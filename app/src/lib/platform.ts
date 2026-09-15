// Platform capability layer: desktop (Electron bridge), Android/iOS (Capacitor), web.
// Every tool here is gated by the user's Control settings (off / ask / full) in chat.ts.
import type Anthropic from "@anthropic-ai/sdk";
import { Capacitor } from "@capacitor/core";
import type { ControlSettings, ModelId } from "./types";

export type Platform = "desktop" | "android" | "ios" | "web";

interface DesktopBridge {
  platform: string;
  invoke: (name: string, input: Record<string, unknown>) => Promise<unknown>;
}
declare global { interface Window { majlisDesktop?: DesktopBridge } }

export function detectPlatform(): Platform {
  if (typeof window !== "undefined" && window.majlisDesktop) return "desktop";
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() === "ios" ? "ios" : "android";
  return "web";
}

export type ToolOutput = string | Anthropic.ContentBlockParam[];

const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): Anthropic.Tool => ({
  name, description, strict: true,
  input_schema: { type: "object", properties, required, additionalProperties: false } as Anthropic.Tool.InputSchema,
});

/** Actions that need the boss's approval when control level is "ask". */
export const SENSITIVE = new Set(["shell", "fs_write", "open_app", "computer", "dial_number", "send_sms", "clipboard_write"]);

export function platformTools(platform: Platform, ctl: ControlSettings, model: ModelId): Anthropic.ToolUnion[] {
  if (ctl.level === "off") return [];
  const t: Anthropic.ToolUnion[] = [];
  if (platform === "desktop") {
    if (ctl.shell) t.push(tool("shell", "Run a command on the boss's computer (PowerShell on Windows, sh on macOS/Linux) and get stdout/stderr/exit code. Use it for real work: list or organise files, install tools, open programs, automation scripts, check system state.", { command: { type: "string" }, cwd: { type: "string", description: "Working directory (optional)" }, timeout_seconds: { type: "integer", description: "Max seconds, default 120" } }, ["command"]));
    if (ctl.files) {
      t.push(tool("fs_read", "Read a text file from the computer by absolute path.", { path: { type: "string" } }, ["path"]));
      t.push(tool("fs_write", "Create or overwrite a text file on the computer (creates parent folders).", { path: { type: "string" }, content: { type: "string" } }, ["path", "content"]));
      t.push(tool("fs_list", "List a folder on the computer.", { path: { type: "string" } }, ["path"]));
      t.push(tool("open_app", "Open a file, folder, program or URL with the default application (e.g. 'notepad', 'C:\\\\Users\\\\me\\\\report.docx', 'https://...').", { target: { type: "string" } }, ["target"]));
    }
    t.push(tool("system_info", "Get OS, user, hostname, CPU, memory, home folder and current time of the boss's computer.", {}));
    t.push(tool("clipboard_read", "Read the computer clipboard text.", {}));
    t.push(tool("clipboard_write", "Put text on the computer clipboard.", { text: { type: "string" } }, ["text"]));
    t.push(tool("notify", "Show a desktop notification.", { title: { type: "string" }, body: { type: "string" } }, ["title", "body"]));
    if (ctl.screen && model !== "claude-haiku-4-5") t.push({ type: "computer_toolset_20260801" });
  } else if (platform === "android" || platform === "ios") {
    if (ctl.device) {
      t.push(tool("open_url", "Open a web page in the phone's browser.", { url: { type: "string" } }, ["url"]));
      t.push(tool("open_app", "Open another app on the phone by URL scheme or Android package (e.g. 'whatsapp://send?text=hi', 'com.google.android.youtube', 'maps://').", { target: { type: "string" } }, ["target"]));
      t.push(tool("get_location", "Get the phone's current GPS location (lat, lng, accuracy).", {}));
      t.push(tool("dial_number", "Open the phone dialer with a number ready to call.", { number: { type: "string" } }, ["number"]));
      t.push(tool("send_sms", "Open the SMS app with recipient and text prefilled (the boss taps send).", { number: { type: "string" }, text: { type: "string" } }, ["number", "text"]));
      t.push(tool("clipboard_read", "Read the phone clipboard text.", {}));
      t.push(tool("clipboard_write", "Copy text to the phone clipboard.", { text: { type: "string" } }, ["text"]));
      t.push(tool("notify", "Show a phone notification, optionally after N seconds (a reminder).", { title: { type: "string" }, body: { type: "string" }, in_seconds: { type: "integer" } }, ["title", "body"]));
      t.push(tool("device_info", "Get phone model, OS version, battery level, network status.", {}));
      t.push(tool("vibrate", "Vibrate the phone briefly.", {}));
    }
  }
  return t;
}

