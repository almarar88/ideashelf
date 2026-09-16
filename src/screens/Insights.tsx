import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight, Zap } from "lucide-react";
import { db, todayKey } from "@/lib/db";
import type { Route } from "@/App";
import { Bars } from "@/components/Bars";
import { Card } from "@/components/ui";
import { formatDuration } from "@/lib/utils";

type Period = "week" | "month";
const DAY_NAMES = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTH_NAMES = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

export function InsightsScreen({ navigate }: { navigate: (r: Route) => void }) {
  const [period, setPeriod] = useState<Period>("week");
  const [open, setOpen] = useState(false);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];
  const analyses = useLiveQuery(() => db.analyses.toArray(), []) ?? [];

  const { data, highlight, current, previous } = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      const days: { label: string; value: number; key: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        days.push({ label: DAY_NAMES[d.getDay()], value: 0, key: todayKey(d) });
      }
      let prev = 0;
      for (const s of sessions) {
        const hit = days.find((d) => d.key === s.day);
        if (hit) hit.value += s.seconds;
        else {
          const d = new Date(s.day);
          const diffDays = (now.getTime() - d.getTime()) / 86400000;
          if (diffDays >= 7 && diffDays < 14) prev += s.seconds;
        }
      }
      return { data: days, highlight: 6, current: days.reduce((a, d) => a + d.value, 0), previous: prev };
    }
    const months: { label: string; value: number; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: MONTH_NAMES[d.getMonth()], value: 0, key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
    }
    for (const s of sessions) {
      const hit = months.find((m) => s.day.startsWith(m.key));
      if (hit) hit.value += s.seconds;
    }
    return { data: months, highlight: 5, current: months[5].value, previous: months[4].value };
  }, [sessions, period]);

  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  const perBook = books
    .map((b) => ({ b, seconds: b.readingSeconds, count: analyses.filter((a) => a.bookId === b.id).length }))
    .sort((a, b) => b.seconds - a.seconds);

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <header className="flex items-start justify-between px-5 pt-5">
        <h1 className="text-2xl font-bold leading-tight">
          تحليل
          <br />
          القراءة
        </h1>
        <div className="relative">
          <button onClick={() => setOpen((v) => !v)} className="flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm text-cream">
            {period === "week" ? "أسبوعي" : "شهري"} <ChevronDown size={16} />
          </button>
          {open && (
            <div className="absolute end-0 top-12 z-10 w-32 overflow-hidden rounded-2xl bg-white shadow-lift">
              {(
                [
                  ["week", "أسبوعي"],
                  ["month", "شهري"],
                ] as [Period, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => {
                    setPeriod(k);
                    setOpen(false);
                  }}
                  className="w-full px-4 py-3 text-start text-sm hover:bg-cream-soft"
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="p-4">
        <Card tone="white" className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-4xl font-bold leading-none">
                {Math.round(current / 60)}
                <span className="ms-1 text-sm font-normal text-ink-muted">دقيقة</span>
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                {delta >= 0 ? "أكثر من" : "أقل من"} {period === "week" ? "الأسبوع الماضي" : "الشهر الماضي"}
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-cream">{Math.abs(delta)}%</span>
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-soft text-accent">
              <Zap size={18} />
            </span>
          </div>
          <div className="mt-6">
            <Bars data={data.map((d) => ({ label: d.label, value: Math.round(d.value / 60) }))} highlightIndex={highlight} height={190} />
          </div>
        </Card>
      </section>

      <section className="px-4 pb-8">
        <Card tone="white" className="p-5">
          <h2 className="mb-3 text-base font-semibold">
            الاستخدام لكل كتاب <span className="text-xs font-normal text-ink-muted">({books.length})</span>
          </h2>
          {perBook.length === 0 && <p className="py-6 text-center text-xs text-ink-muted">لا توجد بيانات بعد. ابدأ بالقراءة.</p>}
          <div className="space-y-2">
            {perBook.map(({ b, seconds, count }) => (
              <button key={b.id} onClick={() => navigate({ name: "reader", bookId: b.id })} className="flex w-full items-center gap-3 rounded-2xl bg-cream-soft p-3 text-start">
                <span className="h-11 w-9 shrink-0 overflow-hidden rounded-lg bg-white">{b.cover && <img src={b.cover} alt="" className="h-full w-full object-cover" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{b.title}</span>
                  <span className="block text-[11px] text-ink-muted">
                    {count} نتيجة ذكاء اصطناعي · {b.lastPage}/{b.pages} صفحة
                  </span>
                </span>
                <span className="text-sm font-bold">{formatDuration(seconds)}</span>
                <ChevronRight size={14} className="rotate-180 text-ink-muted" />
              </button>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
