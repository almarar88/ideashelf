import { db, uid } from "./db";
import { importPdf } from "./pdf";

const SESSION_KEY = "dcl.admin.session";
// SHA-256 of "dcl-admin:<username>:<password>". The app has no server, so this only
// keeps the dashboard out of casual reach — anyone with the bundle can bypass it.
const ADMIN_HASH = "5557a1401da7f335226700ab18bf116dafd9985395d68f71ac5d519141436e58";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function login(username: string, password: string, remember: boolean): Promise<boolean> {
  const ok = (await sha256(`dcl-admin:${username.trim().toLowerCase()}:${password}`)) === ADMIN_HASH;
  if (ok) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, "1");
  return ok;
}
export const isLoggedIn = () => localStorage.getItem(SESSION_KEY) === "1" || sessionStorage.getItem(SESSION_KEY) === "1";
export function logout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

/* ---------------- Publish to GitHub (books visible to every user) ---------------- */
export interface PublishTarget {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}
const GH_KEY = "dcl.admin.github";
export const DEFAULT_TARGET: PublishTarget = { owner: "almarar88", repo: "ideashelf", branch: "main", token: "" };
export function loadTarget(): PublishTarget {
  try {
    return { ...DEFAULT_TARGET, ...(JSON.parse(localStorage.getItem(GH_KEY) ?? "{}") as Partial<PublishTarget>) };
  } catch {
    return { ...DEFAULT_TARGET };
  }
}
export const saveTarget = (t: PublishTarget) => localStorage.setItem(GH_KEY, JSON.stringify(t));

async function gh(t: PublishTarget, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${t.owner}/${t.repo}/contents/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) },
  });
  if (res.status === 404 && (init.method ?? "GET") === "GET") return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(res.status === 401 ? "رمز GitHub غير صالح" : `GitHub: ${body.message ?? res.status}`);
  }
  return (await res.json()) as { sha: string; content?: string };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "") || `book-${Date.now()}`;

/** Uploads the PDF into public/library/ and appends it to public/catalog.json on the branch. */
export async function publishBook(t: PublishTarget, file: File, meta: { title: string; author: string; tags: string[] }, onStage?: (s: string) => void) {
  if (!t.token) throw new Error("أدخل رمز وصول GitHub أولاً");
  if (file.size > 95 * 1024 * 1024) throw new Error("الحد الأقصى للملف عبر GitHub هو 95 MB");
  const id = slug(meta.title || file.name);
  const path = `public/library/${id}.pdf`;
  onStage?.("رفع ملف PDF…");
  const existing = await gh(t, `${path}?ref=${t.branch}`);
  await gh(t, path, {
    method: "PUT",
    body: JSON.stringify({ message: `Add book: ${meta.title}`, branch: t.branch, content: await blobToBase64(file), ...(existing ? { sha: existing.sha } : {}) }),
  });
  onStage?.("تحديث الفهرس…");
  const cat = await gh(t, `public/catalog.json?ref=${t.branch}`);
  let books: CatalogEntry[] = [];
  if (cat?.content) {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(cat.content.replace(/\n/g, ""))))) as { books?: CatalogEntry[] };
      books = parsed.books ?? [];
    } catch {
      books = [];
    }
  }
  books = books.filter((b) => b.id !== id);
  books.push({ id, title: meta.title, author: meta.author || undefined, url: `./library/${id}.pdf`, tags: meta.tags });
  const json = JSON.stringify({ books }, null, 2);
  await gh(t, "public/catalog.json", {
    method: "PUT",
    body: JSON.stringify({ message: `Catalog: add ${meta.title}`, branch: t.branch, content: btoa(unescape(encodeURIComponent(json))), ...(cat ? { sha: cat.sha } : {}) }),
  });
  return { id, url: `https://${t.owner}.github.io/${t.repo}/library/${id}.pdf` };
}

/* ---------------- Remote catalog ---------------- */
export interface CatalogEntry {
  id: string;
  title: string;
  author?: string;
  url: string; // absolute or relative to the catalog file
  description?: string;
  tags?: string[];
}

export async function fetchCatalog(url: string): Promise<CatalogEntry[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`تعذر جلب الفهرس (${res.status})`);
  const json = (await res.json()) as { books?: CatalogEntry[] } | CatalogEntry[];
  const list = Array.isArray(json) ? json : (json.books ?? []);
  const base = new URL(url, location.href);
  return list.map((e) => ({ ...e, url: new URL(e.url, base).toString() }));
}

export async function downloadCatalogBook(entry: CatalogEntry, onProgress?: (pct: number) => void) {
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`فشل التنزيل (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], `${entry.title}.pdf`, { type: "application/pdf" });
  const book = await importPdf(file, (p) => onProgress?.(p.pages ? Math.round((p.page / p.pages) * 100) : 0));
  await db.books.update(book.id, { title: entry.title, author: entry.author ?? book.author, tags: entry.tags ?? [] });
}

/* ---------------- Backup ---------------- */
export interface Backup {
  version: 1;
  exportedAt: number;
  books: Omit<import("./db").Book, "file" | "cover">[];
  analyses: import("./db").Analysis[];
  chats: import("./db").ChatMessage[];
  sessions: import("./db").ReadingSession[];
}

export async function exportBackup(): Promise<Blob> {
  const books = (await db.books.toArray()).map(({ file: _f, cover: _c, ...rest }) => rest);
  const data: Backup = {
    version: 1,
    exportedAt: Date.now(),
    books,
    analyses: await db.analyses.toArray(),
    chats: await db.chats.toArray(),
    sessions: await db.sessions.toArray(),
  };
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

/** Restores AI results / stats for books that still exist (matched by id, then by title). */
export async function importBackup(file: File): Promise<{ analyses: number; chats: number; sessions: number }> {
  const data = JSON.parse(await file.text()) as Backup;
  if (data.version !== 1) throw new Error("إصدار النسخة الاحتياطية غير مدعوم");
  const existing = await db.books.toArray();
  const idMap = new Map<string, string>();
  for (const b of data.books) {
    const match = existing.find((e) => e.id === b.id) ?? existing.find((e) => e.title === b.title);
    if (match) {
      idMap.set(b.id, match.id);
      await db.books.update(match.id, { lastPage: Math.max(match.lastPage, b.lastPage), readingSeconds: Math.max(match.readingSeconds, b.readingSeconds), favorite: b.favorite, tags: b.tags });
    }
  }
  const remap = <T extends { id: string; bookId: string }>(rows: T[]) => rows.filter((r) => idMap.has(r.bookId)).map((r) => ({ ...r, id: uid(), bookId: idMap.get(r.bookId)! }));
  const analyses = remap(data.analyses);
  const chats = remap(data.chats);
  const sessions = remap(data.sessions);
  await db.transaction("rw", [db.analyses, db.chats, db.sessions], async () => {
    await db.analyses.bulkPut(analyses);
    await db.chats.bulkPut(chats);
    for (const s of sessions) {
      const dup = await db.sessions.where({ bookId: s.bookId, day: s.day }).first();
      if (!dup) await db.sessions.add(s);
    }
  });
  return { analyses: analyses.length, chats: chats.length, sessions: sessions.length };
}

export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { used: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}

export async function wipeAll() {
  await db.transaction("rw", [db.books, db.pageTexts, db.analyses, db.chats, db.sessions], async () => {
    await db.books.clear();
    await db.pageTexts.clear();
    await db.analyses.clear();
    await db.chats.clear();
    await db.sessions.clear();
  });
}
