// Share and import agents as portable JSON (one agent or a whole team).
import { AVATAR_COLORS, uid, type Agent } from "./types";

export interface AgentPack { liwabot: 1; kind: "agents"; exportedAt: string; agents: Omit<Agent, "id" | "createdAt" | "active">[]; }

const FIELDS: (keyof AgentPack["agents"][number])[] = ["name", "title", "field", "skills", "personality", "instructions", "avatar", "color", "webSearch", "maxSearches", "creativity", "humor", "model"];

export function packAgents(agents: Agent[]): AgentPack {
  return { liwabot: 1, kind: "agents", exportedAt: new Date().toISOString(), agents: agents.map((a) => Object.fromEntries(FIELDS.map((k) => [k, a[k]])) as AgentPack["agents"][number]) };
}

export function packToJson(pack: AgentPack): string { return JSON.stringify(pack, null, 2); }

const clamp = (n: unknown, lo: number, hi: number, d: number) => { const v = Number(n); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d; };

/** Parses a pack (or a bare agent / array of agents) into fresh Agent records. Throws on garbage. */
export function parseAgents(json: string, existingCount = 0): Agent[] {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error("invalid JSON"); }
  const list: unknown[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { agents?: unknown }).agents) ? (raw as { agents: unknown[] }).agents : [raw];
  const out: Agent[] = [];
  list.forEach((x, i) => {
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) return;
    const skills = Array.isArray(o.skills) ? o.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [];
    const model = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"].includes(String(o.model)) ? (o.model as Agent["model"]) : "default";
    out.push({
      id: uid(), createdAt: Date.now(), active: true, name: name.slice(0, 40),
      title: String(o.title ?? "").slice(0, 60), field: String(o.field ?? "").slice(0, 60), skills,
      personality: String(o.personality ?? "").slice(0, 600), instructions: String(o.instructions ?? "").slice(0, 2000),
      avatar: clamp(o.avatar, 0, 11, (existingCount + i) % 12),
      color: typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : AVATAR_COLORS[(existingCount + i) % AVATAR_COLORS.length],
      webSearch: o.webSearch !== false, maxSearches: clamp(o.maxSearches, 0, 10, 5),
      creativity: clamp(o.creativity, 0, 100, 55), humor: clamp(o.humor, 0, 100, 60), model,
    });
  });
  if (!out.length) throw new Error("no agents found");
  return out;
}
