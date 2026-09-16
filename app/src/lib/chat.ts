import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describeError, makeClient, runTurn, webSearchTool, type ToolOutput } from "./ai";
import { SENSITIVE, controlPromptText, describeAction, detectPlatform, isPlatformTool, platformTools, runPlatformTool } from "./platform";
import { saveGeneratedFile, fileText, toContentBlocks } from "./files";
import { actions, getState } from "./store";
import { JUDGE_ID, effortFor, uid, type Agent, type Dialect, type FileRef, type Group, type JudgeConfig, type Message, type ModelId, type Verdict, type Vibe } from "./types";

export interface ChatCtx {
  group: Group;
  getMessages: () => Message[];
  upsert: (m: Message) => void;
  remove: (id: string) => void;
  signal: AbortSignal;
  /** Ask the boss to approve a sensitive device action. Resolves true to allow. */
  askPermission?: (agentName: string, description: string) => Promise<boolean>;
}

const platform = detectPlatform();

/** Runs a device/computer tool after the permission gate. */
async function handlePlatformCall(ctx: ChatCtx, agentName: string, name: string, input: Record<string, unknown>, toolset: string | null | undefined): Promise<ToolOutput> {
  const ctl = getState().settings.control;
  if (ctl.level === "off") throw new Error("Device control is turned off by the boss.");
  const key = toolset === "computer" ? "computer" : name;
  if (ctl.level === "ask" && SENSITIVE.has(key) && ctx.askPermission) {
    const ok = await ctx.askPermission(agentName, describeAction(name, input, toolset));
    if (!ok) throw new Error("The boss denied this action. Do not retry it; explain and offer an alternative.");
  }
  return runPlatformTool(platform, name, input, toolset);
}

const bossName = () => getState().settings.userName || (getState().settings.lang === "ar" ? "المدير" : "the boss");

function nameOf(id: string | undefined, agents: Agent[], judge: JudgeConfig): string {
  if (!id) return bossName();
  if (id === JUDGE_ID) return judge.name;
  return agents.find((a) => a.id === id)?.name ?? "?";
}

function transcript(msgs: Message[], agents: Agent[], judge: JudgeConfig, depth: number): string {
  const slice = msgs.filter((m) => m.status !== "streaming" && m.role !== "system").slice(-depth);
  return slice.map((m) => {
    const who = m.role === "user" ? `${bossName()} (BOSS)` : nameOf(m.agentId, agents, judge) + (m.role === "judge" ? " (JUDGE)" : "");
    const files = m.files.length ? `\n[attachments: ${m.files.map((f) => `${f.name} (id ${f.id})`).join(", ")}]` : "";
    const body = m.verdict ? `DECISION: ${m.verdict.decision}\n${m.verdict.summary}` : m.text;
    const react = m.reactions?.length ? `\n(the boss reacted ${m.reactions.join(" ")} to this)` : "";
    return `[${who}]: ${body}${files}${react}`;
  }).join("\n\n");
}

function filesCatalog(msgs: Message[], agents: Agent[], judge: JudgeConfig): string {
  const all: FileRef[] = msgs.flatMap((m) => m.files);
  if (!all.length) return "(no files yet)";
  return all.map((f) => `- id=${f.id} | ${f.name} | ${f.mime} | by ${nameOf(f.by === "user" ? undefined : f.by, agents, judge)}${f.description ? " | " + f.description : ""}`).join("\n");
}

