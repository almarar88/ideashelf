// Turns a book page into speech with ElevenLabs, once.
//
// Two reasons this lives on the server and not in the app:
//   1. The ElevenLabs key would otherwise sit on every reader's device.
//   2. Narration is billed per character. Generating a page once and storing it
//      means a page is paid for on its first listen and free for every listener after.
//
// Deploy:  supabase functions deploy narrate
// Secrets: ELEVENLABS_API_KEY, optionally ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_MODEL = "eleven_flash_v2_5"; // Arabic, 40k chars/request, cheapest per character
const DEFAULT_VOICE = Deno.env.get("ELEVENLABS_VOICE_ID") ?? "";
const MONTHLY_CHAR_BUDGET = Number(Deno.env.get("TTS_MONTHLY_CHARS") ?? 400_000);
const SIGNED_TTL = 3600;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Body {
  bookId: string;
  page: number;
  voiceId?: string;
  modelId?: string;
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
  const page = Math.floor(Number(body.page));
  if (!body.bookId || !Number.isFinite(page) || page < 1) return json(400, { error: "صفحة غير صالحة" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Access check runs against the caller's own permissions, not the service role:
  // if this select returns nothing, they are not allowed to read the page, so they
  // are not allowed to hear it either.
  const { data: pageRow } = await anon.from("book_pages").select("text").eq("book_id", body.bookId).eq("page", page).maybeSingle();
  if (!pageRow) return json(403, { error: "هذه الصفحة غير متاحة لك" });

  const text = String((pageRow as { text: string }).text ?? "").trim();
  if (!text) return json(422, { error: "لا يوجد نص في هذه الصفحة" });

  const voiceId = body.voiceId || DEFAULT_VOICE;
  const modelId = body.modelId || DEFAULT_MODEL;
  if (!voiceId) return json(501, { error: "لم يُضبط صوت ElevenLabs على الخادم بعد" });

  const audioPath = `${body.bookId}/${String(page).padStart(4, "0")}-${voiceId}-${modelId}.mp3`;

  const sign = async () => {
    const { data, error } = await admin.storage.from("narration").createSignedUrl(audioPath, SIGNED_TTL);
    if (error) throw error;
    return data.signedUrl;
  };

  // Already narrated? Then nobody pays for it again.
  const { data: existing } = await admin
    .from("narrations")
    .select("audio_path,duration_ms")
    .eq("book_id", body.bookId)
    .eq("page", page)
    .eq("voice_id", voiceId)
    .eq("model_id", modelId)
    .maybeSingle();
  if (existing) return json(200, { url: await sign(), cached: true });

  // Fresh generation is charged to this reader's monthly budget.
  const month = new Date().toISOString().slice(0, 8) + "01";
  const { data: usage } = await admin.from("ai_usage").select("tts_chars").eq("user_id", user.id).eq("month", month).maybeSingle();
  const used = Number((usage as { tts_chars?: number } | null)?.tts_chars ?? 0);
  if (used + text.length > MONTHLY_CHAR_BUDGET) {
    return json(429, { error: "انتهت حصتك الشهرية من القراءة الصوتية." });
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return json(501, { error: "لم يُضبط مفتاح ElevenLabs على الخادم بعد" });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: "ar",
      voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: 1.0 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(502, { error: `تعذر توليد الصوت (${res.status})`, detail: detail.slice(0, 300) });
  }

  const audio = new Uint8Array(await res.arrayBuffer());
  const up = await admin.storage.from("narration").upload(audioPath, audio, { contentType: "audio/mpeg", upsert: true });
  if (up.error) return json(500, { error: up.error.message });

  await admin.from("narrations").upsert({
    book_id: body.bookId,
    page,
    voice_id: voiceId,
    model_id: modelId,
    audio_path: audioPath,
    chars: text.length,
  });
  await admin.from("ai_usage").upsert(
    { user_id: user.id, month, tts_chars: used + text.length },
    { onConflict: "user_id,month" },
  );

  return json(200, { url: await sign(), cached: false });
});
