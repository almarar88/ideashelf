import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Agreement, AgentTask, ChatMessage, Deal, Meeting, Partner, Settings, Study, Task } from "@/types";
import { seedDemo } from "@/lib/demo";
import { uid } from "@/lib/ids";

export interface State {
  settings: Settings;
  partners: Partner[];
  deals: Deal[];
  agreements: Agreement[];
  tasks: Task[];
  meetings: Meeting[];
  studies: Study[];
  chat: ChatMessage[];
  agentTasks: AgentTask[];

  upsertAgentTask: (a: AgentTask) => void;
  removeAgentTask: (id: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  upsertPartner: (p: Partner) => void;
  removePartner: (id: string) => void;
  upsertDeal: (d: Deal) => void;
  removeDeal: (id: string) => void;
  upsertAgreement: (a: Agreement) => void;
  removeAgreement: (id: string) => void;
  upsertTask: (t: Task) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  upsertMeeting: (m: Meeting) => void;
  removeMeeting: (id: string) => void;
  upsertStudy: (s: Study) => void;
  removeStudy: (id: string) => void;
  pushChat: (m: ChatMessage) => void;
  clearChat: () => void;
  loadDemo: () => void;
  clearAll: () => void;
  importAll: (data: Partial<State>) => void;
}

const defaultSettings: Settings = {
  lang: "ar",
  apiKey: "",
  model: "claude-opus-5",
  userName: "",
  orgName: "",
  currency: "AED",
  demoSeeded: false,
  notifications: false,
};

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      partners: [], deals: [], agreements: [], tasks: [], meetings: [], studies: [], chat: [], agentTasks: [],

      upsertAgentTask: (a) => set({ agentTasks: upsert(get().agentTasks, a) }),
      removeAgentTask: (id) => set({ agentTasks: get().agentTasks.filter((a) => a.id !== id) }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      upsertPartner: (p) => set({ partners: upsert(get().partners, p) }),
      removePartner: (id) => set({
        partners: get().partners.filter((p) => p.id !== id),
        deals: get().deals.filter((d) => d.partnerId !== id),
        agreements: get().agreements.filter((a) => a.partnerId !== id),
      }),
      upsertDeal: (d) => set({ deals: upsert(get().deals, d) }),
      removeDeal: (id) => set({ deals: get().deals.filter((d) => d.id !== id) }),
      upsertAgreement: (a) => set({ agreements: upsert(get().agreements, a) }),
      removeAgreement: (id) => set({ agreements: get().agreements.filter((a) => a.id !== id) }),
      upsertTask: (t) => set({ tasks: upsert(get().tasks, t) }),
      removeTask: (id) => set({ tasks: get().tasks.filter((t) => t.id !== id) }),
      toggleTask: (id) => set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t)) }),
      upsertMeeting: (m) => set({ meetings: upsert(get().meetings, m) }),
      removeMeeting: (id) => set({ meetings: get().meetings.filter((m) => m.id !== id) }),
      upsertStudy: (s) => set({ studies: upsert(get().studies, s) }),
      removeStudy: (id) => set({ studies: get().studies.filter((s) => s.id !== id) }),
      pushChat: (m) => set({ chat: [...get().chat, m] }),
      clearChat: () => set({ chat: [] }),
      loadDemo: () => {
        const d = seedDemo();
        set({ ...d, studies: get().studies, settings: { ...get().settings, demoSeeded: true } });
      },
      clearAll: () => set({ partners: [], deals: [], agreements: [], tasks: [], meetings: [], studies: [], chat: [], agentTasks: [], settings: { ...get().settings, demoSeeded: true } }),
      importAll: (data) => set({
        partners: data.partners ?? get().partners,
        deals: data.deals ?? get().deals,
        agreements: data.agreements ?? get().agreements,
        tasks: data.tasks ?? get().tasks,
        meetings: data.meetings ?? get().meetings,
        studies: data.studies ?? get().studies,
      }),
    }),
    {
      name: "partnerhub-v1",
      version: 2,
      migrate: (persisted) => {
        const st = persisted as Partial<State>;
        return { ...st, agentTasks: st.agentTasks ?? [], settings: { ...defaultSettings, ...(st.settings ?? {}) } } as State;
      },
      onRehydrateStorage: () => (state) => {
        if (state && !state.settings.demoSeeded && state.partners.length === 0) state.loadDemo();
      },
    },
  ),
);

export const newChatMessage = (role: ChatMessage["role"], text: string): ChatMessage => ({ id: uid(), role, text, at: new Date().toISOString() });

/* ---------- derived helpers ---------- */

export function partnerHealth(p: Partner, deals: Deal[], agreements: Agreement[], tasks: Task[]): number {
  const daysSince = Math.max(0, Math.round((Date.now() - new Date(p.lastContactAt).getTime()) / 86400000));
  let score = 100;
  if (daysSince > 14) score -= Math.min(40, (daysSince - 14) * 1.5);
  const openDeals = deals.filter((d) => d.partnerId === p.id && !["lost", "signed", "active"].includes(d.stage));
  const staleDeals = openDeals.filter((d) => Math.round((Date.now() - new Date(d.updatedAt).getTime()) / 86400000) > 21);
  score -= staleDeals.length * 10;
  const expiring = agreements.filter((a) => a.partnerId === p.id && a.status === "signed" && (new Date(a.endAt).getTime() - Date.now()) / 86400000 < 60);
  score -= expiring.length * 8;
  const overdue = tasks.filter((t) => t.partnerId === p.id && t.status === "open" && t.dueAt < new Date().toISOString().slice(0, 10));
  score -= overdue.length * 5;
  if (p.status === "paused") score -= 15;
  if (p.status === "ended") score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
