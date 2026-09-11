import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getBackend } from "@/backend";
import { aiConfigFromEnv, generateQuestion, generateRoast } from "@/ai/gemini";
import { computeResults } from "@/lib/scoring";
import { phaseFor, type Phase } from "@/lib/time";
import type { OptionId, Round, RoundResults } from "@/types/game";
import { useGroup } from "./GroupContext";
import { useAuth } from "./AuthContext";
import { useServerClock } from "./useServerClock";

interface GameValue {
  now: number;
  round: Round | null;
  phase: Phase;
  results: RoundResults | null;
  mySubmission: Round["submissions"][string] | null;
  /** Members who have locked in — drives the live squad status list. */
  submittedIds: string[];
  loadingQuestion: boolean;
  loadingRoast: boolean;
  questionIsFallback: boolean;
  aiError: string | null;
  submit: (choice: OptionId, stakes: Record<string, OptionId>) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<GameValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const backend = getBackend();
  const { userId } = useAuth();
  const { group, lang } = useGroup();
  const now = useServerClock();

  const [round, setRound] = useState<Round | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadingRoast, setLoadingRoast] = useState(false);
  const [questionIsFallback, setQuestionIsFallback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  /** Prevents every client in the group racing to write the same roast. */
  const roastRequested = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!group) return;
    setLoadingQuestion(true);
    try {
      const next = await backend.getOrCreateTodayRound(group.id, async (input) => {
        const outcome = await generateQuestion(aiConfigFromEnv(), {
          lang,
          history: input.history,
          recentCategories: input.recentCategories,
          roundNumber: input.roundNumber,
        });
        setQuestionIsFallback(outcome.fromFallback);
        if (outcome.error) setAiError(outcome.error);
        return { question: outcome.value, fromFallback: outcome.fromFallback };
      });
      setRound(next);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingQuestion(false);
    }
  }, [backend, group, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  /* --- LiveSync: adopt peer changes as they land ------------------------- */
  useEffect(() => {
    if (!group) return;
    return backend.subscribe(group.id, (event) => {
      if (event.type !== "round") return;
      if (event.round) {
        // Local adapter hands us the row directly.
        setRound((current) => (!current || event.round!.id === current.id ? event.round! : current));
      } else {
        void load();
      }
    });
  }, [backend, group, load]);

  const phase: Phase = useMemo(
    () => (round ? phaseFor(now, { day: round.day, dropAt: round.dropAt, revealAt: round.revealAt }) : "locked"),
    [now, round],
  );

  const results = useMemo(
    () => (round && group && phase === "revealed" ? computeResults(round, group) : null),
    [round, group, phase],
  );

  /* --- Roast: fired once, at the reveal ---------------------------------- */
  useEffect(() => {
    if (!round || !group || !results) return;
    if (round.roast || loadingRoast) return;
    if (roastRequested.current === round.id) return;

    const answered = Object.keys(round.submissions).length;
    if (answered === 0) return;

    roastRequested.current = round.id;
    setLoadingRoast(true);

    const roster = Object.fromEntries(group.members.map((m) => [m.id, m.name]));
    const breakdown = group.members.map((member) => {
      const submission = round.submissions[member.id];
      return {
        userId: member.id,
        choice: submission?.choice ?? null,
        betsPlaced: Object.entries(submission?.stakes ?? {}).map(([targetId, guess]) => ({
          targetId,
          guess,
          correct: round.submissions[targetId]?.choice === guess,
        })),
        betsReceived: group.members
          .filter((other) => other.id !== member.id && round.submissions[other.id]?.stakes[member.id])
          .map((other) => {
            const guess = round.submissions[other.id]!.stakes[member.id]!;
            return { fromId: other.id, guess, correct: submission?.choice === guess };
          }),
      };
    });

    void (async () => {
      try {
        const outcome = await generateRoast(aiConfigFromEnv(), {
          lang,
          question: round.question,
          roster,
          results,
          breakdown,
          contradictions: [],
        });
        if (outcome.error) setAiError(outcome.error);
        setRound(await backend.saveRoast(round.id, outcome.value, outcome.fromFallback));
      } catch (error) {
        setAiError(error instanceof Error ? error.message : String(error));
        roastRequested.current = null; // allow a retry on the next tick
      } finally {
        setLoadingRoast(false);
      }
    })();
  }, [round, group, results, lang, backend, loadingRoast]);

  const submit = useCallback(
    async (choice: OptionId, stakes: Record<string, OptionId>) => {
      if (!round || !userId) return;
      setRound(await backend.submit(round.id, userId, choice, stakes));
    },
    [backend, round, userId],
  );

  const mySubmission = userId && round ? round.submissions[userId] ?? null : null;
  const submittedIds = useMemo(() => (round ? Object.keys(round.submissions) : []), [round]);

  const value = useMemo<GameValue>(
    () => ({
      now,
      round,
      phase,
      results,
      mySubmission,
      submittedIds,
      loadingQuestion,
      loadingRoast,
      questionIsFallback,
      aiError,
      submit,
      reload: load,
    }),
    [now, round, phase, results, mySubmission, submittedIds, loadingQuestion, loadingRoast, questionIsFallback, aiError, submit, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useGame must be used inside <GameProvider>");
  return value;
}
