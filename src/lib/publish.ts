import { itemsToText, openPdf } from "./pdf";
import { requireSupabase } from "./supabase";

export interface PublishMeta {
  title: string;
  author: string;
  description: string;
  priceMinor: number;
  currency: string;
  previewPages: number;
  inSubscription: boolean;
  tags: string[];
}

export interface PublishProgress {
  stage: "opening" | "cover" | "pages" | "finishing" | "done";
  page: number;
  pages: number;
}

const PAGE_WIDTH = 1400; // enough to read comfortably, small enough to store cheaply

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `book-${Date.now()}`
  );
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const type = "image/webp";
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذر ترميز الصفحة"))), type, 0.82);
  });
}

/**
 * Turns a PDF into a store book: every page becomes an image in a private bucket and a
 * row of extracted text. The PDF itself is never uploaded, so there is no file for a
 * reader to download — only per-page images behind short-lived signed URLs.
 */
export async function publishBookToStore(file: File, meta: PublishMeta, onProgress?: (p: PublishProgress) => void): Promise<string> {
  const sb = requireSupabase();
  onProgress?.({ stage: "opening", page: 0, pages: 0 });
  const doc = await openPdf(file);
  const pages = doc.numPages;

  const slug = `${slugify(meta.title)}-${Date.now().toString(36)}`;
  const { data: book, error: bookErr } = await sb
    .from("books")
    .insert({
      slug,
      title: meta.title,
      author: meta.author || null,
      description: meta.description || null,
      page_count: pages,
      price_minor: meta.priceMinor,
      currency: meta.currency,
      preview_pages: meta.previewPages,
      in_subscription: meta.inSubscription,
      tags: meta.tags,
      status: "draft",
    })
    .select()
    .single();
  if (bookErr) throw new Error(`تعذر إنشاء الكتاب: ${bookErr.message}`);
  const bookId = (book as { id: string }).id;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز لوحة الرسم");
  canvas.dir = "ltr";

  for (let p = 1; p <= pages; p++) {
    const pdfPage = await doc.getPage(p);
    const base = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({ scale: PAGE_WIDTH / base.width });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    ctx.direction = "ltr";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    const blob = await canvasToBlob(canvas);
    const path = `${bookId}/${String(p).padStart(4, "0")}.webp`;
    const up = await sb.storage.from("book-pages").upload(path, blob, { contentType: blob.type, upsert: true });
    if (up.error) throw new Error(`تعذر رفع الصفحة ${p}: ${up.error.message}`);

    const content = await pdfPage.getTextContent();
    const text = itemsToText(content.items as { str?: string; transform?: number[]; width?: number; height?: number }[]);
    const ins = await sb.from("book_pages").insert({ book_id: bookId, page: p, image_path: path, width: canvas.width, height: canvas.height, text });
    if (ins.error) throw new Error(`تعذر حفظ نص الصفحة ${p}: ${ins.error.message}`);

    if (p === 1) {
      onProgress?.({ stage: "cover", page: 0, pages });
      const coverPath = `${bookId}.webp`;
      const cover = await sb.storage.from("covers").upload(coverPath, blob, { contentType: blob.type, upsert: true });
      if (!cover.error) {
        const { data } = sb.storage.from("covers").getPublicUrl(coverPath);
        await sb.from("books").update({ cover_url: data.publicUrl }).eq("id", bookId);
      }
    }
    pdfPage.cleanup();
    onProgress?.({ stage: "pages", page: p, pages });
  }

  onProgress?.({ stage: "finishing", page: pages, pages });
  const pub = await sb.from("books").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", bookId);
  if (pub.error) throw new Error(`تعذر نشر الكتاب: ${pub.error.message}`);
  await doc.destroy();
  onProgress?.({ stage: "done", page: pages, pages });
  return bookId;
}
