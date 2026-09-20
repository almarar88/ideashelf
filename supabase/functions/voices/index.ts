// Lists the voices available on the project's ElevenLabs account so the app can
// offer a real picker instead of hard-coded voice ids that may not exist.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data } = await anon.auth.getUser();
  if (!data.user) return new Response(JSON.stringify({ error: "غير مسجّل الدخول" }), { status: 401 });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ voices: [] }), { status: 200, headers: { "content-type": "application/json" } });

  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
  if (!res.ok) return new Response(JSON.stringify({ voices: [] }), { status: 200, headers: { "content-type": "application/json" } });
  const body = (await res.json()) as { voices?: { voice_id: string; name: string; labels?: Record<string, string> }[] };
  const voices = (body.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels ?? {} }));
  return new Response(JSON.stringify({ voices }), { status: 200, headers: { "content-type": "application/json" } });
});
