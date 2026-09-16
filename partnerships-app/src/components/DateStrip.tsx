import { useEffect, useRef } from "react";
import { addDays, fmtMonthYear, todayISO, weekdayName } from "@/lib/ids";
import { useT } from "@/lib/useT";

export function DateStrip({ selected, onSelect, counts }: { selected: string; onSelect: (iso: string) => void; counts: Record<string, number> }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const today = todayISO();
  const days = Array.from({ length: 21 }, (_, i) => addDays(today, i - 7));
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] text-white/70 px-1 mb-2">
        <span className="font-semibold text-white">{fmtMonthYear(selected)}</span>
        {selected !== today && <button onClick={() => onSelect(today)} className="rounded-full bg-white/10 px-3 py-1 text-[12px]">{t("today")}</button>}
      </div>
      <div ref={ref} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
        {days.map((d) => {
          const date = new Date(d + "T00:00:00");
          const isSel = d === selected;
          const n = counts[d] ?? 0;
          return (
            <button key={d} data-day={d} onClick={() => onSelect(d)} className={`relative shrink-0 min-w-[78px] px-2 h-[78px] rounded-[18px] flex flex-col items-center justify-center transition ${isSel ? "bg-white text-ink" : d === today ? "bg-olive-800 text-white ring-1 ring-white/40" : "bg-olive-800 text-white"}`}>
              <span className="text-[22px] font-bold leading-none">{date.getDate()}</span>
              <span className={`text-[12px] mt-1.5 whitespace-nowrap ${isSel ? "text-ink/70" : "text-white/65"}`}>{weekdayName(d)}</span>
              {n > 0 && !isSel && <span className="absolute top-1.5 end-1.5 h-5 min-w-5 px-1 rounded-full bg-white text-ink text-[11px] font-bold flex items-center justify-center">{n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
