import { QUESTION_GENERATOR_SYSTEM_PROMPT, buildQuestionSteering } from "../_shared/prompts.ts";
import { CORS, callGemini, json, rateLimit } from "../_shared/gemini.ts";

/**
 * POST /functions/v1/daily-drop
 *
 * Body: { lang, category, angle, avoid[], attempt }
 * Returns: { text } — raw model output. Schema validation happens on the
 * client (and would happen again here before persisting, if you move round
 * creation server-side into a cron job).
 *
 * The caller cannot supply prompt text. Only these structured fields are
 * accepted, so the function's Gemini key can't be turned into a free
 * general-purpose LLM endpoint.
 */

const CATEGORIES = new Set(["loyalty", "money", "travel", "habits", "workplace"]);

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
  const category = typeof body.category === "string" && CATEGORIES.has(body.category)
    ? body.category
    : "habits";
  const angle = typeof body.angle === "string" ? body.angle.slice(0, 200) : "an everyday social split";
  const attempt = Number.isInteger(body.attempt) ? Math.min(5, Math.max(0, body.attempt as number)) : 0;
  const avoid = Array.isArray(body.avoid)
    ? (body.avoid as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 25).map((v) => v.slice(0, 400))
    : [];

  try {
    const text = await callGemini(
      QUESTION_GENERATOR_SYSTEM_PROMPT,
      buildQuestionSteering({ lang, category, angle, avoid, attempt }),
      0.95 + attempt * 0.15,
    );
    return json({ text });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});
