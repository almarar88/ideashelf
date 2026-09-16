import * as XLSX from "xlsx";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } from "docx";
import { Capacitor } from "@capacitor/core";

/* ------------------------------------------------------------------ */
/* Save / share                                                         */
/* ------------------------------------------------------------------ */

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);

/** Saves the file on-device (Android: Documents/PartnerHub + share sheet; Web: download). */
export async function saveFile(filename: string, _mime: string, blob: Blob): Promise<string> {
  const name = safeName(filename);
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await toBase64(blob);
    let uri = "";
    try {
      const r = await Filesystem.writeFile({ path: `PartnerHub/${name}`, data, directory: Directory.Documents, recursive: true });
      uri = r.uri;
    } catch {
      const r = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, recursive: true });
      uri = r.uri;
    }
    try { const { Share } = await import("@capacitor/share"); await Share.share({ title: name, files: [uri] }); } catch { /* user dismissed */ }
    return uri;
  }
  const url = URL.createObjectURL(blob);
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const a = document.createElement("a"); a.href = url; a.download = /^[\x20-\x7e]+$/.test(name) ? name : `partnerhub-${Date.now()}${ext}`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}

/* ------------------------------------------------------------------ */
/* Excel                                                                */
/* ------------------------------------------------------------------ */

export interface Sheet { name: string; rows: (string | number | null | undefined)[][]; widths?: number[] }

export function buildXlsx(sheets: Sheet[], rtl = true): Blob {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.map((r) => r.map((c) => (c === undefined || c === null ? "" : c))));
    const widths = s.widths ?? s.rows[0]?.map((_, i) => Math.min(60, Math.max(12, ...s.rows.map((r) => String(r[i] ?? "").length + 2))));
    ws["!cols"] = widths?.map((w) => ({ wch: w }));
    if (rtl) ws["!dir"] = "rtl";
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  if (rtl) wb.Workbook = { Views: [{ RTL: true }] };
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export const exportXlsx = (filename: string, sheets: Sheet[], rtl = true) => saveFile(`${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buildXlsx(sheets, rtl));

/* ------------------------------------------------------------------ */
/* Word (from Markdown)                                                 */
/* ------------------------------------------------------------------ */

function runs(text: string, rtl: boolean): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) => (p.startsWith("**") ? new TextRun({ text: p.slice(2, -2), bold: true, rightToLeft: rtl }) : new TextRun({ text: p, rightToLeft: rtl })));
}

export function markdownToDocx(title: string, md: string, rtl = true, meta?: string): Document {
  const children: (Paragraph | Table)[] = [];
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const para = (opts: ConstructorParameters<typeof Paragraph>[0]) => new Paragraph({ bidirectional: rtl, alignment: align, ...(opts as object) });
  children.push(para({ text: title, heading: HeadingLevel.TITLE }));
  if (meta) children.push(para({ children: [new TextRun({ text: meta, color: "777777", size: 18, rightToLeft: rtl })] }));
  let table: string[][] | null = null;
  const flushTable = () => {
    if (!table || table.length === 0) { table = null; return; }
    const rows = table.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((c) => new TableCell({ width: { size: Math.floor(100 / r.length), type: WidthType.PERCENTAGE }, shading: i === 0 ? { fill: "E8EBE3" } : undefined, children: [para({ children: runs(c, rtl).map((x) => (i === 0 ? new TextRun({ text: c, bold: true, rightToLeft: rtl }) : x)) })] })) }));
    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: rtl }));
    children.push(para({ text: "" }));
    table = null;
  };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const l = raw.trimEnd();
    if (/^\|.*\|$/.test(l.trim())) {
      const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      (table ??= []).push(cells); continue;
    }
    flushTable();
    if (!l.trim()) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) { children.push(para({ text: h[2], heading: h[1].length === 1 ? HeadingLevel.HEADING_1 : h[1].length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 })); continue; }
    const ul = /^[-*•]\s+(.*)$/.exec(l.trim());
    const ol = /^\d+[.)]\s+(.*)$/.exec(l.trim());
    if (ul) { children.push(para({ children: runs(ul[1], rtl), bullet: { level: 0 } })); continue; }
    if (ol) { children.push(para({ children: runs(ol[1], rtl), numbering: { reference: "nums", level: 0 } })); continue; }
    children.push(para({ children: runs(l, rtl), spacing: { after: 120 } }));
  }
  flushTable();
  return new Document({
    creator: "PartnerHub",
    title,
    numbering: { config: [{ reference: "nums", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: align }] }] },
    styles: { default: { document: { run: { font: rtl ? "Arial" : "Calibri", size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });
}

export async function exportDocx(filename: string, title: string, md: string, rtl = true, meta?: string): Promise<string> {
  const blob = await Packer.toBlob(markdownToDocx(title, md, rtl, meta));
  return saveFile(`${filename}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", blob);
}

