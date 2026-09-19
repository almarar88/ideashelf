// Accounts (Supabase Auth) + plan/usage from the Majlis server. Only active in hosted mode.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { API_URL, HOSTED_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

export interface PlanInfo { id: string; name: string; price_usd: number; monthly_budget_usd: number; daily_messages: number; allowed_models: string[]; web_search: boolean; council: boolean; device_control: boolean; max_tokens: number; }
export interface Me {
  user: { id: string; email: string | null };
  plan: PlanInfo;
  plan_source: string | null;
  plan_expires_at: string | null;
  usage: { month: string; cost_usd: number; requests: number; messages: number; day_messages: number };
  plans: PlanInfo[];
}

interface AccountState { ready: boolean; session: Session | null; me: Me | null; loading: boolean; error: string | null; }

let state: AccountState = { ready: !HOSTED_ENABLED, session: null, me: null, loading: false, error: null };
const listeners = new Set<() => void>();
const set = (p: Partial<AccountState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };

export const supabase: SupabaseClient | null = HOSTED_ENABLED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

if (supabase) {
  supabase.auth.getSession().then(({ data }) => { set({ session: data.session, ready: true }); if (data.session) void refreshMe(); });
  supabase.auth.onAuthStateChange((_e, session) => { set({ session }); if (session) void refreshMe(); else set({ me: null }); });
}

export function useAccount(): AccountState { return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state); }
export function getAccount(): AccountState { return state; }
export const accessToken = () => state.session?.access_token ?? null;

export async function refreshMe(refreshPlan = false): Promise<Me | null> {
  const token = accessToken();
  if (!token || !API_URL) return null;
  set({ loading: true, error: null });
  try {
    const r = await fetch(`${API_URL}/me${refreshPlan ? "?refresh=1" : ""}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`server ${r.status}`);
    const me = (await r.json()) as Me;
    set({ me, loading: false });
    return me;
  } catch (e) { set({ loading: false, error: e instanceof Error ? e.message : String(e) }); return null; }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Hosted mode is not configured";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}
export async function signUp(email: string, password: string, name: string): Promise<string | null> {
  if (!supabase) return "Hosted mode is not configured";
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  return error ? error.message : null;
}
export async function resetPassword(email: string): Promise<string | null> {
  if (!supabase) return "Hosted mode is not configured";
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return error ? error.message : null;
}
export async function signOut(): Promise<void> { await supabase?.auth.signOut(); set({ me: null }); }

export async function deleteAccount(): Promise<string | null> {
  const token = accessToken();
  if (!token) return "not signed in";
  const r = await fetch(`${API_URL}/account/delete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return `server ${r.status}`;
  await signOut();
  return null;
}

/** Share of the monthly AI allowance used, 0..1. */
export function usageRatio(me: Me | null): number {
  if (!me || !me.plan.monthly_budget_usd) return 0;
  return Math.min(1, me.usage.cost_usd / me.plan.monthly_budget_usd);
}
