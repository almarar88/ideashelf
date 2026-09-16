import { useState } from "react";
import { Button, Field, Input, Select, Sheet } from "@/components/ui";
import { PRIORITIES, useT, priorityKey } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { todayISO, uid } from "@/lib/ids";
import type { Task } from "@/types";

export function TaskForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: Task; defaults?: Partial<Task> }) {
  const { t } = useT();
  const { partners, deals, studies, upsertTask, removeTask, settings } = useStore();
  const [f, setF] = useState<Task>(() => initial ?? { id: uid(), title: "", priority: "normal", status: "open", dueAt: todayISO(), assignee: settings.userName || (settings.lang === "ar" ? "أنا" : "Me"), createdAt: new Date().toISOString(), source: "manual", ...defaults });
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = () => { if (!f.title.trim()) return; upsertTask(f); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title={initial ? t("editTask") : t("addTask")}>
      <Field label={t("taskTitle")}><Input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Field>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {PRIORITIES.map((p) => (
          <button key={p} onClick={() => set("priority", p)} className={`rounded-full py-2 text-[13px] font-semibold ${f.priority === p ? (p === "urgent" ? "bg-urgent" : p === "medium" ? "bg-medium" : "bg-white text-ink") : "bg-white/10"}`}>{t(priorityKey(p))}</button>
        ))}
      </div>
      <Field label={t("dueDate")}><Input type="date" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("from")}><Input type="time" value={f.startTime ?? ""} onChange={(e) => set("startTime", e.target.value)} /></Field>
        <Field label={t("to")}><Input type="time" value={f.endTime ?? ""} onChange={(e) => set("endTime", e.target.value)} /></Field>
      </div>
      <Field label={t("assignee")}><Input value={f.assignee} onChange={(e) => set("assignee", e.target.value)} /></Field>
      <label className="flex items-center gap-2 mb-3 text-[14px] bg-white/5 rounded-2xl p-3"><input type="checkbox" checked={!!f.agent} onChange={(e) => setF((s) => ({ ...s, agent: e.target.checked, assignee: e.target.checked ? "AI Agent" : (settings.userName || s.assignee) }))} className="h-5 w-5 accent-white" /><span>✦ {t("assignToAgent")}</span></label>
      <Field label={t("partner")}><Select value={f.partnerId ?? ""} onChange={(e) => set("partnerId", e.target.value || undefined)}><option value="">{t("none")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label={t("deals")}><Select value={f.dealId ?? ""} onChange={(e) => set("dealId", e.target.value || undefined)}><option value="">{t("none")}</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</Select></Field>
      <Field label={t("studies")}><Select value={f.studyId ?? ""} onChange={(e) => set("studyId", e.target.value || undefined)}><option value="">{t("none")}</option>{studies.map((s) => <option key={s.id} value={s.id}>{s.input.title}</option>)}</Select></Field>
      <div className="flex gap-2 mt-2">
        <Button onClick={save} className="flex-1">{t("save")}</Button>
        {initial && <Button variant="danger" onClick={() => { if (confirm(t("confirmDelete"))) { removeTask(initial.id); onClose(); } }}>{t("delete")}</Button>}
      </div>
    </Sheet>
  );
}
