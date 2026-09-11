import { cn } from "@/lib/cn";

export function Meter({
  value,
  label,
  hint,
  tone = "rose",
  className,
}: {
  value: number;
  label: string;
  hint?: string;
  tone?: "rose" | "iris" | "mint" | "amber";
  className?: string;
}) {
  const toneClass = {
    rose: "bg-rose",
    iris: "bg-iris",
    mint: "bg-mint",
    amber: "bg-amber",
  }[tone];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">{value}٪</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", toneClass)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {hint && <p className="text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}
