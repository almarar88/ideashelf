import { Capacitor } from "@capacitor/core";
import { useStore } from "@/store/useStore";
import { addDays, daysBetween, todayISO } from "./ids";

const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 2_000_000_000; };

export async function enableNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return "Notification" in window ? (await Notification.requestPermission()) === "granted" : false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const r = await LocalNotifications.requestPermissions();
  if (r.display !== "granted") return false;
  await scheduleReminders();
  return true;
}

/** Re-schedules reminders for open tasks (08:00 on due day) and expiring agreements (09:00, 30/7/1 days before). */
export async function scheduleReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const st = useStore.getState();
  if (!st.settings.notifications) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  const ar = st.settings.lang === "ar";
  const today = todayISO();
  const at = (iso: string, hour: number) => { const d = new Date(iso + "T00:00:00"); d.setHours(hour, 0, 0, 0); return d; };
  const list: { id: number; title: string; body: string; schedule: { at: Date } }[] = [];
  for (const x of st.tasks.filter((x) => x.status === "open" && x.dueAt >= today)) {
    const when = at(x.dueAt, x.startTime ? Math.max(6, Number(x.startTime.slice(0, 2)) - 1) : 8);
    if (when.getTime() > Date.now()) list.push({ id: hash("t" + x.id), title: ar ? `مهمة اليوم: ${x.title}` : `Task today: ${x.title}`, body: ar ? `الأولوية: ${x.priority}` : `Priority: ${x.priority}`, schedule: { at: when } });
  }
  for (const a of st.agreements.filter((a) => a.status === "signed")) {
    for (const before of [30, 7, 1]) {
      const day = addDays(a.endAt, -before);
      if (day >= today && daysBetween(today, day) <= 60) list.push({ id: hash(`a${a.id}${before}`), title: ar ? `اتفاقية تنتهي خلال ${before} يوم` : `Agreement ends in ${before} days`, body: `${a.title} · ${st.partners.find((p) => p.id === a.partnerId)?.name ?? ""}`, schedule: { at: at(day, 9) } });
    }
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list.slice(0, 60) });
}
