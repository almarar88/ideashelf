import { useMemo, useState } from "react";
import { Plus, Sparkles, RefreshCw, ClipboardCheck, GitCompare, Users, Trash2 } from "lucide-react";
import { ExportBar } from "@/components/ExportBar";
import { studyMeta, studyToMarkdown, studyToSheets } from "@/lib/report";
import { Button, Card, Empty, Field, Header, Input, Pill, Select, Sheet, Spinner, TextArea } from "@/components/ui";
import { CashflowChart, CumulativeChart, RadarScores } from "@/components/Charts";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { addDays, fmtDate, fmtMoney, todayISO, uid } from "@/lib/ids";
import { applySensitivity, overallScore, project } from "@/lib/finance";
import { useAgentContext, useApp, useJob, useWide } from "@/lib/app-context";
import { foreground, nativeNotify } from "@/lib/native";
import { demoStudy, describeError, generateStudy, hasAI, matchPartners, type PartnerMatch } from "@/lib/ai";
import type { Study, StudyInput } from "@/types";

export function Studies({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { t } = useT();
  const { studies, settings } = useStore();
  const wide = useWide();
  const [wizard, setWizard] = useState(false);
  const [compare, setCompare] = useState(false);

  const selected = selectedId ? studies.find((x) => x.id === selectedId) : undefined;
  if (selected && !wide) return <StudyDetail study={selected} onBack={() => onSelect(null)} />;

  const listView = (
    <div className="pb-32">
      <Header title={t("studies")} right={<Button small onClick={() => setWizard(true)}><Plus size={14} />{t("newStudy")}</Button>} />
      {studies.length >= 2 && <Button small variant="ghost" className="mb-3" onClick={() => setCompare(true)}><GitCompare size={13} />{t("compare")}</Button>}
      {studies.length === 0 && <Empty>{t("noStudies")}</Empty>}
      <div className="list-grid">
        {studies.map((s) => {
          const score = s.result ? overallScore(s.result.scores) : null;
          const pr = s.result ? project(s.result.financial) : null;
          return (
            <Card key={s.id} onClick={() => onSelect(s.id)} className={wide && s.id === selectedId ? "ring-2 ring-white" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-bold text-[17px] leading-tight">{s.input.title}</div><div className="text-[12px] text-muted mt-0.5">{s.input.sector} · {s.input.country} · {s.input.horizonYears} {t("years")}</div></div>
                {s.result ? <VerdictPill v={s.result.verdict} /> : <Pill tone={s.status === "generating" ? "medium" : s.status === "error" ? "urgent" : "dark"}>{s.status === "generating" ? t("generating") : s.status === "error" ? t("error") : t("as_draft")}</Pill>}
              </div>
              {s.result && pr && (
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Stat label={t("overall")} value={`${score}`} />
                  <Stat label={t("npv")} value={fmtMoney(pr.npv, s.input.currency)} tone={pr.npv >= 0 ? "text-ok" : "text-urgent"} />
                  <Stat label={t("irr")} value={pr.irr === null ? "—" : `${pr.irr.toFixed(0)}%`} />
                </div>
              )}
              <div className="text-[11px] text-muted mt-2">{s.generatedBy === "ai" ? `✦ ${t("aiBadge")}` : s.generatedBy === "demo" ? `⚠ ${t("demoBadge")}` : ""} · {fmtDate(s.updatedAt)}</div>
            </Card>
          );
        })}
      </div>
      {wizard && <StudyWizard onClose={() => setWizard(false)} onCreated={(id) => { setWizard(false); onSelect(id); }} />}
      <Sheet open={compare} onClose={() => setCompare(false)} title={t("compare")} full>
        <CompareTable studies={studies.filter((s) => s.result)} currency={settings.currency} />
      </Sheet>
    </div>
  );
  if (!wide) return listView;
  return (
    <div className="md:grid md:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] md:gap-6">
      <div className="min-w-0">{listView}</div>
      <div className="min-w-0">{selected ? <StudyDetail key={selected.id} study={selected} onBack={() => onSelect(null)} /> : <div className="text-white/40 text-center pt-24">{t("noStudies")}</div>}</div>
    </div>
  );
}

const Stat = ({ label, value, tone = "" }: { label: string; value: string; tone?: string }) => (
  <div className="bg-olive-50 rounded-xl py-2 px-1"><div className={`font-bold text-[14px] ${tone}`}>{value}</div><div className="text-[10px] text-muted">{label}</div></div>
);

function VerdictPill({ v }: { v: Study["result"] extends infer R ? (R extends { verdict: infer V } ? V : never) : never }) {
  const { t } = useT();
  return <Pill tone={v === "go" ? "ok" : v === "conditional" ? "medium" : "urgent"}>{t(`v_${v}` as "v_go")}</Pill>;
}

/* ---------------- Wizard ---------------- */

function StudyWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t, lang } = useT();
  const { partners, settings, upsertStudy } = useStore();
  const [f, setF] = useState<StudyInput>({ title: "", idea: "", sector: "", country: "", targetMarket: "", currency: settings.currency, horizonYears: 5, objectives: "", budgetHint: undefined, partnerId: undefined });
  const set = <K extends keyof StudyInput>(k: K, v: StudyInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const [step, setStep] = useState(0);
  const step0ok = !!(f.title.trim() && f.idea.trim());
  const valid = step0ok && !!f.sector.trim();

  const start = async () => {
    if (!valid) return;
    const id = uid();
    const now = new Date().toISOString();
    const study: Study = { id, input: f, status: "generating", createdAt: now, updatedAt: now };
    upsertStudy(study);
    onCreated(id);
    if (!hasAI(settings)) {
      upsertStudy({ ...study, status: "ready", result: demoStudy(f, lang), generatedBy: "demo", updatedAt: new Date().toISOString() });
      return;
    }
    void foreground(true, lang === "ar" ? "جارٍ توليد دراسة الجدوى" : "Generating feasibility study", f.title);
    try {
      const result = await generateStudy(settings, f, partners.find((p) => p.id === f.partnerId));
      upsertStudy({ ...study, status: "ready", result, generatedBy: "ai", updatedAt: new Date().toISOString() });
      void nativeNotify(lang === "ar" ? "✓ دراسة الجدوى جاهزة" : "✓ Feasibility study ready", `${f.title} · ${result.verdict.toUpperCase()}`, { channel: "agent", action: "home" });
    } catch (e) {
      upsertStudy({ ...study, status: "error", error: describeError(e, lang), updatedAt: new Date().toISOString() });
      void nativeNotify(lang === "ar" ? "⚠ تعذر توليد الدراسة" : "⚠ Study generation failed", f.title, { channel: "agent", action: "home" });
    } finally { void foreground(false); }
  };

  return (
    <Sheet open onClose={onClose} title={t("newStudy")} full>
      <div className="flex gap-1 mb-4">{[0, 1, 2].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-white" : "bg-white/20"}`} />)}</div>
      {step === 0 && (
        <>
          <Field label={t("studyTitle")}><Input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus placeholder={lang === "ar" ? "مثال: منصة تدريب مشتركة" : "e.g. Joint training platform"} /></Field>
          <Field label={t("idea")}><TextArea value={f.idea} onChange={(e) => set("idea", e.target.value)} className="min-h-[130px]" placeholder={lang === "ar" ? "اشرح الفكرة: ماذا، لمن، كيف تحقق قيمة..." : "Describe the idea: what, for whom, how it creates value..."} /></Field>
          <Field label={t("objectives")}><TextArea value={f.objectives} onChange={(e) => set("objectives", e.target.value)} placeholder={lang === "ar" ? "الأهداف الاستراتيجية للقسم من هذا المشروع" : "The department's strategic objectives for this project"} /></Field>
        </>
      )}
      {step === 1 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("sector")}><Input value={f.sector} onChange={(e) => set("sector", e.target.value)} /></Field>
            <Field label={t("country")}><Input value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
          </div>
          <Field label={t("targetMarket")}><Input value={f.targetMarket} onChange={(e) => set("targetMarket", e.target.value)} placeholder={lang === "ar" ? "المنشآت الصغيرة، الطلاب، الجهات الحكومية..." : "SMEs, students, government entities..."} /></Field>
          <Field label={t("partner")}><Select value={f.partnerId ?? ""} onChange={(e) => set("partnerId", e.target.value || undefined)}><option value="">{t("none")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        </>
      )}
      {step === 2 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("budgetHint")}><Input type="number" value={f.budgetHint ?? ""} onChange={(e) => set("budgetHint", e.target.value ? Number(e.target.value) : undefined)} /></Field>
            <Field label={t("currency")}><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
          </div>
          <div className="label">{t("horizon")}</div>
          <div className="flex gap-2 mb-4">{([3, 5] as const).map((h) => <button key={h} onClick={() => set("horizonYears", h)} className={`flex-1 rounded-full py-2 font-semibold ${f.horizonYears === h ? "bg-white text-ink" : "bg-white/10"}`}>{h} {t("years")}</button>)}</div>
          {!hasAI(settings) && <Card dark className="text-[12px] text-white/70 mb-3">⚠ {t("aiNeedsKey")}</Card>}
        </>
      )}
      <div className="flex gap-2 mt-2">
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>{t("back")}</Button>}
        {step < 2 ? <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={(step === 0 && !step0ok) || (step === 1 && !f.sector.trim())}>→</Button> : <Button className="flex-1" onClick={start} disabled={!valid}><Sparkles size={15} />{t("generate")}</Button>}
      </div>
    </Sheet>
  );
}

