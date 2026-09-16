import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Sparkles, Bot, Play, CheckCircle2, XCircle, Loader2, Eye } from "lucide-react";
import { Button, Pill, Sheet, Spinner } from "@/components/ui";
import { Markdown } from "@/lib/markdown";
import { useT } from "@/lib/useT";
import { newChatMessage, useStore } from "@/store/useStore";
import { useApp } from "@/lib/app-context";
import { demoText, describeError, hasAI } from "@/lib/ai";
import { runAgent } from "@/lib/agent";
import { fmtDate, uid } from "@/lib/ids";
import { foreground, nativeNotify } from "@/lib/native";
import type { AgentTask } from "@/types";

/** Executes a queued agent task (also used by TaskCard for agent-assigned tasks). */
export async function executeAgentTask(id: string) {
  const st = useStore.getState();
  const task = st.agentTasks.find((a) => a.id === id);
  if (!task || task.status === "running") return;
  const settings = st.settings;
  if (!hasAI(settings)) { st.upsertAgentTask({ ...task, status: "failed", result: demoText(settings.lang, settings.lang === "ar" ? "التنفيذ" : "execution"), finishedAt: new Date().toISOString() }); return; }
  st.upsertAgentTask({ ...task, status: "running", steps: [] });
  const ar = settings.lang === "ar";
  void foreground(true, ar ? "الوكيل الذكي يعمل" : "AI agent working", task.instruction.slice(0, 80));
  try {
    const r = await runAgent(settings, [{ role: "user", text: task.instruction }], {
      context: task.contextLabel ? { label: task.contextLabel } : undefined,
      onStep: (s) => { const cur = useStore.getState().agentTasks.find((a) => a.id === id); if (cur) useStore.getState().upsertAgentTask({ ...cur, steps: [...cur.steps, s] }); },
    });
    const cur = useStore.getState().agentTasks.find((a) => a.id === id)!;
    useStore.getState().upsertAgentTask({ ...cur, status: "done", result: r.text, finishedAt: new Date().toISOString() });
    if (task.linkedTaskId) { const lt = useStore.getState().tasks.find((x) => x.id === task.linkedTaskId); if (lt) useStore.getState().upsertTask({ ...lt, status: "done", agentResult: r.text }); }
    void nativeNotify(ar ? "✓ الوكيل أنهى المهمة" : "✓ Agent finished", `${task.instruction.slice(0, 60)}${r.steps.length ? ` · ${r.steps.length} ${ar ? "إجراء" : "actions"}` : ""}`, { channel: "agent", action: "agent" });
  } catch (e) {
    const cur = useStore.getState().agentTasks.find((a) => a.id === id)!;
    useStore.getState().upsertAgentTask({ ...cur, status: "failed", result: describeError(e, settings.lang), finishedAt: new Date().toISOString() });
    void nativeNotify(ar ? "⚠ فشلت مهمة الوكيل" : "⚠ Agent task failed", task.instruction.slice(0, 80), { channel: "agent", action: "agent" });
  } finally {
    if (!useStore.getState().agentTasks.some((a) => a.status === "running")) void foreground(false);
  }
}

export function queueAgentTask(instruction: string, opts: { contextLabel?: string; linkedTaskId?: string; run?: boolean } = {}): string {
  const a: AgentTask = { id: uid(), instruction, status: "queued", createdAt: new Date().toISOString(), steps: [], contextLabel: opts.contextLabel, linkedTaskId: opts.linkedTaskId };
  useStore.getState().upsertAgentTask(a);
  if (opts.run !== false) void executeAgentTask(a.id);
  return a.id;
}

