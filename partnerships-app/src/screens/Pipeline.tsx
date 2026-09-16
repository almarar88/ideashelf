import { useMemo, useState } from "react";
import { Plus, Sparkles, ArrowRightLeft } from "lucide-react";
import { Button, Card, Empty, Field, Header, Input, Pill, Select, Sheet, Spinner, TextArea } from "@/components/ui";
import { STAGES, stageKey, useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { addDays, daysBetween, fmtDate, fmtMoney, todayISO, uid } from "@/lib/ids";
import { ExportBar } from "@/components/ExportBar";
import { dealsToSheet } from "@/lib/report";
import { useApp, useJob } from "@/lib/app-context";
import { dealNextStep, describeError, hasAI, type NextStepSuggestion } from "@/lib/ai";
import type { Deal, DealStage } from "@/types";

const stageTone: Record<DealStage, string> = { lead: "bg-white/10", contact: "bg-info", proposal: "bg-medium", negotiation: "bg-urgent", signed: "bg-ok", active: "bg-ok", renewal: "bg-medium", lost: "bg-olive-900" };

export function Pipeline({ openPartner }: { openPartner: (id: string) => void }) {
  const { t, lang } = useT();
  const { deals, partners, settings } = useStore();
  const [stage, setStage] = useState<DealStage | "all">("all");
  const [form, setForm] = useState<{ open: boolean; d?: Deal }>({ open: false });
  const today = todayISO();

  const byStage = useMemo(() => STAGES.map((s) => ({ s, items: deals.filter((d) => d.stage === s), value: deals.filter((d) => d.stage === s).reduce((a, d) => a + d.value, 0) })), [deals]);
  const list = (stage === "all" ? deals : deals.filter((d) => d.stage === stage)).slice().sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  const total = deals.filter((d) => d.stage !== "lost").reduce((a, d) => a + d.value, 0);
  const weighted = deals.filter((d) => !["lost", "signed", "active"].includes(d.stage)).reduce((a, d) => a + d.value * d.probability / 100, 0);

  return (
    <div className="pb-32">
      <Header title={t("pipeline")} subtitle={`${fmtMoney(weighted, settings.currency)} ${lang === "ar" ? "مرجّح" : "weighted"} · ${fmtMoney(total, settings.currency)}`} right={<Button small onClick={() => setForm({ open: true })}><Plus size={14} />{t("addDeal")}</Button>} />
      {/* stage funnel */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4">
        <button onClick={() => setStage("all")} className={`shrink-0 rounded-[18px] px-3 py-2 text-start ${stage === "all" ? "bg-white text-ink" : "bg-olive-800"}`}><div className="text-[11px] opacity-60">{t("all")}</div><div className="font-bold">{deals.length}</div></button>
        {byStage.map(({ s, items, value }) => (
          <button key={s} onClick={() => setStage(s)} className={`shrink-0 rounded-[18px] px-3 py-2 text-start min-w-[92px] ${stage === s ? "bg-white text-ink" : "bg-olive-800"}`}>
            <div className="flex items-center gap-1 text-[11px] opacity-70"><span className={`h-2 w-2 rounded-full ${stageTone[s]}`} />{t(stageKey(s))}</div>
            <div className="font-bold">{items.length} <span className="text-[11px] font-normal opacity-60">{value > 0 ? fmtMoney(value, settings.currency) : ""}</span></div>
          </button>
        ))}
      </div>
      <ExportBar className="mb-3" filename={`pipeline-${today}`} sheets={() => [dealsToSheet(deals, partners, lang)]} />
      {list.length === 0 && <Empty>{t("noData")}</Empty>}
      <div className="list-grid">
        {list.map((d) => {
          const p = partners.find((x) => x.id === d.partnerId);
          const stale = daysBetween(d.updatedAt, today) > 21 && !["lost", "signed", "active"].includes(d.stage);
          return (
            <Card key={d.id} onClick={() => setForm({ open: true, d })}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-bold text-[16px] leading-tight">{d.title}</div><button onClick={(e) => { e.stopPropagation(); p && openPartner(p.id); }} className="text-[12px] text-info mt-0.5">{p?.name ?? "—"}</button></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${stageTone[d.stage]}`}>{t(stageKey(d.stage))}</span>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[12px] text-muted">
                <span className="font-bold text-ink text-[14px]">{fmtMoney(d.value, d.currency)}</span>
                <span>{d.probability}%</span>
                <span>{fmtDate(d.expectedCloseAt, { year: false })}</span>
                {stale && <Pill tone="urgent" className="ms-auto">{daysBetween(d.updatedAt, today)}d</Pill>}
              </div>
              <div className="h-1.5 rounded-full bg-olive-100 mt-3 overflow-hidden"><div className="h-full bg-olive-500 rounded-full" style={{ width: `${d.probability}%` }} /></div>
              {d.nextStep && <div className="text-[12px] mt-2 text-ink/80">→ {d.nextStep}</div>}
            </Card>
          );
        })}
      </div>
      {form.open && <DealForm initial={form.d} onClose={() => setForm({ open: false })} />}
    </div>
  );
}

export function DealForm({ initial, onClose, defaultPartnerId }: { initial?: Deal; onClose: () => void; defaultPartnerId?: string }) {
  const { t, lang } = useT();
  const { partners, upsertDeal, removeDeal, settings, upsertTask } = useStore();
  const { toast } = useApp();
  const [f, setF] = useState<Deal>(() => initial ?? { id: uid(), partnerId: defaultPartnerId ?? partners[0]?.id ?? "", title: "", stage: "lead", value: 0, currency: settings.currency, probability: 20, expectedCloseAt: addDays(todayISO(), 30), nextStep: "", updatedAt: todayISO(), createdAt: todayISO(), notes: "" });
  const set = <K extends keyof Deal>(k: K, v: Deal[K]) => setF((s) => ({ ...s, [k]: v }));
  const ai = useJob<NextStepSuggestion>();
  const save = () => { if (!f.title.trim() || !f.partnerId) return; upsertDeal({ ...f, updatedAt: todayISO() }); onClose(); };
  const p = partners.find((x) => x.id === f.partnerId);
  return (
    <Sheet open onClose={onClose} title={initial ? t("editDeal") : t("addDeal")} full>
      <Field label={t("dealTitle")}><Input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Field>
      <Field label={t("partner")}><Select value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}><option value="">{t("selectPartner")}</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      <div className="label">{t("moveStage")}</div>
      <div className="flex gap-1.5 flex-wrap mb-3">{STAGES.map((s) => <button key={s} onClick={() => set("stage", s)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${f.stage === s ? "bg-white text-ink" : "bg-white/10"}`}>{t(stageKey(s))}</button>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("value")}><Input type="number" value={f.value} onChange={(e) => set("value", Number(e.target.value))} /></Field>
        <Field label={t("currency")}><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
        <Field label={`${t("probability")} ${f.probability}%`}><input type="range" min={0} max={100} step={5} value={f.probability} onChange={(e) => set("probability", Number(e.target.value))} className="w-full accent-white" /></Field>
        <Field label={t("expectedClose")}><Input type="date" value={f.expectedCloseAt} onChange={(e) => set("expectedCloseAt", e.target.value)} /></Field>
      </div>
      <Field label={t("nextStep")}><Input value={f.nextStep} onChange={(e) => set("nextStep", e.target.value)} /></Field>
      {p && hasAI(settings) && (
        <div className="mb-3">
          <Button small variant="ghost" onClick={() => ai.run(() => dealNextStep(settings, f, p), (e) => describeError(e, lang))}><Sparkles size={13} />{t("suggestNextStep")}</Button>
          {ai.loading && <Spinner />}
          {ai.error && <div className="text-urgent text-[12px] mt-1">{ai.error}</div>}
          {ai.data && (
            <div className="card-white p-3 mt-2 text-[13px]">
              <div className="font-bold">{ai.data.nextStep}</div>
              <div className="text-muted mt-1">{ai.data.reasoning}</div>
              <div className="flex gap-2 mt-2">
                <Button small variant="dark" onClick={() => { set("nextStep", ai.data!.nextStep); set("probability", ai.data!.probability); }}><ArrowRightLeft size={12} />{t("apply")} ({ai.data.probability}%)</Button>
                <Button small variant="dark" onClick={() => { upsertTask({ id: uid(), title: ai.data!.suggestedTask.title, priority: ai.data!.suggestedTask.priority, status: "open", dueAt: addDays(todayISO(), ai.data!.suggestedTask.dueInDays), partnerId: f.partnerId, dealId: f.id, assignee: settings.userName || "—", createdAt: new Date().toISOString(), source: "ai" }); toast("✓"); }}><Plus size={12} />{t("addTask")}</Button>
              </div>
            </div>
          )}
        </div>
      )}
      <Field label={t("notes")}><TextArea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button onClick={save} className="flex-1">{t("save")}</Button>
        {initial && <Button variant="danger" onClick={() => { if (confirm(t("confirmDelete"))) { removeDeal(initial.id); onClose(); } }}>{t("delete")}</Button>}
      </div>
    </Sheet>
  );
}