/* ---------------- Detail ---------------- */

function StudyDetail({ study, onBack }: { study: Study; onBack: () => void }) {
  const { t, lang } = useT();
  const { settings, partners, upsertStudy, removeStudy, upsertTask } = useStore();
  const { toast } = useApp();
  const [sens, setSens] = useState({ revenue: 0, cost: 0, capex: 0, discount: 0 });
  const [tab, setTab] = useState<"summary" | "market" | "financial" | "risks" | "plan">("summary");
  const match = useJob<PartnerMatch>();
  const r = study.result;
  useAgentContext({ label: `${t("studies")}: ${study.input.title}`, detail: `${study.input.sector} · ${study.input.country} · ${r ? r.verdict : study.status}` });
  const cur = study.input.currency;

  const base = useMemo(() => (r ? project(r.financial) : null), [r]);
  const adj = useMemo(() => (r ? project(applySensitivity(r.financial, sens)) : null), [r, sens]);

  const regenerate = async () => {
    upsertStudy({ ...study, status: "generating", error: undefined });
    if (!hasAI(settings)) { upsertStudy({ ...study, status: "ready", result: demoStudy(study.input, lang), generatedBy: "demo", updatedAt: new Date().toISOString() }); return; }
    try { const result = await generateStudy(settings, study.input, partners.find((p) => p.id === study.input.partnerId)); upsertStudy({ ...study, status: "ready", result, generatedBy: "ai", updatedAt: new Date().toISOString() }); }
    catch (e) { upsertStudy({ ...study, status: "error", error: describeError(e, lang) }); }
  };

  const stepsToTasks = () => {
    r?.nextSteps.forEach((s, i) => upsertTask({ id: uid(), title: s, priority: i === 0 ? "urgent" : "medium", status: "open", dueAt: addDays(todayISO(), 3 + i * 4), studyId: study.id, partnerId: study.input.partnerId, assignee: settings.userName || "—", createdAt: new Date().toISOString(), source: "ai" }));
    toast(`✓ ${r?.nextSteps.length}`);
  };

  if (study.status === "generating") return (
    <div className="pb-32"><Header title={study.input.title} onBack={onBack} />
      <Card dark className="text-center py-10"><Spinner label={t("generating")} /><div className="text-[12px] text-white/50 mt-3">{lang === "ar" ? "يحلل السوق، الجوانب الفنية والقانونية، ويبني النموذج المالي..." : "Analyzing market, technical and legal aspects, building the financial model..."}</div></Card>
    </div>
  );
  if (study.status === "error" || !r || !base || !adj) return (
    <div className="pb-32"><Header title={study.input.title} onBack={onBack} />
      <Card dark><div className="text-urgent">{study.error ?? t("error")}</div><div className="flex gap-2 mt-3"><Button small onClick={regenerate}><RefreshCw size={13} />{t("regenerate")}</Button><Button small variant="danger" onClick={() => { removeStudy(study.id); onBack(); }}><Trash2 size={13} />{t("delete")}</Button></div></Card>
    </div>
  );

  const score = overallScore(r.scores);
  const tabs: { id: typeof tab; label: string }[] = [{ id: "summary", label: t("execSummary") }, { id: "market", label: t("marketStudy") }, { id: "financial", label: t("financialStudy") }, { id: "risks", label: t("risks") }, { id: "plan", label: t("nextSteps") }];

  return (
    <div className="pb-32">
      <Header title={study.input.title} subtitle={`${study.input.sector} · ${study.input.country}`} onBack={onBack} />
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <VerdictPill v={r.verdict} />
        <Pill tone="light">{t("overall")} {score}</Pill>
        <Pill tone="ghost">{study.generatedBy === "ai" ? `✦ ${t("aiBadge")}` : `⚠ ${t("demoBadge")}`}</Pill>
      </div>
      <ExportBar className="mb-2" filename={`study-${study.input.title}`} title={study.input.title} sheets={() => studyToSheets(study, lang)} markdown={() => studyToMarkdown(study, lang)} meta={studyMeta(study, lang)} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-3">
        <Button small variant="ghost" onClick={stepsToTasks}><ClipboardCheck size={13} />{t("createTasksFromSteps")}</Button>
        {hasAI(settings) && <Button small variant="ghost" onClick={() => match.run(() => matchPartners(settings, study, partners), (e) => describeError(e, lang))}><Users size={13} />{lang === "ar" ? "مطابقة الشركاء" : "Match partners"}</Button>}
        <Button small variant="ghost" onClick={regenerate}><RefreshCw size={13} />{t("regenerate")}</Button>
        <Button small variant="ghost" onClick={() => { if (confirm(t("confirmDelete"))) { removeStudy(study.id); onBack(); } }}><Trash2 size={13} /></Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4">
        {tabs.map((x) => <button key={x.id} onClick={() => setTab(x.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${tab === x.id ? "bg-white text-ink" : "bg-white/10"}`}>{x.label}</button>)}
      </div>

      {match.loading && <Spinner label={t("loading")} />}
      {match.error && <Card dark className="text-urgent text-[12px] mb-3">{match.error}</Card>}
      {match.data && (
        <Card className="mb-4 text-[13px]">
          <div className="font-bold mb-2">{lang === "ar" ? "الشركاء الأنسب" : "Best-fit partners"}</div>
          {match.data.existing.map((e) => <div key={e.partnerId} className="flex gap-2 py-1 border-t border-black/5"><Pill tone={e.fit >= 70 ? "ok" : "medium"}>{e.fit}</Pill><div><div className="font-semibold">{partners.find((p) => p.id === e.partnerId)?.name ?? e.partnerId}</div><div className="text-muted">{e.why}</div></div></div>)}
          {match.data.newProfiles.map((n, i) => <div key={i} className="py-1 border-t border-black/5"><div className="font-semibold">＋ {n.profile}</div><div className="text-muted">{n.why} · {n.howToFind}</div></div>)}
        </Card>
      )}

      {tab === "summary" && (
        <div className="space-y-3">
          <Card><div className="text-[14px] leading-relaxed whitespace-pre-wrap">{r.executiveSummary}</div></Card>
          <Card><div className="font-bold mb-2">{t("scores")}</div><RadarScores scores={{ [t("marketStudy")]: r.scores.market, [t("technicalStudy")]: r.scores.technical, [t("financialStudy")]: r.scores.financial, [t("legalStudy")]: r.scores.legal, [lang === "ar" ? "استراتيجي" : "Strategic"]: r.scores.strategic }} /></Card>
          <Card><div className="font-bold mb-1">{t("verdict")}: <VerdictPill v={r.verdict} /></div><div className="text-[13px] mt-2">{r.verdictReason}</div></Card>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t("npv")} value={fmtMoney(base.npv, cur)} tone={base.npv >= 0 ? "text-ok" : "text-urgent"} />
            <Stat label={t("irr")} value={base.irr === null ? "—" : `${base.irr.toFixed(1)}%`} />
            <Stat label={t("payback")} value={base.paybackYears === null ? "—" : `${base.paybackYears.toFixed(1)} ${t("years")}`} />
            <Stat label={t("roi")} value={`${base.roi.toFixed(0)}%`} />
          </div>
          <Card><div className="font-bold mb-2">{t("partnershipModels")}</div>{r.partnershipModels.map((m, i) => <div key={i} className="flex gap-2 py-1.5 border-t border-black/5 text-[13px]"><Pill tone={m.fit >= 70 ? "ok" : m.fit >= 45 ? "medium" : "dark"}>{m.fit}</Pill><div><div className="font-semibold">{m.name}</div><div className="text-muted">{m.description}</div></div></div>)}</Card>
          <Card><div className="font-bold mb-2">{t("swot")}</div><div className="grid grid-cols-2 gap-2 text-[12px]">
            {([["strengths", "bg-ok/15"], ["weaknesses", "bg-urgent/15"], ["opportunities", "bg-info/15"], ["threats", "bg-medium/15"]] as const).map(([k, bg]) => <div key={k} className={`rounded-xl p-2 ${bg}`}><div className="font-bold mb-1">{t(k)}</div><ul className="list-disc ps-3">{r.swot[k].map((x, i) => <li key={i}>{x}</li>)}</ul></div>)}
          </div></Card>
        </div>
      )}

      {tab === "market" && (
        <div className="space-y-3">
          <Card><div className="font-bold mb-1">{t("marketStudy")}</div><div className="text-[13px]"><div><span className="text-muted">Size: </span>{r.market.size}</div><div><span className="text-muted">Growth: </span>{r.market.growth}</div></div>
            <div className="font-bold mt-3 mb-1 text-[13px]">{lang === "ar" ? "الشرائح" : "Segments"}</div><div className="flex flex-wrap gap-1">{r.market.segments.map((s, i) => <span key={i} className="text-[11px] bg-olive-100 rounded-full px-2 py-0.5">{s}</span>)}</div>
            <div className="font-bold mt-3 mb-1 text-[13px]">{lang === "ar" ? "المنافسون" : "Competitors"}</div>{r.market.competitors.map((c, i) => <div key={i} className="text-[12px] py-1 border-t border-black/5"><b>{c.name}</b> — {c.note}</div>)}
            <div className="font-bold mt-3 mb-1 text-[13px]">{lang === "ar" ? "محركات الطلب" : "Demand drivers"}</div><ul className="list-disc ps-4 text-[12px]">{r.market.demandDrivers.map((d, i) => <li key={i}>{d}</li>)}</ul></Card>
          <Card><div className="font-bold mb-1">{t("technicalStudy")}</div><ul className="list-disc ps-4 text-[12px]">{r.technical.requirements.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <div className="font-bold mt-3 mb-1 text-[13px]">{t("timeline")} · {r.technical.timelineMonths} {t("months")}</div>
            <div className="relative ps-4 border-s-2 border-olive-200 ms-2 space-y-2">{r.technical.milestones.map((m, i) => <div key={i} className="text-[12px] relative"><span className="absolute -start-[21px] top-1 h-3 w-3 rounded-full bg-olive-500" /><b>M{m.month}</b> · {m.name}</div>)}</div></Card>
          <Card><div className="font-bold mb-1">{t("legalStudy")}</div><ul className="list-disc ps-4 text-[12px]">{r.legal.map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
          <Card><div className="font-bold mb-1">{t("operationsStudy")}</div><ul className="list-disc ps-4 text-[12px]">{r.operations.map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
        </div>
      )}

      {tab === "financial" && (
        <div className="space-y-3">
          <Card>
            <div className="font-bold mb-2">{t("cashflow")}</div>
            <CashflowChart rows={adj.years} />
            <div className="flex gap-3 text-[11px] text-muted justify-center"><span>■ {t("revenue")}</span><span className="text-medium">■ {t("costs")}</span><span className="text-ok">■ {t("cashflow")}</span></div>
          </Card>
          <Card><div className="font-bold mb-2">{t("cumulative")}</div><CumulativeChart rows={adj.years} /></Card>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t("npv")} value={fmtMoney(adj.npv, cur)} tone={adj.npv >= 0 ? "text-ok" : "text-urgent"} />
            <Stat label={t("irr")} value={adj.irr === null ? "—" : `${adj.irr.toFixed(1)}%`} />
            <Stat label={t("payback")} value={adj.paybackYears === null ? "—" : `${adj.paybackYears.toFixed(1)} ${t("years")}`} />
            <Stat label={t("breakEven")} value={adj.breakEvenUnitsMonthly === null ? "—" : `${Math.ceil(adj.breakEvenUnitsMonthly)} ${t("unitsPerMonth")}`} />
          </div>
          <Card>
            <div className="font-bold mb-1">{t("sensitivity")}</div>
            <div className="text-[11px] text-muted mb-3">{lang === "ar" ? "حرّك المؤشرات لترى أثرها الفوري على NPV و IRR" : "Drag to see the live effect on NPV and IRR"}</div>
            {([["revenue", t("revenue"), -50, 50], ["cost", t("costs"), -50, 50], ["capex", t("capex"), -50, 50], ["discount", t("discountRate"), -5, 10]] as const).map(([k, label, min, max]) => (
              <div key={k} className="mb-2"><div className="flex justify-between text-[12px]"><span>{label}</span><b>{sens[k] > 0 ? "+" : ""}{sens[k]}{k === "discount" ? " pt" : "%"}</b></div><input type="range" min={min} max={max} value={sens[k]} onChange={(e) => setSens({ ...sens, [k]: Number(e.target.value) })} className="w-full accent-olive-500" /></div>
            ))}
            <button onClick={() => setSens({ revenue: 0, cost: 0, capex: 0, discount: 0 })} className="text-[12px] text-info">↺ reset</button>
          </Card>
          <Card>
            <div className="font-bold mb-2">{lang === "ar" ? "الافتراضات" : "Assumptions"}</div>
            <table className="w-full text-[12px]"><tbody>
              {[[t("capex"), fmtMoney(r.financial.capex, cur)], [t("opex"), fmtMoney(r.financial.opexMonthly, cur)], [t("discountRate"), `${r.financial.discountRatePct}%`], [lang === "ar" ? "الضريبة" : "Tax", `${r.financial.taxPct}%`], [lang === "ar" ? "نمو التكاليف" : "Cost growth", `${r.financial.costGrowthPct}%`], ...(r.financial.unitPrice ? [[lang === "ar" ? "سعر الوحدة / تكلفتها" : "Unit price / cost", `${r.financial.unitPrice} / ${r.financial.unitCost}`]] : [])].map(([a, b], i) => <tr key={i} className="border-t border-black/5"><td className="py-1 text-muted">{a}</td><td className="py-1 text-end font-semibold">{b}</td></tr>)}
            </tbody></table>
            <table className="w-full text-[12px] mt-3"><thead><tr className="text-muted"><th className="text-start">{t("year")}</th><th className="text-end">{t("revenue")}</th><th className="text-end">{t("costs")}</th><th className="text-end">{t("cashflow")}</th></tr></thead><tbody>
              {adj.years.map((y) => <tr key={y.year} className="border-t border-black/5"><td className="py-1">{y.year}</td><td className="text-end">{fmtMoney(y.revenue, "")}</td><td className="text-end">{fmtMoney(y.cost, "")}</td><td className={`text-end font-semibold ${y.cashflow >= 0 ? "text-ok" : "text-urgent"}`}>{fmtMoney(y.cashflow, "")}</td></tr>)}
            </tbody></table>
          </Card>
        </div>
      )}

      {tab === "risks" && (
        <div className="space-y-3">
          <Card>
            <div className="font-bold mb-2">{lang === "ar" ? "مصفوفة المخاطر" : "Risk matrix"}</div>
            <div className="grid grid-cols-5 gap-1 aspect-square max-w-[260px] mx-auto">
              {Array.from({ length: 25 }, (_, i) => { const imp = 5 - Math.floor(i / 5); const prob = (i % 5) + 1; const items = r.risks.filter((k) => k.impact === imp && k.probability === prob); const sev = imp * prob; return <div key={i} className={`rounded-md flex items-center justify-center text-[11px] font-bold ${sev >= 15 ? "bg-urgent/70" : sev >= 8 ? "bg-medium/70" : "bg-ok/40"}`}>{items.length > 0 ? items.length : ""}</div>; })}
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1 max-w-[260px] mx-auto"><span>{t("probabilityShort")} →</span><span>↑ {t("impact")}</span></div>
          </Card>
          {r.risks.slice().sort((a, b) => b.probability * b.impact - a.probability * a.impact).map((k, i) => (
            <Card key={i}><div className="flex items-center justify-between"><div className="font-bold text-[14px]">{k.title}</div><Pill tone={k.probability * k.impact >= 15 ? "urgent" : k.probability * k.impact >= 8 ? "medium" : "ok"}>{t("probabilityShort")} {k.probability} · {t("impact")} {k.impact}</Pill></div><div className="text-[12px] text-muted mt-2">{t("mitigation")}: {k.mitigation}</div></Card>
          ))}
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-3">
          <Card><div className="font-bold mb-2">{t("nextSteps")}</div><ol className="list-decimal ps-4 text-[13px] space-y-1">{r.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ol><Button small variant="dark" className="mt-3" onClick={stepsToTasks}><ClipboardCheck size={12} />{t("createTasksFromSteps")}</Button></Card>
          <Card><div className="font-bold mb-2">{t("kpis")}</div><ul className="list-disc ps-4 text-[13px] space-y-1">{r.kpis.map((s, i) => <li key={i}>{s}</li>)}</ul></Card>
          <Card><div className="font-bold mb-2">{lang === "ar" ? "الموارد" : "Resources"}</div><ul className="list-disc ps-4 text-[13px]">{r.technical.resources.map((s, i) => <li key={i}>{s}</li>)}</ul></Card>
        </div>
      )}
    </div>
  );
}

function CompareTable({ studies, currency }: { studies: Study[]; currency: string }) {
  const { t } = useT();
  const rows = studies.map((s) => ({ s, p: project(s.result!.financial), score: overallScore(s.result!.scores) }));
  return (
    <div className="card-white p-3 overflow-x-auto">
      <table className="text-[12px] min-w-full">
        <thead><tr className="text-muted"><th className="text-start py-1">—</th>{rows.map(({ s }) => <th key={s.id} className="text-start py-1 px-2 max-w-[120px] truncate">{s.input.title}</th>)}</tr></thead>
        <tbody>
          {[
            [t("verdict"), rows.map(({ s }) => t(`v_${s.result!.verdict}` as "v_go"))],
            [t("overall"), rows.map(({ score }) => String(score))],
            [t("npv"), rows.map(({ p, s }) => fmtMoney(p.npv, s.input.currency || currency))],
            [t("irr"), rows.map(({ p }) => (p.irr === null ? "—" : `${p.irr.toFixed(0)}%`))],
            [t("payback"), rows.map(({ p }) => (p.paybackYears === null ? "—" : p.paybackYears.toFixed(1)))],
            [t("capex"), rows.map(({ s }) => fmtMoney(s.result!.financial.capex, s.input.currency))],
            [t("roi"), rows.map(({ p }) => `${p.roi.toFixed(0)}%`)],
            [t("risks"), rows.map(({ s }) => String(s.result!.risks.length))],
          ].map(([label, vals], i) => <tr key={i} className="border-t border-black/5"><td className="py-1.5 text-muted">{label as string}</td>{(vals as string[]).map((v, j) => <td key={j} className="py-1.5 px-2 font-semibold">{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

