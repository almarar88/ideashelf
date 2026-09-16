import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button, Card, Empty, Header, Spinner } from "@/components/ui";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/screens/TaskForm";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { fmtDate, todayISO } from "@/lib/ids";
import { ExportBar } from "@/components/ExportBar";
import { tasksToSheet } from "@/lib/report";
import { useJob } from "@/lib/app-context";
import { describeError, hasAI, planDay, type DayPlan } from "@/lib/ai";
import type { Task } from "@/types";

export function Tasks({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const { tasks, partners, deals, agreements, meetings, studies, settings, upsertTask } = useStore();
  const [filter, setFilter] = useState<"open" | "overdue" | "done" | "all">("open");
  const [form, setForm] = useState<{ open: boolean; task?: Task }>({ open: false });
  const today = todayISO();
  const plan = useJob<DayPlan>();

  const list = useMemo(() => tasks.filter((x) => filter === "all" || (filter === "open" && x.status === "open") || (filter === "done" && x.status === "done") || (filter === "overdue" && x.status === "open" && x.dueAt < today)).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || (a.startTime ?? "99").localeCompare(b.startTime ?? "99")), [tasks, filter, today]);

  const groups = useMemo(() => {
    const g: Record<string, Task[]> = {};
    for (const x of list) (g[x.dueAt] ??= []).push(x);
    return Object.entries(g);
  }, [list]);

  const label = (d: string) => (d === today ? `${t("today")} · ${fmtDate(d, { weekday: true, year: false })}` : d === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? `${t("tomorrow")} · ${fmtDate(d, { weekday: true, year: false })}` : fmtDate(d, { weekday: true }));

  const applyPlan = () => {
    if (!plan.data) return;
    for (const item of plan.data.plan) {
      const task = tasks.find((x) => x.dueAt === today && x.status === "open" && x.title === item.taskTitle);
      if (task) upsertTask({ ...task, startTime: item.startTime, endTime: item.endTime });
    }
  };

  return (
    <div className="pb-32">
      <Header title={t("tasks")} onBack={onBack} right={<Button small onClick={() => setForm({ open: true })}><Plus size={14} />{t("addTask")}</Button>} />
      <ExportBar className="mb-3" filename={`tasks-${today}`} sheets={() => [tasksToSheet(tasks, partners, lang)]} />
      <div className="flex gap-2 mb-3">
        {(["open", "overdue", "done", "all"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${filter === f ? "bg-white text-ink" : "bg-white/10"}`}>{t(f)}</button>)}
      </div>
      {hasAI(settings) && (
        <Card dark className="mb-4">
          <div className="flex items-center justify-between">
            <div className="font-bold">{t("planMyDay")}</div>
            <Button small onClick={() => plan.run(() => planDay(settings, tasks.filter((x) => x.status === "open" && x.dueAt <= today), { partners, deals, agreements, tasks, meetings, studies }), (e) => describeError(e, lang))}><Sparkles size={13} />{t("generate")}</Button>
          </div>
          {plan.loading && <Spinner label={t("loading")} />}
          {plan.error && <div className="text-urgent text-[12px] mt-2">{plan.error}</div>}
          {plan.data && (
            <div className="mt-3 text-[13px]">
              <div className="text-white/80 mb-2">🎯 {plan.data.focus}</div>
              {plan.data.plan.map((it, i) => <div key={i} className="flex gap-2 py-1 border-t border-white/10"><span className="text-white/50 w-[92px] shrink-0">{it.startTime}–{it.endTime}</span><span>{it.taskTitle}<span className="text-white/40"> · {it.why}</span></span></div>)}
              {plan.data.skip.length > 0 && <div className="text-white/50 mt-2">⏭ {plan.data.skip.join(" · ")}</div>}
              <Button small variant="light" className="mt-3" onClick={applyPlan}>{t("apply")}</Button>
            </div>
          )}
        </Card>
      )}
      {groups.length === 0 && <Empty>{t("noData")}</Empty>}
      {groups.map(([d, items]) => (
        <div key={d} className="mb-4">
          <div className={`text-[13px] mb-2 ${d < today && filter !== "done" ? "text-urgent" : "text-white/60"}`}>{label(d)}</div>
          <div className="list-grid !gap-2 space-y-2">{items.map((x) => <TaskCard key={x.id} task={x} wide onOpen={() => setForm({ open: true, task: x })} />)}</div>
        </div>
      ))}
      {form.open && <TaskForm open onClose={() => setForm({ open: false })} initial={form.task} />}
    </div>
  );
}
