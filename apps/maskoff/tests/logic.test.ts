import assert from "node:assert/strict";
import { test } from "node:test";

import { countdown, currentSchedule, dayKey, estimateOffset, localHourToEpoch, phaseFor } from "../src/lib/time.ts";
import { computeResults, derivePersona } from "../src/lib/scoring.ts";
import { contentTokens, isDuplicate, nextCategory, similarity } from "../src/ai/dedupe.ts";
import { extractJsonObject, parseStrict, SchemaViolationError } from "../src/ai/json.ts";
import { zQuestion, zRoast } from "../src/types/game.ts";
import { fallbackQuestion, fallbackRoast } from "../src/ai/fallbacks.ts";
import type { Group, Round } from "../src/types/game.ts";

/* -------------------------------------------------------------------------- */
/*  Schedule                                                                  */
/* -------------------------------------------------------------------------- */

test("localHourToEpoch resolves 20:00 in a fixed-offset zone", () => {
  // Asia/Riyadh is UTC+3 year-round, so 20:00 local is 17:00Z.
  const epoch = localHourToEpoch("2026-03-15", 20, "Asia/Riyadh");
  assert.equal(new Date(epoch).toISOString(), "2026-03-15T17:00:00.000Z");
});

test("localHourToEpoch survives a DST transition", () => {
  // Europe/London: 2026-03-29 is the spring-forward day. 20:00 local is BST
  // (UTC+1), so 19:00Z — not 20:00Z as a naive conversion would give.
  const epoch = localHourToEpoch("2026-03-29", 20, "Europe/London");
  assert.equal(new Date(epoch).toISOString(), "2026-03-29T19:00:00.000Z");

  // The day before is still GMT.
  const before = localHourToEpoch("2026-03-28", 20, "Europe/London");
  assert.equal(new Date(before).toISOString(), "2026-03-28T20:00:00.000Z");
});

test("dayKey uses the group timezone, not the host's", () => {
  // 22:30Z on the 14th is already the 15th in Riyadh (UTC+3).
  const instant = Date.parse("2026-03-14T22:30:00Z");
  assert.equal(dayKey(instant, "Asia/Riyadh"), "2026-03-15");
  assert.equal(dayKey(instant, "UTC"), "2026-03-14");
});

test("phaseFor walks locked -> open -> revealed", () => {
  const schedule = currentSchedule(Date.parse("2026-03-15T10:00:00Z"), "Asia/Riyadh", 20, 21);
  assert.equal(phaseFor(schedule.dropAt - 1, schedule), "locked");
  assert.equal(phaseFor(schedule.dropAt, schedule), "open");
  assert.equal(phaseFor(schedule.revealAt - 1, schedule), "open");
  assert.equal(phaseFor(schedule.revealAt, schedule), "revealed");
});

test("estimateOffset attributes half the round trip to the response leg", () => {
  // Client sends at 1000, server says 5000, reply lands at 1200.
  // True offset is ~3900 (5000 + 100 - 1200).
  assert.equal(estimateOffset(1000, 5000, 1200), 3900);
});

test("countdown never goes negative", () => {
  const c = countdown(1000, 5000);
  assert.equal(c.totalMs, 0);
  assert.deepEqual([c.hours, c.minutes, c.seconds], [0, 0, 0]);
});

/* -------------------------------------------------------------------------- */
/*  Scoring                                                                   */
/* -------------------------------------------------------------------------- */

function makeGroup(memberCount: number, streak = 0): Group {
  return {
    id: "g",
    name: "g",
    inviteCode: "X",
    lang: "en",
    timezone: "UTC",
    dropHour: 20,
    revealHour: 21,
    streak,
    lastPerfectDay: null,
    members: Array.from({ length: memberCount }, (_, i) => ({
      id: `u${i}`,
      name: `U${i}`,
      emoji: "🙂",
      accent: "neon" as const,
    })),
  };
}

function makeRound(group: Group, answers: Record<string, "A" | "B">, stakes: Record<string, Record<string, "A" | "B">>): Round {
  return {
    id: "r",
    day: "2026-03-15",
    groupId: group.id,
    question: fallbackQuestion("en", [], 0),
    dropAt: 0,
    revealAt: 1,
    roast: null,
    roastIsFallback: false,
    submissions: Object.fromEntries(
      Object.entries(answers).map(([userId, choice]) => [
        userId,
        { userId, choice, stakes: stakes[userId] ?? {}, submittedAt: 0 },
      ]),
    ),
  };
}

