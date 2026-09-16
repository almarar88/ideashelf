import { useEffect, useMemo, useState } from "react";
import { Sparkles, UserRound, Plus, FileSignature, Users, Briefcase, Lightbulb, AlertTriangle, ChevronRight, ChevronLeft, Search } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { DateStrip } from "@/components/DateStrip";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/screens/TaskForm";
import { Button, Card, Pill, SectionTitle, Spinner } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useStore, partnerHealth } from "@/store/useStore";
import { daysBetween, fmtMoney, todayISO } from "@/lib/ids";
import { useApp, useJob } from "@/lib/app-context";
import { hasAI, riskRadar, describeError, type Radar } from "@/lib/ai";
import type { Task } from "@/types";
import type { Tab } from "@/components/BottomNav";

export function Home({ go, openPartner, openSettings }: { go: (t: Tab) => void; openPartner: (id: string) => void; openSettings: () => void }) {
  const { t, lang, dir } = useT();
  const { tasks, partners, deals, agreements, studies, settings, meetings } = useStore();
  const { openAssistant, addTaskSignal } = useApp();
  const setSettings = useStore((s) => s.setSettings);
  const [notifBusy, setNotifBusy] = useState(false);
  useEffect(() => { if (addTaskSignal > 0) setTaskForm({ open: true }); }, [addTaskSignal]);
  const [day, setDay] = useState(todayISO());
  const [taskForm, setTaskForm] = useState<{ open: boolean; task?: Task }>({ open: false });
  const [search, setSearch] = useState(false);
  const today = todayISO();

  const counts = useMemo(() => tasks.filter((x) => x.status === "open").reduce<Record<string, number>>((acc, x) => { acc[x.dueAt] = (acc[x.dueAt] ?? 0) + 1; return acc; }, {}), [tasks]);
  const dayTasks = useMemo(() => tasks.filter((x) => x.dueAt === day).sort((a, b) => (a.status === b.status ? (a.startTime ?? "99").localeCompare(b.startTime ?? "99") : a.status === "done" ? 1 : -1)), [tasks, day]);

  const weighted = deals.filter((d) => !["lost", "signed", "active"].includes(d.stage)).reduce((s, d) => s + d.value * d.probability / 100, 0);
  const active = partners.filter((p) => p.status === "active").length;
  const openTasks = tasks.filter((x) => x.status === "open").length;
  const ready = studies.filter((s) => s.status === "ready").length;

  const renewals = agreements.filter((a) => a.status === "signed").map((a) => ({ a, d: daysBetween(today, a.endAt) })).filter((x) => x.d <= 90).sort((x, y) => x.d - y.d);
  const stale = partners.filter((p) => p.status !== "ended").map((p) => ({ p, d: daysBetween(p.lastContactAt, today) })).filter((x) => x.d >= 21).sort((x, y) => y.d - x.d);
  const overdue = tasks.filter((x) => x.status === "open" && x.dueAt < today).length;
  const stalled = deals.filter((d) => !["lost", "signed", "active"].includes(d.stage) && daysBetween(d.updatedAt, today) > 21);

  const alerts = renewals.filter((r) => r.d <= 45).length + stale.length + overdue + stalled.length;
  const hour = new Date().getHours();
  const greeting = hour < 17 ? t("goodMorning") : t("goodEvening");

  const radar = useJob<Radar>();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="pb-32">
      {/* header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => openAssistant()} className="flex items-center gap-2">
            <Sparkles size={34} strokeWidth={1.6} />
            <span className="text-[30px] font-bold leading-none">{alerts}</span>
          </button>
          <div className="text-[14px] text-white/80 leading-tight">
            <div>{greeting}{settings.userName ? `، ${settings.userName}` : ""}</div>
            <div className="text-white/60">{lang === "ar" ? `${alerts} تنبيهات تحتاج انتباهك` : `${alerts} alerts need attention`}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearch(true)} className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center"><Search size={20} /></button>
          <button onClick={openSettings} className="h-12 w-12 rounded-full border-2 border-white/80 flex items-center justify-center"><UserRound size={22} /></button>
        </div>
      </div>
      <GlobalSearch open={search} onClose={() => setSearch(false)} />

      <div className="mt-4"><DateStrip selected={day} onSelect={setDay} counts={counts} /></div>
      {!settings.notifications && (
        <Card dark className="mt-4 flex items-center gap-3">
          <span className="text-[22px]">🔔</span>
          <div className="flex-1 text-[13px]"><div className="font-bold">{t("notifications")}</div><div className="text-white/60">{t("enableNotifications")}</div></div>
          <Button small disabled={notifBusy} onClick={async () => { setNotifBusy(true); try { const { enableNotifications } = await import("@/lib/notifications"); const ok = await enableNotifications(); setSettings({ notifications: ok }); } finally { setNotifBusy(false); } }}>{t("apply")}</Button>
        </Card>
      )}

      <SectionTitle action={<Button small onClick={() => setTaskForm({ open: true })}><Plus size={14} />{t("addTask")}</Button>}>{t("dayTasks")}</SectionTitle>
      {dayTasks.length === 0 ? (
        <Card dark className="text-white/60 text-[14px]">{t("noTasksToday")}</Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:flex-wrap md:overflow-visible">
          {dayTasks.map((x) => <TaskCard key={x.id} task={x} onOpen={() => setTaskForm({ open: true, task: x })} />)}
        </div>
      )}

      <SectionTitle>{t("pulse")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Briefcase size={22} />} label={t("weightedPipeline")} value={fmtMoney(weighted, settings.currency)} onClick={() => go("pipeline")} />
        <Kpi icon={<Users size={22} />} label={t("activePartners")} value={String(active)} sub={`${partners.length} ${t("all")}`} onClick={() => go("partners")} />
        <Kpi icon={<FileSignature size={22} />} label={t("renewals")} value={String(renewals.length)} sub={`≤ 90 ${t("days")}`} onClick={() => go("more")} />
        <Kpi icon={<Lightbulb size={22} />} label={t("readyStudies")} value={String(ready)} sub={`${openTasks} ${t("openTasks")}`} onClick={() => go("studies")} />
      </div>

      {/* Risk radar: rule-based instantly, AI-deepened on demand */}
      <SectionTitle action={hasAI(settings) ? <Button small variant="ghost" onClick={() => radar.run(() => riskRadar(settings, { partners, deals, agreements, tasks, meetings, studies }), (e) => describeError(e, lang))}><Sparkles size={14} />{t("askAI")}</Button> : undefined}>{t("riskRadar")}</SectionTitle>
      <div className="space-y-2">
        {renewals.filter((r) => r.d <= 45).map(({ a, d }) => (
          <Alert key={a.id} tone={d <= 14 ? "urgent" : "medium"} title={a.title} sub={`${t("expiringSoon")} ${d} ${t("days")} · ${partners.find((p) => p.id === a.partnerId)?.name ?? ""}`} onClick={() => go("more")} />
        ))}
        {stale.slice(0, 3).map(({ p, d }) => (
          <Alert key={p.id} tone={d >= 45 ? "urgent" : "medium"} title={p.name} sub={`${t("stale")} ${d} ${t("days")}`} onClick={() => openPartner(p.id)} />
        ))}
        {stalled.slice(0, 2).map((d) => (
          <Alert key={d.id} tone="medium" title={d.title} sub={`${t(`st_${d.stage}` as "st_lead")} · ${daysBetween(d.updatedAt, today)} ${t("days")}`} onClick={() => go("pipeline")} />
        ))}
        {overdue > 0 && <Alert tone="urgent" title={`${overdue} ${t("overdue")}`} sub={t("tasks")} onClick={() => go("more")} />}
        {alerts === 0 && <Card dark className="text-white/60 text-[14px]">✓ {lang === "ar" ? "لا مخاطر عاجلة اليوم" : "No urgent risks today"}</Card>}
        {radar.loading && <Spinner label={t("loading")} />}
        {radar.error && <Card dark className="text-urgent text-[13px]">{radar.error}</Card>}
        {radar.data?.items.map((it, i) => (
          <Card key={i} dark className="border border-white/10">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className={it.severity === "high" ? "text-urgent" : it.severity === "medium" ? "text-medium" : "text-white/60"} />
              <div className="flex-1">
                <div className="font-bold text-[15px]">{it.title}</div>
                <div className="text-[13px] text-white/70 mt-1">{it.detail}</div>
                <div className="text-[13px] mt-2"><span className="text-white/50">→ </span>{it.action}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle action={<button onClick={() => go("partners")} className="text-[13px] text-white/70 flex items-center">{t("seeAll")}<Arrow size={16} /></button>}>{t("partnerHealth")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {partners.filter((p) => p.status !== "ended").slice(0, 4).map((p) => {
          const h = partnerHealth(p, deals, agreements, tasks);
          return (
            <Card key={p.id} dark onClick={() => openPartner(p.id)}>
              <div className="flex items-center justify-between">
                <Pill tone={h >= 70 ? "ok" : h >= 45 ? "medium" : "urgent"}>{h}%</Pill>
                <span className="text-[11px] text-white/50">{t(`t_${p.type}` as "t_strategic")}</span>
              </div>
              <div className="mt-3 font-bold text-[16px] leading-tight line-clamp-2">{p.name}</div>
              <div className="text-[12px] text-white/50 mt-1">{t("lastContact")}: {daysBetween(p.lastContactAt, today)} {t("days")}</div>
            </Card>
          );
        })}
      </div>

      {taskForm.open && <TaskForm open onClose={() => setTaskForm({ open: false })} initial={taskForm.task} defaults={{ dueAt: day }} />}
    </div>
  );
}

function Kpi({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: string; sub?: string; onClick: () => void }) {
  return (
    <Card dark onClick={onClick} className="min-h-[124px] flex flex-col justify-between">
      <div className="h-9 w-9 rounded-xl border border-white/20 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-[20px] font-bold leading-tight">{value}</div>
        <div className="text-[13px] text-white/70 leading-tight mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-white/40 mt-0.5">{sub}</div>}
      </div>
    </Card>
  );
}

function Alert({ tone, title, sub, onClick }: { tone: "urgent" | "medium"; title: string; sub: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="card-white p-3 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${tone === "urgent" ? "bg-urgent" : "bg-medium"}`} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-[14px] truncate">{title}</div>
        <div className="text-[12px] text-muted truncate">{sub}</div>
      </div>
    </div>
  );
}
