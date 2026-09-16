import { useId } from "react";

/**
 * The tick-mark arc from the air-conditioner screen, repurposed as a reading
 * progress dial. value is 0..1. Ticks up to the value light up in accent color.
 */
export function Gauge({
  value,
  size = 260,
  ticks = 60,
  children,
  startLabel,
  endLabel,
}: {
  value: number;
  size?: number;
  ticks?: number;
  children?: React.ReactNode;
  startLabel?: string;
  endLabel?: string;
}) {
  const id = useId();
  const r = size / 2;
  const outer = r - 6;
  const inner = r - 34;
  const startDeg = 240; // 300° sweep with a symmetric 60° gap at the bottom, like the reference
  const sweep = 300;
  const active = Math.round(Math.max(0, Math.min(1, value)) * ticks);

  const lines = [];
  for (let i = 0; i <= ticks; i++) {
    const deg = startDeg - (i / ticks) * sweep;
    const rad = (deg * Math.PI) / 180;
    // RTL layout: mirror so progress flows right-to-left visually? Keep LTR sweep for familiarity.
    const x1 = r + Math.cos(rad) * inner;
    const y1 = r - Math.sin(rad) * inner;
    const x2 = r + Math.cos(rad) * outer;
    const y2 = r - Math.sin(rad) * outer;
    const on = i <= active && value > 0;
    lines.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={i % 10 === 0 ? 3 : 2}
        strokeLinecap="round"
        className={on ? "stroke-accent" : "stroke-current opacity-25"}
        style={{ transition: "stroke 0.3s" }}
      />,
    );
  }

  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.9 }} dir="ltr">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-x-0 top-0" aria-labelledby={id}>
        <title id={id}>تقدم القراءة</title>
        {lines}
      </svg>
      <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: size }} dir="rtl">
        {children}
      </div>
      {startLabel && <span className="absolute bottom-0 left-6 text-xs opacity-60">{startLabel}</span>}
      {endLabel && <span className="absolute bottom-0 right-6 text-xs opacity-60">{endLabel}</span>}
    </div>
  );
}
