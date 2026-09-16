import { useState } from "react";
import { Plus, Sparkles, Check, ShieldAlert } from "lucide-react";
import { Button, Card, Empty, Field, Header, Input, Pill, Select, Sheet, Spinner, TextArea } from "@/components/ui";
import { AGREEMENT_STATUSES, AGREEMENT_TYPES, agreementStatusKey, agreementTypeKey, useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { addDays, daysBetween, fmtDate, fmtMoney, todayISO, uid } from "@/lib/ids";
import { ExportBar } from "@/components/ExportBar";
import { agreementsToSheet } from "@/lib/report";
import { useJob } from "@/lib/app-context";
import { describeError, hasAI, reviewAgreement, type ClauseReview } from "@/lib/ai";
import type { Agreement } from "@/types";

export function Agreements({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const { agreements, partners } = useStore();
  const [form, setForm] = useState<{ open: boolean; a?: Agreement }>({ open: false });
  const today = todayISO();
  const list = agreements.slice().sort((a, b) => a.endAt.localeCompare(b.endAt));
  return (
    <div className="pb-32">
      <Header title={t("agreements")} onBack={onBack} right={<Button small onClick={() => setForm({ open: true })}><Plus size={14} />{t("addAgreement")}</Button>} />
      <ExportBar className="mb-3" filename={`agreements-${today}`} sheets={() => [agreementsToSheet(agreements, partners, lang)]} />
      {list.length === 0 && <Empty>{t("noData")}</Empty>}
      <div className="list-grid">
        {list.map((a) => {
          const d = daysBetween(today, a.endAt);
          const openObl = a.obligations.filter((o) => !o.done).length;
          const noticeBy = addDays(a.endAt, -a.noticeDays);
          return (
            <Card key={a.id} onClick={() => setForm({ open: true, a })}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-bold text-[16px] leading-tight">{a.title}</div><div className="text-[12px] text-muted mt-0.5">{partners.find((p) => p.id === a.partnerId)?.name} · {t(agreementTypeKey(a.type))}</div></div>
                <Pill tone={a.status === "signed" ? "ok" : a.status === "expired" || a.status === "terminated" ? "urgent" : "info"}>{t(agreementStatusKey(a.status))}</Pill>
              </div>
              <div className="flex items-center gap-2 mt-3 text-[12px] text-muted flex-wrap">
                {a.value > 0 && <span className="font-bold text-ink text-[14px]">{fmtMoney(a.value, a.currency)}</span>}
                <span>{fmtDate(a.startAt, { year: false })} → {fmtDate(a.endAt)}</span>
                {a.status === "signed" && d <= 90 && <Pill tone={d <= 30 ? "urgent" : "medium"} className="ms-auto">{d} {t("days")}</Pill>}
              </div>
              {a.status === "signed" && a.noticeDays > 0 && daysBetween(today, noticeBy) <= 30 && <div className="text-[12px] mt-2 text-urgent flex items-center gap-1"><ShieldAlert size={13} />{t("noticeDays")}: {fmtDate(noticeBy)}</div>}
              {openObl > 0 && <div className="text-[12px] mt-1 text-muted">{openObl} {t("obligations")}</div>}
            </Card>
          );
        })}
      </div>
      {form.open && <AgreementForm initial={form.a} onClose={() => setForm({ open: false })} />}
    </div>
  );
}

function AgreementForm({ initial, onClose }: { initial?: Agreement; onClose: () => void }) {
  const { t, lang } = useT();
  const { partners, upsertAgreement, removeAgreement, settings } = useStore();
  const [f, setF] = useState<Agreement>(() => initial ?? { id: uid(), partnerId: partners[0]?.id ?? "", title: "", type: "mou", status: "draft", startAt: todayISO(), endAt: addDays(todayISO(), 365), value: 0, currency: settings.currency, autoRenew: false, noticeDays: 30, obligations: [], summary: "", createdAt: todayISO() });
  const set = <K extends keyof Agreement>(k: K, v: Agreement[K]) => setF((s) => ({ ...s, [k]: v }));
  const [obl, setObl] = useState("");
  const [body, setBody] = useState("");
  const review = useJob<ClauseReview>();
  const p = partners.find((x) => x.id === f.partnerId);
  const save = () => { if (!f.title.trim() || !f.partnerId) return; upsertAgreement(f); onClose(); };
  return (
    <Sheet open onClose={onClose} title={initial ? t("editAgreement") : t("addAgreement")} full>
      <Field label={t("name")}><Input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Field>
      <Field label={t("partner")}><Select value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}><option value="">{t("selectPartner")}</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("type")}><Select value={f.type} onChange={(e) => set("type", e.target.value as Agreement["type"])}>{AGREEMENT_TYPES.map((x) => <option key={x} value={x}>{t(agreementTypeKey(x))}</option>)}</Select></Field>
        <Field label={t("status")}><Select value={f.status} onChange={(e) => set("status", e.target.value as Agreement["status"])}>{AGREEMENT_STATUSES.map((x) => <option key={x} value={x}>{t(agreementStatusKey(x))}</option>)}</Select></Field>
        <Field label={t("startDate")}><Input type="date" value={f.startAt} onChange={(e) => set("startAt", e.target.value)} /></Field>
        <Field label={t("endDate")}><Input type="date" value={f.endAt} onChange={(e) => set("endAt", e.target.value)} /></Field>
        <Field label={t("value")}><Input type="number" value={f.value} onChange={(e) => set("value", Number(e.target.value))} /></Field>
        <Field label={t("noticeDays")}><Input type="number" value={f.noticeDays} onChange={(e) => set("noticeDays", Number(e.target.value))} /></Field>
      </div>
      <label className="flex items-center gap-2 mb-3 text-[14px]"><input type="checkbox" checked={f.autoRenew} onChange={(e) => set("autoRenew", e.target.checked)} className="h-5 w-5 accent-white" />{t("autoRenew")}</label>
      <Field label={t("summary")}><TextArea value={f.summary} onChange={(e) => set("summary", e.target.value)} /></Field>

      <div className="label">{t("obligations")}</div>
      <div className="space-y-2 mb-2">
        {f.obligations.map((o) => (
          <div key={o.id} className="flex items-center gap-2 bg-white/5 rounded-2xl p-2">
            <button onClick={() => set("obligations", f.obligations.map((x) => (x.id === o.id ? { ...x, done: !x.done } : x)))} className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 ${o.done ? "bg-ok border-ok" : "border-white/40"}`}>{o.done && <Check size={14} />}</button>
            <div className={`flex-1 text-[13px] ${o.done ? "line-through opacity-60" : ""}`}>{o.text}</div>
            <button onClick={() => set("obligations", f.obligations.map((x) => (x.id === o.id ? { ...x, owner: x.owner === "us" ? "partner" : "us" } : x)))} className="text-[11px] rounded-full bg-white/10 px-2 py-1">{o.owner === "us" ? t("us") : t("them")}</button>
            <button onClick={() => set("obligations", f.obligations.filter((x) => x.id !== o.id))} className="text-urgent text-[12px]">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4"><Input value={obl} onChange={(e) => setObl(e.target.value)} placeholder={t("addObligation")} /><Button variant="ghost" onClick={() => { if (obl.trim()) { set("obligations", [...f.obligations, { id: uid(), text: obl.trim(), owner: "us", done: false }]); setObl(""); } }}><Plus size={14} /></Button></div>

      {p && (
        <div className="mb-4">
          <Field label={t("reviewClauses")} hint={hasAI(settings) ? undefined : t("aiNeedsKey")}><TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder={lang === "ar" ? "الصق نص الاتفاقية أو بنودها الرئيسية هنا..." : "Paste the agreement text or key clauses here..."} /></Field>
          <Button small variant="light" disabled={!hasAI(settings)} onClick={() => review.run(() => reviewAgreement(settings, f, p, body), (e) => describeError(e, lang))}><Sparkles size={13} />{t("reviewClauses")}</Button>
          {review.loading && <Spinner label={t("loading")} />}
          {review.error && <div className="text-urgent text-[12px] mt-1">{review.error}</div>}
          {review.data && (
            <div className="card-white p-3 mt-2 text-[13px] space-y-2">
              <div>{review.data.summary}</div>
              {review.data.risks.map((r, i) => (
                <div key={i} className="border-t border-black/10 pt-2"><div className="flex items-center gap-2"><Pill tone={r.severity === "high" ? "urgent" : r.severity === "medium" ? "medium" : "dark"}>{r.severity}</Pill><span className="font-bold">{r.clause}</span></div><div className="text-muted mt-1">{r.risk}</div><div className="mt-1">→ {r.suggestion}</div></div>
              ))}
              {review.data.missingClauses.length > 0 && <div className="border-t border-black/10 pt-2"><div className="font-bold">{lang === "ar" ? "بنود ناقصة" : "Missing clauses"}</div><ul className="list-disc ps-4">{review.data.missingClauses.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
              <Button small variant="dark" onClick={() => set("obligations", [...f.obligations, ...review.data!.obligationsUs.map((x) => ({ id: uid(), text: x, owner: "us" as const, done: false })), ...review.data!.obligationsPartner.map((x) => ({ id: uid(), text: x, owner: "partner" as const, done: false }))])}><Plus size={12} />{t("obligations")}</Button>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={save} className="flex-1">{t("save")}</Button>
        {initial && <Button variant="danger" onClick={() => { if (confirm(t("confirmDelete"))) { removeAgreement(initial.id); onClose(); } }}>{t("delete")}</Button>}
      </div>
    </Sheet>
  );
}
