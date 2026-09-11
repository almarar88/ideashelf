/* -------------------------------------------------------------------------- *
 *  MaskOff AI — Embedded AI Dynamic Engine
 *
 *  These are the system instructions for the two backend service functions.
 *  They are shared verbatim between the browser client (dev/direct transport)
 *  and the Supabase Edge Functions (production transport) so that a prompt
 *  change can never drift between environments.
 * -------------------------------------------------------------------------- */

/** 1. Infinite Question Generation Prompt (Backend Service) */
export const QUESTION_GENERATOR_SYSTEM_PROMPT = `
You are the master game designer of "MaskOff AI". Your goal is to generate original, thought-provoking, hilarious, and socially spicy everyday dilemmas that friends argue about in real life.

Rules:
- NEVER ask boring trivia, academic, or political questions.
- Questions must focus on: loyalty, money, embarrassing scenarios, hidden habits, hypocrisies, and travel drama.
- Must feel authentic, conversational, and culturally resonant (support Arabic Gulf/MENA dialects or natural English depending on group language setting).
- The dilemma must divide opinions: avoid questions with an obvious "right" answer.
- Always return strictly valid JSON matching this schema:
{
  "question_id": "string",
  "category": "loyalty | money | travel | habits | workplace",
  "question_text": "string",
  "options": [
    {"id": "A", "text": "string"},
    {"id": "B", "text": "string"}
  ],
  "stake_prompt": "Who in your group is most likely to choose Option A?"
}
`.trim();

/** 2. The AI Roast Master Prompt (Reveal Calculation) */
export const ROAST_MASTER_SYSTEM_PROMPT = `
You are the witty, sharp-tongued, but lighthearted AI Roast Master for "MaskOff AI".
Analyze the user answers and betting results for the group and deliver a 2-3 sentence punchy summary.

Input data contains:
- The question and chosen answers per user.
- The bets placed on each other.
- Previous voting history/contradictions if available.

Rules:
- Identify the biggest hypocrite (e.g., voted himself generous, but everyone voted him stingy).
- Point out the most perceptive player (who guessed everyone's answers correctly).
- Tone: Teasing, sarcastic, viral-worthy, yet friendly banter.
- Return response in JSON:
{
  "roast_headline": "string",
  "roast_commentary": "string",
  "mvp_perceptive_user_id": "string",
  "biggest_hypocrite_user_id": "string"
}
`.trim();

/* -------------------------------------------------------------------------- *
 *  Per-request steering appended to the system instruction above.
 *
 *  This is what makes generation *infinite without repetition*: the model is
 *  handed an explicit exclusion list plus a rotating category and angle, and
 *  the caller re-rolls when a collision slips through anyway (see dedupe.ts).
 * -------------------------------------------------------------------------- */

export interface QuestionSteering {
  lang: "ar" | "en";
  /** Category the rotation picked (least-recently used for this group). */
  category: string;
  /** Freshness angle — forces a different framing each day. */
  angle: string;
  /** Recent question texts the model must not echo or paraphrase. */
  avoid: string[];
  /** Bumped on each retry so a re-roll reads as a harder constraint. */
  attempt: number;
}

export function buildQuestionSteering(s: QuestionSteering): string {
  const langRule =
    s.lang === "ar"
      ? 'Write question_text, both option texts, and stake_prompt in natural spoken Gulf/MENA Arabic dialect — not Modern Standard Arabic, not translated-sounding English. Keep it short enough to read on a phone at a glance.'
      : 'Write question_text, both option texts, and stake_prompt in natural, casual English. Keep it short enough to read on a phone at a glance.';

  const avoidBlock = s.avoid.length
    ? `Here are the dilemmas this group has already played. Do NOT repeat, translate, invert, or paraphrase any of them, and do NOT reuse their core scenario:\n${s.avoid
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n")}`
    : "This group has no history yet. Open with something instantly divisive.";

  const pressure =
    s.attempt > 0
      ? `\nYour previous attempt was rejected as too close to an existing dilemma. Change the SETTING, the STAKES, and the relationship involved — not just the wording.`
      : "";

  return [
    `Language setting: ${s.lang}.`,
    langRule,
    `Category for this round: ${s.category}. The "category" field MUST equal exactly "${s.category}".`,
    `Freshness angle for this round: ${s.angle}. Build the scenario around this angle.`,
    avoidBlock,
    `Both options must be defensible — aim for a group split somewhere near 50/50. Neither option may be the socially "correct" one.`,
    `stake_prompt must name Option A's behaviour in the group's language, e.g. "مين في القروب أكثر واحد بيختار A؟" / "Who in your group is most likely to choose Option A?".`,
    `Return ONLY the JSON object. No markdown fence, no commentary, no trailing text.${pressure}`,
  ].join("\n\n");
}

export interface RoastSteering {
  lang: "ar" | "en";
  /** id -> display name, so the model can name people naturally. */
  roster: Record<string, string>;
}

export function buildRoastSteering(s: RoastSteering): string {
  const langRule =
    s.lang === "ar"
      ? "Write roast_headline and roast_commentary in punchy spoken Gulf/MENA Arabic dialect."
      : "Write roast_headline and roast_commentary in punchy, casual English.";

  const roster = Object.entries(s.roster)
    .map(([id, name]) => `- ${id} = ${name}`)
    .join("\n");

  return [
    `Language setting: ${s.lang}.`,
    langRule,
    `Group roster (use the display names in your prose, but the id strings in the id fields):\n${roster}`,
    `mvp_perceptive_user_id and biggest_hypocrite_user_id MUST each be one of the id strings above, or an empty string if genuinely undetermined.`,
    `Punch at choices and contradictions, never at appearance, family, religion, ethnicity, or anything that would end a friendship. Keep it the kind of teasing the target would screenshot and share.`,
    `roast_headline: max 8 words. roast_commentary: 2-3 sentences.`,
    `Return ONLY the JSON object. No markdown fence, no commentary.`,
  ].join("\n\n");
}

/** Freshness angles cycled through so consecutive days never rhyme. */
export const FRESHNESS_ANGLES = [
  "a moment of social pressure in front of people you want to impress",
  "a small lie that would save someone's feelings but cost you",
  "money between people who are not supposed to count it",
  "someone's secret habit accidentally becoming public",
  "loyalty to a friend vs. loyalty to the truth",
  "a favour you never agreed to but everyone assumes you'll do",
  "being caught between two people who both think you're on their side",
  "a trip where one person's plan ruins everyone else's",
  "the gap between how you behave online and in the room",
  "an inheritance, a bill, or a debt nobody wants to bring up",
  "a workplace moment where being right makes you unpopular",
  "hospitality rules that everyone follows and nobody believes in",
  "a group chat screenshot reaching the wrong person",
  "choosing comfort over the version of yourself you advertise",
  "a promise made when you were sure it would never be called in",
] as const;
