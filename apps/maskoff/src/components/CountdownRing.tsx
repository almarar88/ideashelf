import { useEffect, useRef } from "react";
import { formatCountdown, type Countdown } from "@/lib/time";
import { sfx } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Progress ring + tabular countdown.
 *
 * Under ten seconds it switches to a per-second tick and a pulsing alert
 * colour — the dramatic pre-reveal beat the game is built around.
 */
export function CountdownRing({
  countdown,
  totalMs,
  label,
  accent = "#8B5CF6",
  sound = true,
}: {
  countdown: Countdown;
  totalMs: number;
  label: string;
  accent?: string;
  sound?: boolean;
}) {
  const lastTick = useRef(-1);
  const seconds = Math.ceil(countdown.totalMs / 1000);
  const urgent = seconds <= 10 && seconds > 0;

  useEffect(() => {
    if (!sound || !urgent) return;
    if (lastTick.current === seconds) return;
    lastTick.current = seconds;
    sfx("tick");
  }, [seconds, urgent, sound]);

  const progress = totalMs > 0 ? 1 - Math.min(1, countdown.totalMs / totalMs) : 1;
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const color = urgent ? "#EF4444" : accent;

  return (
    <div className="relative mx-auto grid h-[204px] w-[204px] place-items-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset .9s linear, stroke .3s ease" }}
        />
      </svg>
      <div
        className={cn("absolute inset-3 rounded-pill", urgent && "animate-pulse-ring")}
        style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 68%)` }}
        aria-hidden
      />
      <div className="relative text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</div>
        <div
          className={cn("tnum mt-1 font-display text-[38px] font-extrabold leading-none", urgent && "text-alert")}
          role="timer"
          aria-live="off"
        >
          {formatCountdown(countdown)}
        </div>
      </div>
    </div>
  );
}
