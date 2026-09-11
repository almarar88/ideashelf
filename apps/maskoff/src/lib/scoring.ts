import {
  SCORING,
  type Group,
  type OptionId,
  type Persona,
  type PersonaStats,
  type PlayerResult,
  type Round,
  type RoundResults,
} from "@/types/game";

/**
 * Pure scoring. Deliberately free of any I/O so the same function runs on the
 * client for the optimistic reveal and on the server for the authoritative
 * one — a mismatch here would be visible as points changing after the reveal.
 */
export function computeResults(round: Round, group: Group): RoundResults {
  const members = group.members;
  const submissions = round.submissions;

  const tally: Record<OptionId, string[]> = { A: [], B: [] };
  for (const member of members) {
    const choice = submissions[member.id]?.choice;
    if (choice) tally[choice].push(member.id);
  }

  const streakMultiplier = Math.min(
    SCORING.streakCapMultiplier,
    1 + group.streak * SCORING.streakStep,
  );

  const perPlayer: PlayerResult[] = members.map((member) => {
    const submission = submissions[member.id];
    if (!submission) {
      return {
        userId: member.id,
        choice: null,
        correctStakes: 0,
        totalStakes: 0,
        perfectRead: false,
        points: 0,
        misreadBy: 0,
      };
    }

    // Only stakes on members who actually submitted can be graded.
    const gradable = Object.entries(submission.stakes).filter(
      ([targetId]) => targetId !== member.id && submissions[targetId] !== undefined,
    );
    const correctStakes = gradable.filter(
      ([targetId, guess]) => submissions[targetId]!.choice === guess,
    ).length;
    const totalStakes = gradable.length;
    const perfectRead = totalStakes > 0 && correctStakes === totalStakes;

    // How many other members misjudged this player.
    let misreadBy = 0;
    for (const other of members) {
      if (other.id === member.id) continue;
      const guess = submissions[other.id]?.stakes[member.id];
      if (guess && guess !== submission.choice) misreadBy += 1;
    }

    const base =
      SCORING.participation +
      correctStakes * SCORING.correctStake +
      (perfectRead ? SCORING.perfectRead : 0);

    return {
      userId: member.id,
      choice: submission.choice,
      correctStakes,
      totalStakes,
      perfectRead,
      points: Math.round(base * streakMultiplier),
      misreadBy,
    };
  });

  const graded = perPlayer.filter((p) => p.totalStakes > 0);
  const mvp = graded.reduce<PlayerResult | null>((best, current) => {
    if (!best) return current;
    const bestRate = best.correctStakes / best.totalStakes;
    const currentRate = current.correctStakes / current.totalStakes;
    if (currentRate > bestRate) return current;
    if (currentRate === bestRate && current.correctStakes > best.correctStakes) return current;
    return best;
  }, null);

  const submitted = perPlayer.filter((p) => p.choice !== null);
  const hypocrite = submitted.reduce<PlayerResult | null>(
    (worst, current) => (!worst || current.misreadBy > worst.misreadBy ? current : worst),
    null,
  );

  return {
    tally,
    perPlayer,
    // A "most perceptive" player with zero correct reads is not perceptive.
    mvpUserId: mvp && mvp.correctStakes > 0 ? mvp.userId : null,
    // Nobody is the hypocrite if nobody misread them.
    hypocriteUserId: hypocrite && hypocrite.misreadBy > 0 ? hypocrite.userId : null,
  };
}

/** Squad streak survives only if every member submitted before the reveal. */
export function isPerfectRound(round: Round, group: Group): boolean {
  return group.members.every((member) => {
    const submission = round.submissions[member.id];
    return submission !== undefined && submission.submittedAt <= round.revealAt;
  });
}

/* -------------------------------------------------------------------------- *
 *  Weekly persona                                                            *
 * -------------------------------------------------------------------------- */

export function computePersonaStats(userId: string, rounds: Round[], group: Group): PersonaStats {
  let points = 0;
  let correctStakes = 0;
  let totalStakes = 0;
  let readCorrectlyByOthers = 0;
  let readAttemptsByOthers = 0;
  let minorityCount = 0;
  let played = 0;

  for (const round of rounds) {
    const results = computeResults(round, group);
    const mine = results.perPlayer.find((p) => p.userId === userId);
    if (!mine || mine.choice === null) continue;

    played += 1;
    points += mine.points;
    correctStakes += mine.correctStakes;
    totalStakes += mine.totalStakes;

    for (const other of group.members) {
      if (other.id === userId) continue;
      const guess = round.submissions[other.id]?.stakes[userId];
      if (!guess) continue;
      readAttemptsByOthers += 1;
      if (guess === mine.choice) readCorrectlyByOthers += 1;
    }

    const mySide = results.tally[mine.choice].length;
    const otherSide = results.tally[mine.choice === "A" ? "B" : "A"].length;
    if (mySide < otherSide) minorityCount += 1;
  }

  return {
    userId,
    rounds: played,
    points,
    readAccuracy: totalStakes ? correctStakes / totalStakes : 0,
    predictability: readAttemptsByOthers ? readCorrectlyByOthers / readAttemptsByOthers : 0,
    contrarianRate: played ? minorityCount / played : 0,
  };
}

export function derivePersona(stats: PersonaStats): Persona {
  const { rounds, readAccuracy, predictability, contrarianRate } = stats;

  let archetype: Persona["archetype"] = "chameleon";
  if (rounds === 0) archetype = "ghost";
  else if (readAccuracy >= 0.7) archetype = "mind_reader";
  else if (predictability <= 0.35) archetype = "wildcard";
  else if (predictability >= 0.75) archetype = "open_book";
  else if (contrarianRate >= 0.5) archetype = "wildcard";
  else if (contrarianRate <= 0.15 && predictability >= 0.55) archetype = "loyalist";

  return { userId: stats.userId, archetype, stats };
}
