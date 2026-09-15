export type ModelId = "claude-opus-5" | "claude-sonnet-5" | "claude-haiku-4-5";
export type Lang = "ar" | "en";

export const MODELS: { id: ModelId; label: string; note: { ar: string; en: string }; inPrice: number; outPrice: number }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", note: { ar: "الأذكى — للقرارات المهمة", en: "Smartest — for important decisions" }, inPrice: 5, outPrice: 25 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: { ar: "متوازن — سريع وذكي", en: "Balanced — fast and smart" }, inPrice: 2, outPrice: 10 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: { ar: "الأسرع والأرخص", en: "Fastest and cheapest" }, inPrice: 1, outPrice: 5 },
];

export const JUDGE_ID = "__judge__";

export interface Agent {
  id: string;
  name: string;
  title: string;
  field: string;
  skills: string[];
  personality: string;
  instructions: string;
  avatar: number;
  color: string;
  webSearch: boolean;
  maxSearches: number;
  creativity: number;   // 0..100 → effort
  humor: number;        // 0..100 how playful / jokey
  model: ModelId | "default";
  active: boolean;
  createdAt: number;
}

export type Dialect = "emirati" | "gulf" | "saudi" | "egyptian" | "levant" | "msa" | "auto";
export type Vibe = "friends" | "mixed" | "professional";

export interface Memory { id: string; agentId: string; text: string; createdAt: number; }

export type JudgeStyle = "balanced" | "critical" | "consensus" | "bold";

export interface JudgeConfig {
  name: string;
  avatar: number;
  color: string;
  style: JudgeStyle;
  instructions: string;
  model: ModelId | "default";
}

export interface Usage { input: number; output: number; }
export interface Source { url: string; title: string; }

export interface FileRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  by: string;           // "user" | agentId | JUDGE_ID
  createdAt: number;
  groupId: string;
  description?: string;
}

export interface AgentScore { agentId: string; score: number; strengths: string; weaknesses: string; }

export interface Verdict {
  decision: string;
  summary: string;
  confidence: number;
  scores: AgentScore[];
  actionPlan: string[];
  risks: string[];
  dissent: string;
  bestAgentId: string;
}

export type MsgRole = "user" | "agent" | "judge" | "system";
export type MsgStatus = "streaming" | "done" | "error";

export interface Message {
  id: string;
  groupId: string;
  role: MsgRole;
  agentId?: string;      // for agent messages; JUDGE_ID for judge
  text: string;
  files: FileRef[];
  sources: Source[];
  status: MsgStatus;
  phase?: "ack" | "working" | "searching" | "writing";
  verdict?: Verdict;
  usage?: Usage;
  model?: ModelId;
  createdAt: number;
  replyTo?: string;
  mentions?: string[];
  council?: boolean;
  error?: string;
  reactions?: string[];   // emoji the boss put on this message
  reaction?: boolean;     // short spontaneous reaction from a colleague
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  memberIds: string[];
  judgeEnabled: boolean;
  debate: boolean;
  banter: boolean;        // spontaneous reactions from other members
  createdAt: number;
  updatedAt: number;
  lastPreview: string;
  lastSender: string;
  msgCount: number;
}

export interface UsageEntry { ts: number; agentId: string; model: ModelId; input: number; output: number; groupId: string; }

export interface Settings {
  apiKey: string;
  userName: string;
  lang: Lang;
  theme: "light" | "dark";
  defaultModel: ModelId;
  dispatcherModel: ModelId;
  concurrency: number;
  onboarded: boolean;
  historyDepth: number;
  dialect: Dialect;
  vibe: Vibe;
  humanDelay: boolean;
}

export interface AppState {
  settings: Settings;
  agents: Agent[];
  judge: JudgeConfig;
  groups: Group[];
  usageLog: UsageEntry[];
  memories: Memory[];
}

export const AVATAR_COLORS = ["#f47a4b", "#3aa7a3", "#8b6cf6", "#4f8ef7", "#4cb37a", "#ef6aa0", "#e9b43a", "#e35d5d", "#5a6bd8", "#7a8c99", "#c46bd6", "#2f9c8a"];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function effortFor(creativity: number): "low" | "medium" | "high" | "xhigh" {
  if (creativity < 25) return "low";
  if (creativity < 50) return "medium";
  if (creativity < 78) return "high";
  return "xhigh";
}

export function costUSD(model: ModelId, u: Usage): number {
  const m = MODELS.find((x) => x.id === model) ?? MODELS[0];
  return (u.input * m.inPrice + u.output * m.outPrice) / 1_000_000;
}

export function isTextMime(mime: string, name = ""): boolean {
  return mime.startsWith("text/") || /json|csv|xml|markdown|html|javascript/.test(mime) || /\.(md|txt|csv|json|html|htm|js|ts|py|xml|yaml|yml)$/i.test(name);
}
export function isImageMime(mime: string): boolean {
  return /^image\/(png|jpeg|jpg|gif|webp)$/.test(mime);
}
