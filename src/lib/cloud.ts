import type { Session, User } from "@supabase/supabase-js";
import { requireSupabase, supabase } from "./supabase";
import type { BookPageRow, BookRow, ProfileRow, PurchaseRow, ReadingProgressRow, SubscriptionRow } from "./database.types";

/* =====================================================================
 * Accounts
 * ================================================================== */

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await requireSupabase().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(user: User): Promise<ProfileRow | null> {
  const { data, error } = await requireSupabase().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Google Play requires an in-app path to delete the account. This removes the auth user
 * via an Edge Function running with the service role; rows cascade from auth.users.
 */
export async function deleteAccount() {
  const { error } = await requireSupabase().functions.invoke("delete-account");
  if (error) throw error;
  await signOut();
}

/* =====================================================================
 * Entitlements — the client copy is for showing the right button.
 * The database enforces the real rule on every page read.
 * ================================================================== */

export interface Entitlements {
  purchasedBookIds: Set<string>;
  subscription: SubscriptionRow | null;
  subscribed: boolean;
}

export const EMPTY_ENTITLEMENTS: Entitlements = {
  purchasedBookIds: new Set(),
  subscription: null,
  subscribed: false,
};

export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const sb = requireSupabase();
  const [purchases, subs] = await Promise.all([
    sb.from("purchases").select("book_id").eq("user_id", userId),
    sb
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "grace"])
      .order("current_period_end", { ascending: false })
      .limit(1),
  ]);
  if (purchases.error) throw purchases.error;
  if (subs.error) throw subs.error;
  const subscription = (subs.data?.[0] as SubscriptionRow | undefined) ?? null;
  return {
    purchasedBookIds: new Set((purchases.data ?? []).map((r) => (r as { book_id: string }).book_id)),
    subscription,
    subscribed: Boolean(subscription && new Date(subscription.current_period_end) > new Date()),
  };
}

export function isReadable(book: BookRow, ent: Entitlements): boolean {
  if (book.price_minor === 0) return true;
  if (ent.purchasedBookIds.has(book.id)) return true;
  return book.in_subscription && ent.subscribed;
}

export function formatPrice(book: BookRow): string {
  if (book.price_minor === 0) return "مجاني";
  const major = (book.price_minor / 100).toFixed(2).replace(/\.00$/, "");
  return `${major} ${book.currency === "AED" ? "درهم" : book.currency}`;
}

/* =====================================================================
 * Catalog
 * ================================================================== */

export async function listBooks(): Promise<BookRow[]> {
  const { data, error } = await requireSupabase()
    .from("books")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookRow[];
}

export async function getBook(id: string): Promise<BookRow | null> {
  const { data, error } = await requireSupabase().from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as BookRow | null;
}

/* =====================================================================
 * Pages — never the PDF. One signed URL per page, minted only after the
 * storage policy has checked entitlement, and valid for a few minutes.
 * ================================================================== */

const SIGNED_URL_TTL = 300;

export async function getPageRows(bookId: string, from: number, to: number): Promise<BookPageRow[]> {
  const { data, error } = await requireSupabase()
    .from("book_pages")
    .select("*")
    .eq("book_id", bookId)
    .gte("page", from)
    .lte("page", to)
    .order("page");
  if (error) throw error;
  return (data ?? []) as BookPageRow[];
}

export async function signPageUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data, error } = await requireSupabase().storage.from("book-pages").createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
}

/** Page text for the AI features; the same row-level rule gates it. */
export async function getBookTextCloud(bookId: string, from = 1, to = 100000): Promise<{ page: number; text: string }[]> {
  const { data, error } = await requireSupabase()
    .from("book_pages")
    .select("page,text")
    .eq("book_id", bookId)
    .gte("page", from)
    .lte("page", to)
    .order("page");
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as { page: number; text: string | null };
    return { page: row.page, text: row.text ?? "" };
  });
}

/* =====================================================================
 * Reading progress — synced so a reader resumes on any device
 * ================================================================== */

export async function loadProgress(userId: string): Promise<Map<string, ReadingProgressRow>> {
  const { data, error } = await requireSupabase().from("reading_progress").select("*").eq("user_id", userId);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [(r as ReadingProgressRow).book_id, r as ReadingProgressRow]));
}

export async function saveProgress(userId: string, bookId: string, patch: { last_page?: number; reading_seconds?: number; favorite?: boolean }) {
  const row = { user_id: userId, book_id: bookId, ...patch, updated_at: new Date().toISOString() };
  const { error } = await requireSupabase().from("reading_progress").upsert(row, { onConflict: "user_id,book_id" });
  if (error) throw error;
}

/* =====================================================================
 * Purchases and subscriptions
 *
 * The client never writes these tables — RLS has no insert policy, so a
 * patched app cannot grant itself a book. A receipt goes to an Edge
 * Function which verifies it with Google Play or Stripe and inserts the
 * row with the service role.
 * ================================================================== */

export interface PurchaseReceipt {
  provider: "google_play" | "stripe";
  /** Play: purchaseToken. Stripe: checkout session id. */
  token: string;
  productId: string;
  bookId?: string;
}

export async function redeemReceipt(receipt: PurchaseReceipt): Promise<void> {
  const { error } = await requireSupabase().functions.invoke("verify-purchase", { body: receipt });
  if (error) throw error;
}

export async function myPurchases(userId: string): Promise<PurchaseRow[]> {
  const { data, error } = await requireSupabase().from("purchases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PurchaseRow[];
}