test("a perfect read scores participation + stakes + bonus", () => {
  const group = makeGroup(3);
  const round = makeRound(
    group,
    { u0: "A", u1: "A", u2: "B" },
    { u0: { u1: "A", u2: "B" }, u1: { u0: "B", u2: "B" }, u2: { u0: "B", u1: "B" } },
  );

  const results = computeResults(round, group);
  const u0 = results.perPlayer.find((p) => p.userId === "u0")!;

  // u0 read both others correctly: 10 + 2*25 + 50 = 110.
  assert.equal(u0.correctStakes, 2);
  assert.equal(u0.perfectRead, true);
  assert.equal(u0.points, 110);
  assert.equal(results.mvpUserId, "u0");
});

test("streak multiplies points and is capped at 2x", () => {
  const group = makeGroup(3, 40); // 1 + 40*0.1 = 5x, clamped to 2x
  const round = makeRound(
    group,
    { u0: "A", u1: "A", u2: "B" },
    { u0: { u1: "A", u2: "B" }, u1: {}, u2: {} },
  );
  const u0 = computeResults(round, group).perPlayer.find((p) => p.userId === "u0")!;
  assert.equal(u0.points, 220); // 110 * 2
});

test("stakes on members who never submitted are not graded", () => {
  const group = makeGroup(3);
  const round = makeRound(group, { u0: "A", u1: "A" }, { u0: { u1: "A", u2: "B" } });
  const u0 = computeResults(round, group).perPlayer.find((p) => p.userId === "u0")!;
  assert.equal(u0.totalStakes, 1); // u2 is ungradable
  assert.equal(u0.perfectRead, true);
});

test("a non-submitter scores zero and is not the hypocrite", () => {
  const group = makeGroup(3);
  const round = makeRound(group, { u0: "A", u1: "A" }, { u0: { u1: "A" }, u1: { u0: "A" } });
  const results = computeResults(round, group);
  const u2 = results.perPlayer.find((p) => p.userId === "u2")!;
  assert.equal(u2.points, 0);
  assert.equal(u2.choice, null);
  assert.notEqual(results.hypocriteUserId, "u2");
});

test("nobody is MVP when no read was correct", () => {
  const group = makeGroup(2);
  const round = makeRound(group, { u0: "A", u1: "B" }, { u0: { u1: "A" }, u1: { u0: "B" } });
  assert.equal(computeResults(round, group).mvpUserId, null);
});

test("the hypocrite is whoever the most people misread", () => {
  const group = makeGroup(3);
  // Everyone bets u2 picks A; u2 picks B.
  const round = makeRound(
    group,
    { u0: "A", u1: "A", u2: "B" },
    { u0: { u2: "A" }, u1: { u2: "A" }, u2: {} },
  );
  assert.equal(computeResults(round, group).hypocriteUserId, "u2");
});

test("derivePersona reads the stats it is given", () => {
  assert.equal(
    derivePersona({ userId: "u", rounds: 0, points: 0, readAccuracy: 0, predictability: 0, contrarianRate: 0 }).archetype,
    "ghost",
  );
  assert.equal(
    derivePersona({ userId: "u", rounds: 5, points: 1, readAccuracy: 0.8, predictability: 0.5, contrarianRate: 0.2 }).archetype,
    "mind_reader",
  );
  assert.equal(
    derivePersona({ userId: "u", rounds: 5, points: 1, readAccuracy: 0.2, predictability: 0.2, contrarianRate: 0.6 }).archetype,
    "wildcard",
  );
  assert.equal(
    derivePersona({ userId: "u", rounds: 5, points: 1, readAccuracy: 0.3, predictability: 0.9, contrarianRate: 0.3 }).archetype,
    "open_book",
  );
});

/* -------------------------------------------------------------------------- */
/*  Anti-repetition                                                           */
/* -------------------------------------------------------------------------- */

test("similarity catches reworded duplicates", () => {
  const a = "Would you lend your brother a large amount of money?";
  const b = "Would you lend a large amount of money to your brother?";
  assert.ok(similarity(a, b) > 0.8, `expected high similarity, got ${similarity(a, b)}`);
});

test("similarity separates genuinely different dilemmas", () => {
  const a = "Would you lend your brother a large amount of money?";
  const b = "Do you wait for the friend who is always an hour late?";
  assert.ok(similarity(a, b) < 0.2, `expected low similarity, got ${similarity(a, b)}`);
});

