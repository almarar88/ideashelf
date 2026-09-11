import { zQuestion, zRoast, type Category, type Lang, type Question, type Roast, type RoundResults } from "@/types/game";
import { parseStrict } from "./json";
import { isDuplicate, nextAngle, nextCategory } from "./dedupe";
import { fallbackQuestion, fallbackRoast } from "./fallbacks";
import {
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  ROAST_MASTER_SYSTEM_PROMPT,
  buildQuestionSteering,
  buildRoastSteering,
} from "./prompts";

/* -------------------------------------------------------------------------- *
 *  AIClient — the only module allowed to talk to a model.
 *
 *  Transports:
 *    edge   — POST to a Supabase Edge Function. The Gemini key never leaves
 *             the server. This is the only production-safe option.
 *    direct — call generativelanguage.googleapis.com from the browser using
 *             VITE_DEV_GEMINI_API_KEY. Local development only: a key shipped
 *             to a browser is a published key.
 *    off    — never touch the network; always serve the offline bank.
 *
 *  Every path is total: callers always receive a valid, schema-checked object.
 * -------------------------------------------------------------------------- */

export type AiTransport = "edge" | "direct" | "off";

export interface AiConfig {
  transport: AiTransport;
  model: string;
  /** Base URL of the Edge Functions host (edge transport). */
  functionsUrl?: string;
  /** Bearer token forwarded to the Edge Function (Supabase anon/session key). */
  authToken?: string;
  /** DEV ONLY. */
  devApiKey?: string;
}

