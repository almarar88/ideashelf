import { cn } from "@/lib/utils";

/** Segmented bar chart from the "Home Analysis" screen. */
export function Bars({
  data,
  highlightIndex,
  height = 200,
}: {
  data: { label: string; value: number }[];
  highlightIndex?: number;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const segments = 10;
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => {
        const filled = Math.max(d.value > 0 ? 1 : 0, Math.round((d.value / max) * segments));
        const hi = i === highlightIndex;
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-col-reverse gap-[3px]" style={{ height: height - 28 }}>
              {Array.from({ length: segments }).map((_, s) => (
                <div
                  key={s}
                  className={cn(
                    "w-full flex-1 rounded-[3px] transition-colors",
                    s < filled ? (hi ? "bg-accent" : "bg-cream-deep") : "bg-transparent",
                  )}
                />
              ))}
            </div>
            <span className={cn("text-xs", hi ? "font-semibold" : "opacity-60")}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
