import type { Group, OptionId, Player, Question, Roast, Round } from "@/types/game";

/**
 * Every screen talks to this interface and nothing else. The local simulator
 * and the Supabase adapter are interchangeable behind it, so swapping the
 * production backend never touches a component.
 */

export interface LiveEvent {
  type: "round" | "group" | "presence";
  round?: Round;
  group?: Group;
  /** user ids currently connected. */
  present?: string[];
}

export type Unsubscribe = () => void;

export interface Backend {
  readonly kind: "local" | "supabase";

  /* --- Auth -------------------------------------------------------------- */
  getSession(): Promise<{ userId: string } | null>;
  signInAs(userId: string): Promise<{ userId: string }>;
  signOut(): Promise<void>;

  /* --- Clock ------------------------------------------------------------- */
  /** Server time in epoch ms, used to align every client to the same second. */
  serverTime(): Promise<number>;

  /* --- Groups ------------------------------------------------------------ */
  getGroup(groupId: string): Promise<Group>;
  listGroupsForUser(userId: string): Promise<Group[]>;
  setGroupLanguage(groupId: string, lang: Group["lang"]): Promise<Group>;

  /* --- Rounds ------------------------------------------------------------ */
  /**
   * Fetch (or lazily create) the round for the group's current day. Creation
   * is idempotent per (groupId, day) so two clients opening the app at 20:00
   * cannot produce two different dilemmas.
   */
  getOrCreateTodayRound(
    groupId: string,
    generate: (input: { history: string[]; recentCategories: Round["question"]["category"][]; roundNumber: number }) => Promise<{ question: Question; fromFallback: boolean }>,
  ): Promise<Round>;

  submit(roundId: string, userId: string, choice: OptionId, stakes: Record<string, OptionId>): Promise<Round>;

  /** Persist the roast once, at reveal time. First writer wins. */
  saveRoast(roundId: string, roast: Roast, fromFallback: boolean): Promise<Round>;

  listRecentRounds(groupId: string, limit: number): Promise<Round[]>;

  /* --- Realtime ---------------------------------------------------------- */
  subscribe(groupId: string, handler: (event: LiveEvent) => void): Unsubscribe;

  /* --- Simulation (local adapter only) ----------------------------------- */
  simulate?: {
    fillOthers(roundId: string, exceptUserId: string): Promise<Round>;
    shiftSchedule(roundId: string, patch: { dropAt?: number; revealAt?: number }): Promise<Round>;
    resetDay(groupId: string): Promise<void>;
    addMember(groupId: string, player: Player): Promise<Group>;
  };
}
