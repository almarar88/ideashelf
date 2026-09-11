import type { Backend, LiveEvent, Unsubscribe } from "@/backend/types";
import type { Category, Group, OptionId, Player, Question, Roast, Round } from "@/types/game";
import { currentSchedule } from "@/lib/time";
import { uid } from "@/lib/utils";
import { seedGroup } from "./seed";

/**
 * LocalBackend — a complete, offline simulator of the real thing.
 *
 * It exists for two reasons: the app must be demonstrable and testable with no
 * server at all, and every screen must be exercised against the same Backend
 * contract the Supabase adapter implements. Cross-tab realtime is real here
 * (BroadcastChannel), so the synchronized reveal can actually be observed by
 * opening two tabs.
 */

const STORAGE_KEY = "maskoff.local.v1";
const CHANNEL = "maskoff.live";

interface Store {
  group: Group;
  rounds: Record<string, Round>;
  session: { userId: string } | null;
  /** Question texts already played, newest first. */
  history: string[];
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh";
  } catch {
    return "Asia/Riyadh";
  }
}

/**
 * Hand callers a detached copy.
 *
 * The store mutates rows in place, so returning the live object would give
 * React the same reference it already holds and the update would never
 * render. Every value that leaves the backend is snapshotted.
 */
function snapshot<T>(value: T): T {
  return structuredClone(value);
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* corrupted storage falls through to a fresh seed */
  }
  return { group: seedGroup(timezone()), rounds: {}, session: null, history: [] };
}

export class LocalBackend implements Backend {
  readonly kind = "local" as const;

  private store: Store = load();
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<(event: LiveEvent) => void>();
  /** Guards against two concurrent callers generating two dilemmas. */
  private creating: Promise<Round> | null = null;

  constructor() {
    try {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (event: MessageEvent<LiveEvent>) => {
        // A peer tab mutated state; adopt it and re-render.
        this.store = load();
        for (const handler of this.handlers) handler(event.data);
      };
    } catch {
      this.channel = null; // BroadcastChannel unavailable — single-tab only.
    }
  }

