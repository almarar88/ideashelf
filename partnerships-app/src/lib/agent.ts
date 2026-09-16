import Anthropic from "@anthropic-ai/sdk";
import type { AgentStep, Deal, Lang, Partner, Settings, Study, StudyInput, Task } from "@/types";
import { useStore } from "@/store/useStore";
import { addDays, todayISO, uid } from "./ids";
import { AIError, emailDraft, generateStudy, negotiationPrep, partnerBrief, proposalDraft, snapshot, weeklyReport } from "./ai";
import { agreementsToSheet, dealsToSheet, meetingsToSheet, partnersToSheet, studyMeta, studyToMarkdown, studyToSheets, tasksToSheet } from "./report";
import { exportDocx, exportPdfFromMarkdown, exportXlsx } from "./export";
import { nativeNotify } from "./native";

/* ------------------------------------------------------------------ */
/* Tool definitions                                                     */
/* ------------------------------------------------------------------ */

const str = (description: string) => ({ type: "string" as const, description });
const num = (description: string) => ({ type: "number" as const, description });

export const AGENT_TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "get_snapshot", description: "Return the latest full data snapshot (partners, deals, agreements, tasks, meetings, studies) as JSON. Use when you need ids or fresh data after changes.", input_schema: { type: "object", properties: {} } },
  { name: "create_task", description: "Create a task in the user's task list.", input_schema: { type: "object", properties: { title: str("Task title"), priority: { type: "string", enum: ["urgent", "medium", "normal"] }, dueAt: str("ISO date YYYY-MM-DD"), startTime: str("HH:MM optional"), endTime: str("HH:MM optional"), partnerName: str("Optional partner name to link"), assignee: str("Optional assignee") }, required: ["title", "priority", "dueAt"] } },
  { name: "complete_task", description: "Mark a task done by title (fuzzy match).", input_schema: { type: "object", properties: { title: str("Task title or part of it") }, required: ["title"] } },
  { name: "create_partner", description: "Add a partner organization to the CRM.", input_schema: { type: "object", properties: { name: str("Organization name"), type: { type: "string", enum: ["strategic", "sponsor", "supplier", "government", "ngo", "academic", "media", "technology"] }, status: { type: "string", enum: ["prospect", "active", "paused", "ended"] }, sector: str("Sector"), country: str("Country"), description: str("Short description"), contactName: str("Primary contact name"), contactRole: str("Contact role"), contactEmail: str("Contact email"), contactPhone: str("Contact phone"), tags: { type: "array", items: { type: "string" } }, notes: str("Notes") }, required: ["name", "type", "sector", "country"] } },
  { name: "update_partner", description: "Update fields of an existing partner (by name).", input_schema: { type: "object", properties: { partnerName: str("Existing partner name"), status: { type: "string", enum: ["prospect", "active", "paused", "ended"] }, notes: str("Append these notes"), tags: { type: "array", items: { type: "string" } }, description: str("New description") }, required: ["partnerName"] } },
  { name: "log_contact", description: "Record that the user contacted a partner today (or on a date).", input_schema: { type: "object", properties: { partnerName: str("Partner name"), date: str("ISO date, default today"), note: str("Optional note to append") }, required: ["partnerName"] } },
  { name: "create_deal", description: "Create a pipeline opportunity for a partner.", input_schema: { type: "object", properties: { title: str("Deal title"), partnerName: str("Partner name"), stage: { type: "string", enum: ["lead", "contact", "proposal", "negotiation", "signed", "active", "renewal", "lost"] }, value: num("Monetary value"), probability: num("0-100"), expectedCloseAt: str("ISO date"), nextStep: str("Next step") }, required: ["title", "partnerName", "stage", "value"] } },
  { name: "update_deal", description: "Move a deal to a stage and/or update its fields (by title).", input_schema: { type: "object", properties: { dealTitle: str("Deal title or part of it"), stage: { type: "string", enum: ["lead", "contact", "proposal", "negotiation", "signed", "active", "renewal", "lost"] }, probability: num("0-100"), nextStep: str("Next step"), value: num("Value"), expectedCloseAt: str("ISO date") }, required: ["dealTitle"] } },
  { name: "create_agreement", description: "Create an agreement / MoU / contract record.", input_schema: { type: "object", properties: { title: str("Title"), partnerName: str("Partner"), type: { type: "string", enum: ["mou", "contract", "sponsorship", "nda", "sla"] }, status: { type: "string", enum: ["draft", "review", "signed", "expired", "terminated"] }, startAt: str("ISO date"), endAt: str("ISO date"), value: num("Value"), autoRenew: { type: "boolean" }, noticeDays: num("Notice period days"), obligationsUs: { type: "array", items: { type: "string" } }, obligationsPartner: { type: "array", items: { type: "string" } }, summary: str("Summary") }, required: ["title", "partnerName", "type", "startAt", "endAt"] } },
  { name: "create_meeting", description: "Log a meeting with notes.", input_schema: { type: "object", properties: { title: str("Title"), partnerName: str("Partner optional"), at: str("ISO date"), attendees: { type: "array", items: { type: "string" } }, rawNotes: str("Notes"), summary: str("Optional summary"), decisions: { type: "array", items: { type: "string" } }, actionItems: { type: "array", items: { type: "object", properties: { text: str("Action"), owner: str("Owner"), dueInDays: num("Days") }, required: ["text", "owner"] } } }, required: ["title", "at"] } },
  { name: "start_feasibility_study", description: "Create and generate a full AI feasibility study. Generation runs in the background (1-3 minutes); tell the user it has started.", input_schema: { type: "object", properties: { title: str("Study title"), idea: str("Idea / project description"), sector: str("Sector"), country: str("Country"), targetMarket: str("Target market"), objectives: str("Objectives"), budgetHint: num("Optional budget"), horizonYears: { type: "number", enum: [3, 5] }, partnerName: str("Optional partner") }, required: ["title", "idea", "sector", "country"] } },
  { name: "generate_document", description: "Generate an AI document and return its text: partner_brief, proposal, email, negotiation_prep (needs dealTitle), weekly_report.", input_schema: { type: "object", properties: { kind: { type: "string", enum: ["partner_brief", "proposal", "email", "negotiation_prep", "weekly_report"] }, partnerName: str("Partner name (for partner docs)"), dealTitle: str("Deal title (for negotiation_prep)"), objective: str("Objective / purpose") }, required: ["kind"] } },
  { name: "export_file", description: "Create and save a file on the device (opens the share sheet). kinds: partners_excel, pipeline_excel, tasks_excel, agreements_excel, meetings_excel, all_excel, study_excel, study_word, study_pdf, document_word, document_pdf (needs title+markdown).", input_schema: { type: "object", properties: { kind: { type: "string", enum: ["partners_excel", "pipeline_excel", "tasks_excel", "agreements_excel", "meetings_excel", "all_excel", "study_excel", "study_word", "study_pdf", "document_word", "document_pdf"] }, studyTitle: str("Study title (for study_*)"), title: str("Document title (for document_*)"), markdown: str("Document body in Markdown (for document_*)") }, required: ["kind"] } },
];

