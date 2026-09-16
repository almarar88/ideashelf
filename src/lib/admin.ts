import { db, uid } from "./db";
import { importPdf } from "./pdf";

const PIN_KEY = "dcl.admin.pin";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const hasPin = () => !!localStorage.getItem(PIN_KEY);
export async function setPin(pin: string) {
  localStorage.setItem(PIN_KEY, await sha256(`dcl:${pin}`));
}
export async function verifyPin(pin: string) {
  return (await sha256(`dcl:${pin}`)) === localStorage.getItem(PIN_KEY);
}
export const clearPin = () => localStorage.removeItem(PIN_KEY);

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