  private persist(event: LiveEvent): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    const detached = snapshot(event);
    for (const handler of this.handlers) handler(detached);
    this.channel?.postMessage(event);
  }

  /* --- Auth -------------------------------------------------------------- */

  async getSession() {
    return this.store.session;
  }

  async signInAs(userId: string) {
    this.store.session = { userId };
    this.persist({ type: "presence", present: [userId] });
    return this.store.session;
  }

  async signOut() {
    this.store.session = null;
    this.persist({ type: "presence", present: [] });
  }

  /* --- Clock ------------------------------------------------------------- */

  async serverTime() {
    // No server to ask; the device clock *is* the shared clock here, and all
    // tabs on one device agree, which is what the simulator needs.
    return Date.now();
  }

  /* --- Groups ------------------------------------------------------------ */

  async getGroup(groupId: string) {
    if (this.store.group.id !== groupId) throw new Error(`unknown group ${groupId}`);
    return snapshot(this.store.group);
  }

  async listGroupsForUser() {
    return [snapshot(this.store.group)];
  }

  async setGroupLanguage(groupId: string, lang: Group["lang"]) {
    this.requireGroup(groupId).lang = lang;
    const group = snapshot(this.store.group);
    this.persist({ type: "group", group });
    return group;
  }

  /* --- Rounds ------------------------------------------------------------ */

  async getOrCreateTodayRound(
    groupId: string,
    generate: (input: {
      history: string[];
      recentCategories: Category[];
      roundNumber: number;
    }) => Promise<{ question: Question; fromFallback: boolean }>,
  ): Promise<Round> {
    const group = await this.getGroup(groupId);
    const schedule = currentSchedule(Date.now(), group.timezone, group.dropHour, group.revealHour);

    const existing = Object.values(this.store.rounds).find(
      (round) => round.groupId === groupId && round.day === schedule.day,
    );
    if (existing) return snapshot(existing);

    // Collapse concurrent creators onto one generation.
    if (this.creating) return this.creating;

    this.creating = (async () => {
      const rounds = await this.listRecentRounds(groupId, 30);
      const { question } = await generate({
        history: this.store.history,
        recentCategories: rounds.map((r) => r.question.category),
        roundNumber: Object.keys(this.store.rounds).length,
      });

      const round: Round = {
        id: uid("round"),
        day: schedule.day,
        groupId,
        question,
        dropAt: schedule.dropAt,
        revealAt: schedule.revealAt,
        submissions: {},
        roast: null,
        roastIsFallback: false,
      };

      this.store.rounds[round.id] = round;
      this.store.history = [question.question_text, ...this.store.history].slice(0, 120);
      this.persist({ type: "round", round });
      return snapshot(round);
    })();

    try {
      return await this.creating;
    } finally {
      this.creating = null;
    }
  }

  /** Live reference for internal mutation. Never returned to callers. */
  private requireGroup(groupId: string): Group {
    if (this.store.group.id !== groupId) throw new Error(`unknown group ${groupId}`);
    return this.store.group;
  }

  private requireRound(roundId: string): Round {
    const round = this.store.rounds[roundId];
    if (!round) throw new Error(`unknown round ${roundId}`);
    return round;
  }

  async submit(roundId: string, userId: string, choice: OptionId, stakes: Record<string, OptionId>) {
    const round = this.requireRound(roundId);
    if (Date.now() >= round.revealAt) throw new Error("round is already revealed");
    round.submissions[userId] = { userId, choice, stakes, submittedAt: Date.now() };
    this.persist({ type: "round", round });
    return snapshot(round);
  }

  async saveRoast(roundId: string, roast: Roast, fromFallback: boolean) {
    const round = this.requireRound(roundId);
    // First writer wins, so every client shows the same roast text.
    if (!round.roast) {
      round.roast = roast;
      round.roastIsFallback = fromFallback;
      this.persist({ type: "round", round });
    }
    return snapshot(round);
  }

  async listRecentRounds(groupId: string, limit: number) {
    return snapshot(
      Object.values(this.store.rounds)
        .filter((round) => round.groupId === groupId)
        .sort((a, b) => b.dropAt - a.dropAt)
        .slice(0, limit),
    );
  }

  /* --- Realtime ---------------------------------------------------------- */

  subscribe(_groupId: string, handler: (event: LiveEvent) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /* --- Simulation -------------------------------------------------------- */

  simulate = {
    fillOthers: async (roundId: string, exceptUserId: string) => {
      const round = this.requireRound(roundId);
      const members = this.store.group.members;

      for (const member of members) {
        if (member.id === exceptUserId || round.submissions[member.id]) continue;

        // Deterministic per (round, member) so a reload doesn't reshuffle the
        // squad's answers underneath the player.
        const seed = hash(`${round.id}:${member.id}`);
        const choice: OptionId = seed % 100 < 52 ? "A" : "B";

        const stakes: Record<string, OptionId> = {};
        for (const target of members) {
          if (target.id === member.id) continue;
          const targetSeed = hash(`${round.id}:${member.id}:${target.id}`);
          stakes[target.id] = targetSeed % 100 < 55 ? "A" : "B";
        }

        round.submissions[member.id] = {
          userId: member.id,
          choice,
          stakes,
          submittedAt: Date.now() - (seed % 1800) * 1000,
        };
      }

      this.persist({ type: "round", round });
      return snapshot(round);
    },

    shiftSchedule: async (roundId: string, patch: { dropAt?: number; revealAt?: number }) => {
      const round = this.requireRound(roundId);
      if (patch.dropAt !== undefined) round.dropAt = patch.dropAt;
      if (patch.revealAt !== undefined) round.revealAt = patch.revealAt;
      this.persist({ type: "round", round });
      return snapshot(round);
    },

    resetDay: async (groupId: string) => {
      const group = this.requireGroup(groupId);
      const schedule = currentSchedule(Date.now(), group.timezone, group.dropHour, group.revealHour);
      for (const [id, round] of Object.entries(this.store.rounds)) {
        if (round.groupId === groupId && round.day === schedule.day) delete this.store.rounds[id];
      }
      this.persist({ type: "round" });
    },

    addMember: async (groupId: string, player: Player) => {
      const live = this.requireGroup(groupId);
      if (!live.members.some((m) => m.id === player.id)) live.members.push(player);
      const group = snapshot(live);
      this.persist({ type: "group", group });
      return group;
    },
  };
}

/** Small stable string hash — deterministic simulation, not security. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
