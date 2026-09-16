import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { db, uid, type Book } from "./db";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer();
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

async function renderCover(doc: PDFDocumentProxy): Promise<string> {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = 360 / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

function normalizeText(items: { str?: string; hasEOL?: boolean }[]): string {
  let out = "";
  for (const it of items) {
    if (!it.str) continue;
    out += it.str;
    out += it.hasEOL ? "\n" : " ";
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
}

export interface ImportProgress {
  stage: "opening" | "cover" | "text" | "done";
  page: number;
  pages: number;
}

/** Import a PDF file into the library: store the blob, render a cover, extract text per page. */
export async function importPdf(file: File, onProgress?: (p: ImportProgress) => void): Promise<Book> {
  onProgress?.({ stage: "opening", page: 0, pages: 0 });
  const doc = await openPdf(file);
  const pages = doc.numPages;

  onProgress?.({ stage: "cover", page: 0, pages });
  const cover = await renderCover(doc);

  let title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  let author = "";
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as Record<string, unknown>;
    if (typeof info.Title === "string" && info.Title.trim().length > 2) title = info.Title.trim();
    if (typeof info.Author === "string") author = info.Author.trim();
  } catch {
    /* metadata is optional */
  }

  const book: Book = {
    id: uid(),
    title,
    author,
    addedAt: Date.now(),
    lastOpenedAt: 0,
    pages,
    size: file.size,
    cover,
    file,
    lastPage: 1,
    readingSeconds: 0,
    textExtracted: false,
    tags: [],
    favorite: false,
  };
  await db.books.add(book);

  // Text extraction in batches so the UI keeps updating.
  const BATCH = 20;
  for (let start = 1; start <= pages; start += BATCH) {
    const end = Math.min(pages, start + BATCH - 1);
    const rows = [];
    for (let p = start; p <= end; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      rows.push({ id: `${book.id}:${p}`, bookId: book.id, page: p, text: normalizeText(content.items as { str?: string; hasEOL?: boolean }[]) });
      page.cleanup();
    }
    await db.pageTexts.bulkPut(rows);
    onProgress?.({ stage: "text", page: end, pages });
  }
  await db.books.update(book.id, { textExtracted: true });
  await doc.destroy();
  onProgress?.({ stage: "done", page: pages, pages });
  return { ...book, textExtracted: true };
}
