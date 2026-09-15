import { useSyncExternalStore } from "react";
import type { Agent, AppState, Group, JudgeConfig, Settings, UsageEntry } from "./types";
import { defaultAgents, defaultJudge } from "./presets";

const KEY = "majlis:state:v2";

const defaultSettings: Settings = {
  apiKey: "", userName: "", lang: "ar", theme: "light",
  defaultModel: "claude-opus-5", dispatcherModel: "claude-haiku-4-5",
  concurrency: 3, onboarded: false, historyDepth: 30,
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<AppState>;
      return {
        settings: { ...defaultSettings, ...(s.settings ?? {}) },
        agents: s.agents ?? [],
        judge: s.judge ?? defaultJudge("ar"),
        groups: s.groups ?? [],
        usageLog: s.usageLog ?? [],
      };
    }
  } catch { /* ignore */ }
  return { settings: defaultSettings, agents: defaultAgents("ar"), judge: defaultJudge("ar"), groups: [], usageLog: [] };
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("persist failed", e); }
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  persist();
  listeners.forEach((l) => l());
}

export function getState() { return state; }

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => sel(state), () => sel(state));
}

export const actions = {
  updateSettings(p: Partial<Settings>) { setState((s) => ({ settings: { ...s.settings, ...p } })); },
  upsertAgent(a: Agent) {
    setState((s) => ({ agents: s.agents.some((x) => x.id === a.id) ? s.agents.map((x) => (x.id === a.id ? a : x)) : [...s.agents, a] }));
  },
  setAgents(list: Agent[]) { setState({ agents: list }); },
  deleteAgent(id: string) {
    setState((s) => ({ agents: s.agents.filter((a) => a.id !== id), groups: s.groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => m !== id) })) }));
  },
  setJudge(j: JudgeConfig) { setState({ judge: j }); },
  upsertGroup(g: Group) {
    setState((s) => ({ groups: s.groups.some((x) => x.id === g.id) ? s.groups.map((x) => (x.id === g.id ? g : x)) : [g, ...s.groups] }));
  },
  patchGroup(id: string, p: Partial<Group>) { setState((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) })); },
  deleteGroup(id: string) { setState((s) => ({ groups: s.groups.filter((g) => g.id !== id) })); },
  logUsage(e: UsageEntry) { setState((s) => ({ usageLog: [...s.usageLog.slice(-4000), e] })); },
  resetAll() {
    state = { settings: { ...defaultSettings, lang: state.settings.lang }, agents: defaultAgents(state.settings.lang), judge: defaultJudge(state.settings.lang), groups: [], usageLog: [] };
    persist(); listeners.forEach((l) => l());
  },
};
