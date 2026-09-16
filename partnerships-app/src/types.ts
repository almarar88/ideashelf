export type Lang = "ar" | "en";

export type Priority = "urgent" | "medium" | "normal";
export type TaskStatus = "open" | "done";

export type PartnerType = "strategic" | "sponsor" | "supplier" | "government" | "ngo" | "academic" | "media" | "technology";
export type PartnerStatus = "prospect" | "active" | "paused" | "ended";

export type DealStage = "lead" | "contact" | "proposal" | "negotiation" | "signed" | "active" | "renewal" | "lost";

export type AgreementType = "mou" | "contract" | "sponsorship" | "nda" | "sla";
export type AgreementStatus = "draft" | "review" | "signed" | "expired" | "terminated";

export interface Contact {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  sector: string;
  country: string;
  website?: string;
  description: string;
  tags: string[];
  contacts: Contact[];
  ownerName: string;
  lastContactAt: string; // ISO
  createdAt: string;
  notes: string;
  aiBrief?: string;
  links?: { title: string; url: string }[];
}

export interface Deal {
  id: string;
  partnerId: string;
  title: string;
  stage: DealStage;
  value: number; // in currency units
  currency: string;
  probability: number; // 0-100
  expectedCloseAt: string;
  nextStep: string;
  updatedAt: string;
  createdAt: string;
  notes: string;
}

export interface Obligation {
  id: string;
  text: string;
  owner: "us" | "partner";
  dueAt?: string;
  done: boolean;
}

export interface Agreement {
  id: string;
  partnerId: string;
  title: string;
  type: AgreementType;
  status: AgreementStatus;
  startAt: string;
  endAt: string;
  value: number;
  currency: string;
  autoRenew: boolean;
  noticeDays: number;
  obligations: Obligation[];
  summary: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  dueAt: string; // ISO date (day)
  startTime?: string; // "08:00"
  endTime?: string; // "10:00"
  partnerId?: string;
  dealId?: string;
  studyId?: string;
  assignee: string;
  createdAt: string;
  source?: "manual" | "ai" | "meeting";
  agent?: boolean; // assigned to the AI agent for execution
  agentResult?: string;
}

export interface Meeting {
  id: string;
  title: string;
  partnerId?: string;
  at: string;
  attendees: string[];
  rawNotes: string;
  summary?: string;
  decisions?: string[];
  actionItems?: { text: string; owner: string; dueAt?: string }[];
  createdAt: string;
}

/* ---------- Feasibility ---------- */

export interface StudyInput {
  title: string;
  idea: string;
  sector: string;
  country: string;
  targetMarket: string;
  partnerId?: string;
  currency: string;
  budgetHint?: number;
  horizonYears: 3 | 5;
  objectives: string;
}

export interface FinancialModel {
  capex: number;
  opexMonthly: number;
  revenueByYear: number[]; // length = horizon
  costGrowthPct: number;
  discountRatePct: number;
  taxPct: number;
  unitPrice?: number;
  unitCost?: number;
  fixedCostsMonthly?: number;
}

export interface RiskItem {
  title: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  mitigation: string;
}

export interface StudyResult {
  executiveSummary: string;
  market: {
    size: string;
    growth: string;
    segments: string[];
    competitors: { name: string; note: string }[];
    demandDrivers: string[];
  };
  technical: {
    requirements: string[];
    resources: string[];
    timelineMonths: number;
    milestones: { name: string; month: number }[];
  };
  legal: string[];
  operations: string[];
  financial: FinancialModel;
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  risks: RiskItem[];
  partnershipModels: { name: string; description: string; fit: number }[];
  scores: { market: number; technical: number; financial: number; legal: number; strategic: number };
  verdict: "go" | "conditional" | "no-go";
  verdictReason: string;
  nextSteps: string[];
  kpis: string[];
}

export interface Study {
  id: string;
  input: StudyInput;
  result?: StudyResult;
  status: "draft" | "generating" | "ready" | "error";
  error?: string;
  generatedBy?: "ai" | "demo";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface AgentStep { tool: string; summary: string; ok: boolean }
export interface AgentTask {
  id: string;
  instruction: string;
  status: "queued" | "running" | "done" | "failed";
  createdAt: string;
  finishedAt?: string;
  result?: string;
  steps: AgentStep[];
  contextLabel?: string;
  linkedTaskId?: string;
}

export interface Settings {
  lang: Lang;
  apiKey: string;
  model: string;
  userName: string;
  orgName: string;
  currency: string;
  demoSeeded: boolean;
  notifications: boolean;
}
