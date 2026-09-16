import { useState } from "react";
import { Plus, Sparkles, ClipboardCheck, Share2 } from "lucide-react";
import { Button, Card, Empty, Field, Header, Input, Select, Sheet, Spinner, TextArea } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { addDays, fmtDate, todayISO, uid } from "@/lib/ids";
import { ExportBar } from "@/components/ExportBar";
import { meetingsToSheet } from "@/lib/report";
import { shareText, useApp, useJob } from "@/lib/app-context";
import { describeError, hasAI, summarizeMeeting, type Minutes } from "@/lib/ai";
import type { Meeting } from "@/types";

export function Meetings({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const { meetings, partners } = useStore();
  const [form, setForm] = useState<{ open: boolean; m?: Meeting }>({ open: false });
  return (
    <div className="pb-32">
      <Header title={t("meetings")} onBack={onBack} right={<Button small onClick={() => setForm({ open: true })}><Plus size={14} />{t("addMeeting")}</Button>} />
      <ExportBar className="mb-3" filename={`meetings-${todayISO()}`} sheets={() => [meetingsToSheet(meetings, partners, lang)]} />
      {meetings.length === 0 && <Empty>{t("noData")}</Empty>}
      <div className="list-grid">
        {meetings.slice().sort((a, b) => b.at.localeCompare(a.at)).map((m) => (
          <Card key={m.id} onClick={() => setForm({ open: true, m })}>
            <div className="font-bold text-[16px] leading-tight">{m.title}</div>
            <div className="text-[12px] text-muted mt-0.5">{fmtDate(m.at, { weekday: true })} · {partners.find((p) => p.id === m.partnerId)?.name ?? m.attendees.join(", ")}</div>
            {m.summary ? <div className="text-[13px] mt-2 line-clamp-3">{m.summary}</div> : <div className="text-[12px] mt-2 text-medium">{t("summarize")} →</div>}
            {m.actionItems && m.actionItems.length > 0 && <div className="text-[12px] text-muted mt-1">{m.actionItems.length} {t("actionItems")}</div>}
          </Card>
        ))}
      </div>
      {form.open && <MeetingForm initial={form.m} onClose={() => setForm({ open: false })} />}
    </div>
  );
}

function MeetingForm({ initial, onClose }: { initial?: Meeting; onClose: () => void }) {
  const { t, lang } = useT();
  const { partners, upsertMeeting, removeMeeting, upsertTask, upsertPartner, settings } = useStore();
  const { toast } = useApp();
  const [f, setF] = useState<Meeting>(() => initial ?? { id: uid(), title: "", partnerId: undefined, at: todayISO(), attendees: [], rawNotes: "", createdAt: new Date().toISOString() });
  const [att, setAtt] = useState(f.attendees.join(", "));
  const set = <K extends keyof Meeting>(k: K, v: Meeting[K]) => setF((s) => ({ ...s, [k]: v }));
  const job = useJob<Minutes>();
  const current = (): Meeting => ({ ...f, attendees: att.split(",").map((x) => x.trim()).filter(Boolean) });
  const save = () => { if (!f.title.trim()) return; const m = current(); upsertMeeting(m); const p = partners.find((x) => x.id === m.partnerId); if (p && m.at > p.lastContactAt) upsertPartner({ ...p, lastContactAt: m.at }); onClose(); };
  const summarize = async () => {
    const m = current();
    const r = await job.run(() => summarizeMeeting(settings, m, partners.find((p) => p.id === m.partnerId)?.name), (e) => describeError(e, lang));
    if (r) setF({ ...m, summary: r.summary, decisions: r.decisions, actionItems: r.actionItems.map((a) => ({ text: a.text, owner: a.owner, dueAt: addDays(m.at, a.dueInDays) })) });
  };
  const addTasks = () => {
    for (const a of f.actionItems ?? []) upsertTask({ id: uid(), title: a.text, priority: "medium", status: "open", dueAt: a.dueAt ?? addDays(todayISO(), 7), partnerId: f.partnerId, assignee: a.owner, createdAt: new Date().toISOString(), source: "meeting" });
    toast(`✓ ${(f.actionItems ?? []).length}`);
  };
  const minutesText = () => `# ${f.title}\n${f.at} · ${att}\n\n## ${t("summary")}\n${f.summary ?? ""}\n\n## ${t("decisions")}\n${(f.decisions ?? []).map((d) => `- ${d}`).join("\n")}\n\n## ${t("actionItems")}\n${(f.actionItems ?? []).map((a) => `- [ ] ${a.text} (${a.owner}${a.dueAt ? `, ${a.dueAt}` : ""})`).join("\n")}`;
  return (
    <Sheet open onClose={onClose} title={initial ? t("edit") : t("addMeeting")} full>
      <Field label={t("meetingTitle")}><Input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("partner")}><Select value={f.partnerId ?? ""} onChange={(e) => set("partnerId", e.target.value || undefined)}><option value="">{t("none")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label={t("dueDate")}><Input type="date" value={f.at} onChange={(e) => set("at", e.target.value)} /></Field>
      </div>
      <Field label={t("attendees")}><Input value={att} onChange={(e) => setAtt(e.target.value)} placeholder="a, b, c" /></Field>
      <Field label={t("rawNotes")}><TextArea value={f.rawNotes} onChange={(e) => set("rawNotes", e.target.value)} className="min-h-[140px]" placeholder={lang === "ar" ? "اكتب ملاحظاتك بحرية؛ الذكاء سيرتبها." : "Type freely; AI will structure it."} /></Field>
      <Button className="w-full mb-3" disabled={!f.rawNotes.trim() || !hasAI(settings)} onClick={summarize}><Sparkles size={15} />{t("summarize")}</Button>
      {!hasAI(settings) && <div className="text-[12px] text-white/50 mb-3">{t("aiNeedsKey")}</div>}
      {job.loading && <Spinner label={t("loading")} />}
      {job.error && <div className="text-urgent text-[12px] mb-2">{job.error}</div>}
      {f.summary && (
        <div className="card-white p-3 text-[13px] mb-3 space-y-2">
          <div className="font-bold">{t("summary")}</div><div className="whitespace-pre-wrap">{f.summary}</div>
          {f.decisions && f.decisions.length > 0 && <><div className="font-bold">{t("decisions")}</div><ul className="list-disc ps-4">{f.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
          {f.actionItems && f.actionItems.length > 0 && <><div className="font-bold">{t("actionItems")}</div><ul className="list-disc ps-4">{f.actionItems.map((a, i) => <li key={i}>{a.text} <span className="text-muted">— {a.owner}{a.dueAt ? `, ${a.dueAt}` : ""}</span></li>)}</ul>
            <div className="flex gap-2 pt-1 flex-wrap"><Button small variant="dark" onClick={addTasks}><ClipboardCheck size={12} />{t("addAsTasks")}</Button><Button small variant="dark" onClick={() => shareText(f.title, minutesText())}><Share2 size={12} />{t("share")}</Button><ExportBar filename={`minutes-${f.title}`} title={f.title} markdown={() => minutesText().split("\n").slice(1).join("\n")} meta={`${fmtDate(f.at)} · ${att}`} /></div></>}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={save} className="flex-1">{t("save")}</Button>
        {initial && <Button variant="danger" onClick={() => { if (confirm(t("confirmDelete"))) { removeMeeting(initial.id); onClose(); } }}>{t("delete")}</Button>}
      </div>
    </Sheet>
  );
}