export function Assistant() {
  const { t, lang } = useT();
  const { assistantOpen, closeAssistant, assistantPrefill, context } = useApp();
  const { chat: history, pushChat, clearChat, settings, agentTasks, removeAgentTask } = useStore();
  const [tab, setTab] = useState<"chat" | "tasks">("chat");
  const [input, setInput] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveSteps, setLiveSteps] = useState<{ tool: string; summary: string; ok: boolean }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (assistantOpen) { setInput(assistantPrefill); if (assistantPrefill) setTab("chat"); } }, [assistantOpen, assistantPrefill]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history.length, busy, liveSteps.length]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    pushChat(newChatMessage("user", q));
    if (!hasAI(settings)) { pushChat(newChatMessage("assistant", demoText(lang, lang === "ar" ? "الرد" : "answer"))); return; }
    setBusy(true); setLiveSteps([]);
    try {
      const all = [...useStore.getState().chat].map((m) => ({ role: m.role, text: m.text }));
      const r = await runAgent(settings, all, { context, onStep: (s) => setLiveSteps((x) => [...x, s]) });
      const stepsNote = r.steps.length ? `\n\n---\n**${t("agentDid")}:** ${r.steps.map((s) => s.summary).join(" · ")}` : "";
      pushChat(newChatMessage("assistant", (r.text || "✓") + stepsNote));
    } catch (e) {
      pushChat(newChatMessage("assistant", `⚠ ${describeError(e, lang)}`));
    } finally { setBusy(false); setLiveSteps([]); }
  };

  const addTask = () => { const q = taskInput.trim(); if (!q) return; setTaskInput(""); queueAgentTask(q, { contextLabel: context?.label }); };

  const title = <span className="flex items-center gap-2"><Bot size={20} />{t("agent")}</span>;
  return (
    <Sheet open={assistantOpen} onClose={closeAssistant} title={title} full>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          {(["chat", "tasks"] as const).map((x) => <button key={x} onClick={() => setTab(x)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${tab === x ? "bg-white text-ink" : "bg-white/10"}`}>{x === "chat" ? t("chatTab") : `${t("agentTasks")} ${agentTasks.filter((a) => a.status !== "done").length ? `(${agentTasks.filter((a) => a.status !== "done").length})` : ""}`}</button>)}
          {context?.label && <span className="ms-auto flex items-center gap-1 text-[11px] text-white/60 truncate max-w-[45%]"><Eye size={12} />{context.label}</span>}
        </div>

        {tab === "chat" && (
          <>
            <div className="flex-1 space-y-3">
              {history.length === 0 && (
                <div className="card-dark p-4 text-[13px]">
                  <div className="text-white/80 mb-2">{t("assistantIntro")}</div>
                  <div className="text-white/50 text-[12px] mb-3">{t("agentHint")}</div>
                  {(["q1", "q2", "q3"] as const).map((k) => <button key={k} onClick={() => send(t(k))} className="block w-full text-start bg-white/10 rounded-2xl px-3 py-2 mb-2">{t(k)}</button>)}
                  <button onClick={() => send(lang === "ar" ? "أنشئ مهمة عاجلة لمتابعة كل شريك لم نتواصل معه منذ أكثر من 30 يوماً" : "Create an urgent follow-up task for every partner not contacted in 30+ days")} className="block w-full text-start bg-white/10 rounded-2xl px-3 py-2 mb-2">✦ {lang === "ar" ? "أنشئ مهام متابعة للشركاء المهملين" : "Create follow-up tasks for stale partners"}</button>
                </div>
              )}
              {history.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[14px] ${m.role === "user" ? "bg-white text-ink rounded-br-md" : "bg-olive-800 text-white rounded-bl-md"}`}>
                    {m.role === "user" ? m.text : <Markdown text={m.text} />}
                  </div>
                </div>
              ))}
              {busy && <div className="card-dark p-3 text-[12px] space-y-1">{liveSteps.map((s, i) => <div key={i} className="flex items-center gap-2">{s.ok ? <CheckCircle2 size={14} className="text-ok" /> : <XCircle size={14} className="text-urgent" />}<span className="text-white/50">{s.tool}</span><span>{s.summary}</span></div>)}<Spinner label={t("runningAgent")} /></div>}
              <div ref={endRef} />
            </div>
            <div className="sticky bottom-0 pt-3 bg-olive-600">
              <div className="flex items-center gap-2">
                <button onClick={clearChat} className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center shrink-0" title={t("clearChat")}><Trash2 size={17} /></button>
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder={t("chatPlaceholder")} className="field flex-1" />
                <button onClick={() => send(input)} disabled={busy || !input.trim()} className="h-11 w-11 rounded-full bg-white text-ink flex items-center justify-center shrink-0 disabled:opacity-40"><Send size={17} className={lang === "ar" ? "-scale-x-100" : ""} /></button>
              </div>
            </div>
          </>
        )}

        {tab === "tasks" && (
          <>
            <div className="flex-1 space-y-2">
              <div className="card-dark p-3 text-[12px] text-white/60">{t("agentHint")}</div>
              {agentTasks.length === 0 && <div className="text-center text-white/40 py-8 text-[13px]">—</div>}
              {agentTasks.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => (
                <div key={a.id} className="card-white p-3 text-[13px]">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{a.status === "done" ? <CheckCircle2 size={16} className="text-ok" /> : a.status === "failed" ? <XCircle size={16} className="text-urgent" /> : a.status === "running" ? <Loader2 size={16} className="animate-spin text-medium" /> : <Play size={16} className="text-muted" />}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{a.instruction}</div>
                      <div className="text-[11px] text-muted mt-0.5">{fmtDate(a.createdAt)} {a.contextLabel ? `· ${a.contextLabel}` : ""} · <Pill tone={a.status === "done" ? "ok" : a.status === "failed" ? "urgent" : a.status === "running" ? "medium" : "dark"} className="!py-0 !px-2 !text-[10px]">{t(a.status)}</Pill></div>
                      {a.steps.length > 0 && <div className="mt-2 space-y-0.5">{a.steps.map((s, i) => <div key={i} className="flex items-center gap-1.5 text-[12px]">{s.ok ? <CheckCircle2 size={12} className="text-ok" /> : <XCircle size={12} className="text-urgent" />}<span className="text-muted">{s.tool}</span><span className="truncate">{s.summary}</span></div>)}</div>}
                      {a.result && <div className="mt-2 border-t border-black/10 pt-2"><Markdown text={a.result} /></div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 justify-end">
                    {(a.status === "queued" || a.status === "failed") && <Button small variant="dark" onClick={() => executeAgentTask(a.id)}><Play size={12} />{t("runAgent")}</Button>}
                    <Button small variant="ghost" className="!text-ink !border-ink/15" onClick={() => removeAgentTask(a.id)}><Trash2 size={12} /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 pt-3 bg-olive-600">
              <div className="flex items-center gap-2">
                <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder={t("newAgentTask")} className="field flex-1" />
                <button onClick={addTask} disabled={!taskInput.trim()} className="h-11 px-4 rounded-full bg-white text-ink font-semibold flex items-center gap-1 shrink-0 disabled:opacity-40"><Sparkles size={15} />{t("runAgent")}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
