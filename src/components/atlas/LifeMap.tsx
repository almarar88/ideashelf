import { cn } from "@/lib/cn";
import type { AtlasMoment } from "@/lib/types";

const KIND_COLOR: Record<AtlasMoment["kind"], string> = {
  رحلة: "rgb(var(--iris))",
  كتابة: "rgb(var(--rose))",
  لقاء: "rgb(var(--amber))",
  محطة: "rgb(var(--mint))",
};

/** أطلس الحياة: مستوٍ مائل ثلاثي الأبعاد بدل شبكة صور مربعة. */
export function LifeMap({
  moments,
  highlighted,
  selectedId,
  onSelect,
}: {
  moments: AtlasMoment[];
  highlighted: Set<string>;
  selectedId: string | null;
  onSelect: (m: AtlasMoment) => void;
}) {
  const dim = highlighted.size > 0;
  return (
    <div className="relative h-64 overflow-hidden rounded-xl2 bg-[linear-gradient(180deg,rgb(var(--raised)),rgb(var(--surface)))]">
      <div
        className="absolute inset-0"
        style={{ perspective: "760px", perspectiveOrigin: "50% 30%" }}
      >
        <div
          className="absolute inset-x-[-12%] bottom-[-6%] top-[16%]"
          style={{ transform: "rotateX(58deg)", transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                "linear-gradient(rgb(var(--line)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line)) 1px, transparent 1px)",
              backgroundSize: "9% 9%",
              opacity: 1,
              maskImage: "radial-gradient(70% 70% at 50% 45%, #000, transparent)",
              WebkitMaskImage: "radial-gradient(70% 70% at 50% 45%, #000, transparent)",
            }}
          />
          {moments.map((m) => {
            const on = !dim || highlighted.has(m.id);
            const selected = selectedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                aria-label={m.title}
                className={cn(
                  "absolute transition-opacity duration-500",
                  on ? "opacity-100" : "opacity-20",
                )}
                style={{
                  right: `${m.x}%`,
                  top: `${m.y}%`,
                  transform: `translate(50%, -50%) translateZ(${m.depth * 46}px) rotateX(-58deg)`,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* ساق رأسية تربط العلامة بمستوى الأرض — إيحاء العمق */}
                <span
                  className="absolute right-1/2 top-1/2 w-px translate-x-1/2 origin-top"
                  style={{
                    height: `${m.depth * 46}px`,
                    background: `linear-gradient(${KIND_COLOR[m.kind]}, transparent)`,
                    opacity: 0.5,
                  }}
                />
                <span
                  className={cn(
                    "relative block rounded-full transition-all duration-300",
                    selected ? "h-5 w-5" : "h-3.5 w-3.5",
                  )}
                  style={{
                    background: KIND_COLOR[m.kind],
                    boxShadow: `0 0 0 ${selected ? 6 : 3}px ${KIND_COLOR[m.kind]}33, 0 8px 18px -6px ${KIND_COLOR[m.kind]}`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-x-3 gap-y-1 bg-[linear-gradient(0deg,rgb(var(--surface)),transparent)] px-3 pb-2 pt-6 text-[10.5px] text-muted">
        {(Object.keys(KIND_COLOR) as AtlasMoment["kind"][]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