/* ------------------------------------------------------------------ */
/* Tool execution                                                       */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const findPartner = (name?: string): Partner | undefined => { if (!name) return undefined; const n = norm(name); const ps = useStore.getState().partners; return ps.find((p) => norm(p.name) === n) ?? ps.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name))); };
const findDeal = (title?: string): Deal | undefined => { if (!title) return undefined; const n = norm(title); const ds = useStore.getState().deals; return ds.find((d) => norm(d.title) === n) ?? ds.find((d) => norm(d.title).includes(n) || n.includes(norm(d.title))); };
const findTask = (title?: string): Task | undefined => { if (!title) return undefined; const n = norm(title); const ts = useStore.getState().tasks; return ts.find((t) => norm(t.title) === n) ?? ts.find((t) => norm(t.title).includes(n)); };
const findStudy = (title?: string): Study | undefined => { const ss = useStore.getState().studies.filter((s) => s.result); if (!title) return ss[0]; const n = norm(title); return ss.find((s) => norm(s.input.title).includes(n)) ?? ss[0]; };

type In = Record<string, unknown>;
const S = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const N = (v: unknown, d = 0) => (typeof v === "number" && !isNaN(v) ? v : d);
const A = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export async function runTool(name: string, input: In, settings: Settings): Promise<{ result: string; summary: string }> {
  const st = useStore.getState();
  const now = new Date().toISOString();
  switch (name) {
    case "get_snapshot": return { result: snapshot(st), summary: "snapshot" };
    case "create_task": {
      const p = findPartner(S(input.partnerName));
      const t: Task = { id: uid(), title: S(input.title), priority: (["urgent", "medium", "normal"].includes(S(input.priority)) ? S(input.priority) : "normal") as Task["priority"], status: "open", dueAt: S(input.dueAt, todayISO()), startTime: S(input.startTime) || undefined, endTime: S(input.endTime) || undefined, partnerId: p?.id, assignee: S(input.assignee, settings.userName || "—"), createdAt: now, source: "ai" };
      st.upsertTask(t); return { result: JSON.stringify({ ok: true, id: t.id }), summary: `＋ ${t.title}` };
    }
    case "complete_task": { const t = findTask(S(input.title)); if (!t) return { result: "not found", summary: "task not found" }; st.upsertTask({ ...t, status: "done" }); return { result: "done", summary: `✓ ${t.title}` }; }
    case "create_partner": {
      const p: Partner = { id: uid(), name: S(input.name), type: S(input.type, "strategic") as Partner["type"], status: S(input.status, "prospect") as Partner["status"], sector: S(input.sector), country: S(input.country), description: S(input.description), tags: A(input.tags), contacts: S(input.contactName) ? [{ id: uid(), name: S(input.contactName), role: S(input.contactRole), email: S(input.contactEmail) || undefined, phone: S(input.contactPhone) || undefined }] : [], ownerName: settings.userName || "", lastContactAt: todayISO(), createdAt: now, notes: S(input.notes) };
      st.upsertPartner(p); return { result: JSON.stringify({ ok: true, id: p.id }), summary: `＋ ${p.name}` };
    }
    case "update_partner": { const p = findPartner(S(input.partnerName)); if (!p) return { result: "partner not found", summary: "partner not found" }; st.upsertPartner({ ...p, status: (S(input.status) || p.status) as Partner["status"], description: S(input.description) || p.description, tags: A(input.tags).length ? A(input.tags) : p.tags, notes: S(input.notes) ? `${p.notes}\n${S(input.notes)}`.trim() : p.notes }); return { result: "updated", summary: `✎ ${p.name}` }; }
    case "log_contact": { const p = findPartner(S(input.partnerName)); if (!p) return { result: "partner not found", summary: "partner not found" }; st.upsertPartner({ ...p, lastContactAt: S(input.date, todayISO()), notes: S(input.note) ? `${p.notes}\n${S(input.date, todayISO())}: ${S(input.note)}`.trim() : p.notes }); return { result: "logged", summary: `☎ ${p.name}` }; }
    case "create_deal": {
      const p = findPartner(S(input.partnerName)); if (!p) return { result: "partner not found; create it first with create_partner", summary: "partner not found" };
      const d: Deal = { id: uid(), partnerId: p.id, title: S(input.title), stage: S(input.stage, "lead") as Deal["stage"], value: N(input.value), currency: settings.currency, probability: N(input.probability, 20), expectedCloseAt: S(input.expectedCloseAt, addDays(todayISO(), 30)), nextStep: S(input.nextStep), updatedAt: todayISO(), createdAt: todayISO(), notes: "" };
      st.upsertDeal(d); return { result: JSON.stringify({ ok: true, id: d.id }), summary: `＋ ${d.title}` };
    }
    case "update_deal": { const d = findDeal(S(input.dealTitle)); if (!d) return { result: "deal not found", summary: "deal not found" }; st.upsertDeal({ ...d, stage: (S(input.stage) || d.stage) as Deal["stage"], probability: typeof input.probability === "number" ? N(input.probability) : d.probability, nextStep: S(input.nextStep) || d.nextStep, value: typeof input.value === "number" ? N(input.value) : d.value, expectedCloseAt: S(input.expectedCloseAt) || d.expectedCloseAt, updatedAt: todayISO() }); return { result: "updated", summary: `→ ${d.title}${S(input.stage) ? ` (${S(input.stage)})` : ""}` }; }
    case "create_agreement": {
      const p = findPartner(S(input.partnerName)); if (!p) return { result: "partner not found", summary: "partner not found" };
      const a = { id: uid(), partnerId: p.id, title: S(input.title), type: S(input.type, "mou") as "mou", status: S(input.status, "draft") as "draft", startAt: S(input.startAt, todayISO()), endAt: S(input.endAt, addDays(todayISO(), 365)), value: N(input.value), currency: settings.currency, autoRenew: input.autoRenew === true, noticeDays: N(input.noticeDays, 30), obligations: [...A(input.obligationsUs).map((t) => ({ id: uid(), text: t, owner: "us" as const, done: false })), ...A(input.obligationsPartner).map((t) => ({ id: uid(), text: t, owner: "partner" as const, done: false }))], summary: S(input.summary), createdAt: todayISO() };
      st.upsertAgreement(a); return { result: JSON.stringify({ ok: true, id: a.id }), summary: `＋ ${a.title}` };
    }
    case "create_meeting": {
      const p = findPartner(S(input.partnerName));
      const items = Array.isArray(input.actionItems) ? (input.actionItems as In[]).map((x) => ({ text: S(x.text), owner: S(x.owner, "us"), dueAt: addDays(S(input.at, todayISO()), N(x.dueInDays, 7)) })) : undefined;
      const m = { id: uid(), title: S(input.title), partnerId: p?.id, at: S(input.at, todayISO()), attendees: A(input.attendees), rawNotes: S(input.rawNotes), summary: S(input.summary) || undefined, decisions: A(input.decisions).length ? A(input.decisions) : undefined, actionItems: items, createdAt: now };
      st.upsertMeeting(m); if (p && m.at > p.lastContactAt) st.upsertPartner({ ...p, lastContactAt: m.at });
      return { result: JSON.stringify({ ok: true, id: m.id }), summary: `＋ ${m.title}` };
    }
    case "start_feasibility_study": {
      const p = findPartner(S(input.partnerName));
      const inp: StudyInput = { title: S(input.title), idea: S(input.idea), sector: S(input.sector), country: S(input.country), targetMarket: S(input.targetMarket), objectives: S(input.objectives), currency: settings.currency, budgetHint: typeof input.budgetHint === "number" ? N(input.budgetHint) : undefined, horizonYears: N(input.horizonYears, 5) === 3 ? 3 : 5, partnerId: p?.id };
      const study: Study = { id: uid(), input: inp, status: "generating", createdAt: now, updatedAt: now };
      st.upsertStudy(study);
      generateStudy(settings, inp, p)
        .then((result) => { useStore.getState().upsertStudy({ ...study, status: "ready", result, generatedBy: "ai", updatedAt: new Date().toISOString() }); void nativeNotify(settings.lang === "ar" ? "✓ دراسة الجدوى جاهزة" : "✓ Feasibility study ready", `${inp.title} · ${result.verdict.toUpperCase()}`, { channel: "agent" }); })
        .catch((e) => useStore.getState().upsertStudy({ ...study, status: "error", error: e instanceof Error ? e.message : String(e), updatedAt: new Date().toISOString() }));
      return { result: JSON.stringify({ ok: true, id: study.id, status: "generating" }), summary: `✦ ${inp.title}` };
    }
    case "generate_document": {
      const kind = S(input.kind);
      if (kind === "weekly_report") return { result: await weeklyReport(settings, st), summary: "📄 weekly report" };
      const p = findPartner(S(input.partnerName)); if (!p) return { result: "partner not found", summary: "partner not found" };
      if (kind === "partner_brief") { const r = await partnerBrief(settings, p, st.deals.filter((d) => d.partnerId === p.id), st.agreements.filter((a) => a.partnerId === p.id)); st.upsertPartner({ ...p, aiBrief: r }); return { result: r, summary: `📄 brief: ${p.name}` }; }
      if (kind === "proposal") return { result: await proposalDraft(settings, p, S(input.objective)), summary: `📄 proposal: ${p.name}` };
      if (kind === "email") return { result: await emailDraft(settings, p, S(input.objective)), summary: `✉ ${p.name}` };
      if (kind === "negotiation_prep") { const d = findDeal(S(input.dealTitle)) ?? st.deals.find((x) => x.partnerId === p.id); if (!d) return { result: "deal not found", summary: "deal not found" }; return { result: await negotiationPrep(settings, d, p), summary: `🤝 ${d.title}` }; }
      return { result: "unknown kind", summary: "unknown" };
    }
    case "export_file": {
      const kind = S(input.kind); const lang = settings.lang; const rtl = lang === "ar";
      const date = todayISO();
      if (kind === "partners_excel") { await exportXlsx(`partners-${date}`, [partnersToSheet(st.partners, st.deals, st.agreements, lang)], rtl); return { result: "saved", summary: "📊 partners.xlsx" }; }
      if (kind === "pipeline_excel") { await exportXlsx(`pipeline-${date}`, [dealsToSheet(st.deals, st.partners, lang)], rtl); return { result: "saved", summary: "📊 pipeline.xlsx" }; }
      if (kind === "tasks_excel") { await exportXlsx(`tasks-${date}`, [tasksToSheet(st.tasks, st.partners, lang)], rtl); return { result: "saved", summary: "📊 tasks.xlsx" }; }
      if (kind === "agreements_excel") { await exportXlsx(`agreements-${date}`, [agreementsToSheet(st.agreements, st.partners, lang)], rtl); return { result: "saved", summary: "📊 agreements.xlsx" }; }
      if (kind === "meetings_excel") { await exportXlsx(`meetings-${date}`, [meetingsToSheet(st.meetings, st.partners, lang)], rtl); return { result: "saved", summary: "📊 meetings.xlsx" }; }
      if (kind === "all_excel") { await exportXlsx(`partnerhub-${date}`, [partnersToSheet(st.partners, st.deals, st.agreements, lang), dealsToSheet(st.deals, st.partners, lang), agreementsToSheet(st.agreements, st.partners, lang), tasksToSheet(st.tasks, st.partners, lang), meetingsToSheet(st.meetings, st.partners, lang)], rtl); return { result: "saved", summary: "📊 partnerhub.xlsx" }; }
      if (kind.startsWith("study_")) {
        const s = findStudy(S(input.studyTitle)); if (!s?.result) return { result: "study not found or not ready", summary: "study not found" };
        if (kind === "study_excel") await exportXlsx(`study-${s.input.title}`, studyToSheets(s, lang), rtl);
        else if (kind === "study_word") await exportDocx(`study-${s.input.title}`, s.input.title, studyToMarkdown(s, lang), rtl, studyMeta(s, lang));
        else await exportPdfFromMarkdown(`study-${s.input.title}`, s.input.title, studyToMarkdown(s, lang), rtl, studyMeta(s, lang));
        return { result: "saved", summary: `📄 ${s.input.title} (${kind.split("_")[1]})` };
      }
      if (kind === "document_word") { await exportDocx(S(input.title, "document"), S(input.title, "Document"), S(input.markdown), rtl); return { result: "saved", summary: `📄 ${S(input.title)}.docx` }; }
      if (kind === "document_pdf") { await exportPdfFromMarkdown(S(input.title, "document"), S(input.title, "Document"), S(input.markdown), rtl); return { result: "saved", summary: `📄 ${S(input.title)}.pdf` }; }
      return { result: "unknown kind", summary: "unknown" };
    }
    default: return { result: `unknown tool ${name}`, summary: "unknown tool" };
  }
}

