import type { Category, Question } from "@/types/game";
import { CATEGORIES } from "@/types/game";
import { FRESHNESS_ANGLES } from "./prompts";

/**
 * Anti-repetition engine.
 *
 * "Infinite questions" only holds if the *same* question never comes back.
 * Prompting alone does not guarantee that, so generation is wrapped in a
 * three-part defence:
 *
 *   1. Rotation   — pick the least-recently-used category and a rotating
 *                   freshness angle, so consecutive days cannot rhyme.
 *   2. Exclusion  — hand the model the recent question texts explicitly.
 *   3. Rejection  — fingerprint what comes back and re-roll on a collision.
 *
 * The fingerprint is a normalized content-word set, so it catches trivial
 * rewording ("would you lend your brother money" vs "would you lend money to
 * your brother") without needing an embedding model on the critical path.
 */

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Words carrying no topical signal in either language. */
const STOPWORDS = new Set([
  // English
  "the","a","an","and","or","but","if","of","to","in","on","for","with","your","you","i","me","my",
  "is","are","was","were","be","been","do","does","did","would","could","should","will","that","this",
  "it","its","at","as","by","from","who","what","when","where","how","why","not","no","yes","more",
  "most","than","then","them","they","he","she","we","us","our","their","his","her","one","about",
  // Arabic (common function words)
  "في","من","على","الى","إلى","عن","مع","او","أو","و","لو","ان","أن","إن","انت","أنت","انا","أنا",
  "هو","هي","هم","هن","نحن","الذي","التي","ما","ماذا","مين","وش","شنو","ليش","كيف","وين","متى",
  "هل","لا","نعم","كان","يكون","تكون","اللي","عشان","علشان","بس","كل","اي","أي","هذا","هذه","ذلك",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light Arabic stemming: strip the leading conjunction (و/ف) and the definite
 * article (ال). Without this, "المال" and "مال" are different tokens and two
 * dilemmas about the same subject look unrelated — which is exactly the
 * collision the dedupe engine exists to catch.
 *
 * Length guards keep it from mangling short words that merely begin with those
 * letters (ولد, الم), at the cost of missing a few genuine clitics.
 */
function stripClitics(word: string): string {
  let out = word;
  if (/^[وف]/.test(out) && out.length >= 5) out = out.slice(1);
  if (out.startsWith("ال") && out.length >= 5) out = out.slice(2);
  return out;
}

export function contentTokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .map(stripClitics)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of content words, 0..1. */
export function similarity(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

/** Above this overlap, two dilemmas are "the same question again". */
export const DUPLICATE_THRESHOLD = 0.45;

export function isDuplicate(candidate: Question, history: string[]): boolean {
  return history.some((past) => similarity(candidate.question_text, past) >= DUPLICATE_THRESHOLD);
}

/** Least-recently-used category, so all five stay in rotation. */
export function nextCategory(recent: Category[]): Category {
  const lastSeen = new Map<Category, number>();
  recent.forEach((category, index) => lastSeen.set(category, index));
  let best: Category = CATEGORIES[0];
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const category of CATEGORIES) {
    const index = lastSeen.has(category) ? lastSeen.get(category)! : -1;
    if (index < bestIndex) {
      bestIndex = index;
      best = category;
    }
  }
  return best;
}

/** Deterministic angle rotation keyed by round count — never random-repeats. */
export function nextAngle(roundNumber: number, attempt: number): string {
  const index = (roundNumber * 7 + attempt * 3) % FRESHNESS_ANGLES.length;
  return FRESHNESS_ANGLES[index];
}

/** Keep history bounded; old enough questions may fairly come round again. */
export const HISTORY_WINDOW = 120;

export function pushHistory(history: string[], text: string): string[] {
  return [text, ...history].slice(0, HISTORY_WINDOW);
}
