import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Core domain                                                               */
/* -------------------------------------------------------------------------- */

export type Lang = "ar" | "en";

export const CATEGORIES = ["loyalty", "money", "travel", "habits", "workplace"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Option ids are fixed to a binary dilemma — the format the game is built on. */
export type OptionId = "A" | "B";

export const zOption = z.object({
  id: z.enum(["A", "B"]),
  text: z.string().trim().min(1).max(160),
});
export type DilemmaOption = z.infer<typeof zOption>;

/** Shape returned by the question generator (and by the offline fallback bank). */
export const zQuestion = z.object({
  question_id: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIES),
  question_text: z.string().trim().min(8).max(400),
  options: z.tuple([zOption, zOption]),
  stake_prompt: z.string().trim().min(4).max(240),
});
export type Question = z.infer<typeof zQuestion>;

/** Shape returned by the Roast Master. */
export const zRoast = z.object({
  roast_headline: z.string().trim().min(3).max(160),
  roast_commentary: z.string().trim().min(10).max(700),
  mvp_perceptive_user_id: z.string().trim().max(120),
  biggest_hypocrite_user_id: z.string().trim().max(120),
});
export type Roast = z.infer<typeof zRoast>;

export interface Player {
  id: string;
  name: string;
  emoji: string;
  /** Accent key used for this member's avatar ring / tiles. */
  accent: "ice" | "coral" | "pistachio" | "butter" | "grape" | "neon";
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  lang: Lang;
  /** IANA timezone the daily schedule is anchored to. */
  timezone: string;
  dropHour: number; // local hour the dilemma unlocks (default 20)
  revealHour: number; // local hour results open (default 21)
  members: Player[];
  streak: number;
  /** ISO date (YYYY-MM-DD) of the last round every member completed. */
  lastPerfectDay: string | null;
}

/** One player's private submission for a round. */
export interface Submission {
  userId: string;
  /** The player's own answer. */
  choice: OptionId;
  /**
   * Intuition bets: for each *other* member, which option this player thinks
   * that member picked. Keyed by target user id.
   */
  stakes: Record<string, OptionId>;
  submittedAt: number; // epoch ms
}

export type RoundPhase = "locked" | "open" | "revealed";

export interface Round {
  id: string;
  /** YYYY-MM-DD in the group's timezone. */
  day: string;
  groupId: string;
  question: Question;
  /** Epoch ms — identical for every client, drives the synchronized reveal. */
  dropAt: number;
  revealAt: number;
  submissions: Record<string, Submission>;
  roast: Roast | null;
  /** True when the roast came from the offline bank rather than the model. */
  roastIsFallback: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Scoring                                                                   */
/* -------------------------------------------------------------------------- */

export const SCORING = {
  /** Awarded for submitting before the reveal. */
  participation: 10,
  /** Per correct read of another member's answer. */
  correctStake: 25,
  /** Bonus when every stake in the round was correct. */
  perfectRead: 50,
  /** Multiplier step per consecutive squad-streak day, capped. */
  streakStep: 0.1,
  streakCapMultiplier: 2,
} as const;

export interface PlayerResult {
  userId: string;
  choice: OptionId | null;
  correctStakes: number;
  totalStakes: number;
  perfectRead: boolean;
  points: number;
  /**
   * How many members bet that this player would choose the option they did
   * NOT choose — the raw signal behind "biggest hypocrite".
   */
  misreadBy: number;
}

export interface RoundResults {
  tally: Record<OptionId, string[]>; // option -> user ids
  perPlayer: PlayerResult[];
  mvpUserId: string | null;
  hypocriteUserId: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Persona / weekly summary                                                  */
/* -------------------------------------------------------------------------- */

export interface PersonaStats {
  userId: string;
  rounds: number;
  points: number;
  readAccuracy: number; // 0..1 — how well they read others
  predictability: number; // 0..1 — how well others read them
  contrarianRate: number; // 0..1 — how often they were in the minority
}

export interface Persona {
  userId: string;
  /** Stable archetype key; labels are localized at render time. */
  archetype:
    | "mind_reader"
    | "wildcard"
    | "open_book"
    | "chameleon"
    | "loyalist"
    | "ghost";
  stats: PersonaStats;
}
