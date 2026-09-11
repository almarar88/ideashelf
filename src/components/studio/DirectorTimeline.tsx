import { cn } from "@/lib/cn";

export type Clip = {
  id: string;
  label: string;
  seconds: number;
  colors: [string, string, string];
  generated?: boolean;
};

export function DirectorTimeline({
  clips,
  activeIndex,
}: {
  clips: Clip[];
  activeIndex: number;
}) {
  const total = clips.reduce((s, c) => s + c.seconds, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-16 gap-1 overflow-hidden rounded-xl2">
        {clips.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "relative grid place-items-center transition-all duration-500",
              i === activeIndex ? "ring-2 ring-rose" : "opacity-80",
              c.generated && "border-2 border-dashed border-white/70",
            )}
            style={{
              flexGrow: c.seconds,
              background: `linear-gradient(150deg, ${c.colors[0]}, ${c.colors[1]} 60%, ${c.colors[2]})`,
            }}
            title={`${c.label} · ${c.seconds}ث`}
          >
            <span className="px-1 text-center text-[9.5px] font-medium leading-tight text-white drop-shadow">
              {c.label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] tabular-nums text-muted">
        <span>0:00</span>
        <span>{clips.filter((c) => c.generated).length} لقطة مولّدة (مؤشّرة بالحدود المتقطعة)</span>
        <span>{total} ثانية</span>
      </div>
    </div>
  );
}
