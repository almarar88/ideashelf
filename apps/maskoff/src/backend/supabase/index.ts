import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Backend, LiveEvent, Unsubscribe } from "@/backend/types";
import type { Category, Group, OptionId, Question, Roast, Round } from "@/types/game";
import { currentSchedule } from "@/lib/time";

/**
 * SupabaseBackend — the production adapter.
 *
 * Schema lives in supabase/schema.sql. Two things matter for correctness:
 *
 *  1. Round creation is a single `insert ... on conflict (group_id, day) do
 *     nothing` followed by a re-select, so N clients hitting 20:00 together
 *     still produce exactly one dilemma.
 *  2. Realtime is postgres_changes on rounds + group_members. Clients never
 *     compute the reveal moment from their own clock — `reveal_at` comes from
 *     the row and the clock offset comes from serverTime().
 */

interface RoundRow {
  id: string;
  day: string;
  group_id: string;
  question: Question;
  drop_at: string;
  reveal_at: string;
  roast: Roast | null;
  roast_is_fallback: boolean;
}

interface SubmissionRow {
  round_id: string;
  user_id: string;
  choice: OptionId;
  stakes: Record<string, OptionId>;
  submitted_at: string;
}

export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }

  /* --- Auth -------------------------------------------------------------- */

  async getSession() {
    const { data } = await this.client.auth.getSession();
    return data.session ? { userId: data.session.user.id } : null;
  }

  async signInAs(): Promise<{ userId: string }> {
    // Real sign-in flows (OTP / OAuth) are wired at the app shell, not here;
    // this adapter only reports the session it was handed.
    const session = await this.getSession();
    if (!session) throw new Error("no Supabase session — sign in before using this backend");
    return session;
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  /* --- Clock ------------------------------------------------------------- */

  async serverTime(): Promise<number> {
    const { data, error } = await this.client.rpc("server_now");
    if (error) throw error;
    return new Date(data as string).getTime();
  }

  /* --- Groups ------------------------------------------------------------ */

  async getGroup(groupId: string): Promise<Group> {
    const { data, error } = await this.client
      .from("groups")
      .select("id,name,invite_code,lang,timezone,drop_hour,reveal_hour,streak,last_perfect_day,group_members(user_id,name,emoji,accent)")
      .eq("id", groupId)
      .single();
    if (error) throw error;

    const row = data as unknown as {
      id: string; name: string; invite_code: string; lang: Group["lang"]; timezone: string;
      drop_hour: number; reveal_hour: number; streak: number; last_perfect_day: string | null;
      group_members: { user_id: string; name: string; emoji: string; accent: Group["members"][number]["accent"] }[];
    };

    return {
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      lang: row.lang,
      timezone: row.timezone,
      dropHour: row.drop_hour,
      revealHour: row.reveal_hour,
      streak: row.streak,
      lastPerfectDay: row.last_perfect_day,
      members: row.group_members.map((m) => ({
        id: m.user_id,
        name: m.name,
        emoji: m.emoji,
        accent: m.accent,
      })),
    };
  }

  async listGroupsForUser(userId: string): Promise<Group[]> {
    const { data, error } = await this.client
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    if (error) throw error;
    const ids = (data as { group_id: string }[]).map((r) => r.group_id);
    return Promise.all(ids.map((id) => this.getGroup(id)));
  }

  async setGroupLanguage(groupId: string, lang: Group["lang"]): Promise<Group> {
    const { error } = await this.client.from("groups").update({ lang }).eq("id", groupId);
    if (error) throw error;
    return this.getGroup(groupId);
  }

  /* --- Rounds ------------------------------------------------------------ */

  private async hydrate(row: RoundRow): Promise<Round> {
    const { data, error } = await this.client
      .from("submissions")
      .select("round_id,user_id,choice,stakes,submitted_at")
      .eq("round_id", row.id);
    if (error) throw error;

    const submissions: Round["submissions"] = {};
    for (const s of (data ?? []) as SubmissionRow[]) {
      submissions[s.user_id] = {
        userId: s.user_id,
        choice: s.choice,
        stakes: s.stakes ?? {},
        submittedAt: new Date(s.submitted_at).getTime(),
      };
    }

    return {
      id: row.id,
      day: row.day,
      groupId: row.group_id,
      question: row.question,
      dropAt: new Date(row.drop_at).getTime(),
      revealAt: new Date(row.reveal_at).getTime(),
      submissions,
      roast: row.roast,
      roastIsFallback: row.roast_is_fallback,
    };
  }

  async getOrCreateTodayRound(
    groupId: string,
    generate: (input: {
      history: string[];
      recentCategories: Category[];
      roundNumber: number;
    }) => Promise<{ question: Question; fromFallback: boolean }>,
  ): Promise<Round> {
    const group = await this.getGroup(groupId);
    const now = await this.serverTime();
    const schedule = currentSchedule(now, group.timezone, group.dropHour, group.revealHour);

    const existing = await this.client
      .from("rounds")
      .select("id,day,group_id,question,drop_at,reveal_at,roast,roast_is_fallback")
      .eq("group_id", groupId)
      .eq("day", schedule.day)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return this.hydrate(existing.data as unknown as RoundRow);

    const recent = await this.client
      .from("rounds")
      .select("question")
      .eq("group_id", groupId)
      .order("drop_at", { ascending: false })
      .limit(60);
    if (recent.error) throw recent.error;
    const recentQuestions = ((recent.data ?? []) as { question: Question }[]).map((r) => r.question);

    const { question } = await generate({
      history: recentQuestions.map((q) => q.question_text),
      recentCategories: recentQuestions.map((q) => q.category),
      roundNumber: recentQuestions.length,
    });

    // Idempotent create: the unique (group_id, day) index makes the loser of
    // the race a no-op rather than a second dilemma.
    const inserted = await this.client
      .from("rounds")
      .upsert(
        {
          group_id: groupId,
          day: schedule.day,
          question,
          drop_at: new Date(schedule.dropAt).toISOString(),
          reveal_at: new Date(schedule.revealAt).toISOString(),
        },
        { onConflict: "group_id,day", ignoreDuplicates: true },
      )
      .select("id,day,group_id,question,drop_at,reveal_at,roast,roast_is_fallback")
      .maybeSingle();
    if (inserted.error) throw inserted.error;
    if (inserted.data) return this.hydrate(inserted.data as unknown as RoundRow);

    // Lost the race — read back whatever the winner wrote.
    const winner = await this.client
      .from("rounds")
      .select("id,day,group_id,question,drop_at,reveal_at,roast,roast_is_fallback")
      .eq("group_id", groupId)
      .eq("day", schedule.day)
      .single();
    if (winner.error) throw winner.error;
    return this.hydrate(winner.data as unknown as RoundRow);
  }

  async submit(roundId: string, userId: string, choice: OptionId, stakes: Record<string, OptionId>) {
    const { error } = await this.client
      .from("submissions")
      .upsert({ round_id: roundId, user_id: userId, choice, stakes }, { onConflict: "round_id,user_id" });
    if (error) throw error;
    return this.getRound(roundId);
  }

  async saveRoast(roundId: string, roast: Roast, fromFallback: boolean) {
    // `is null` makes this first-writer-wins without a transaction.
    const { error } = await this.client
      .from("rounds")
      .update({ roast, roast_is_fallback: fromFallback })
      .eq("id", roundId)
      .is("roast", null);
    if (error) throw error;
    return this.getRound(roundId);
  }

  private async getRound(roundId: string): Promise<Round> {
    const { data, error } = await this.client
      .from("rounds")
      .select("id,day,group_id,question,drop_at,reveal_at,roast,roast_is_fallback")
      .eq("id", roundId)
      .single();
    if (error) throw error;
    return this.hydrate(data as unknown as RoundRow);
  }

  async listRecentRounds(groupId: string, limit: number): Promise<Round[]> {
    const { data, error } = await this.client
      .from("rounds")
      .select("id,day,group_id,question,drop_at,reveal_at,roast,roast_is_fallback")
      .eq("group_id", groupId)
      .order("drop_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Promise.all((data as unknown as RoundRow[]).map((row) => this.hydrate(row)));
  }

  /* --- Realtime ---------------------------------------------------------- */

  subscribe(groupId: string, handler: (event: LiveEvent) => void): Unsubscribe {
    const channel = this.client
      .channel(`group:${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `group_id=eq.${groupId}` }, () => {
        handler({ type: "round" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => {
        handler({ type: "round" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` }, () => {
        handler({ type: "group" });
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        handler({ type: "presence", present: Object.values(state).flat().map((p) => p.user_id) });
      })
      .subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
