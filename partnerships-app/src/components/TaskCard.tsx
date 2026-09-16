import { Check, Sparkles } from "lucide-react";
import { queueAgentTask } from "@/screens/Assistant";
import { useApp } from "@/lib/app-context";
import { useT, priorityKey } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import type { Task } from "@/types";

const tone: Record<Task["priority"], string> = { urgent: "bg-urgent", medium: "bg-medium", normal: "bg-olive-700" };

export function TaskCard({ task, onOpen, wide = false }: { task: Task; onOpen: () => void; wide?: boolean }) {
  const { t } = useT();
  const { toggleTask, partners, agentTasks } = useStore();
  const { toast, openAssistant } = useApp();
  const running = agentTasks.some((a) => a.linkedTaskId === task.id && a.status === "running");
  const partner = partners.find((p) => p.id === task.partnerId);
  const done = task.status === "done";
  const time = task.startTime ? `${task.startTime}${task.endTime ? ` – ${task.endTime}` : ""}` : partner?.name ?? "";
  return (
    <div onClick={onOpen} className={`card-white p-4 flex flex-col justify-between ${wide ? "w-full min-h-[120px]" : "w-[190px] h-[205px] shrink-0"} ${done ? "opacity-60" : ""} active:scale-[0.98] transition cursor-pointer`}>
      <div>
        <div className="text-[12px] text-muted mb-1 truncate">{time}</div>
        <div className={`text-[19px] font-bold leading-tight line-clamp-3 ${done ? "line-through" : ""}`}>{task.title}</div>
        {wide && partner && task.startTime && <div className="text-[12px] text-muted mt-1">{partner.name}</div>}
      </div>
      <div className="flex items-end justify-between mt-3">
        <div>
          <div className="text-[11px] text-muted mb-1">{t("priority")}</div>
          <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-semibold text-white ${tone[task.priority]}`}>{t(priorityKey(task.priority))}</span>
        </div>
        {task.agent && !done && (
          <button onClick={(e) => { e.stopPropagation(); if (running) { openAssistant(); return; } queueAgentTask(`${task.title}${partner ? ` (${partner.name})` : ""}`, { linkedTaskId: task.id, contextLabel: partner?.name }); toast("✦"); openAssistant(); }} className={`h-8 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-bold ${running ? "bg-medium text-white pulse-soft" : "bg-ink text-white"}`}><Sparkles size={12} />{running ? t("running") : t("runAgent")}</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${done ? "bg-ok border-ok text-white" : "border-olive-200 text-transparent"}`}><Check size={16} /></button>
      </div>
    </div>
  );
}