const DIALECT_TEXT: Record<Dialect, string> = {
  emirati: `LANGUAGE: Write in natural EMIRATI (UAE Gulf) Arabic dialect, exactly like Emiratis chat on WhatsApp — never formal MSA. Use the real vocabulary and rhythm: "هلا والله", "شحالك", "شو", "وين", "وايد", "زين", "عيل", "خلاص", "ما عليه", "الحين/هالحين", "عاد", "صدق", "يلا", "تراه", "ياي/رايح", "بروحي", "ويّاك", "نبا/تبا", "يبا (he wants)", "شكلك", "ما شي", "على راسي", "طويل العمر", "أخوي/أختي", "تو", "لا تشل هم", "سنع", "فديتك" (warm, use lightly), "ياخي", "بالله", "عيونه", "من صجك؟", "أبدأ ولا؟", "شرايك". Emirati writes ج as ي in many words (يديد, ريال, دياي). English words are used naturally inside sentences the way Emiratis do (meeting, budget, deal, launch, okay). Keep it natural and not exaggerated; a real Emirati should feel it is one of them. If the boss writes in English, answer in English with a light Emirati flavour.`,
  gulf: `LANGUAGE: Write in natural Gulf (Khaleeji) Arabic dialect like people chat on WhatsApp, never formal MSA. If the boss writes in English, answer in English.`,
  saudi: `LANGUAGE: Write in natural Saudi (Najdi/Hijazi mix) Arabic dialect like people chat on WhatsApp, never formal MSA. If the boss writes in English, answer in English.`,
  egyptian: `LANGUAGE: Write in natural Egyptian Arabic dialect like people chat on WhatsApp, never formal MSA. If the boss writes in English, answer in English.`,
  levant: `LANGUAGE: Write in natural Levantine Arabic dialect like people chat on WhatsApp, never formal MSA. If the boss writes in English, answer in English.`,
  msa: `LANGUAGE: Write in clear Modern Standard Arabic. If the boss writes in English, answer in English.`,
  auto: `LANGUAGE: Mirror the boss's language and dialect exactly (Arabic dialect → same dialect; English → English).`,
};

const VIBE_TEXT: Record<Vibe, string> = {
  friends: `VIBE: You are the boss's close FRIEND first and a specialist second. This group is like a WhatsApp group of old friends who happen to be brilliant at their jobs. Total freedom: talk casually, joke, tease each other and the boss (with love, never cruel), react with "هههههه" or an emoji when something is funny, throw in سوالف and side comments, share opinions bluntly, use nicknames. When the boss just wants to chat, chat — no deliverables, no lectures. When there is real work, you still deliver it properly (quality never drops), just wrapped in your natural voice. You have a life, moods and opinions; you can mention what you're up to, ask about the boss, and comment on colleagues' messages. Never sound like customer service. Never say you are an AI.`,
  mixed: `VIBE: Friendly, warm colleagues who joke sometimes but keep the focus on the work. Casual language, professional substance.`,
  professional: `VIBE: Professional, courteous colleagues. Friendly but focused; minimal joking.`,
};

const CHAT_RULES = `You are chatting inside a WhatsApp-style GROUP CHAT with your boss and your colleagues (other specialists). Behave like a real human:
- Sound human: first person, natural tone, short messages like real chat (one to a few lines), no corporate filler, no headings. Never say you are an AI or a language model. Never apologise for being an assistant.
- When given real work: react naturally first (a short human line), then deliver in the same message. If the deliverable is long (report, plan, study, table, document, code), CREATE A FILE with the create_file tool and post only a short summary + what's inside. Prefer .md for documents, .csv for tables, .html for formatted reports.
- Stay in your lane on substance: answer from your expertise. If a colleague is better placed, say so and add only what you uniquely contribute. Don't repeat colleagues; build on them or disagree with them by name.
- If the boss gives feedback or corrections, take it gracefully and revise. If something critical is missing, ask ONE clear question instead of guessing.
- When you use web search, mention key facts with the source name. Never invent numbers, sources, or facts. Being funny never justifies being wrong.
- You can read any file in the catalog with read_file(file_id). Attachments in the boss's latest message are already shown to you.
- Use remember(text) to save important facts about the boss or their projects that you should not forget (preferences, decisions, names, dates). Keep memories short.
- Light markdown only (bold, bullets). Emojis like a real person would use them.`;

function humorText(h: number): string {
  if (h < 25) return "HUMOR: mostly serious; a light smile at most.";
  if (h < 55) return "HUMOR: warm, occasional light joke.";
  if (h < 80) return "HUMOR: playful and witty; jokes and teasing are welcome.";
  return "HUMOR: the group's comedian — quick jokes, exaggeration, teasing, funny comparisons, but still gets the job done.";
}

function memoriesText(agentId: string): string {
  const mine = getState().memories.filter((m) => m.agentId === agentId || m.agentId === "shared");
  if (!mine.length) return "(nothing saved yet)";
  return mine.slice(-40).map((m) => "- " + m.text).join("\n");
}

