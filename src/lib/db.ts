import Dexie, { type EntityTable } from "dexie";

export interface Book {
  id: string;
  title: string;
  author: string;
  addedAt: number;
  lastOpenedAt: number;
  pages: number;
  size: number;
  cover: string; // data URL (JPEG) of the first page
  file: Blob; // the PDF itself
  lastPage: number; // 1-based
  readingSeconds: number;
  textExtracted: boolean;
  /** Version of the text-extraction pipeline used. Older books are re-extracted on open. */
  textVersion?: number;
  tags: string[];
  favorite: boolean;
}

export interface PageText {
  id: string; // `${bookId}:${page}`
  bookId: string;
  page: number;
  text: string;
}

export type AnalysisKind = "summary" | "analysis" | "chat" | "quiz" | "explain";

export interface Analysis {
  id: string;
  bookId: string;
  kind: AnalysisKind;
  title: string;
  scope: string; // e.g. "الكتاب كاملاً" / "صفحة 12" / "الصفحات 3-9"
  content: string; // markdown
  createdAt: number;
  model: string;
}

export interface ChatMessage {
  id: string;
  bookId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  day: string; // YYYY-MM-DD
  seconds: number;
  pages: number;
}

class LibraryDB extends Dexie {
  books!: EntityTable<Book, "id">;
  pageTexts!: EntityTable<PageText, "id">;
  analyses!: EntityTable<Analysis, "id">;
  chats!: EntityTable<ChatMessage, "id">;
  sessions!: EntityTable<ReadingSession, "id">;

  constructor() {
    super("digital-code-library");
    this.version(1).stores({
      books: "id, title, addedAt, lastOpenedAt, favorite",
      pageTexts: "id, bookId, [bookId+page]",
      analyses: "id, bookId, kind, createdAt",
      chats: "id, bookId, createdAt",
      sessions: "id, bookId, day, [bookId+day]",
    });
  }
}

export const db = new LibraryDB();

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Add reading time for a book, aggregated per day. */
export async function logReading(bookId: string, seconds: number, pages = 0) {
  if (seconds <= 0 && pages <= 0) return;
  const day = todayKey();
  await db.transaction("rw", db.sessions, db.books, async () => {
    const existing = await db.sessions.where({ bookId, day }).first();
    if (existing) {
      await db.sessions.update(existing.id, {
        seconds: existing.seconds + seconds,
        pages: existing.pages + pages,
      });
    } else {
      await db.sessions.add({ id: uid(), bookId, day, seconds, pages });
    }
    const book = await db.books.get(bookId);
    if (book) await db.books.update(bookId, { readingSeconds: book.readingSeconds + seconds });
  });
}

export async function deleteBook(bookId: string) {
  await db.transaction("rw", [db.books, db.pageTexts, db.analyses, db.chats, db.sessions], async () => {
    await db.books.delete(bookId);
    await db.pageTexts.where("bookId").equals(bookId).delete();
    await db.analyses.where("bookId").equals(bookId).delete();
    await db.chats.where("bookId").equals(bookId).delete();
    await db.sessions.where("bookId").equals(bookId).delete();
  });
}

export async function getBookText(bookId: string, from = 1, to = Infinity): Promise<{ page: number; text: string }[]> {
  const rows = await db.pageTexts.where("bookId").equals(bookId).sortBy("page");
  return rows.filter((r) => r.page >= from && r.page <= to).map((r) => ({ page: r.page, text: r.text }));
}
