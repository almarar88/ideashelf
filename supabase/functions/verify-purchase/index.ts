// Verifies a purchase receipt with the payment provider, then grants access.
//
// The client can never write `purchases` or `subscriptions` — row level security has no
// insert policy for them. Only this function, running with the service role, may do it,
// and only after the provider itself confirms the receipt. That is what stops a patched
// app from granting itself a book.
//
// Deploy: supabase functions deploy verify-purchase
// Secrets: GOOGLE_PLAY_SERVICE_ACCOUNT (JSON), ANDROID_PACKAGE_NAME, STRIPE_SECRET_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

interface Body {
  provider: "google_play" | "stripe";
  token: string;
  productId: string;
  bookId?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Exchanges the service-account key for an access token to the Play Developer API. */
async function playAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claim)}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`play token: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await anon.auth.getUser();
  const user = userData.user;
  if (!user) return json(401, { error: "غير مسجّل الدخول" });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "طلب غير صالح" });
  }
  if (!body.token) return json(400, { error: "لا يوجد إيصال شراء" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const isSubscription = body.productId.startsWith("sub_");

  try {
    if (body.provider === "google_play") {
      const sa = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT");
      const pkg = Deno.env.get("ANDROID_PACKAGE_NAME");
      if (!sa || !pkg) return json(501, { error: "لم تُضبط بيانات Google Play على الخادم بعد" });
      const token = await playAccessToken(sa);
      const kind = isSubscription ? "subscriptionsv2/tokens" : `products/${body.productId}/tokens`;
      const url = isSubscription
        ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${body.token}`
        : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/${kind}/${body.token}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return json(402, { error: "تعذر التحقق من عملية الشراء" });
      const receipt = (await res.json()) as Record<string, unknown>;

      if (isSubscription) {
        const line = (receipt.lineItems as { expiryTime?: string }[] | undefined)?.[0];
        const expiry = line?.expiryTime ?? new Date(Date.now() + 30 * 864e5).toISOString();
        const state = String(receipt.subscriptionState ?? "");
        const status = state.includes("ACTIVE") ? "active" : state.includes("GRACE") ? "grace" : state.includes("CANCELED") ? "canceled" : "expired";
        const { error } = await admin.from("subscriptions").upsert(
          {
            user_id: user.id,
            plan: body.productId.replace(/^sub_/, ""),
            provider: "google_play",
            provider_txn: body.token,
            status,
            current_period_end: expiry,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider,provider_txn" },
        );
        if (error) throw error;
      } else {
        if (Number(receipt.purchaseState ?? 1) !== 0) return json(402, { error: "عملية الشراء غير مكتملة" });
        if (!body.bookId) return json(400, { error: "لم يُحدَّد الكتاب" });
        const { error } = await admin.from("purchases").upsert(
          {
            user_id: user.id,
            book_id: body.bookId,
            provider: "google_play",
            provider_txn: body.token,
            amount_minor: Number(receipt.priceAmountMicros ?? 0) / 10000,
            currency: String(receipt.priceCurrencyCode ?? "AED"),
          },
          { onConflict: "provider,provider_txn" },
        );
        if (error) throw error;
      }
      return json(200, { ok: true });
    }

    // Stripe (web only — Play policy does not allow this path inside the Android app)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(501, { error: "لم يُضبط Stripe على الخادم بعد" });
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${body.token}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!res.ok) return json(402, { error: "تعذر التحقق من الدفع" });
    const session = (await res.json()) as { payment_status?: string; amount_total?: number; currency?: string; mode?: string };
    if (session.payment_status !== "paid") return json(402, { error: "لم يكتمل الدفع" });

    if (session.mode === "subscription" || isSubscription) {
      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id: user.id,
          plan: body.productId.replace(/^sub_/, ""),
          provider: "stripe",
          provider_txn: body.token,
          status: "active",
          current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,provider_txn" },
      );
      if (error) throw error;
    } else {
      if (!body.bookId) return json(400, { error: "لم يُحدَّد الكتاب" });
      const { error } = await admin.from("purchases").upsert(
        {
          user_id: user.id,
          book_id: body.bookId,
          provider: "stripe",
          provider_txn: body.token,
          amount_minor: session.amount_total ?? 0,
          currency: (session.currency ?? "aed").toUpperCase(),
        },
        { onConflict: "provider,provider_txn" },
      );
      if (error) throw error;
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "فشل التحقق" });
  }
});