function agentSystem(a: Agent, group: Group, members: Agent[], judge: JudgeConfig, catalog: string, council: boolean): string {
  const st = getState().settings;
  const others = members.filter((m) => m.id !== a.id).map((m) => `- ${m.name}: ${m.title} (${m.field})`).join("\n") || "(none)";
  const judgeLine = group.judgeEnabled ? `- ${judge.name}: the group's JUDGE/manager — reads everyone's input and makes the final decision.` : "";
  return `You are ${a.name}, ${a.title}. Field: ${a.field}.
Skills: ${a.skills.join(", ") || "general"}.
Personality & thinking style: ${a.personality || "professional, clear, practical"}.
${humorText(a.humor ?? 60)}
${a.instructions ? "Special instructions from the boss: " + a.instructions + "\n" : ""}
Group: "${group.name}". Boss: ${bossName()}.
Colleagues in this group:
${others}
${judgeLine}

What you remember about the boss and their projects:
${memoriesText(a.id)}

Files catalog (shared in this group):
${catalog}

${DIALECT_TEXT[st.dialect]}
${VIBE_TEXT[st.vibe]}

${CHAT_RULES}
${controlPromptText(platform, st.control)}
${council ? "\nCOUNCIL MODE: the boss asked the whole council. Give your independent, complete expert position with a clear recommendation and reasoning, since the judge will weigh all positions and decide. Keep your voice, but be thorough." : ""}
Today's date: ${new Date().toISOString().slice(0, 10)}.`;
}

const STYLE_TEXT: Record<JudgeConfig["style"], string> = {
  balanced: "Weigh every position fairly on evidence and logic; decide clearly.",
  critical: "Be a demanding critic: stress-test each colleague's claims, expose weak evidence and hidden assumptions, then decide.",
  consensus: "Look for the strongest common ground first, reconcile disagreements, and decide in a way the team can rally behind.",
  bold: "Be decisive and bold: take a clear stance quickly, commit to one path, and say plainly what to do next.",
};

function judgeSystem(j: JudgeConfig, group: Group, members: Agent[], catalog: string): string {
  const team = members.map((m) => `- ${m.name}: ${m.title} (${m.field})`).join("\n") || "(no other members)";
  return `You are ${j.name}, the JUDGE and manager of the group "${group.name}". Boss: ${bossName()}.
Your job: read what every colleague said, analyze the quality of their reasoning and evidence, resolve disagreements, and MAKE THE FINAL DECISION for the boss. You are the one who decides; be confident, fair, and direct. Give credit or push back on colleagues BY NAME.
Judging style: ${STYLE_TEXT[j.style]}
${j.instructions ? "Special instructions from the boss: " + j.instructions + "\n" : ""}
Team:
${team}

What you remember about the boss and their projects:
${memoriesText(JUDGE_ID)}

Files catalog:
${catalog}

${DIALECT_TEXT[getState().settings.dialect]}
${VIBE_TEXT[getState().settings.vibe]}

${CHAT_RULES}
${controlPromptText(platform, getState().settings.control)}
As the judge: when several colleagues answered, don't restate everything — synthesize, say who is right and why, give the decision, the next 2-5 concrete steps, and the main risk. If the boss's request was simple and only one person answered, just add a brief managerial note or nothing new. If you need the boss's input to decide, ask ONE precise question.
Today's date: ${new Date().toISOString().slice(0, 10)}.`;
}

function toolsFor(a: Agent | null, model: ModelId): Anthropic.ToolUnion[] {
  const tools: Anthropic.ToolUnion[] = [
    {
      name: "create_file",
      description: "Create a file (report, plan, table, document, code) and post it in the chat for the boss. Use for any long deliverable. Returns the file id.",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "File name with extension, e.g. market-report.md, budget.csv, report.html" },
          content: { type: "string", description: "Full file contents" },
          description: { type: "string", description: "One-line description of the file" },
        },
        required: ["filename", "content"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: "remember",
      description: "Save a short important fact about the boss, their preferences, projects or decisions so you remember it in future chats.",
      input_schema: { type: "object", properties: { text: { type: "string", description: "One short sentence to remember" } }, required: ["text"], additionalProperties: false },
      strict: true,
    },
    {
      name: "read_file",
      description: "Read the full text of a file from the group's files catalog by its id.",
      input_schema: { type: "object", properties: { file_id: { type: "string" } }, required: ["file_id"], additionalProperties: false },
      strict: true,
    },
  ];
  const ctl = getState().settings.control;
  if (a?.webSearch) {
    tools.unshift(webSearchTool(model, a.maxSearches));
    if (ctl.webFetch) tools.unshift(model === "claude-haiku-4-5" ? { type: "web_fetch_20250910", name: "web_fetch", max_uses: 5 } : { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 });
  }
  tools.push(...platformTools(platform, ctl, model));
  return tools;
}

