import { Clapperboard, Mic, PenLine, ScanText, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PulseMode } from "@/lib/pulse";

const ICONS = {
  compose: PenLine,
  director: Clapperboard,
  mic: Mic,
  lens: ScanText,
  map: Waypoints,
  shield: ShieldCheck,
};

/** زر النبض: عنصر واحد يغيّر وظيفته حسب ما تفعله، بديلاً عن زر "+" الجامد. */
export function PulseCore({
  mode,
  busy,
  onPress,
  className,
}: {
  mode: PulseMode;
  busy: boolean;
  onPress: () => void;
  className?: string;
}) {
  const Icon = ICONS[mode.icon];
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={mode.label}
      title={mode.hint}
      className={cn(
        "relative grid h-14 w-14 place-items-center rounded-full text-white shadow-glow transition active:scale-95",
        className,
      )}
      style={{ background: "linear-gradient(140deg, rgb(var(--rose)), rgb(var(--iris)))" }}
    >
      <span
        className={cn("absolute inset-0 rounded-full", busy ? "animate-pulseRing" : "opacity-0")}
        style={{ background: "rgb(var(--rose)/.55)" }}
      />
      {busy ? <Sparkles size={22} className="animate-pulse" /> : <Icon size={22} />}
    </button>
  );
}

export function PulseButton({
  mode,
  busy,
  onPress,
  expanded,
}: {
  mode: PulseMode;
  busy: boolean;
  onPress: () => void;
  expanded: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-30 flex flex-col items-center gap-2">
      <div
        className={cn(
          "pointer-events-auto max-w-[86%] rounded-full bg-surface px-3.5 py-1.5 text-center text-[11px] leading-snug text-muted shadow-float ring-1 ring-[rgb(var(--line))] transition-all duration-500",
          expanded ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {mode.hint}
      </div>
      <PulseCore mode={mode} busy={busy} onPress={onPress} className="pointer-events-auto" />
    </div>
  );
}
