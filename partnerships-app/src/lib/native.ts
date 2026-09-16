import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { State } from "@/store/useStore";
import { addDays, daysBetween, fmtMoney, todayISO } from "./ids";

interface PartnerHubPlugin {
  syncSnapshot(o: { json: string }): Promise<void>;
  notify(o: { title: string; text: string; channel?: "reminders" | "agent"; id?: number; action?: string }): Promise<void>;
  startForeground(o: { title: string; text: string }): Promise<void>;
  stopForeground(): Promise<void>;
  consumePendingAction(): Promise<{ action: string }>;
  notificationsAllowed(): Promise<{ allowed: boolean }>;
  addListener(event: "action", fn: (d: { action: string }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<PartnerHubPlugin>("PartnerHub");
export const isNative = () => Capacitor.isNativePlatform();

/** Compact snapshot for the widget and the background worker (no WebView needed to read it). */
export function buildSnapshot(st: Pick<State, "tasks" | "deals" | "agreements" | "partners" | "studies" | "settings">): string {
  const today = todayISO();
  const pn = (id?: string) => st.partners.find((p) => p.id === id)?.name ?? "";
  const todayTasks = st.tasks.filter((t) => t.status === "open" && t.dueAt === today).sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
  const renewals = st.agreements.filter((a) => a.status === "signed").map((a) => ({ id: a.id, title: a.title, partner: pn(a.partnerId), days: daysBetween(today, a.endAt) })).filter((r) => r.days >= 0 && r.days <= 90).sort((a, b) => a.days - b.days);
  const weighted = st.deals.filter((d) => !["lost", "signed", "active"].includes(d.stage)).reduce((s, d) => s + d.value * d.probability / 100, 0);
  return JSON.stringify({
    lang: st.settings.lang,
    notifications: st.settings.notifications,
    digestHour: 8,
    syncedAt: new Date().toISOString(),
    todayCount: todayTasks.length,
    urgentCount: todayTasks.filter((t) => t.priority === "urgent").length,
    overdueCount: st.tasks.filter((t) => t.status === "open" && t.dueAt < today).length,
    tomorrowCount: st.tasks.filter((t) => t.status === "open" && t.dueAt === addDays(today, 1)).length,
    todayTasks: todayTasks.slice(0, 6).map((t) => ({ id: t.id, title: t.title, priority: t.priority, time: t.startTime ?? "", partner: pn(t.partnerId) })),
    pipeline: fmtMoney(weighted, st.settings.currency),
    activePartners: st.partners.filter((p) => p.status === "active").length,
    studiesReady: st.studies.filter((s) => s.status === "ready").length,
    nextRenewal: renewals[0] ?? null,
    renewals: renewals.slice(0, 10),
  });
}

export async function syncNative(st: Parameters<typeof buildSnapshot>[0]): Promise<void> {
  if (!isNative()) return;
  try { await Native.syncSnapshot({ json: buildSnapshot(st) }); } catch { /* plugin missing on web */ }
}

export async function nativeNotify(title: string, text: string, opts: { channel?: "reminders" | "agent"; action?: string } = {}): Promise<void> {
  if (isNative()) { try { await Native.notify({ title, text, channel: opts.channel ?? "agent", action: opts.action ?? "home" }); return; } catch { /* fall through */ } }
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body: text }); } catch { /* ignore */ }
}

export async function foreground(on: boolean, title = "PartnerHub", text = ""): Promise<void> {
  if (!isNative()) return;
  try { if (on) await Native.startForeground({ title, text }); else await Native.stopForeground(); } catch { /* ignore */ }
}

export async function consumePendingAction(): Promise<string> {
  if (!isNative()) return "";
  try { return (await Native.consumePendingAction()).action ?? ""; } catch { return ""; }
}

export async function onNativeAction(fn: (action: string) => void): Promise<() => void> {
  if (!isNative()) return () => undefined;
  try { const h = await Native.addListener("action", (d) => fn(d.action)); return () => h.remove(); } catch { return () => undefined; }
}
