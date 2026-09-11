/**
 * Server-side Gemini call. Runs in Deno on Supabase Edge Functions.
 * GEMINI_API_KEY is a function secret and never reaches a browser.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  temperature: number,
  model = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-flash",
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set for this function");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`gemini ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("");
    if (!text) throw new Error("gemini returned no candidate text");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export const CORS = {
  "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

/**
 * Cheap per-caller throttle held in function memory. Edge Functions are not
 * guaranteed to share an instance, so this bounds abuse rather than
 * eliminating it — put a real rate limit in front for production traffic.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}
