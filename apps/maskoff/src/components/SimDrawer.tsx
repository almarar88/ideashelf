import { useState } from "react";
import { getBackend } from "@/backend";
import { t } from "@/lib/i18n";
import { serverNow } from "@/lib/time";
import { useGame } from "@/state/GameContext";
import { useGroup } from "@/state/GroupContext";
import { useAuth } from "@/state/AuthContext";
import { Sheet } from "./ui/Primitives";
import { IconSpark, IconClose } from "./ui/Icons";

/**
 * Simulation drawer — local backend only.
 *
 * A once-a-day game is otherwise impossible to demo or QA: you would have to
 * wait until 20:00 with five other people. These controls move the clock and
 * fill in the squad so the whole loop can be exercised in under a minute.
 */
export function SimDrawer() {
  const backend = getBackend();
  const { group, lang } = useGroup();
  const { userId } = useAuth();
  const { round, reload } = useGame();
  const [open, setOpen] = useState(false);

  if (!backend.simulate || !group) return null;
  const sim = backend.simulate;

  // Each action closes the sheet — you press one of these to see its effect
  // on the screen behind, so leaving the modal up just blocks the view.
  const act = async (fn: () => Promise<unknown>) => {
    setOpen(false);
    await fn();
    await reload();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t(lang, "simulate")}
        className="badge-ring fixed start-4 bottom-[calc(var(--safe-bottom)+92px)] z-30 h-10 w-10 bg-ink-800/90 text-cyber backdrop-blur"
      >
        <IconSpark className="h-4 w-4" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="sim-title">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="close"
          className="badge-ring absolute end-4 top-4 h-9 w-9 text-muted"
        >
          <IconClose className="h-4 w-4" />
        </button>

        <h2 id="sim-title" className="font-display text-xl font-extrabold">
          {t(lang, "simulate")}
        </h2>
        <p className="mt-1 text-xs text-muted">{t(lang, "sim_note")}</p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            disabled={!round}
            onClick={() => void act(() => sim.shiftSchedule(round!.id, { dropAt: serverNow() - 1000 }))}
            className="btn-ghost btn-md w-full"
          >
            {t(lang, "sim_open")}
          </button>

          <button
            type="button"
            disabled={!round || !userId}
            onClick={() => void act(() => sim.fillOthers(round!.id, userId!))}
            className="btn-ghost btn-md w-full"
          >
            {t(lang, "sim_fill")}
          </button>

          <button
            type="button"
            disabled={!round}
            onClick={() =>
              void act(() =>
                sim.shiftSchedule(round!.id, { dropAt: serverNow() - 2000, revealAt: serverNow() + 5000 }),
              )
            }
            className="btn-grape btn-md w-full"
          >
            {t(lang, "sim_reveal")} (5s)
          </button>

          <button
            type="button"
            onClick={() => void act(() => sim.resetDay(group.id))}
            className="btn-coral btn-md w-full"
          >
            {t(lang, "sim_reset")}
          </button>
        </div>
      </Sheet>
    </>
  );
}
