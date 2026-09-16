import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { db, uid, type Book } from "./db";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Copied into public/pdfjs by the vite plugin in vite.config.ts. Needed for PDFs that use
// predefined CMaps (CID fonts) or non-embedded standard fonts — common in Arabic books.
const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;

export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer();
  return pdfjs.getDocument({
    data,
    isEvalSupported: false,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
  }).promise;
}

/* ---------------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------------ */

/** Prepares the canvas and starts a render. The caller awaits `.promise` and may `.cancel()`. */
export async function renderPageFitted(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  o: { fit: "page" | "width"; zoom: number; availWidth: number; availHeight: number },
): Promise<RenderTask | null> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fitScale =
    o.fit === "page"
      ? Math.min(o.availWidth / base.width, o.availHeight / base.height)
      : o.availWidth / base.width;
  const cssScale = Math.max(0.05, fitScale * o.zoom);
  const viewport = page.getViewport({ scale: cssScale * dpr });

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // The UI runs under dir="rtl". A canvas that inherits RTL makes the browser re-order the
  // already-shaped glyphs pdf.js paints, which visibly mangles Arabic text. Force LTR.
  canvas.dir = "ltr";
  ctx.direction = "ltr";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return page.render({ canvasContext: ctx, viewport });
}

async function renderCover(doc: PDFDocumentProxy): Promise<string> {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 360 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.dir = "ltr";
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.direction = "ltr";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

/* ---------------------------------------------------------------------------
 * Text extraction
 *
 * Many Arabic PDFs map glyphs to Unicode *presentation forms* (U+FB50–U+FEFF), emit one
 * item per glyph, and lay them out in visual (right-to-left) order. Reading `item.str` in
 * stream order therefore yields reversed, letter-by-letter gibberish. We rebuild each line
 * from glyph positions instead: group by baseline, order by x (right-to-left for RTL lines),
 * insert spaces from the real gaps, then fold presentation forms back to base letters.
 * ------------------------------------------------------------------------ */

interface RawItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  str: string;
}

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const PRESENTATION_RE = /[ﭐ-﷿ﹰ-﻿]/;
const BIDI_MARKS_RE = /[‎‏‪-‮⁦-⁩]/g;

export function itemsToText(items: RawItem[]): string {
  const cells: Cell[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    const h = it.height && it.height > 1 ? it.height : Math.abs(it.transform[3]) || 10;
    cells.push({ x: it.transform[4], y: it.transform[5], w: it.width ?? 0, h, str: it.str });
  }
  if (!cells.length) return "";

  cells.sort((a, b) => b.y - a.y);
  const lines: Cell[][] = [];
  for (const c of cells) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - c.y) <= Math.max(1.5, c.h * 0.5)) line.push(c);
    else lines.push([c]);
  }

  const out: string[] = [];
  for (const line of lines) {
    const rtl = RTL_RE.test(line.map((c) => c.str).join(""));
    line.sort((a, b) => (rtl ? b.x + b.w - (a.x + a.w) : a.x - b.x));

    let text = "";
    let prev: Cell | null = null;
    for (const c of line) {
      let s = c.str;
      // Presentation forms sit in visual order inside the item too, so reverse before folding
      // them back (reversing after would turn the لا ligature into ال).
      if (rtl && s.length > 1 && PRESENTATION_RE.test(s)) s = [...s].reverse().join("");
      s = s.normalize("NFKC");
      if (prev) {
        const gap = rtl ? prev.x - (c.x + c.w) : c.x - (prev.x + prev.w);
        const fontSize = Math.max(prev.h, c.h, 6);
        if (gap > fontSize * 0.18 && !/\s$/.test(text) && !/^\s/.test(s)) text += " ";
      }
      text += s;
      prev = c;
    }
    const clean = text.replace(BIDI_MARKS_RE, "").replace(/[ \t]{2,}/g, " ").trim();
    if (clean) out.push(clean);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** True when the page yielded so little text that the PDF is probably scanned images. */
export function looksScanned(text: string, pages: number): boolean {
  return text.replace(/\s/g, "").length < pages * 20;
}

/**
 * Bumped whenever extraction changes in a way that invalidates stored text.
 * 2 = position-aware reconstruction that fixed reversed, letter-separated Arabic.
 */
export const TEXT_VERSION = 2;

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
  await db.books.add({ ...book, textVersion: TEXT_VERSION });

  await extractBookText(doc, book.id, onProgress);
  await doc.destroy();
  onProgress?.({ stage: "done", page: pages, pages });
  return { ...book, textExtracted: true, textVersion: TEXT_VERSION };
}

/** Extract every page's text into the database, in batches so the UI keeps updating. */
export async function extractBookText(
  doc: PDFDocumentProxy,
  bookId: string,
  onProgress?: (p: ImportProgress) => void,
): Promise<void> {
  const pages = doc.numPages;
  const BATCH = 20;
  for (let start = 1; start <= pages; start += BATCH) {
    const end = Math.min(pages, start + BATCH - 1);
    const rows = [];
    for (let p = start; p <= end; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      rows.push({ id: `${bookId}:${p}`, bookId, page: p, text: itemsToText(content.items as RawItem[]) });
      page.cleanup();
    }
    await db.pageTexts.bulkPut(rows);
    onProgress?.({ stage: "text", page: end, pages });
  }
  await db.books.update(bookId, { textExtracted: true, textVersion: TEXT_VERSION });
}

/**
 * Re-extract a book whose stored text predates the current pipeline. Books imported before
 * the Arabic fix hold reversed, letter-separated text that makes every AI answer nonsense.
 */
export async function ensureTextCurrent(doc: PDFDocumentProxy, book: Book): Promise<boolean> {
  if (book.textVersion === TEXT_VERSION) return false;
  await extractBookText(doc, book.id);
  return true;
}