export interface GenerationOutcome<T> {
  value: T;
  /** True when the model path failed and the offline bank answered instead. */
  fromFallback: boolean;
  /** Populated when something went wrong, for telemetry / the debug drawer. */
  error?: string;
  attempts: number;
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/**
 * Structured request sent to an Edge Function. The client never sends prompt
 * text: the function builds the instructions from its own copy of prompts.ts.
 * Otherwise anyone holding the public anon key could drive our Gemini quota
 * with arbitrary prompts.
 */
type EdgeRequest =
  | { kind: "question"; lang: Lang; category: string; angle: string; avoid: string[]; attempt: number }
  | { kind: "roast"; lang: Lang; roster: Record<string, string>; round: unknown };

async function callEdge(config: AiConfig, request: EdgeRequest): Promise<string> {
  if (!config.functionsUrl) throw new Error("edge transport requires functionsUrl");
  const path = request.kind === "question" ? "daily-drop" : "roast";
  const { signal, done } = withTimeout(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.functionsUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(config.authToken ? { authorization: `Bearer ${config.authToken}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`edge function ${response.status}: ${await response.text()}`);
    const payload = (await response.json()) as { text?: string };
    if (typeof payload.text !== "string") throw new Error("edge function returned no text field");
    return payload.text;
  } finally {
    done();
  }
}

/** DEV ONLY: browser -> Gemini, using a key that is public by definition. */
async function callGeminiDirect(
  config: AiConfig,
  systemInstruction: string,
  userPrompt: string,
  temperature: number,
): Promise<string> {
  if (!config.devApiKey) throw new Error("direct transport requires devApiKey");
  const { signal, done } = withTimeout(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${config.model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": config.devApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          // Ask for JSON at the transport level too — belt and braces with the
          // prompt instruction and the schema check downstream.
          responseMimeType: "application/json",
          maxOutputTokens: 1024,
        },
      }),
    });
    if (!response.ok) throw new Error(`gemini ${response.status}: ${await response.text()}`);
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("gemini returned no candidate text");
    return text;
  } finally {
    done();
  }
}

export interface QuestionRequest {
  lang: Lang;
  /** Recent question texts for this group, newest first. */
  history: string[];
  /** Recent categories, newest first — drives least-recently-used rotation. */
  recentCategories: Category[];
  /** Monotonic round index for this group. */
  roundNumber: number;
}

/**
 * Generate the day's dilemma.
 *
 * Retries on: network failure, malformed JSON, schema violation, wrong
 * category, and — the interesting one — a near-duplicate of something the
 * group already played.
 */
export async function generateQuestion(
  config: AiConfig,
  request: QuestionRequest,
): Promise<GenerationOutcome<Question>> {
  const category = nextCategory(request.recentCategories);
  let lastError: string | undefined;
  let attempts = 0;

  if (config.transport !== "off") {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt + 1;
      try {
        const steering = {
          lang: request.lang,
          category,
          angle: nextAngle(request.roundNumber, attempt),
          avoid: request.history.slice(0, 25),
          attempt,
        };

        const raw =
          config.transport === "edge"
            ? await callEdge(config, { kind: "question", ...steering })
            : await callGeminiDirect(
                config,
                QUESTION_GENERATOR_SYSTEM_PROMPT,
                buildQuestionSteering(steering),
                // Climb on retry: the first try should be coherent, later
                // tries need to break out of whatever groove produced the
                // duplicate.
                0.95 + attempt * 0.15,
              );

        const question = parseStrict(raw, zQuestion);

        if (question.options[0].id !== "A" || question.options[1].id !== "B") {
          throw new Error("options must be exactly [A, B] in order");
        }
        if (question.options[0].text.trim() === question.options[1].text.trim()) {
          throw new Error("options are identical");
        }
        if (isDuplicate(question, request.history)) {
          throw new Error("generated dilemma duplicates a previous round");
        }

        return { value: question, fromFallback: false, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return {
    value: fallbackQuestion(request.lang, request.history, request.roundNumber),
    fromFallback: true,
    error: lastError ?? "transport off",
    attempts,
  };
}

export interface RoastRequest {
  lang: Lang;
  question: Question;
  /** id -> display name. */
  roster: Record<string, string>;
  results: RoundResults;
  /** Compact per-player payload: own answer + the bets placed on them. */
  breakdown: {
    userId: string;
    choice: "A" | "B" | null;
    betsPlaced: { targetId: string; guess: "A" | "B"; correct: boolean }[];
    betsReceived: { fromId: string; guess: "A" | "B"; correct: boolean }[];
  }[];
  /** Optional contradiction notes from earlier rounds. */
  contradictions: string[];
}

export async function generateRoast(
  config: AiConfig,
  request: RoastRequest,
): Promise<GenerationOutcome<Roast>> {
  const validIds = new Set(Object.keys(request.roster));
  let lastError: string | undefined;
  let attempts = 0;

  if (config.transport !== "off") {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt + 1;
      try {
        const payload = {
          question: {
            text: request.question.question_text,
            category: request.question.category,
            option_a: request.question.options[0].text,
            option_b: request.question.options[1].text,
          },
          players: request.breakdown,
          computed: {
            tally: request.results.tally,
            most_perceptive_candidate: request.results.mvpUserId,
            most_misread_candidate: request.results.hypocriteUserId,
          },
          previous_contradictions: request.contradictions,
        };

        const raw =
          config.transport === "edge"
            ? await callEdge(config, {
                kind: "roast",
                lang: request.lang,
                roster: request.roster,
                round: payload,
              })
            : await callGeminiDirect(
                config,
                ROAST_MASTER_SYSTEM_PROMPT,
                `${buildRoastSteering({ lang: request.lang, roster: request.roster })}\n\nRound data:\n${JSON.stringify(payload, null, 2)}`,
                1.0 + attempt * 0.1,
              );

        const roast = parseStrict(raw, zRoast);

        // The model must not invent people. An unknown id is a hard reject on
        // the first pass; on the last pass we repair it rather than lose the
        // roast entirely.
        const mvpOk = roast.mvp_perceptive_user_id === "" || validIds.has(roast.mvp_perceptive_user_id);
        const hypOk = roast.biggest_hypocrite_user_id === "" || validIds.has(roast.biggest_hypocrite_user_id);
        if (!mvpOk || !hypOk) {
          if (attempt < MAX_ATTEMPTS - 1) throw new Error("roast referenced an unknown user id");
          roast.mvp_perceptive_user_id = mvpOk ? roast.mvp_perceptive_user_id : request.results.mvpUserId ?? "";
          roast.biggest_hypocrite_user_id = hypOk
            ? roast.biggest_hypocrite_user_id
            : request.results.hypocriteUserId ?? "";
        }

        return { value: roast, fromFallback: false, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return {
    value: fallbackRoast(request.lang, request.results, request.roster),
    fromFallback: true,
    error: lastError ?? "transport off",
    attempts,
  };
}

/** Read transport config from Vite env, refusing unsafe combinations. */
export function aiConfigFromEnv(authToken?: string): AiConfig {
  const env = import.meta.env;
  const requested = (env.VITE_AI_TRANSPORT ?? "off") as AiTransport;
  const model = env.VITE_GEMINI_MODEL || "gemini-1.5-flash";
  const devApiKey = env.VITE_DEV_GEMINI_API_KEY || undefined;

  let transport: AiTransport = requested;
  if (transport === "direct") {
    if (import.meta.env.PROD) {
      // Refuse to ship a browser-side API key, whatever the .env says.
      console.error("[MaskOff] VITE_AI_TRANSPORT=direct is dev-only; falling back to 'off'.");
      transport = "off";
    } else if (!devApiKey) {
      transport = "off";
    }
  }
  if (transport === "edge" && !env.VITE_SUPABASE_URL) transport = "off";

  return {
    transport,
    model,
    functionsUrl: env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL}/functions/v1` : undefined,
    authToken: authToken ?? env.VITE_SUPABASE_ANON_KEY,
    devApiKey,
  };
}
