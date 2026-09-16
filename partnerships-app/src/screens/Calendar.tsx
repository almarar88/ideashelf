import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckSquare, Briefcase, FileSignature, CalendarDays } from "lucide-react";
import { Card, Header } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { fmtDate, fmtMonthYear, todayISO, weekdayName } from "@/lib/ids";
import { useApp } from "@/lib/app-context";

type Ev = { date: string; kind: "task" | "deal" | "agreement" | "meeting"; title: string; sub: string; id: string; partnerId?: string };

export function Calendar({ onBack }: { onBack: () => void }) {
  const { t, dir } = useT();
  const { tasks, deals, agreements, meetings, partners } = useStore();
  const { navigate } = useApp();
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);

  const events = useMemo<Ev[]>(() => {
    const pn = (id?: string) => partners.find((p) => p.id === id)?.name ?? "";
    return [
      ...tasks.filter((x) => x.status === "open").map((x) => ({ date: x.dueAt, kind: "task" as const, title: x.title, sub: `${t(x.priority)}${x.startTime ? ` · ${x.startTime}` : ""}`, id: x.id, partnerId: x.partnerId })),
      ...deals.filter((d) => !["lost", "signed", "active"].includes(d.stage)).map((d) => ({ date: d.expectedCloseAt, kind: "deal" as const, title: d.title, sub: `${t("dealsClosing")} · ${pn(d.partnerId)}`, id: d.id, partnerId: d.partnerId })),
      ...agreements.filter((a) => a.status === "signed").map((a) => ({ date: a.endAt, kind: "agreement" as const, title: a.title, sub: `${t("agreementsEnding")} · ${pn(a.partnerId)}`, id: a.id, partnerId: a.partnerId })),
      ...meetings.map((m) => ({ date: m.at, kind: "meeting" as const, title: m.title, sub: `${t("meetings")} · ${pn(m.partnerId)}`, id: m.id, partnerId: m.partnerId })),
    ];
  }, [tasks, deals, agreements, meetings, partners, t]);

  const first = new Date(month + "-01T00:00:00");
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const startPad = first.getDay();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const byDay = useMemo(() => events.reduce<Record<string, Ev[]>>((acc, e) => { (acc[e.date] ??= []).push(e); return acc; }, {}), [events]);
  const shift = (n: number) => { const d = new Date(first); d.setMonth(d.getMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft; const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const dot: Record<Ev["kind"], string> = { task: "bg-urgent", deal: "bg-medium", agreement: "bg-info", meeting: "bg-ok" };
  const icon: Record<Ev["kind"], typeof CheckSquare> = { task: CheckSquare, deal: Briefcase, agreement: FileSignature, meeting: CalendarDays };
  const weekHead = Array.from({ length: 7 }, (_, i) => weekdayName(`2026-03-0${i + 1}`, true)); // 2026-03-01 is a Sunday
  const dayEvents = byDay[sel] ?? [];

  return (
    <div className="pb-32">
      <Header title={t("calendar")} onBack={onBack} />
      <div className="md:grid md:grid-cols-2 md:gap-6">
        <Card dark>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => shift(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center"><Prev size={18} /></button>
            <div className="font-bold text-[16px]">{fmtMonthYear(month + "-01")}</div>
            <button onClick={() => shift(1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center"><Next size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/50 mb-1">{weekHead.map((w, i) => <div key={i}>{w}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => d === null ? <div key={i} /> : (
              <button key={d} onClick={() => setSel(d)} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[13px] ${d === sel ? "bg-white text-ink font-bold" : d === today ? "bg-white/15 font-bold" : "bg-white/5"}`}>
                {Number(d.slice(8))}
                <div className="flex gap-0.5 mt-0.5 h-1.5">{[...new Set((byDay[d] ?? []).map((e) => e.kind))].slice(0, 4).map((k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${d === sel ? "bg-ink/50" : dot[k]}`} />)}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap mt-3 text-[11px] text-white/60">{(["task", "deal", "agreement", "meeting"] as const).map((k) => <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${dot[k]}`} />{k === "task" ? t("tasks") : k === "deal" ? t("dealsClosing") : k === "agreement" ? t("agreementsEnding") : t("meetings")}</span>)}</div>
        </Card>
        <div className="mt-4 md:mt-0">
          <div className="text-[13px] text-white/60 mb-2">{fmtDate(sel, { weekday: true })}</div>
          <div className="space-y-2">
            {dayEvents.length === 0 && <Card dark className="text-white/40 text-[13px]">—</Card>}
            {dayEvents.map((e) => { const I = icon[e.kind]; return (
              <Card key={e.kind + e.id} onClick={() => navigate(e.kind === "task" ? { kind: "sub", sub: "tasks" } : e.kind === "deal" ? { kind: "tab", tab: "pipeline" } : e.kind === "agreement" ? { kind: "sub", sub: "agreements" } : { kind: "sub", sub: "meetings" })} className="flex items-center gap-3">
                <span className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${dot[e.kind]}`}><I size={16} /></span>
                <div className="min-w-0"><div className="font-semibold truncate">{e.title}</div><div className="text-[12px] text-muted truncate">{e.sub}</div></div>
              </Card>
            ); })}
          </div>
        </div>
      </div>
    </div>
  );
}
