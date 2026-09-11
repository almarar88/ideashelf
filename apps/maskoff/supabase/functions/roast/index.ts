import { ROAST_MASTER_SYSTEM_PROMPT, buildRoastSteering } from "../_shared/prompts.ts";
import { CORS, callGemini, json, rateLimit } from "../_shared/gemini.ts";

/**
 * POST /functions/v1/roast
 *
 * Body: { lang, roster: {id: name}, round: <computed round summary> }
 * Returns: { text } — raw model output, validated against the roast schema by
 * the caller before it is shown or stored.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const caller = auth.slice(7, 40);
  if (!rateLimit(caller, 12, 60_000)) return json({ error: "rate limited" }, 429);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const lang = body.lang === "en" ? "en" : "ar";

  // Roster is user-authored display names. Bound the size and length so a
  // long name can't be used to smuggle instructions past the system prompt.
  const roster: Record<string, string> = {};
  if (body.roster && typeof body.roster === "object") {
    for (const [id, name] of Object.entries(body.roster as Record<string, unknown>).slice(0, 24)) {
      if (typeof name === "string") roster[id.slice(0, 64)] = name.slice(0, 40);
    }
  }
  if (Object.keys(roster).length === 0) return json({ error: "roster is required" }, 400);

  const round = JSON.stringify(body.round ?? {}).slice(0, 12_000);

  try {
    const text = await callGemini(
      ROAST_MASTER_SYSTEM_PROMPT,
      `${buildRoastSteering({ lang, roster })}\n\nRound data:\n${round}`,
      1.0,
    );
    return json({ text });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});
