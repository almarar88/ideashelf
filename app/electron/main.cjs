// Majlis AI desktop shell (Electron). Serves the built web app from app://majlis
// and exposes device tools to the agents through a single IPC channel. All tools
// are gated in the renderer by the user's Control settings (off / ask / full).
const { app, BrowserWindow, protocol, ipcMain, shell, clipboard, desktopCapturer, screen, Notification, net, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "dist");
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function createWindow() {
  const win = new BrowserWindow({
    width: 460, height: 900, minWidth: 380, minHeight: 640,
    backgroundColor: "#2b2724", title: "Majlis AI", autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadURL("app://majlis/index.html");
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === "/" || p === "") p = "/index.html";
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST)) return new Response("forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // Belt and braces for the Anthropic API from a custom origin.
  session.defaultSession.webRequest.onHeadersReceived({ urls: ["https://api.anthropic.com/*"] }, (details, cb) => {
    const h = { ...details.responseHeaders };
    if (!Object.keys(h).some((k) => k.toLowerCase() === "access-control-allow-origin")) h["Access-Control-Allow-Origin"] = ["*"];
    cb({ responseHeaders: h });
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (!IS_MAC) app.quit(); });

// ---------- helpers ----------
const cap = (s, n = 20000) => (s.length > n ? s.slice(0, n) + `\n...[truncated ${s.length - n} chars]` : s);

function run(command, { cwd, timeoutMs = 120000, shellKind } = {}) {
  return new Promise((resolve) => {
    const useWin = shellKind === "powershell" || (IS_WIN && shellKind !== "sh");
    const child = useWin
      ? spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command], { cwd: cwd || os.homedir(), windowsHide: true })
      : spawn("/bin/sh", ["-c", command], { cwd: cwd || os.homedir() });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    const timer = setTimeout(() => { child.kill(); err += "\n[timed out]"; }, timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, out, err }); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, out, err: err + String(e) }); });
  });
}

