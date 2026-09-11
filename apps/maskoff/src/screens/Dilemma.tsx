import { useMemo, useState } from "react";
import type { OptionId } from "@/types/game";
import { t } from "@/lib/i18n";
import { haptic, sfx } from "@/lib/haptics";
import { countdown, formatCountdown } from "@/lib/time";
import { useGame } from "@/state/GameContext";
import { useGroup } from "@/state/GroupContext";
import { useAuth } from "@/state/AuthContext";
import { DilemmaCard } from "@/components/DilemmaCard";
import { StakePicker } from "@/components/StakePicker";
import { IconBadge, SectionTitle, Stepper } from "@/components/ui/Primitives";
import { IconCheck, IconMask } from "@/components/ui/Icons";
import type { Screen } from "@/components/PillNav";

/**
 * Answer + stake, as a two-step flow with the chevron stepper from the
 * reference. Everything stays local until "lock in" — the group must not be
 * able to watch an answer change in real time.
 */
export function Dilemma({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { group, lang } = useGroup();
  const { userId } = useAuth();
  const { round, phase, now, mySubmission, submit, loadingQuestion } = useGame();

  const [choice, setChoice] = useState<OptionId | null>(null);
  const [stakes, setStakes] = useState<Record<string, OptionId>>({});
  const [step, setStep] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);

  const others = useMemo(
    () => group?.members.filter((member) => member.id !== userId) ?? [],
    [group, userId],
  );

  if (!group || !round) {
    return (
      <Centered>
        <p className="text-sm font-semibold text-muted">
          {loadingQuestion ? t(lang, "ai_thinking") : t(lang, "loading")}
        </p>
      </Centered>
    );
  }

  if (phase === "locked") {
    return (
      <Centered>
        <IconBadge className="mb-4 text-neon">
          <IconMask />
        </IconBadge>
        <p className="text-sm font-semibold text-muted">{t(lang, "dilemma_locked_msg")}</p>
        <p className="tnum mt-2 font-display text-2xl font-extrabold">
          {formatCountdown(countdown(round.dropAt, now))}
        </p>
      </Centered>
    );
  }

  // Already locked in, or the reveal has opened — show the read-only state.
  if (mySubmission || phase === "revealed") {
    const chosen = mySubmission
      ? round.question.options.find((option) => option.id === mySubmission.choice)
      : null;
    return (
      <Centered>
        <IconBadge className="mb-4 bg-pistachio text-ink-900">
          <IconCheck />
        </IconBadge>
        <p className="font-display text-xl font-extrabold">{t(lang, "dilemma_submitted")}</p>
        {chosen && (
          <p className="mt-3 text-sm text-muted">
            {t(lang, "dilemma_your_answer")}:{" "}
            <span className="font-bold text-white">
              {chosen.id} · {chosen.text}
            </span>
          </p>
        )}
        <p className="tnum mt-5 font-display text-2xl font-extrabold text-cyber">
          {formatCountdown(countdown(round.revealAt, now))}
        </p>
        <button
          type="button"
          onClick={() => onNavigate(phase === "revealed" ? "showdown" : "vault")}
          className="btn-ghost btn-md mt-6"
        >
          {phase === "revealed" ? t(lang, "vault_see_results") : t(lang, "nav_vault")}
        </button>
      </Centered>
    );
  }

  const allStaked = others.every((member) => stakes[member.id]);

  const lockIn = async () => {
    if (!choice || !allStaked || saving) return;
    setSaving(true);
    haptic("lock");
    sfx("lock");
    try {
      await submit(choice, stakes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Stepper
        steps={[t(lang, "dilemma_step_answer"), t(lang, "dilemma_step_stake"), t(lang, "dilemma_step_done")]}
        activeIndex={step}
      />

      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        <span className="chip bg-white/[.06]">{round.question.category}</span>
        <span className="tnum text-cyber">{formatCountdown(countdown(round.revealAt, now))}</span>
      </div>

      {step === 0 ? (
        <>
          <DilemmaCard
            question={round.question}
            value={choice}
            onChange={(next) => {
              setChoice(next);
              // Auto-advance: one decision per screen keeps the loop fast.
              setTimeout(() => setStep(1), 260);
            }}
            hint={t(lang, "dilemma_swipe_hint")}
          />
        </>
      ) : (
        <>
          <SectionTitle
            action={
              <button type="button" onClick={() => setStep(0)} className="chip bg-white/[.06] text-muted">
                {t(lang, "dilemma_change")}
              </button>
            }
          >
            {t(lang, "dilemma_stake_title")}
          </SectionTitle>

          <p className="-mt-1 mb-3 text-xs font-medium text-muted">{round.question.stake_prompt}</p>
          <p className="mb-4 text-xs font-medium text-muted">{t(lang, "dilemma_stake_sub")}</p>

          <StakePicker
            question={round.question}
            members={others}
            stakes={stakes}
            onChange={(targetId, next) => setStakes((prev) => ({ ...prev, [targetId]: next }))}
          />

          <button
            type="button"
            onClick={lockIn}
            disabled={!choice || !allStaked || saving}
            className="btn-coral btn-lg mt-5 w-full"
          >
            {saving ? t(lang, "loading") : t(lang, "dilemma_submit")}
          </button>
        </>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">{children}</div>
  );
}
