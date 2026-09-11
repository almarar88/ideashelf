import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { haptic, sfx } from "@/lib/haptics";
import { countdown, formatCountdown } from "@/lib/time";
import { useGame } from "@/state/GameContext";
import { useGroup } from "@/state/GroupContext";
import { useAuth } from "@/state/AuthContext";
import { RoastFeed } from "@/components/RoastFeed";
import { Leaderboard } from "@/components/Leaderboard";
import { IconBadge, SectionTitle, Sheet, StatTiles, Stepper } from "@/components/ui/Primitives";
import { IconEye, IconStar, IconClose } from "@/components/ui/Icons";

const REACTIONS = ["😂", "😍", "😳", "💀"] as const;

/**
 * The Live Showdown — the synchronized reveal.
 *
 * Layout follows the reference's "My order" screen: title block, the coloured
 * stat-count row, the chevron stepper, then the result cards. The reaction
 * sheet is the reference's "Rate Us" modal, repurposed.
 */
export function Showdown() {
  const { group, lang } = useGroup();
  const { userId } = useAuth();
  const { round, phase, now, results, loadingRoast } = useGame();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [comeback, setComeback] = useState("");
  const [sent, setSent] = useState(false);
  const celebrated = useRef(false);

  // Fire the reveal beat exactly once, the moment the phase flips.
  useEffect(() => {
    if (phase !== "revealed" || celebrated.current || !results) return;
    celebrated.current = true;
    haptic("reveal");
    sfx("reveal");
  }, [phase, results]);

  if (!group || !round) return null;

  if (phase !== "revealed") {
    return (
      <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">
        <IconBadge className="mb-4 text-neon">
          <IconEye />
        </IconBadge>
        <p className="text-sm font-semibold text-muted">{t(lang, "showdown_waiting")}</p>
        <p className="tnum mt-3 font-display text-3xl font-extrabold">
          {formatCountdown(countdown(round.revealAt, now))}
        </p>
      </div>
    );
  }

  if (!results) return null;

  const missed = group.members.length - (results.tally.A.length + results.tally.B.length);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-[32px] font-extrabold leading-tight">{t(lang, "showdown_title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "showdown_subtitle")}</p>
      </header>

      {/* Reference: the coloured count row */}
      <StatTiles
        items={[
          { value: group.members.length, label: t(lang, "showdown_all"), color: "#B9C9F2" },
          { value: results.tally.A.length, label: t(lang, "showdown_option_a"), color: "#C7E89C" },
          { value: results.tally.B.length, label: t(lang, "showdown_option_b"), color: "#F08D7C" },
          { value: missed, label: t(lang, "showdown_missed"), color: "#F2D06B" },
        ]}
      />

      <Stepper
        steps={[t(lang, "dilemma_step_answer"), t(lang, "dilemma_step_stake"), t(lang, "showdown_title")]}
        activeIndex={2}
      />

      {/* The split bar */}
      <div className="surface p-5">
        <p className="mb-4 text-balance font-display text-lg font-extrabold leading-snug">
          {round.question.question_text}
        </p>
        <div className="flex h-14 overflow-hidden rounded-tile">
          {(["A", "B"] as const).map((option, index) => {
            const count = results.tally[option].length;
            const total = results.tally.A.length + results.tally.B.length || 1;
            return (
              <div
                key={option}
                className="flex items-center justify-center gap-2 transition-[width] duration-700 ease-out"
                style={{
                  width: `${(count / total) * 100}%`,
                  background: index === 0 ? "#B9C9F2" : "#F08D7C",
                  minWidth: count ? 56 : 0,
                }}
              >
                <span className="tnum font-display text-lg font-extrabold text-ink-900">{count}</span>
                <span className="font-display text-xs font-extrabold text-ink-900/60">{option}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[11px] font-semibold text-muted">
          <span>A · {round.question.options[0].text}</span>
          <span>B · {round.question.options[1].text}</span>
        </div>
      </div>

      <RoastFeed
        lang={lang}
        roast={round.roast}
        results={results}
        members={group.members}
        loading={loadingRoast}
        isFallback={round.roastIsFallback}
      />

      {round.roast && (
        <button type="button" onClick={() => setSheetOpen(true)} className="btn-ghost btn-lg w-full">
          <IconStar className="h-4 w-4" />
          {t(lang, "showdown_react")}
        </button>
      )}

      <section>
        <SectionTitle>{t(lang, "showdown_leaderboard")}</SectionTitle>
        <Leaderboard lang={lang} results={results} members={group.members} meId={userId} />
      </section>

      {/* Reference: the "Rate Us" modal — star burst, emoji row, coral CTA */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} labelledBy="react-title">
        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          aria-label="close"
          className="badge-ring absolute end-4 top-4 h-9 w-9 text-muted"
        >
          <IconClose className="h-4 w-4" />
        </button>

        <div className="animate-spark mx-auto mt-2 grid h-16 w-16 place-items-center rounded-pill bg-pistachio">
          <IconStar className="h-8 w-8 text-ink-900" />
        </div>

        <h2 id="react-title" className="mt-4 text-center font-display text-2xl font-extrabold">
          {t(lang, "showdown_react")}
        </h2>
        <p className="mx-auto mt-2 max-w-[28ch] text-center text-sm text-muted">
          {t(lang, "showdown_react_sub")}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={reaction === emoji}
              onClick={() => {
                haptic("tap");
                setReaction(emoji);
              }}
              className={`grid h-14 w-14 place-items-center rounded-pill text-3xl transition-all duration-150 active:scale-90 ${
                reaction === emoji ? "bg-butter scale-105" : "bg-white/[.06]"
              }`}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>

        <textarea
          value={comeback}
          onChange={(event) => setComeback(event.target.value)}
          placeholder={t(lang, "showdown_comeback")}
          rows={3}
          className="surface-2 mt-5 w-full resize-none p-4 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-neon"
        />

        <button
          type="button"
          disabled={!reaction}
          onClick={() => {
            haptic("lock");
            setSent(true);
            setTimeout(() => {
              setSheetOpen(false);
              setSent(false);
            }, 900);
          }}
          className="btn-coral btn-lg mt-4 w-full"
        >
          {sent ? t(lang, "showdown_thanks") : t(lang, "showdown_send")}
        </button>
      </Sheet>
    </div>
  );
}
