import { useMemo } from "react";
import { Sparkles, Share2 } from "lucide-react";
import { Button, Card, Header, Spinner } from "@/components/ui";
import { Donut, TrendLine } from "@/components/Charts";
import { Markdown } from "@/lib/markdown";
import { STAGES, stageKey, useT, partnerTypeKey } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { addDays, fmtMoney, todayISO } from "@/lib/ids";
import { shareText, useJob } from "@/lib/app-context";
import { ExportBar } from "@/components/ExportBar";
import { agreementsToSheet, dealsToSheet, meetingsToSheet, partnersToSheet, tasksToSheet } from "@/lib/report";
import { demoText, describeError, hasAI, weeklyReport } from "@/lib/ai";
import type { PartnerType } from "@/types";

export function Reports({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const { partners, deals, agreements, tasks, meetings, studies, settings } = useStore();
  const job = useJob<string>();
  const today = todayISO();

  const byStage = STAGES.filter((s) => s !== "lost").map((s) => ({ name: t(stageKey(s)), value: deals.filter((d) => d.stage === s).reduce((a, d) => a + d.value, 0) })).filter((x) => x.value > 0);
  const byType = useMemo(() => { const m: Record<string, number> = {}; for (const p of partners) m[p.type] = (m[p.type] ?? 0) + 1; return Object.entries(m).map(([k, v]) => ({ name: t(partnerTypeKey(k as PartnerType)), value: v })); }, [partners, t]);
  const completion = useMemo(() => Array.from({ length: 8 }, (_, i) => { const d = addDays(today, -(7 - i)); return { name: d.slice(5), [t("done")]: tasks.filter((x) => x.status === "done" && x.dueAt === d).length, [t("open")]: tasks.filter((x) => x.status === "open" && x.dueAt === d).length }; }), [tasks, today, t]);
  const won = deals.filter((d) => ["signed", "active"].includes(d.stage)).reduce((a, d) => a + d.value, 0);
  const winRate = deals.length ? Math.round((deals.filter((d) => ["signed", "active", "renewal"].includes(d.stage)).length / deals.length) * 100) : 0;

  const generate = () => (hasAI(settings) ? job.run(() => weeklyReport(settings, { partners, deals, agreements, tasks, meetings, studies }), (e) => describeError(e, lang)) : job.setData(demoText(lang, lang === "ar" ? "التقرير الأسبوعي" : "weekly report")));

  return (
    <div className="pb-32">
      <Header title={t("reports")} onBack={onBack} />
      <ExportBar className="mb-3" filename={`partnerhub-${today}`} sheets={() => [partnersToSheet(partners, deals, agreements, lang), dealsToSheet(deals, partners, lang), agreementsToSheet(agreements, partners, lang), tasksToSheet(tasks, partners, lang), meetingsToSheet(meetings, partners, lang)]} />
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Card dark className="text-center"><div className="font-bold text-[16px]">{fmtMoney(won, settings.currency)}</div><div className="text-[10px] text-white/60">{lang === "ar" ? "قيمة موقّعة" : "Signed value"}</div></Card>
        <Card dark className="text-center"><div className="font-bold text-[16px]">{winRate}%</div><div className="text-[10px] text-white/60">{lang === "ar" ? "نسبة الفوز" : "Win rate"}</div></Card>
        <Card dark className="text-center"><div className="font-bold text-[16px]">{studies.filter((s) => s.result?.verdict === "go").length}/{studies.length}</div><div className="text-[10px] text-white/60">GO</div></Card>
      </div>
      <Card className="mb-3"><div className="font-bold mb-1">{t("pipelineByStage")}</div>{byStage.length ? <><Donut data={byStage} /><div className="flex flex-wrap gap-2 text-[11px] text-muted justify-center">{byStage.map((b) => <span key={b.name}>{b.name}: {fmtMoney(b.value, settings.currency)}</span>)}</div></> : <div className="text-muted text-[13px]">{t("noData")}</div>}</Card>
      <Card className="mb-3"><div className="font-bold mb-1">{t("partnersByType")}</div>{byType.length ? <><Donut data={byType} /><div className="flex flex-wrap gap-2 text-[11px] text-muted justify-center">{byType.map((b) => <span key={b.name}>{b.name}: {b.value}</span>)}</div></> : <div className="text-muted text-[13px]">{t("noData")}</div>}</Card>
      <Card className="mb-3"><div className="font-bold mb-1">{t("taskCompletion")}</div><TrendLine data={completion} keys={[t("done"), t("open")]} /></Card>

      <Card dark>
        <div className="flex items-center justify-between"><div className="font-bold">{t("weeklyReport")}</div><Button small onClick={generate}><Sparkles size={13} />{t("generateReport")}</Button></div>
        {job.loading && <Spinner label={t("loading")} />}
        {job.error && <div className="text-urgent text-[12px] mt-2">{job.error}</div>}
        {job.data && <div className="mt-3"><div className="card-white p-3"><Markdown text={job.data} /></div><div className="flex gap-2 mt-2 flex-wrap"><ExportBar filename={`weekly-report-${today}`} title={t("weeklyReport")} markdown={() => job.data!} meta={`${settings.orgName} · ${today}`} /><Button small variant="ghost" onClick={() => shareText(t("weeklyReport"), job.data!)}><Share2 size={12} />{t("share")}</Button></div></div>}
      </Card>
    </div>
  );
}
