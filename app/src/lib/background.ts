// Keeps the agents' work alive when the app goes to the background.
// Android: a foreground service with a persistent notification (the OS would
// otherwise freeze the process and drop the network connections).
// Everywhere else this is a no-op, plus a "done" notification when the app is hidden.
import { Capacitor } from "@capacitor/core";

const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const CHANNEL = "majlis_work";
let channelReady = false;
let active = false;

async function fg() {
  const { ForegroundService, Importance } = await import("@capawesome-team/capacitor-android-foreground-service");
  if (!channelReady) {
    await ForegroundService.createNotificationChannel({ id: CHANNEL, name: "LiwaBot", description: "Agents working in the background", importance: Importance.Low }).catch(() => undefined);
    channelReady = true;
  }
  return ForegroundService;
}

export const keepAlive = {
  /** Never blocks the caller: the service starts in the background with a short timeout. */
  async start(title: string, body: string) {
    if (!isAndroid) return;
    const work = (async () => {
      const F = await fg();
      await Promise.race([F.requestPermissions().catch(() => undefined), new Promise((r) => setTimeout(r, 4000))]);
      await F.startForegroundService({ id: 7, title, body, smallIcon: "ic_stat_liwabot", silent: true, notificationChannelId: CHANNEL });
      active = true;
    })().catch((e) => console.warn("foreground service failed", e));
    await Promise.race([work, new Promise((r) => setTimeout(r, 1500))]);
  },
  async update(title: string, body: string) {
    if (!isAndroid || !active) return;
    try { const F = await fg(); await F.updateForegroundService({ id: 7, title, body, smallIcon: "ic_stat_liwabot", silent: true, notificationChannelId: CHANNEL }); } catch { /* ignore */ }
  },
  async stop() {
    if (!isAndroid || !active) return;
    active = false;
    try { const F = await fg(); await F.stopForegroundService(); } catch { /* ignore */ }
  },
};

/** Tell the boss the team finished while the app was hidden. */
export async function notifyDone(title: string, body: string) {
  if (!document.hidden) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== "granted") return;
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e6), title, body }] });
    } catch { /* ignore */ }
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
}