/* ------------------------------------------------------------------ */
/* PDF (rendered from HTML so Arabic shaping is correct)                */
/* ------------------------------------------------------------------ */

export function markdownToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out: string[] = []; let list: "ul" | "ol" | null = null; let table: string[][] | null = null;
  const flush = () => { if (list) { out.push(`</${list}>`); list = null; } if (table) { const [h, ...rows] = table; out.push(`<table><thead><tr>${h.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); table = null; } };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const l = raw.trimEnd();
    if (/^\|.*\|$/.test(l.trim())) { const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim()); if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; if (list) { out.push(`</${list}>`); list = null; } (table ??= []).push(cells); continue; }
    if (table) flush();
    if (!l.trim()) { flush(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const ul = /^[-*•]\s+(.*)$/.exec(l.trim()); const ol = /^\d+[.)]\s+(.*)$/.exec(l.trim());
    if (ul || ol) { const ty = ul ? "ul" : "ol"; if (list !== ty) { if (list) out.push(`</${list}>`); out.push(`<${ty}>`); list = ty; } out.push(`<li>${inline((ul ?? ol)![1])}</li>`); continue; }
    flush(); out.push(`<p>${inline(l)}</p>`);
  }
  flush();
  return out.join("\n");
}

const PDF_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .pdf { width: 794px; padding: 48px 56px; background: #fff; color: #1e2419; font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif; font-size: 13px; line-height: 1.7; }
  .pdf h1 { font-size: 24px; margin: 0 0 6px; color: #2b3128; } .pdf h2 { font-size: 17px; margin: 18px 0 6px; color: #2b3128; border-bottom: 2px solid #4b5343; padding-bottom: 4px; } .pdf h3 { font-size: 14px; margin: 14px 0 4px; }
  .pdf p { margin: 4px 0; } .pdf ul, .pdf ol { padding-inline-start: 22px; margin: 4px 0; } .pdf li { margin: 2px 0; }
  .pdf table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; } .pdf th, .pdf td { border: 1px solid #cfd3c8; padding: 5px 8px; text-align: start; } .pdf th { background: #e8ebe3; }
  .pdf .meta { color: #777; font-size: 11px; margin-bottom: 14px; } .pdf .brand { display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid #4b5343; padding-bottom: 8px; margin-bottom: 14px; font-weight: 700; color:#4b5343; }
`;

export async function exportPdfFromMarkdown(filename: string, title: string, md: string, rtl = true, meta?: string, brand = "PartnerHub"): Promise<string> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;";
  host.innerHTML = `<style>${PDF_CSS}</style><div class="pdf" dir="${rtl ? "rtl" : "ltr"}"><div class="brand"><span>${brand}</span><span>${new Date().toLocaleDateString(rtl ? "ar-AE-u-nu-latn" : "en-GB")}</span></div><h1>${title}</h1>${meta ? `<div class="meta">${meta}</div>` : ""}${markdownToHtml(md)}</div>`;
  document.body.appendChild(host);
  try {
    const el = host.querySelector<HTMLElement>(".pdf")!;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth(); const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW; const imgH = (canvas.height * imgW) / canvas.width;
    const pagePx = Math.floor((pageH / imgH) * canvas.height);
    let y = 0; let first = true;
    while (y < canvas.height) {
      const slice = document.createElement("canvas"); slice.width = canvas.width; slice.height = Math.min(pagePx, canvas.height - y);
      slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, (slice.height * imgW) / canvas.width);
      first = false; y += pagePx;
    }
    return saveFile(`${filename}.pdf`, "application/pdf", pdf.output("blob"));
  } finally { host.remove(); }
}