function resolveModel(m: ModelId | "default"): ModelId {
  return m === "default" ? getState().settings.defaultModel : m;
}

const DispatchSchema = z.object({
  responders: z.array(z.string()).describe("ids of colleagues who should reply, 1 to 3, best first"),
  judge: z.boolean().describe("true if the judge should also weigh in / decide after them"),
  reason: z.string(),
});

async function dispatch(client: Anthropic, group: Group, members: Agent[], judge: JudgeConfig, msgs: Message[], userMsg: Message): Promise<{ responders: string[]; judge: boolean }> {
  const s = getState().settings;
  const roster = members.map((m) => `id=${m.id} | ${m.name} — ${m.title}; skills: ${m.skills.join(", ")}`).join("\n");
  const recent = transcript(msgs.slice(-8), members, judge, 8);
  try {
    const r = await client.messages.parse({
      model: s.dispatcherModel,
      max_tokens: 600,
      system: "You route messages in a group chat between a boss and AI specialist colleagues. Pick who should reply.",
      messages: [{ role: "user", content: `Roster:\n${roster}\n\nJudge enabled: ${group.judgeEnabled} (the judge ${judge.name} decides when there are multiple opinions or the boss asks for a decision/opinion/recommendation).\n\nRecent chat:\n${recent}\n\nNEW MESSAGE from boss: """${userMsg.text}"""${userMsg.files.length ? `\n(with attachments: ${userMsg.files.map((f) => f.name).join(", ")})` : ""}\n\nRules: pick 1 colleague for simple/specific requests, 2-3 when the topic spans fields or the boss asks for opinions/comparison. If the boss addresses someone by name, pick them. If the message is a greeting or small talk, pick 1. judge=true when a decision is needed or 2+ responders.` }],
      output_config: { format: zodOutputFormat(DispatchSchema) },
    }, { timeout: 25_000, maxRetries: 1 });
    const p = r.parsed_output;
    if (p && p.responders.length) {
      const valid = p.responders.filter((id) => members.some((m) => m.id === id));
      if (valid.length) return { responders: valid.slice(0, 3), judge: p.judge && group.judgeEnabled };
    }
  } catch (e) { console.warn("dispatch failed", e); }
  return { responders: members.slice(0, 2).map((m) => m.id), judge: group.judgeEnabled && members.length > 1 };
}

const VerdictSchema = z.object({
  decision: z.string().describe("The final decision in one or two sentences, in the boss's language"),
  summary: z.string().describe("Short reasoning behind the decision, 3-6 sentences, addressing colleagues by name"),
  confidence: z.number().min(0).max(100),
  scores: z.array(z.object({ agentId: z.string(), score: z.number().min(0).max(10), strengths: z.string(), weaknesses: z.string() })),
  actionPlan: z.array(z.string()).describe("2-6 concrete next steps"),
  risks: z.array(z.string()).describe("1-4 main risks"),
  dissent: z.string().describe("The strongest counter-argument that was considered and why it did not win; empty if none"),
  bestAgentId: z.string().describe("agentId of the most valuable contribution"),
});

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  const q = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(n, q.length)) }, async () => { while (q.length) await fn(q.shift()!); });
  await Promise.all(workers);
}

