import type Anthropic from "@anthropic-ai/sdk";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { filesDB } from "./db";
import { isImageMime, isTextMime, uid, type FileRef } from "./types";

export function pickFiles(accept = "*/*", multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept; input.multiple = multiple;
    input.style.display = "none";
    input.onchange = () => { resolve(Array.from(input.files ?? [])); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}

function readAsDataURL(f: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });
}
function readAsText(f: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(f); });
}

async function shrinkImage(f: File, max = 1600): Promise<{ b64: string; mime: string; size: number }> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    if (scale === 1 && f.size < 900_000) {
      const d = await readAsDataURL(f);
      return { b64: d.split(",")[1], mime: f.type, size: f.size };
    }
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const d = c.toDataURL("image/jpeg", 0.86);
    const b64 = d.split(",")[1];
    return { b64, mime: "image/jpeg", size: Math.round(b64.length * 0.75) };
  } finally { URL.revokeObjectURL(url); }
}

export async function ingestUpload(f: File, groupId: string): Promise<FileRef> {
  const id = uid();
  let mime = f.type || "application/octet-stream";
  let size = f.size;
  if (isImageMime(mime)) {
    const r = await shrinkImage(f);
    await filesDB.put({ id, data: r.b64, text: false });
    mime = r.mime; size = r.size;
  } else if (isTextMime(mime, f.name)) {
    const t = await readAsText(f);
    await filesDB.put({ id, data: t, text: true });
    if (!mime.startsWith("text/")) mime = "text/plain";
  } else {
    const d = await readAsDataURL(f);
    await filesDB.put({ id, data: d.split(",")[1], text: false });
  }
  return { id, name: f.name, mime, size, by: "user", createdAt: Date.now(), groupId };
}

const EXT_MIME: Record<string, string> = { md: "text/markdown", txt: "text/plain", csv: "text/csv", json: "application/json", html: "text/html", htm: "text/html", js: "text/javascript", ts: "text/plain", py: "text/plain", xml: "text/xml", yaml: "text/plain", yml: "text/plain", svg: "image/svg+xml" };

export async function saveGeneratedFile(groupId: string, by: string, name: string, content: string, description?: string): Promise<FileRef> {
  const id = uid();
  const ext = (name.split(".").pop() ?? "md").toLowerCase();
  const safeName = name.includes(".") ? name : name + ".md";
  const mime = EXT_MIME[ext] ?? "text/plain";
  await filesDB.put({ id, data: content, text: true });
  return { id, name: safeName, mime, size: new Blob([content]).size, by, createdAt: Date.now(), groupId, description };
}

export async function fileText(ref: FileRef): Promise<string | null> {
  const f = await filesDB.get(ref.id);
  if (!f) return null;
  return f.text ? f.data : null;
}

export async function fileDataUrl(ref: FileRef): Promise<string | null> {
  const f = await filesDB.get(ref.id);
  if (!f) return null;
  if (f.text) return "data:" + ref.mime + ";charset=utf-8," + encodeURIComponent(f.data);
  return "data:" + ref.mime + ";base64," + f.data;
}

/** Convert an attachment to Claude content blocks. */
export async function toContentBlocks(ref: FileRef): Promise<Anthropic.ContentBlockParam[]> {
  const f = await filesDB.get(ref.id);
  if (!f) return [{ type: "text", text: `[attachment missing: ${ref.name}]` }];
  if (isImageMime(ref.mime) && !f.text) {
    return [
      { type: "text", text: `[Image attached: ${ref.name}]` },
      { type: "image", source: { type: "base64", media_type: ref.mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: f.data } },
    ];
  }
  if (ref.mime === "application/pdf" && !f.text) {
    return [
      { type: "text", text: `[PDF attached: ${ref.name}]` },
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data }, title: ref.name },
    ];
  }
  if (f.text) {
    const clipped = f.data.length > 120_000 ? f.data.slice(0, 120_000) + "\n...[truncated]" : f.data;
    return [{ type: "text", text: `[File attached: ${ref.name} (${ref.mime})]\n\`\`\`\n${clipped}\n\`\`\`` }];
  }
  return [{ type: "text", text: `[Binary attachment: ${ref.name} (${ref.mime}, ${Math.round(ref.size / 1024)} KB) — contents not readable]` }];
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function utf8ToB64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

/** Share / save a file via the OS share sheet (native) or a download (web). */
export async function shareFile(ref: FileRef, text?: string): Promise<void> {
  const f = await filesDB.get(ref.id);
  if (!f) return;
  if (Capacitor.isNativePlatform()) {
    const data = f.text ? utf8ToB64(f.data) : f.data;
    const path = "majlis/" + ref.name.replace(/[^\w.\-؀-ۿ ]/g, "_");
    await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title: ref.name, text, url: uri });
    return;
  }
  const blob = f.text ? new Blob([f.data], { type: ref.mime }) : b64ToBlob(f.data, ref.mime);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = ref.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareText(title: string, text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) { await Share.share({ title, text }); return; }
  if (navigator.share) { await navigator.share({ title, text }); return; }
  await navigator.clipboard.writeText(text);
}

export function fmtSize(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