test("Arabic normalization folds spelling variants and clitics", () => {
  // أ/ا, ة/ه, and the و+ال clitics all collapse to one token.
  assert.equal(contentTokens("الأمانة والامانه").size, 1);

  // The definite article must not make a word look like a different topic.
  assert.ok(similarity("تستلف المال من صاحبك", "تستلف مال من صاحبك") > 0.9);
});

test("clitic stripping leaves short words alone", () => {
  // ولد is a word, not "و" + "لد" — the length guard must protect it.
  assert.ok(contentTokens("ولد صغير").has("ولد"));
});

test("isDuplicate rejects a paraphrase of a played question", () => {
  const played = ["Would you lend your brother a large amount of money?"];
  const candidate = fallbackQuestion("en", [], 0);
  assert.equal(isDuplicate({ ...candidate, question_text: "Would you lend a large amount of money to your brother?" }, played), true);
  assert.equal(isDuplicate({ ...candidate, question_text: "Who takes the couch in the rental?" }, played), false);
});

test("nextCategory picks the least recently used", () => {
  // recent is newest-first; 'workplace' has never appeared.
  assert.equal(nextCategory(["loyalty", "money", "travel", "habits"]), "workplace");
});

test("the fallback bank avoids what was already played", () => {
  const first = fallbackQuestion("en", [], 0);
  const second = fallbackQuestion("en", [first.question_text], 1);
  assert.notEqual(first.question_text, second.question_text);
});

/* -------------------------------------------------------------------------- */
/*  Strict JSON handling                                                      */
/* -------------------------------------------------------------------------- */

const VALID_QUESTION = JSON.stringify({
  question_id: "q1",
  category: "money",
  question_text: "Split the bill evenly or pay your own?",
  options: [
    { id: "A", text: "Split evenly" },
    { id: "B", text: "Pay your own" },
  ],
  stake_prompt: "Who in your group is most likely to choose Option A?",
});

test("extractJsonObject unwraps a markdown fence", () => {
  const parsed = extractJsonObject("```json\n{\"a\":1}\n```") as { a: number };
  assert.equal(parsed.a, 1);
});

test("extractJsonObject recovers an object after a stray sentence", () => {
  const parsed = extractJsonObject('Sure! Here you go: {"a":2}') as { a: number };
  assert.equal(parsed.a, 2);
});

test("extractJsonObject throws on genuinely unparseable output", () => {
  assert.throws(() => extractJsonObject("I'd rather not answer that."), SyntaxError);
});

test("parseStrict accepts a well-formed question", () => {
  const question = parseStrict(VALID_QUESTION, zQuestion);
  assert.equal(question.category, "money");
  assert.equal(question.options[1].id, "B");
});

test("parseStrict rejects an unknown category", () => {
  const bad = VALID_QUESTION.replace('"money"', '"politics"');
  assert.throws(() => parseStrict(bad, zQuestion), SchemaViolationError);
});

test("parseStrict rejects a three-option question", () => {
  const bad = JSON.parse(VALID_QUESTION);
  bad.options.push({ id: "A", text: "third" });
  assert.throws(() => parseStrict(JSON.stringify(bad), zQuestion), SchemaViolationError);
});

test("parseStrict rejects a roast missing a required field", () => {
  const bad = JSON.stringify({ roast_headline: "Hi", roast_commentary: "Long enough to pass." });
  assert.throws(() => parseStrict(bad, zRoast), SchemaViolationError);
});

/* -------------------------------------------------------------------------- */
/*  Fallbacks                                                                 */
/* -------------------------------------------------------------------------- */

test("every fallback question validates against the live schema", () => {
  for (const lang of ["ar", "en"] as const) {
    for (let i = 0; i < 20; i += 1) {
      const question = fallbackQuestion(lang, [], i);
      assert.doesNotThrow(() => zQuestion.parse(question), `${lang} #${i} failed schema`);
    }
  }
});

test("the fallback roast validates and names the computed winners", () => {
  const group = makeGroup(3);
  const round = makeRound(
    group,
    { u0: "A", u1: "A", u2: "B" },
    { u0: { u1: "A", u2: "B" }, u1: { u0: "A", u2: "A" }, u2: {} },
  );
  const results = computeResults(round, group);
  const roast = fallbackRoast("en", results, { u0: "U0", u1: "U1", u2: "U2" });
  assert.doesNotThrow(() => zRoast.parse(roast));
  assert.equal(roast.mvp_perceptive_user_id, results.mvpUserId ?? "");
});