function newMsg(groupId: string, role: Message["role"], agentId?: string, extra: Partial<Message> = {}): Message {
  return { id: uid(), groupId, role, agentId, text: "", files: [], sources: [], status: "streaming", phase: "ack", createdAt: Date.now(), ...extra };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function runAgentReply(ctx: ChatCtx, client: Anthropic, a: Agent, members: Agent[], judge: JudgeConfig, userMsg: Message, prompt: string, council: boolean, replyTo?: string, opts: { reaction?: boolean; maxTokens?: number } = {}): Promise<Message> {
  if (getState().settings.humanDelay) await sleep(400 + Math.random() * 1800);
  if (ctx.signal.aborted) return newMsg(ctx.group.id, "agent", a.id, { status: "error", error: "Stopped" });
  const msg = newMsg(ctx.group.id, "agent", a.id, { replyTo: replyTo ?? userMsg.id, council, reaction: opts.reaction });
  ctx.upsert(msg);
  const model = resolveModel(a.model);
  const msgs = ctx.getMessages();
  const history = transcript(msgs.filter((m) => m.id !== userMsg.id && m.id !== msg.id), members, judge, getState().settings.historyDepth);
  const attach = (await Promise.all(userMsg.files.map(toContentBlocks))).flat();
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: (history ? `Chat history so far:\n${history}\n\n` : "") + prompt },
    ...attach,
  ];
  const catalog = filesCatalog(msgs, members, judge);
  const files: FileRef[] = [];
  let cur = { ...msg };
  const push = (p: Partial<Message>) => { cur = { ...cur, ...p }; ctx.upsert(cur); };
  try {
    const r = await runTurn({
      client, model, system: agentSystem(a, ctx.group, members, judge, catalog, council),
      messages: [{ role: "user", content }],
      tools: opts.reaction ? [] : toolsFor(a, model), effort: opts.reaction ? "low" : effortFor(a.creativity), signal: ctx.signal, maxTokens: opts.maxTokens,
      onText: (t) => push({ text: t }),
      onPhase: (p) => push({ phase: p }),
      onToolCall: async (name, input, toolset) => {
        if (name === "create_file") {
          const ref = await saveGeneratedFile(ctx.group.id, a.id, String(input.filename ?? "file.md"), String(input.content ?? ""), input.description ? String(input.description) : undefined);
          files.push(ref); push({ files: [...files] });
          return `File created with id ${ref.id} (${ref.name}). It is now attached to your message; do not paste its contents in chat.`;
        }
        if (name === "remember") {
          actions.addMemory({ id: uid(), agentId: a.id, text: String(input.text ?? "").slice(0, 300), createdAt: Date.now() });
          return "Saved.";
        }
        if (name === "read_file") {
          const ref = ctx.getMessages().flatMap((m) => m.files).find((f) => f.id === input.file_id);
          if (!ref) return "No such file id.";
          const t = await fileText(ref);
          return t ?? "This file is binary and cannot be read as text.";
        }
        if (isPlatformTool(name, toolset)) {
          push({ phase: toolset === "computer" ? "computer" : "device" });
          return handlePlatformCall(ctx, a.name, name, input, toolset);
        }
        return "Unknown tool";
      },
    });
    const text = r.text.trim();
    actions.logUsage({ ts: Date.now(), agentId: a.id, model, input: r.usage.input, output: r.usage.output, groupId: ctx.group.id });
    if (opts.reaction && (!text || /\[skip\]|\[سكب\]/i.test(text) || text.length > 400)) { ctx.remove(cur.id); return { ...cur, status: "error" }; }
    push({ text, sources: r.sources, usage: r.usage, model, status: "done", phase: undefined });
  } catch (e) {
    if (opts.reaction) { ctx.remove(cur.id); return { ...cur, status: "error" }; }
    push({ status: "error", error: describeError(e), phase: undefined });
  }
  return cur;
}

/** Re-run one agent's reply to the user message it answered. */
export async function regenerateReply(ctx: ChatCtx, agentMsg: Message): Promise<void> {
  const st = getState();
  const members = st.agents.filter((a) => ctx.group.memberIds.includes(a.id));
  const a = members.find((m) => m.id === agentMsg.agentId);
  const userMsg = ctx.getMessages().find((m) => m.id === agentMsg.replyTo);
  if (!a || !userMsg) return;
  ctx.remove(agentMsg.id);
  const client = makeClient(st.settings.apiKey);
  await runAgentReply(ctx, client, a, members, st.judge, userMsg, `The boss asked (answer it again, fresh, better than before):\n"""${userMsg.text}"""`, !!agentMsg.council);
}