/* ------------------------------------------------------------------ */
/* Agent loop                                                           */
/* ------------------------------------------------------------------ */

export interface AgentContext { label?: string; detail?: string }

const systemFor = (s: Settings, lang: Lang, ctx?: AgentContext) => [
  { type: "text" as const, text: `You are the AI Agent inside "PartnerHub", a mobile app for a corporate Partnerships department. You both advise and ACT: use the tools to create and update records, log activity, generate documents, start feasibility studies and export files when the user asks. Prefer doing the work over describing it; ask a question only if a required fact is genuinely missing (e.g. which partner). Resolve partners/deals by name from the snapshot. Never invent facts about real companies. After acting, reply with a short confirmation of what you did and any next step. Organization: ${s.orgName || "(unnamed)"}. User: ${s.userName || "partnerships manager"}. Currency: ${s.currency}. Today: ${todayISO()}.
${lang === "ar" ? "أجب بالعربية المهنية المختصرة. الأرقام بالأرقام الإنجليزية." : "Reply in concise professional English."}` },
  { type: "text" as const, text: `Live data snapshot (JSON): ${snapshot(useStore.getState())}`, cache_control: { type: "ephemeral" as const } },
  ...(ctx?.label ? [{ type: "text" as const, text: `The user is currently viewing: ${ctx.label}${ctx.detail ? ` — ${ctx.detail}` : ""}. Assume references like "this partner"/"this study" point to it.` }] : []),
];