// PowerShell helper with Win32 user32 bindings for mouse/keyboard control.
const PS_PRELUDE = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class U {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  public struct POINT { public int X; public int Y; }
}
"@
function Click($btn, $count) {
  $down = @{ left = 0x0002; right = 0x0008; middle = 0x0020 }[$btn]; $up = @{ left = 0x0004; right = 0x0010; middle = 0x0040 }[$btn]
  for ($i = 0; $i -lt $count; $i++) { [U]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [U]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
}
$VK = @{ ctrl=0x11; control=0x11; alt=0x12; shift=0x10; super=0x5B; win=0x5B; cmd=0x5B; meta=0x5B; enter=0x0D; return=0x0D; tab=0x09; escape=0x1B; esc=0x1B; backspace=0x08; delete=0x2E; space=0x20; up=0x26; down=0x28; left=0x25; right=0x27; home=0x24; end=0x23; page_up=0x21; pageup=0x21; page_down=0x22; pagedown=0x22; insert=0x2D; caps_lock=0x14; print=0x2C; f1=0x70; f2=0x71; f3=0x72; f4=0x73; f5=0x74; f6=0x75; f7=0x76; f8=0x77; f9=0x78; f10=0x79; f11=0x7A; f12=0x7B; minus=0xBD; equal=0xBB; plus=0xBB; comma=0xBC; period=0xBE; slash=0xBF; semicolon=0xBA; apostrophe=0xDE; bracketleft=0xDB; bracketright=0xDD; backslash=0xDC; grave=0xC0 }
function VkOf($k) { $k = $k.ToLower(); if ($VK.ContainsKey($k)) { return [int]$VK[$k] }; if ($k.Length -eq 1) { $c = [int][char]$k.ToUpper(); return $c }; throw "unknown key $k" }
function Chord($combo) {
  $parts = $combo -split '\\+' | Where-Object { $_ -ne '' }
  $codes = @($parts | ForEach-Object { VkOf $_ })
  foreach ($c in $codes) { [U]::keybd_event([byte]$c, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 20 }
  [array]::Reverse($codes)
  foreach ($c in $codes) { [U]::keybd_event([byte]$c, 0, 2, [UIntPtr]::Zero); Start-Sleep -Milliseconds 20 }
}
function TypeText($t) {
  $ascii = $t.ToCharArray() | ForEach-Object { [int]$_ -lt 128 } | Where-Object { -not $_ }
  if ($ascii.Count -eq 0) { $esc = ($t -replace '([+^%~(){}\\[\\]])', '{$1}'); [System.Windows.Forms.SendKeys]::SendWait($esc) }
  else { [System.Windows.Forms.Clipboard]::SetText($t); Chord 'ctrl+v'; Start-Sleep -Milliseconds 120 }
}
`;

async function ps(script) {
  const r = await run(PS_PRELUDE + "\n" + script, { shellKind: "powershell", timeoutMs: 60000 });
  if (r.code !== 0 && r.err.trim()) throw new Error(r.err.trim().slice(0, 500));
  return r.out.trim();
}

// Screenshot scaled to <= 1280 px long edge; returns base64 PNG and the scale to map back to physical pixels.
let lastShot = { scale: 1, width: 0, height: 0 };
async function screenshot(region) {
  const display = screen.getPrimaryDisplay();
  const physW = Math.round(display.size.width * display.scaleFactor);
  const physH = Math.round(display.size.height * display.scaleFactor);
  const scale = Math.min(1, 1280 / Math.max(physW, physH));
  const w = Math.round(physW * scale), h = Math.round(physH * scale);
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: w, height: h } });
  const src = sources.find((s) => String(s.display_id) === String(display.id)) ?? sources[0];
  if (!src) throw new Error("No screen source");
  let img = src.thumbnail;
  if (region) {
    const [x0, y0, x1, y1] = region.map((v) => Math.round(v));
    const full = (await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: physW, height: physH } })).find((s) => String(s.display_id) === String(display.id)) ?? sources[0];
    const crop = full.thumbnail.crop({ x: Math.round(x0 / scale), y: Math.round(y0 / scale), width: Math.max(1, Math.round((x1 - x0) / scale)), height: Math.max(1, Math.round((y1 - y0) / scale)) });
    const cs = Math.min(1, w / crop.getSize().width, h / crop.getSize().height);
    img = cs < 1 ? crop.resize({ width: Math.round(crop.getSize().width * cs) }) : crop;
  } else {
    lastShot = { scale, width: w, height: h };
  }
  return img.toPNG().toString("base64");
}

const toPhys = ([x, y]) => [Math.round(x / (lastShot.scale || 1)), Math.round(y / (lastShot.scale || 1))];

async function computer(input) {
  const a = input.action;
  if (a === "screenshot") return { ok: true, image: await screenshot() };
  if (a === "zoom") return { ok: true, image: await screenshot(input.region) };
  if (a === "wait") { await new Promise((r) => setTimeout(r, Math.min(300, Number(input.duration || 1)) * 1000)); return { ok: true, text: "OK" }; }
  if (!IS_WIN) {
    // macOS fallback via osascript / cliclick when available; Linux via xdotool.
    const tool = IS_MAC ? "cliclick" : "xdotool";
    const has = await run(`command -v ${tool}`, { shellKind: "sh" });
    if (has.code !== 0) throw new Error(`Mouse/keyboard control on this OS needs '${tool}' installed.`);
    const [x, y] = input.coordinate ? toPhys(input.coordinate) : [null, null];
    let cmd = "";
    if (IS_MAC) {
      const at = x !== null ? `${x},${y}` : ".";
      cmd = { left_click: `cliclick c:${at}`, right_click: `cliclick rc:${at}`, double_click: `cliclick dc:${at}`, triple_click: `cliclick tc:${at}`, mouse_move: `cliclick m:${at}`, type: `cliclick t:${JSON.stringify(String(input.text || ""))}`, key: `cliclick kp:${String(input.text || "").toLowerCase()}` }[a];
    } else {
      const mv = x !== null ? `xdotool mousemove ${x} ${y} && ` : "";
      cmd = { left_click: `${mv}xdotool click 1`, right_click: `${mv}xdotool click 3`, middle_click: `${mv}xdotool click 2`, double_click: `${mv}xdotool click --repeat 2 1`, triple_click: `${mv}xdotool click --repeat 3 1`, mouse_move: `xdotool mousemove ${x} ${y}`, type: `xdotool type --delay 20 ${JSON.stringify(String(input.text || ""))}`, key: `xdotool key ${String(input.text || "")}`, scroll: `${mv}xdotool click --repeat ${Number(input.scroll_amount || 3)} ${input.scroll_direction === "up" ? 4 : input.scroll_direction === "left" ? 6 : input.scroll_direction === "right" ? 7 : 5}` }[a];
    }
    if (!cmd) throw new Error("Unsupported action on this OS: " + a);
    const r = await run(cmd, { shellKind: "sh" });
    if (r.code !== 0) throw new Error(r.err || "failed");
    return { ok: true, text: "OK" };
  }
  const mods = input.text && ["left_click", "right_click", "middle_click", "double_click", "triple_click", "left_click_drag", "scroll"].includes(a) ? String(input.text) : "";
  const modDown = mods ? mods.split("+").map((m) => `[U]::keybd_event([byte](VkOf '${m}'), 0, 0, [UIntPtr]::Zero)`).join("; ") + "; Start-Sleep -Milliseconds 30; " : "";
  const modUp = mods ? "; " + mods.split("+").reverse().map((m) => `[U]::keybd_event([byte](VkOf '${m}'), 0, 2, [UIntPtr]::Zero)`).join("; ") : "";
  const move = input.coordinate ? (([x, y]) => `[U]::SetCursorPos(${x}, ${y}); Start-Sleep -Milliseconds 60; `)(toPhys(input.coordinate)) : "";
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  let script;
  switch (a) {
    case "mouse_move": script = move || "'OK'"; break;
    case "left_click": script = `${move}${modDown}Click 'left' 1${modUp}`; break;
    case "right_click": script = `${move}${modDown}Click 'right' 1${modUp}`; break;
    case "middle_click": script = `${move}${modDown}Click 'middle' 1${modUp}`; break;
    case "double_click": script = `${move}${modDown}Click 'left' 2${modUp}`; break;
    case "triple_click": script = `${move}${modDown}Click 'left' 3${modUp}`; break;
    case "left_mouse_down": script = `[U]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)`; break;
    case "left_mouse_up": script = `[U]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)`; break;
    case "left_click_drag": {
      const [sx, sy] = toPhys(input.start_coordinate); const [ex, ey] = toPhys(input.coordinate);
      script = `[U]::SetCursorPos(${sx},${sy}); Start-Sleep -Milliseconds 80; ${modDown}[U]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 120; [U]::SetCursorPos(${Math.round((sx + ex) / 2)},${Math.round((sy + ey) / 2)}); Start-Sleep -Milliseconds 80; [U]::SetCursorPos(${ex},${ey}); Start-Sleep -Milliseconds 120; [U]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)${modUp}`; break;
    }
    case "cursor_position": {
      const out = await ps(`$p = New-Object U+POINT; [U]::GetCursorPos([ref]$p) | Out-Null; "$($p.X),$($p.Y)"`);
      const [x, y] = out.split(",").map(Number);
      return { ok: true, text: `[${Math.round(x * lastShot.scale)}, ${Math.round(y * lastShot.scale)}]` };
    }
    case "type": script = `TypeText ${q(input.text || "")}`; break;
    case "key": script = `for ($i=0; $i -lt ${Math.min(100, Number(input.repeat || 1))}; $i++) { Chord ${q(input.text || "")}; Start-Sleep -Milliseconds 40 }`; break;
    case "hold_key": script = `$c = VkOf ${q(input.text || "")}; [U]::keybd_event([byte]$c,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds ${Math.min(300, Number(input.duration || 1)) * 1000}; [U]::keybd_event([byte]$c,0,2,[UIntPtr]::Zero)`; break;
    case "scroll": {
      const n = Math.max(1, Math.min(50, Number(input.scroll_amount || 3)));
      const dir = String(input.scroll_direction || "down");
      const horiz = dir === "left" || dir === "right";
      const delta = (dir === "up" || dir === "right" ? 1 : -1) * 120;
      script = `${move}${modDown}for ($i=0; $i -lt ${n}; $i++) { [U]::mouse_event(${horiz ? "0x01000" : "0x0800"},0,0,[uint32](${delta} -band 0xFFFFFFFF),[UIntPtr]::Zero); Start-Sleep -Milliseconds 30 }${modUp}`; break;
    }
    default: throw new Error("Unknown computer action: " + a);
  }
  await ps(script);
  return { ok: true, text: "OK" };
}

// ---------- IPC ----------
ipcMain.handle("majlis:tool", async (_e, { name, input }) => {
  try {
    switch (name) {
      case "shell": {
        const r = await run(String(input.command || ""), { cwd: input.cwd ? String(input.cwd) : undefined, timeoutMs: Math.min(600, Number(input.timeout_seconds || 120)) * 1000 });
        return { ok: true, text: cap(`exit code: ${r.code}\n--- stdout ---\n${r.out}\n--- stderr ---\n${r.err}`) };
      }
      case "fs_read": { const t = await fs.readFile(String(input.path), "utf8"); return { ok: true, text: cap(t, 200000) }; }
      case "fs_write": { const p = String(input.path); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, String(input.content ?? ""), "utf8"); return { ok: true, text: `Wrote ${p}` }; }
      case "fs_list": {
        const p = String(input.path); const ents = await fs.readdir(p, { withFileTypes: true });
        return { ok: true, text: cap(ents.map((e) => (e.isDirectory() ? "[dir]  " : "[file] ") + e.name).join("\n") || "(empty)") };
      }
      case "open_app": {
        const target = String(input.target);
        if (/^https?:\/\//i.test(target)) { await shell.openExternal(target); return { ok: true, text: "Opened in browser." }; }
        const err = await shell.openPath(target);
        if (!err) return { ok: true, text: "Opened." };
        const r = await run(IS_WIN ? `Start-Process ${JSON.stringify(target)}` : IS_MAC ? `open -a ${JSON.stringify(target)}` : `${target} &`, {});
        return r.code === 0 ? { ok: true, text: "Launched." } : { ok: false, error: err || r.err };
      }
      case "system_info": return { ok: true, text: JSON.stringify({ os: `${os.type()} ${os.release()}`, platform: process.platform, arch: os.arch(), hostname: os.hostname(), user: os.userInfo().username, home: os.homedir(), cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memory_gb: Math.round(os.totalmem() / 1e9), free_gb: Math.round(os.freemem() / 1e9), now: new Date().toString(), screen: screen.getPrimaryDisplay().size }) };
      case "clipboard_read": return { ok: true, text: clipboard.readText() };
      case "clipboard_write": clipboard.writeText(String(input.text ?? "")); return { ok: true, text: "Copied." };
      case "notify": new Notification({ title: String(input.title || "Majlis AI"), body: String(input.body || "") }).show(); return { ok: true, text: "Shown." };
      case "computer": return await computer(input);
      default: return { ok: false, error: "Unknown tool " + name };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