export function describeAction(name: string, input: Record<string, unknown>, toolsetName?: string | null): string {
  if (toolsetName === "computer") return `${name}${input.coordinate ? " @" + JSON.stringify(input.coordinate) : ""}${input.text ? ` "${String(input.text).slice(0, 60)}"` : ""}`;
  switch (name) {
    case "shell": return `run: ${String(input.command ?? "").slice(0, 300)}`;
    case "fs_write": return `write file ${input.path}`;
    case "fs_read": return `read file ${input.path}`;
    case "fs_list": return `list folder ${input.path}`;
    case "open_app": return `open ${input.target}`;
    case "open_url": return `open ${input.url}`;
    case "dial_number": return `call ${input.number}`;
    case "send_sms": return `SMS to ${input.number}`;
    case "clipboard_write": return `copy to clipboard: ${String(input.text ?? "").slice(0, 80)}`;
    default: return name;
  }
}

export function isPlatformTool(name: string, toolsetName?: string | null): boolean {
  if (toolsetName === "computer") return true;
  return ["shell", "fs_read", "fs_write", "fs_list", "open_app", "system_info", "clipboard_read", "clipboard_write", "notify", "open_url", "get_location", "dial_number", "send_sms", "device_info", "vibrate"].includes(name);
}

export async function runPlatformTool(platform: Platform, name: string, input: Record<string, unknown>, toolsetName?: string | null): Promise<ToolOutput> {
  if (platform === "desktop") {
    const d = window.majlisDesktop!;
    if (toolsetName === "computer") {
      const r = (await d.invoke("computer", { action: name, ...input })) as { ok: boolean; text?: string; image?: string; error?: string };
      if (!r.ok) throw new Error(r.error ?? "computer action failed");
      if (r.image) return [{ type: "image", source: { type: "base64", media_type: "image/png", data: r.image } }];
      return r.text ?? "OK";
    }
    const r = (await d.invoke(name, input)) as { ok: boolean; text?: string; error?: string };
    if (!r.ok) throw new Error(r.error ?? "failed");
    return r.text ?? "OK";
  }
  switch (name) {
    case "open_url": { const { Browser } = await import("@capacitor/browser"); await Browser.open({ url: String(input.url) }); return "Opened."; }
    case "open_app": {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      const target = String(input.target);
      const can = await AppLauncher.canOpenUrl({ url: target }).catch(() => ({ value: false }));
      if (!can.value && !/^[a-z]+:/i.test(target)) return "App not found or cannot be opened: " + target;
      await AppLauncher.openUrl({ url: target });
      return "Opened.";
    }
    case "get_location": {
      const { Geolocation } = await import("@capacitor/geolocation");
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy, maps: `https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}` });
    }
    case "dial_number": window.open("tel:" + String(input.number), "_system"); return "Dialer opened.";
    case "send_sms": window.open(`sms:${String(input.number)}?body=${encodeURIComponent(String(input.text ?? ""))}`, "_system"); return "SMS app opened.";
    case "clipboard_read": { const { Clipboard } = await import("@capacitor/clipboard"); const r = await Clipboard.read(); return r.value ?? ""; }
    case "clipboard_write": { const { Clipboard } = await import("@capacitor/clipboard"); await Clipboard.write({ string: String(input.text ?? "") }); return "Copied."; }
    case "notify": {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return "Notification permission denied.";
      const secs = Number(input.in_seconds ?? 0);
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e6), title: String(input.title), body: String(input.body), schedule: secs > 0 ? { at: new Date(Date.now() + secs * 1000) } : undefined }] });
      return secs > 0 ? `Reminder scheduled in ${secs}s.` : "Notification shown.";
    }
    case "device_info": {
      const { Device } = await import("@capacitor/device"); const { Network } = await import("@capacitor/network");
      const [info, bat, net] = await Promise.all([Device.getInfo(), Device.getBatteryInfo().catch(() => ({})), Network.getStatus()]);
      return JSON.stringify({ ...info, battery: bat, network: net });
    }
    case "vibrate": { const { Haptics, ImpactStyle } = await import("@capacitor/haptics"); await Haptics.impact({ style: ImpactStyle.Medium }); return "Vibrated."; }
  }
  throw new Error("Unknown tool " + name);
}

export function controlPromptText(platform: Platform, ctl: ControlSettings): string {
  if (ctl.level === "off") return "";
  if (platform === "desktop") {
    return `DEVICE CONTROL: You are running on the boss's COMPUTER and have real tools to act on it${ctl.shell ? " (shell commands)" : ""}${ctl.files ? " (files, open apps)" : ""}${ctl.screen ? " (see the screen with screenshot, and use the mouse/keyboard via the computer toolset)" : ""}. When the boss asks for something on the computer, DO it with the tools instead of explaining how. Prefer shell/file tools over clicking when possible (faster and more reliable); use the screen tools for GUI-only tasks, and always take a fresh screenshot before clicking. Before destructive actions (deleting, sending, paying, uninstalling) say what you are about to do. Report what you did concisely.${ctl.level === "ask" ? " The boss may be asked to approve sensitive actions; if an action is denied, respect it and propose an alternative." : ""}`;
  }
  if (platform === "android" || platform === "ios") {
    return `DEVICE CONTROL: You are running on the boss's PHONE and have phone tools (open URLs/apps, location, dialer, SMS draft, clipboard, notifications/reminders, device info, vibrate). Use them when useful instead of only describing.${ctl.level === "ask" ? " Sensitive actions may need the boss's approval." : ""}`;
  }
  return "";
}
