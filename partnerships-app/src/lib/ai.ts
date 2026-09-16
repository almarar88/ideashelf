import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Agreement, Deal, Lang, Meeting, Partner, Settings, Study, StudyInput, StudyResult, Task } from "@/types";
import { project } from "./finance";

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export const hasAI = (s: Settings): boolean => s.apiKey.trim().length > 20;

function client(s: Settings): Anthropic {
  // Key is entered by the user and stored on-device only (BYOK). The app never ships a key.
  return new Anthropic({ apiKey: s.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 10 * 60 * 1000 });
}

const langLine = (lang: Lang) => (lang === "ar" ? "اكتب كل النصوص بالعربية الفصحى المهنية. الأرقام بالأرقام الإنجليزية." : "Write all text in professional English.");

const SYSTEM_BASE = (lang: Lang, s: Settings) =>
  `You are the AI engine inside "PartnerHub", a mobile app for a corporate Partnerships department (إدارة الشراكات). You help partnership managers with partner intelligence, proposals, negotiation, agreements, meeting minutes, and full feasibility studies (دراسات الجدوى).
Be specific, practical, and honest about uncertainty: when you estimate a number (market size, cost, revenue), mark it as an estimate and state the assumption. Never invent named statistics or sources.
Organization: ${s.orgName || "(unnamed)"}. User: ${s.userName || "partnerships manager"}. Default currency: ${s.currency}.
${langLine(lang)}`;

export class AIError extends Error {}

