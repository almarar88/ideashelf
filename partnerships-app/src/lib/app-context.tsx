import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/ui";
import type { AgentContext } from "@/lib/agent";

export type NavTarget = { kind: "tab"; tab: "home" | "partners" | "pipeline" | "studies" | "more" } | { kind: "partner"; id: string } | { kind: "study"; id: string } | { kind: "sub"; sub: "tasks" | "agreements" | "meetings" | "reports" | "settings" | "calendar" };

interface Ctx {
  toast: (msg: string) => void;
  openAssistant: (prefill?: string) => void;
  assistantOpen: boolean;
  assistantPrefill: string;
  closeAssistant: () => void;
  context: AgentContext | undefined;
  setContext: (c: AgentContext | undefined) => void;
  navigate: (t: NavTarget) => void;
  registerNav: (fn: (t: NavTarget) => void) => void;
  addTaskSignal: number;
  requestAddTask: () => void;
}

const C = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrefill, setPrefill] = useState("");
  const [context, setContextState] = useState<AgentContext | undefined>(undefined);
  const navRef = useRef<(t: NavTarget) => void>(() => {});
  const [addTaskSignal, setAddTaskSignal] = useState(0);
  const requestAddTask = useCallback(() => setAddTaskSignal((n) => n + 1), []);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2400);
  }, []);
  const openAssistant = useCallback((p = "") => { setPrefill(p); setAssistantOpen(true); }, []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const setContext = useCallback((c: AgentContext | undefined) => setContextState(c), []);
  const navigate = useCallback((t: NavTarget) => navRef.current(t), []);
  const registerNav = useCallback((fn: (t: NavTarget) => void) => { navRef.current = fn; }, []);
  return (
    <C.Provider value={{ toast, openAssistant, assistantOpen, assistantPrefill, closeAssistant, context, setContext, navigate, registerNav, addTaskSignal, requestAddTask }}>
      {children}
      <Toast msg={msg} />
    </C.Provider>
  );
}

export const useApp = (): Ctx => {
  const c = useContext(C);
  if (!c) throw new Error("AppProvider missing");
  return c;
};

/** Declare what the user is looking at so the agent understands "this partner" / "this study". */
export function useAgentContext(ctx: AgentContext | undefined) {
  const { setContext } = useApp();
  const key = `${ctx?.label ?? ""}|${ctx?.detail ?? ""}`;
  useEffect(() => { setContext(ctx); return () => setContext(undefined); }, [key, setContext]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Run an async job with loading/error state. */
export function useJob<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const run = useCallback(async (fn: () => Promise<T>, onError?: (e: unknown) => string) => {
    setLoading(true); setError(null);
    try { const r = await fn(); setData(r); return r; }
    catch (e) { setError(onError ? onError(e) : e instanceof Error ? e.message : String(e)); return null; }
    finally { setLoading(false); }
  }, []);
  return { loading, error, data, run, setData };
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => { const mq = window.matchMedia(query); const h = () => setM(mq.matches); mq.addEventListener("change", h); setM(mq.matches); return () => mq.removeEventListener("change", h); }, [query]);
  return m;
}
export const useWide = () => useMedia("(min-width: 768px)");

export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text, dialogTitle: title });
    return true;
  } catch {
    try {
      if (navigator.share) { await navigator.share({ title, text }); return true; }
      await navigator.clipboard.writeText(text);
      return true;
    } catch { return false; }
  }
}