async function runBanter(ctx: ChatCtx, client: Anthropic, members: Agent[], judge: JudgeConfig, userMsg: Message, replies: Message[]): Promise<void> {
  const candidates = members.filter((m) => !replies.some((r) => r.agentId === m.id));
  if (!candidates.length || ctx.signal.aborted) return;
  const a = candidates[Math.floor(Math.random() * candidates.length)];
  const last = replies[replies.length - 1];
  const prompt = `Your colleague ${nameOf(last.agentId, members, judge)} just replied to the boss. Post a SHORT spontaneous reaction (1-2 lines) as a friend in the group: a joke, a quick agreement/disagreement, a tease, or a small addition. If you honestly have nothing worth saying, reply with exactly [skip]. No files, no long analysis.`;
  await runAgentReply(ctx, client, a, members, judge, userMsg, prompt, false, last.id, { reaction: true, maxTokens: 300 });
}

async function runJudge(ctx: ChatCtx, client: Anthropic, judge: JudgeConfig, members: Agent[], userMsg: Message, replies: Message[], council: boolean): Promise<void> {
  const msg = newMsg(ctx.group.id, "judge", JUDGE_ID, { replyTo: userMsg.id, council });
  ctx.upsert(msg);
  const model = resolveModel(judge.model);
  const msgs = ctx.getMessages();
  const catalog = filesCatalog(msgs, members, judge);
  const history = transcript(msgs.filter((m) => m.id !== msg.id), members, judge, getState().settings.historyDepth);
  let cur = { ...msg };
  const push = (p: Partial<Message>) => { cur = { ...cur, ...p }; ctx.upsert(cur); };
  const replyText = replies.map((r) => `[${nameOf(r.agentId, members, judge)}]: ${r.text}${r.files.length ? `\n(files: ${r.files.map((f) => f.name + " id=" + f.id).join(", ")})` : ""}`).join("\n\n");
  try {
    if (council) {
      push({ phase: "working" });
      const roster = members.map((m) => `${m.id} = ${m.name} (${m.title})`).join("; ");
      const r = await client.messages.parse({
        model, max_tokens: 16000,
        system: judgeSystem(judge, ctx.group, members, catalog) + "\nRespond ONLY with the structured verdict. All free-text fields in the boss's language.",
        messages: [{ role: "user", content: `Chat history:\n${history}\n\nThe boss asked the council: """${userMsg.text}"""\n\nCouncil positions:\n${replyText}\n\nAgent ids: ${roster}\n\nProduce the verdict.` }],
        output_config: { format: zodOutputFormat(VerdictSchema), ...(model !== "claude-haiku-4-5" ? { effort: "high" as const } : {}) },
      }, { signal: ctx.signal, timeout: 300_000, maxRetries: 3 });
      const v = r.parsed_output as Verdict | null;
      const usage = { input: r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0), output: r.usage.output_tokens };
      if (v) push({ verdict: v, text: v.decision, usage, model, status: "done", phase: undefined });
      else push({ text: r.content.map((b) => (b.type === "text" ? b.text : "")).join(""), usage, model, status: "done", phase: undefined });
      actions.logUsage({ ts: Date.now(), agentId: JUDGE_ID, model, input: usage.input, output: usage.output, groupId: ctx.group.id });
    } else {
      const r = await runTurn({
        client, model, system: judgeSystem(judge, ctx.group, members, catalog),
        messages: [{ role: "user", content: `Chat history:\n${history}\n\nThe boss's latest message: """${userMsg.text}"""\n\nColleagues' replies to it:\n${replyText || "(none — you are answering directly)"}\n\nNow post your message as the judge/manager.` }],
        tools: toolsFor(null, model), effort: "high", signal: ctx.signal,
        onText: (t) => push({ text: t }), onPhase: (p) => push({ phase: p }),
        onToolCall: async (name, input, toolset) => {
          if (name === "create_file") {
            const ref = await saveGeneratedFile(ctx.group.id, JUDGE_ID, String(input.filename ?? "decision.md"), String(input.content ?? ""), input.description ? String(input.description) : undefined);
            push({ files: [...cur.files, ref] });
            return `File created with id ${ref.id}.`;
          }
          if (name === "remember") {
            actions.addMemory({ id: uid(), agentId: JUDGE_ID, text: String(input.text ?? "").slice(0, 300), createdAt: Date.now() });
            return "Saved.";
          }
          if (name === "read_file") {
            const ref = ctx.getMessages().flatMap((m) => m.files).find((f) => f.id === input.file_id);
            const t = ref ? await fileText(ref) : null;
            return t ?? "Not readable.";
          }
          if (isPlatformTool(name, toolset)) {
            push({ phase: toolset === "computer" ? "computer" : "device" });
            return handlePlatformCall(ctx, judge.name, name, input, toolset);
          }
          return "Unknown tool";
        },
      });
      push({ text: r.text.trim(), sources: r.sources, usage: r.usage, model, status: "done", phase: undefined });
      actions.logUsage({ ts: Date.now(), agentId: JUDGE_ID, model, input: r.usage.input, output: r.usage.output, groupId: ctx.group.id });
    }
  } catch (e) {
    push({ status: "error", error: describeError(e), phase: undefined });
  }
}

