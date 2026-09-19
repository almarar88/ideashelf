import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdf, renderPageFitted } from "./pdf";
import { getBookTextCloud, getPageRows, signPageUrls } from "./cloud";
import { db } from "./db";

export interface Geom {
  fit: "page" | "width";
  zoom: number;
  availWidth: number;
  availHeight: number;
}

/** A render in flight: await `done` for the finished pixels, `cancel()` to abandon it. */
export interface RenderHandle {
  done: Promise<void>;
  cancel(): void;
}

/**
 * The reader draws pages through this interface so it does not care whether the book is
 * a PDF the reader imported themselves or a store book that only ever arrives as images.
 */
export interface PageSource {
  readonly kind: "local" | "cloud";
  readonly pageCount: number;
  render(page: number, canvas: HTMLCanvasElement, geom: Geom): Promise<RenderHandle | null>;
  getText(from?: number, to?: number): Promise<{ page: number; text: string }[]>;
  destroy(): void;
}

/* ------------------------------------------------------------------ */
/* Local: the reader's own PDF, rendered by pdf.js                      */
/* ------------------------------------------------------------------ */
export async function createLocalSource(bookId: string): Promise<PageSource> {
  const book = await db.books.get(bookId);
  if (!book) throw new Error("الكتاب غير موجود");
  const doc: PDFDocumentProxy = await openPdf(book.file);
  return {
    kind: "local",
    pageCount: doc.numPages,
    async render(page, canvas, geom) {
      const task = await renderPageFitted(doc, page, canvas, geom);
      if (!task) return null;
      // Swallow the cancellation rejection here; the caller only cares that it stopped.
      return { done: task.promise.catch(() => {}), cancel: () => task.cancel() };
    },
    async getText(from = 1, to = Number.MAX_SAFE_INTEGER) {
      const rows = await db.pageTexts.where("bookId").equals(bookId).sortBy("page");
      return rows.filter((r) => r.page >= from && r.page <= to).map((r) => ({ page: r.page, text: r.text }));
    },
    destroy: () => void doc.destroy(),
  };
}

/* ------------------------------------------------------------------ */
/* Cloud: a store book. The PDF never reaches the device — each page is  */
/* an image fetched through a short-lived signed URL, and it is stamped  */
/* with the reader's identity so a leak can be traced back.              */
/* ------------------------------------------------------------------ */
const PREFETCH = 2;

export async function createCloudSource(bookId: string, pageCount: number, watermark: string): Promise<PageSource> {
  const urls = new Map<number, { url: string; expires: number }>();
  const images = new Map<number, HTMLImageElement>();
  let disposed = false;

  async function urlFor(page: number): Promise<string | null> {
    const hit = urls.get(page);
    if (hit && hit.expires > Date.now() + 15_000) return hit.url;
    // Sign a small window at once: one round trip covers the next few turns.
    const from = Math.max(1, page - 1);
    const to = Math.min(pageCount, page + PREFETCH);
    const rows = await getPageRows(bookId, from, to);
    if (!rows.length) return null;
    const signed = await signPageUrls(rows.map((r) => r.image_path));
    const expires = Date.now() + 4 * 60_000;
    for (const r of rows) {
      const u = signed.get(r.image_path);
      if (u) urls.set(r.page, { url: u, expires });
    }
    return urls.get(page)?.url ?? null;
  }

  async function imageFor(page: number): Promise<HTMLImageElement | null> {
    const cached = images.get(page);
    if (cached) return cached;
    const url = await urlFor(page);
    if (!url) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("تعذر تحميل الصفحة");
    });
    if (images.size > 8) images.delete(images.keys().next().value as number);
    images.set(page, img);
    return img;
  }

  function stamp(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!watermark) return;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#2b2826";
    ctx.font = `${Math.max(11, Math.round(w * 0.022))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(watermark, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#6b6461";
    ctx.font = `${Math.max(9, Math.round(w * 0.014))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(watermark, w / 2, h - Math.round(h * 0.012));
    ctx.restore();
  }

  return {
    kind: "cloud",
    pageCount,
    async render(page, canvas, geom) {
      let cancelled = false;
      const img = await imageFor(page);
      if (!img || cancelled || disposed) return { done: Promise.resolve(), cancel: () => { cancelled = true; } };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fit =
        geom.fit === "page"
          ? Math.min(geom.availWidth / img.naturalWidth, geom.availHeight / img.naturalHeight)
          : geom.availWidth / img.naturalWidth;
      const cssScale = Math.max(0.05, fit * geom.zoom);
      const w = Math.floor(img.naturalWidth * cssScale * dpr);
      const h = Math.floor(img.naturalHeight * cssScale * dpr);
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      canvas.style.width = `${Math.floor(w / dpr)}px`;
      canvas.style.height = `${Math.floor(h / dpr)}px`;
      canvas.dir = "ltr";
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.direction = "ltr";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      stamp(ctx, canvas.width, canvas.height);
      // warm the next page so a page turn starts instantly
      void imageFor(page + 1).catch(() => {});
      return { done: Promise.resolve(), cancel: () => { cancelled = true; } };
    },
    getText: (from = 1, to = Number.MAX_SAFE_INTEGER) => getBookTextCloud(bookId, from, to),
    destroy() {
      disposed = true;
      urls.clear();
      images.clear();
    },
  };
}