export async function runAgent(settings: Settings, history: { role: "user" | "assistant"; text: string }[], opts: { context?: AgentContext; onStep?: (s: AgentStep) => void } = {}): Promise<{ text: string; steps: AgentStep[] }> {
  const client = new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 10 * 60 * 1000 });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-14).map((m) => ({ role: m.role, content: m.text }));
  const steps: AgentStep[] = [];
  for (let i = 0; i < 12; i++) {
    const stream = client.beta.messages.stream({ model: settings.model, max_tokens: 16000, system: systemFor(settings, settings.lang, opts.context), tools: AGENT_TOOLS, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", messages });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AIError("refused");
    const toolUses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const text = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (msg.stop_reason === "max_tokens" && toolUses.length > 0) throw new AIError("truncated");
    if (msg.stop_reason !== "tool_use" || toolUses.length === 0) return { text, steps };
    messages.push({ role: "assistant", content: msg.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      try {
        const r = await runTool(tu.name, (tu.input ?? {}) as In, settings);
        const step = { tool: tu.name, summary: r.summary, ok: true }; steps.push(step); opts.onStep?.(step);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.result.slice(0, 60000) });
      } catch (e) {
        const step = { tool: tu.name, summary: e instanceof Error ? e.message : String(e), ok: false }; steps.push(step); opts.onStep?.(step);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: `error: ${step.summary}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "", steps };
}