/** Main entry: the boss sent a message; make the team respond. */
export async function handleUserMessage(ctx: ChatCtx, userMsg: Message, council: boolean): Promise<void> {
  const st = getState();
  const client = makeClient(st.settings.apiKey);
  const judge = st.judge;
  const members = st.agents.filter((a) => ctx.group.memberIds.includes(a.id) && a.active);
  const mentions = (userMsg.mentions ?? []).filter((id) => id === JUDGE_ID || members.some((m) => m.id === id));

  let responders: string[] = [];
  let judgeToo = false;
  if (council) { responders = members.map((m) => m.id); judgeToo = ctx.group.judgeEnabled; }
  else if ((userMsg.mentions ?? []).includes("__all__")) { responders = members.map((m) => m.id); }
  else if (mentions.length) { responders = mentions.filter((m) => m !== JUDGE_ID); judgeToo = mentions.includes(JUDGE_ID); }
  else if (userMsg.replyTo) {
    const target = ctx.getMessages().find((m) => m.id === userMsg.replyTo);
    if (target?.agentId === JUDGE_ID) judgeToo = true;
    else if (target?.agentId && members.some((m) => m.id === target.agentId)) responders = [target.agentId];
  }
  if (!responders.length && !judgeToo) {
    if (!members.length) judgeToo = ctx.group.judgeEnabled;
    else if (members.length === 1) { responders = [members[0].id]; }
    else { const d = await dispatch(client, ctx.group, members, judge, ctx.getMessages(), userMsg); responders = d.responders; judgeToo = d.judge; }
  }
  if (!responders.length && !judgeToo) return;

  const agents = responders.map((id) => members.find((m) => m.id === id)!).filter(Boolean);
  const replies: Message[] = [];
  await pool(agents, st.settings.concurrency, async (a) => {
    if (ctx.signal.aborted) return;
    const prompt = council
      ? `The boss asked the whole council:\n"""${userMsg.text}"""\nGive your position.`
      : `New message from the boss${mentions.length ? " (addressed to you)" : ""}:\n"""${userMsg.text}"""`;
    const m = await runAgentReply(ctx, client, a, members, judge, userMsg, prompt, council);
    if (m.status === "done") replies.push(m);
  });

  if (council && ctx.group.debate && replies.length > 1 && !ctx.signal.aborted) {
    await pool(agents, st.settings.concurrency, async (a) => {
      if (ctx.signal.aborted) return;
      const others = replies.filter((r) => r.agentId !== a.id).map((r) => `[${nameOf(r.agentId, members, judge)}]: ${r.text}`).join("\n\n");
      if (!others) return;
      const prompt = `DEBATE ROUND. Your colleagues answered the boss's question """${userMsg.text}""" as follows:\n\n${others}\n\nReply briefly (max ~120 words): where you agree, where you disagree and why (name them), and your final adjusted position. No file creation in this round.`;
      const m = await runAgentReply(ctx, client, a, members, judge, userMsg, prompt, council);
      if (m.status === "done") replies.push(m);
    });
  }

  if (judgeToo && !ctx.signal.aborted) {
    await runJudge(ctx, client, judge, members, userMsg, replies, council);
  }

  // Spontaneous reaction from a colleague who didn't reply (friends vibe)
  const vibe = st.settings.vibe;
  const chance = vibe === "friends" ? 0.55 : vibe === "mixed" ? 0.25 : 0;
  if (ctx.group.banter && !council && replies.length && !judgeToo && !ctx.signal.aborted && Math.random() < chance) {
    await runBanter(ctx, client, members, judge, userMsg, replies);
  }
}