async function text(s: Settings, system: string, user: string, maxTokens = 16000): Promise<string> {
  const c = client(s);
  const stream = c.beta.messages.stream({
    model: s.model,
    max_tokens: maxTokens,
    system,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AIError("refused");
  return msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}

async function structured<T extends z.ZodType>(s: Settings, schema: T, system: string, user: string, maxTokens = 24000): Promise<z.infer<T>> {
  const c = client(s);
  const stream = c.beta.messages.stream({
    model: s.model,
    max_tokens: maxTokens,
    system,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AIError("refused");
  if (msg.stop_reason === "max_tokens") throw new AIError("truncated");
  const parsed = (msg as unknown as { parsed_output: z.infer<T> | null }).parsed_output;
  if (parsed) return parsed;
  const raw = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
  return schema.parse(JSON.parse(raw));
}

export function describeError(e: unknown, lang: Lang): string {
  if (e instanceof Anthropic.AuthenticationError) return lang === "ar" ? "مفتاح API غير صالح." : "Invalid API key.";
  if (e instanceof Anthropic.RateLimitError) return lang === "ar" ? "تم تجاوز حد الطلبات، حاول بعد قليل." : "Rate limited, try again shortly.";
  if (e instanceof Anthropic.APIConnectionError) return lang === "ar" ? "تعذر الاتصال بالخدمة. تحقق من الإنترنت." : "Could not reach the API. Check your connection.";
  if (e instanceof Anthropic.APIError) return `API ${e.status}: ${e.message}`;
  if (e instanceof AIError) return e.message === "refused" ? (lang === "ar" ? "رفض النموذج الطلب." : "The model declined the request.") : (lang === "ar" ? "الإجابة طويلة جداً وتم قطعها." : "Response was truncated.");
  return e instanceof Error ? e.message : String(e);
}

export async function testKey(s: Settings): Promise<boolean> {
  const r = await text(s, "Reply with the single word OK.", "ping", 16);
  return r.toUpperCase().includes("OK");
}

/* ------------------------------------------------------------------ */
/* Context snapshot for chat & reports                                  */
/* ------------------------------------------------------------------ */

export interface Snapshot { partners: Partner[]; deals: Deal[]; agreements: Agreement[]; tasks: Task[]; meetings: Meeting[]; studies: Study[] }

export function snapshot(sn: Snapshot): string {
  const today = new Date().toISOString().slice(0, 10);
  const compact = {
    today,
    partners: sn.partners.map((p) => ({ id: p.id, name: p.name, type: p.type, status: p.status, sector: p.sector, country: p.country, lastContactAt: p.lastContactAt, tags: p.tags, notes: p.notes.slice(0, 200) })),
    deals: sn.deals.map((d) => ({ id: d.id, partner: sn.partners.find((p) => p.id === d.partnerId)?.name, title: d.title, stage: d.stage, value: d.value, probability: d.probability, expectedCloseAt: d.expectedCloseAt, nextStep: d.nextStep, updatedAt: d.updatedAt })),
    agreements: sn.agreements.map((a) => ({ partner: sn.partners.find((p) => p.id === a.partnerId)?.name, title: a.title, type: a.type, status: a.status, endAt: a.endAt, autoRenew: a.autoRenew, noticeDays: a.noticeDays, openObligations: a.obligations.filter((o) => !o.done).map((o) => o.text) })),
    tasks: sn.tasks.filter((t) => t.status === "open").map((t) => ({ title: t.title, priority: t.priority, dueAt: t.dueAt, partner: sn.partners.find((p) => p.id === t.partnerId)?.name })),
    meetings: sn.meetings.slice(0, 5).map((m) => ({ title: m.title, at: m.at, summary: m.summary?.slice(0, 300) })),
    studies: sn.studies.filter((s) => s.result).map((s) => ({ id: s.id, title: s.input.title, sector: s.input.sector, verdict: s.result?.verdict, scores: s.result?.scores, summary: s.result?.executiveSummary.slice(0, 300) })),
  };
  return JSON.stringify(compact);
}

/* ------------------------------------------------------------------ */
/* Feasibility study                                                    */
/* ------------------------------------------------------------------ */

const StudySchema = z.object({
  executiveSummary: z.string(),
  market: z.object({
    size: z.string(),
    growth: z.string(),
    segments: z.array(z.string()),
    competitors: z.array(z.object({ name: z.string(), note: z.string() })),
    demandDrivers: z.array(z.string()),
  }),
  technical: z.object({
    requirements: z.array(z.string()),
    resources: z.array(z.string()),
    timelineMonths: z.number(),
    milestones: z.array(z.object({ name: z.string(), month: z.number() })),
  }),
  legal: z.array(z.string()),
  operations: z.array(z.string()),
  financial: z.object({
    capex: z.number(),
    opexMonthly: z.number(),
    revenueByYear: z.array(z.number()),
    costGrowthPct: z.number(),
    discountRatePct: z.number(),
    taxPct: z.number(),
    unitPrice: z.number(),
    unitCost: z.number(),
    fixedCostsMonthly: z.number(),
    assumptions: z.array(z.string()),
  }),
  swot: z.object({ strengths: z.array(z.string()), weaknesses: z.array(z.string()), opportunities: z.array(z.string()), threats: z.array(z.string()) }),
  risks: z.array(z.object({ title: z.string(), probability: z.number(), impact: z.number(), mitigation: z.string() })),
  partnershipModels: z.array(z.object({ name: z.string(), description: z.string(), fit: z.number() })),
  scores: z.object({ market: z.number(), technical: z.number(), financial: z.number(), legal: z.number(), strategic: z.number() }),
  verdict: z.enum(["go", "conditional", "no-go"]),
  verdictReason: z.string(),
  nextSteps: z.array(z.string()),
  kpis: z.array(z.string()),
});

const clamp15 = (n: number) => Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function toStudyResult(r: z.infer<typeof StudySchema>, horizon: number): StudyResult {
  const rev = r.financial.revenueByYear.slice(0, horizon);
  while (rev.length < horizon) rev.push(rev[rev.length - 1] ?? 0);
  return {
    ...r,
    financial: { ...r.financial, revenueByYear: rev },
    legal: [...r.legal, ...(r.financial.assumptions.length ? [] : [])],
    operations: [...r.operations, ...r.financial.assumptions.map((a) => `📌 ${a}`)],
    risks: r.risks.map((k) => ({ ...k, probability: clamp15(k.probability), impact: clamp15(k.impact) })),
    partnershipModels: r.partnershipModels.map((m) => ({ ...m, fit: clamp100(m.fit) })),
    scores: { market: clamp100(r.scores.market), technical: clamp100(r.scores.technical), financial: clamp100(r.scores.financial), legal: clamp100(r.scores.legal), strategic: clamp100(r.scores.strategic) },
  };
}

export async function generateStudy(s: Settings, input: StudyInput, partner?: Partner): Promise<StudyResult> {
  const system = `${SYSTEM_BASE(s.lang, s)}
You produce complete, decision-grade feasibility studies. Cover market, technical, legal/regulatory, operational, and financial feasibility, SWOT, risk register, suggested partnership models, dimension scores (0-100), a GO / CONDITIONAL / NO-GO verdict with reasoning, next steps, and KPIs.
Financial rules: all money in ${input.currency}. revenueByYear must have exactly ${input.horizonYears} entries (year 1..${input.horizonYears}). capex and opexMonthly must be realistic for the described scale. probability and impact are integers 1-5. Every score is 0-100. List your key financial assumptions explicitly in financial.assumptions.`;
  const user = `Feasibility study request:
Title: ${input.title}
Idea / project: ${input.idea}
Sector: ${input.sector}
Country / region: ${input.country}
Target market: ${input.targetMarket}
Objectives: ${input.objectives}
Budget hint: ${input.budgetHint ? `${input.budgetHint} ${input.currency}` : "none"}
Horizon: ${input.horizonYears} years
${partner ? `Candidate partner: ${partner.name} (${partner.type}, ${partner.sector}, ${partner.country}). ${partner.description}` : "No specific partner yet: recommend partner profiles."}`;
  const raw = await structured(s, StudySchema, system, user, 32000);
  return toStudyResult(raw, input.horizonYears);
}

/* ------------------------------------------------------------------ */
/* Partner intelligence                                                 */
/* ------------------------------------------------------------------ */

export async function partnerBrief(s: Settings, p: Partner, deals: Deal[], agreements: Agreement[]): Promise<string> {
  const user = `Prepare a one-page partner brief in Markdown for:
${JSON.stringify({ name: p.name, type: p.type, status: p.status, sector: p.sector, country: p.country, website: p.website, description: p.description, tags: p.tags, notes: p.notes, lastContactAt: p.lastContactAt, deals: deals.map((d) => ({ title: d.title, stage: d.stage, value: d.value, nextStep: d.nextStep })), agreements: agreements.map((a) => ({ title: a.title, type: a.type, status: a.status, endAt: a.endAt })) })}
Sections: Who they are (from the given data only; do not invent facts about the real company), Why they matter to us, Partnership opportunities (3), Due-diligence checklist (what to verify), Talking points for the next meeting, Red flags to watch, Suggested next action.`;
  return text(s, SYSTEM_BASE(s.lang, s), user);
}

export async function proposalDraft(s: Settings, p: Partner, objective: string): Promise<string> {
  const user = `Draft a partnership proposal (Markdown, ready to paste into a document) from ${s.orgName || "our organization"} to ${p.name} (${p.type}, ${p.sector}).
Objective: ${objective || "a mutually beneficial strategic partnership"}
Context about them: ${p.description} ${p.notes}
Include: cover summary, shared objectives, proposed scope & activities, value for each party, governance & roles, timeline (phases), commercial / in-kind terms placeholders in [brackets], success KPIs, next steps. Keep it concise and persuasive.`;
  return text(s, SYSTEM_BASE(s.lang, s), user);
}

export async function emailDraft(s: Settings, p: Partner, purpose: string): Promise<string> {
  const user = `Write a short professional email to ${p.contacts[0]?.name || "the partner contact"} at ${p.name}. Purpose: ${purpose}. Context: ${p.notes || p.description}. Provide subject line and body. Max 180 words.`;
  return text(s, SYSTEM_BASE(s.lang, s), user, 2000);
}

export async function negotiationPrep(s: Settings, d: Deal, p: Partner): Promise<string> {
  const user = `Prepare a negotiation brief (Markdown) for deal "${d.title}" with ${p.name} (${p.type}). Value ${d.value} ${d.currency}, stage ${d.stage}, probability ${d.probability}%, notes: ${d.notes} ${p.notes}.
Sections: Our goals & walk-away line, Their likely interests, BATNA for both sides, Concessions we can trade (cheap for us / valuable for them), Questions to ask, Anchoring strategy, Risks & red lines, Closing plan.`;
  return text(s, SYSTEM_BASE(s.lang, s), user);
}

const NextStepSchema = z.object({ nextStep: z.string(), probability: z.number(), reasoning: z.string(), suggestedTask: z.object({ title: z.string(), priority: z.enum(["urgent", "medium", "normal"]), dueInDays: z.number() }) });
export type NextStepSuggestion = z.infer<typeof NextStepSchema>;

export async function dealNextStep(s: Settings, d: Deal, p: Partner): Promise<NextStepSuggestion> {
  const user = `Deal: ${JSON.stringify({ title: d.title, partner: p.name, partnerType: p.type, stage: d.stage, value: d.value, probability: d.probability, expectedCloseAt: d.expectedCloseAt, currentNextStep: d.nextStep, notes: d.notes, updatedAt: d.updatedAt, today: new Date().toISOString().slice(0, 10) })}
Suggest the single best next action, a re-estimated close probability (0-100), brief reasoning, and one concrete task.`;
  const r = await structured(s, NextStepSchema, SYSTEM_BASE(s.lang, s), user, 4000);
  return { ...r, probability: clamp100(r.probability) };
}

const ClauseReviewSchema = z.object({ summary: z.string(), risks: z.array(z.object({ clause: z.string(), risk: z.string(), severity: z.enum(["high", "medium", "low"]), suggestion: z.string() })), missingClauses: z.array(z.string()), obligationsUs: z.array(z.string()), obligationsPartner: z.array(z.string()) });
export type ClauseReview = z.infer<typeof ClauseReviewSchema>;

export async function reviewAgreement(s: Settings, a: Agreement, p: Partner, textBody: string): Promise<ClauseReview> {
  const user = `Review this ${a.type} between us and ${p.name}. Title: ${a.title}. Term ${a.startAt} → ${a.endAt}. Value ${a.value} ${a.currency}. Auto-renew: ${a.autoRenew}, notice ${a.noticeDays} days.
Text / summary of the agreement:
${textBody || a.summary || "(no text provided; review the metadata and list what a strong agreement of this type should contain)"}
Identify risky clauses, missing standard clauses (termination, IP, confidentiality, liability, dispute resolution, exclusivity, renewal), and extract obligations for each party. This is not legal advice; flag items for legal counsel.`;
  return structured(s, ClauseReviewSchema, SYSTEM_BASE(s.lang, s), user, 8000);
}

/* ------------------------------------------------------------------ */
/* Meetings                                                             */
/* ------------------------------------------------------------------ */

const MinutesSchema = z.object({ summary: z.string(), decisions: z.array(z.string()), actionItems: z.array(z.object({ text: z.string(), owner: z.string(), dueInDays: z.number() })), followUpEmail: z.string() });
export type Minutes = z.infer<typeof MinutesSchema>;

export async function summarizeMeeting(s: Settings, m: Meeting, partnerName?: string): Promise<Minutes> {
  const user = `Meeting "${m.title}"${partnerName ? ` with ${partnerName}` : ""} on ${m.at}. Attendees: ${m.attendees.join(", ")}.
Raw notes:
${m.rawNotes}
Produce: concise summary (5-8 lines), decisions, action items (owner from attendees or "us", dueInDays 1-30), and a short follow-up email body.`;
  return structured(s, MinutesSchema, SYSTEM_BASE(s.lang, s), user, 8000);
}

/* ------------------------------------------------------------------ */
/* Partner matching, risk radar, day plan, reports, chat                */
/* ------------------------------------------------------------------ */

const MatchSchema = z.object({ existing: z.array(z.object({ partnerId: z.string(), fit: z.number(), why: z.string() })), newProfiles: z.array(z.object({ profile: z.string(), why: z.string(), howToFind: z.string() })) });
export type PartnerMatch = z.infer<typeof MatchSchema>;

export async function matchPartners(s: Settings, study: Study, partners: Partner[]): Promise<PartnerMatch> {
  const user = `Study: ${study.input.title} — ${study.input.idea} (${study.input.sector}, ${study.input.country}). Verdict ${study.result?.verdict}. Suggested models: ${study.result?.partnershipModels.map((m) => m.name).join(", ")}.
Existing partners: ${JSON.stringify(partners.map((p) => ({ partnerId: p.id, name: p.name, type: p.type, sector: p.sector, country: p.country, description: p.description })))}
Rank existing partners by fit (0-100, only those with fit ≥ 40) and describe 3 new partner profiles worth sourcing.`;
  return structured(s, MatchSchema, SYSTEM_BASE(s.lang, s), user, 6000);
}

const RadarSchema = z.object({ items: z.array(z.object({ severity: z.enum(["high", "medium", "low"]), title: z.string(), detail: z.string(), action: z.string(), entityType: z.enum(["partner", "deal", "agreement", "task", "portfolio"]), entityId: z.string() })) });
export type Radar = z.infer<typeof RadarSchema>;

export async function riskRadar(s: Settings, sn: Snapshot): Promise<Radar> {
  const user = `Portfolio snapshot: ${snapshot(sn)}
Scan for risks: expiring agreements without renewal plan, stale partners, stalled deals, overdue obligations, concentration risk (too much value in one partner/type), unrealistic probabilities. Return max 8 items, most severe first. entityId must be an id from the snapshot or "portfolio".`;
  return structured(s, RadarSchema, SYSTEM_BASE(s.lang, s), user, 6000);
}

const DayPlanSchema = z.object({ focus: z.string(), plan: z.array(z.object({ taskTitle: z.string(), startTime: z.string(), endTime: z.string(), why: z.string() })), skip: z.array(z.string()) });
export type DayPlan = z.infer<typeof DayPlanSchema>;

export async function planDay(s: Settings, tasks: Task[], sn: Snapshot): Promise<DayPlan> {
  const user = `Today's open tasks: ${JSON.stringify(tasks.map((t) => ({ title: t.title, priority: t.priority, dueAt: t.dueAt, partner: sn.partners.find((p) => p.id === t.partnerId)?.name })))}
Context: ${snapshot(sn)}
Build a realistic day plan 08:00-17:00 (times as "HH:MM"), order by impact on partnership outcomes, group calls together, leave a buffer. Suggest what to defer.`;
  return structured(s, DayPlanSchema, SYSTEM_BASE(s.lang, s), user, 6000);
}

export async function weeklyReport(s: Settings, sn: Snapshot): Promise<string> {
  const user = `Write the weekly Partnerships Department report (Markdown) for management from this snapshot: ${snapshot(sn)}
Sections: Headline (3 bullets), Pipeline & wins, Partner health & follow-ups needed, Agreements & renewals, Feasibility studies status, Risks, Priorities for next week, Asks from management. Use tables where useful. Be factual: only use the data given.`;
  return text(s, SYSTEM_BASE(s.lang, s), user);
}

export async function chat(s: Settings, history: { role: "user" | "assistant"; text: string }[], sn: Snapshot): Promise<string> {
  const c = client(s);
  const system = [
    { type: "text" as const, text: SYSTEM_BASE(s.lang, s) + "\nAnswer as a sharp chief-of-staff for the partnerships department: direct, prioritized, actionable. Reference partners and deals by name. Keep answers under 250 words unless asked for a document." },
    { type: "text" as const, text: `Live data snapshot (JSON): ${snapshot(sn)}`, cache_control: { type: "ephemeral" as const } },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((m) => ({ role: m.role, content: m.text }));
  const stream = c.beta.messages.stream({ model: s.model, max_tokens: 8000, system, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", messages });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AIError("refused");
  return msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}

/* ------------------------------------------------------------------ */
/* Demo fallback (no API key). Clearly labelled in the UI.              */
/* ------------------------------------------------------------------ */

export function demoStudy(input: StudyInput, lang: Lang): StudyResult {
  const base = input.budgetHint && input.budgetHint > 0 ? input.budgetHint : 500000;
  const capex = Math.round(base * 0.6);
  const opexMonthly = Math.round(base * 0.04);
  const rev = Array.from({ length: input.horizonYears }, (_, i) => Math.round(base * (0.55 + i * 0.35)));
  const ar = lang === "ar";
  const model = { capex, opexMonthly, revenueByYear: rev, costGrowthPct: 6, discountRatePct: 10, taxPct: 15, unitPrice: 1200, unitCost: 500, fixedCostsMonthly: opexMonthly };
  const pr = project(model);
  const financialScore = clamp100(50 + (pr.npv > 0 ? 20 : -20) + Math.min(20, (pr.irr ?? 0) / 2));
  const scores = { market: 68, technical: 72, financial: financialScore, legal: 75, strategic: 70 };
  const verdict: StudyResult["verdict"] = pr.npv > 0 ? "conditional" : "no-go";
  const s = (a: string, e: string) => (ar ? a : e);
  return {
    executiveSummary: s(
      `[نموذج تجريبي — أضف مفتاح API لتوليد دراسة حقيقية] مشروع "${input.title}" في قطاع ${input.sector} يستهدف ${input.targetMarket} في ${input.country}. بناءً على افتراضات نمطية (رأس مال ${capex.toLocaleString()} ${input.currency} وتشغيل شهري ${opexMonthly.toLocaleString()}), يُظهر النموذج المالي صافي قيمة حالية ${Math.round(pr.npv).toLocaleString()} ${input.currency} على ${input.horizonYears} سنوات. التوصية مشروطة بالتحقق من حجم الطلب وتأمين شريك تشغيلي.`,
      `[Demo sample — add an API key for a real study] "${input.title}" in ${input.sector} targets ${input.targetMarket} in ${input.country}. Using generic assumptions (CAPEX ${capex.toLocaleString()} ${input.currency}, monthly OPEX ${opexMonthly.toLocaleString()}), the model yields NPV ${Math.round(pr.npv).toLocaleString()} ${input.currency} over ${input.horizonYears} years. Recommendation is conditional on validating demand and securing an operating partner.`,
    ),
    market: {
      size: s("تقدير أولي: سوق متوسط الحجم بنمو مستقر (يتطلب تحققاً)", "Preliminary estimate: mid-size market with steady growth (needs validation)"),
      growth: s("نمو سنوي مقدر 8-12% (افتراض)", "Estimated 8-12% CAGR (assumption)"),
      segments: [s("المنشآت الصغيرة والمتوسطة", "SMEs"), s("الجهات الحكومية", "Government entities"), s("الشركات الكبرى", "Enterprises")],
      competitors: [{ name: s("منافس محلي (أ)", "Local competitor A"), note: s("حصة سوقية جيدة، تسعير مرتفع", "Good share, premium pricing") }, { name: s("منافس دولي (ب)", "International competitor B"), note: s("علامة قوية، حضور محلي ضعيف", "Strong brand, weak local presence") }],
      demandDrivers: [s("التحول الرقمي", "Digital transformation"), s("الدعم الحكومي للقطاع", "Government sector support"), s("تغير سلوك العملاء", "Changing customer behaviour")],
    },
    technical: {
      requirements: [s("فريق تشغيل من 6-8 أشخاص", "Operations team of 6-8"), s("منصة/بنية تقنية", "Platform / technical infrastructure"), s("تراخيص وتصاريح", "Licences and permits")],
      resources: [s("مكاتب/موقع", "Office / site"), s("موردون رئيسيون", "Key suppliers"), s("شريك تقني", "Technology partner")],
      timelineMonths: 9,
      milestones: [{ name: s("التأسيس والتراخيص", "Setup & licensing"), month: 2 }, { name: s("بناء الفريق", "Team build"), month: 4 }, { name: s("الإطلاق التجريبي", "Pilot launch"), month: 6 }, { name: s("الإطلاق الكامل", "Full launch"), month: 9 }],
    },
    legal: [s("التحقق من متطلبات الترخيص في الدولة", "Verify licensing requirements"), s("اتفاقية شراكة تحدد الملكية الفكرية", "Partnership agreement covering IP"), s("الامتثال لحماية البيانات", "Data-protection compliance")],
    operations: [s("نموذج تشغيل هجين مع الشريك", "Hybrid operating model with partner"), s("مؤشرات جودة شهرية", "Monthly quality KPIs"), `📌 ${s("الافتراضات المالية نمطية وليست مبنية على بيانات السوق الفعلية", "Financial assumptions are generic, not based on actual market data")}`],
    financial: model,
    swot: {
      strengths: [s("شبكة شركاء قائمة", "Existing partner network"), s("خبرة القسم", "Department expertise")],
      weaknesses: [s("محدودية رأس المال", "Limited capital"), s("اعتماد على شريك واحد", "Dependence on a single partner")],
      opportunities: [s("برامج دعم حكومية", "Government support programmes"), s("توسع إقليمي", "Regional expansion")],
      threats: [s("دخول منافسين", "New entrants"), s("تغير التنظيمات", "Regulatory change")],
    },
    risks: [
      { title: s("ضعف الطلب الفعلي", "Weak actual demand"), probability: 3, impact: 4, mitigation: s("تجربة تجريبية مع 3 عملاء قبل الاستثمار الكامل", "Pilot with 3 customers before full investment") },
      { title: s("تأخر التراخيص", "Licensing delays"), probability: 2, impact: 3, mitigation: s("بدء الإجراءات مبكراً", "Start procedures early") },
      { title: s("تجاوز التكاليف", "Cost overrun"), probability: 3, impact: 3, mitigation: s("احتياطي 15%", "15% contingency") },
    ],
    partnershipModels: [
      { name: s("مشروع مشترك", "Joint venture"), description: s("مشاركة رأس المال والعوائد", "Shared capital and returns"), fit: 72 },
      { name: s("اتفاقية رعاية", "Sponsorship"), description: s("تمويل مقابل ظهور", "Funding in exchange for visibility"), fit: 55 },
      { name: s("مذكرة تفاهم تشغيلية", "Operational MoU"), description: s("تعاون بدون التزام مالي", "Collaboration without financial commitment"), fit: 64 },
    ],
    scores,
    verdict,
    verdictReason: s("النتائج المالية النمطية إيجابية لكن يجب التحقق من الطلب والافتراضات. أضف مفتاح API للحصول على تحليل حقيقي.", "Generic financials look positive but demand and assumptions need validation. Add an API key for real analysis."),
    nextSteps: [s("التحقق من حجم الطلب عبر 10 مقابلات", "Validate demand via 10 interviews"), s("تحديد الشريك التشغيلي", "Identify operating partner"), s("إعداد نموذج مالي تفصيلي", "Build detailed financial model")],
    kpis: [s("عدد العملاء النشطين", "Active customers"), s("هامش الربح الإجمالي", "Gross margin"), s("زمن الاسترداد الفعلي", "Actual payback")],
  };
}

export const demoText = (lang: Lang, what: string) =>
  lang === "ar"
    ? `**وضع تجريبي** — لم يتم ضبط مفتاح API.\n\nهنا سيظهر ${what} المولّد بالذكاء الاصطناعي بناءً على بياناتك الفعلية. أضف مفتاح Anthropic API من الإعدادات لتفعيل الميزة.`
    : `**Demo mode** — no API key configured.\n\nThis is where the AI-generated ${what} based on your real data would appear. Add an Anthropic API key in Settings to enable it.`;
