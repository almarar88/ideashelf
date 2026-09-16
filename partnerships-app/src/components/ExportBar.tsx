import { useState } from "react";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useApp } from "@/lib/app-context";
import { exportDocx, exportPdfFromMarkdown, exportXlsx, type Sheet } from "@/lib/export";

/** Excel / Word / PDF buttons. Pass only what applies. */
export function ExportBar({ filename, sheets, title, markdown, meta, small = true, className = "" }: { filename: string; sheets?: () => Sheet[]; title?: string; markdown?: () => string; meta?: string; small?: boolean; className?: string }) {
  const { t, lang } = useT();
  const { toast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const rtl = lang === "ar";
  const run = async (kind: "xlsx" | "docx" | "pdf") => {
    setBusy(kind); toast(t("exporting"));
    try {
      if (kind === "xlsx" && sheets) await exportXlsx(filename, sheets(), rtl);
      if (kind === "docx" && markdown) await exportDocx(filename, title ?? filename, markdown(), rtl, meta);
      if (kind === "pdf" && markdown) await exportPdfFromMarkdown(filename, title ?? filename, markdown(), rtl, meta);
      toast(`✓ ${t("fileReady")}`);
    } catch (e) { toast(`${t("error")}: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(null); }
  };
  return (
    <div className={`flex gap-2 ${className}`}>
      {sheets && <Button small={small} variant="ghost" disabled={!!busy} onClick={() => run("xlsx")}><FileSpreadsheet size={14} className="text-ok" />{t("exportExcel")}</Button>}
      {markdown && <Button small={small} variant="ghost" disabled={!!busy} onClick={() => run("docx")}><FileText size={14} className="text-info" />{t("exportWord")}</Button>}
      {markdown && <Button small={small} variant="ghost" disabled={!!busy} onClick={() => run("pdf")}><FileDown size={14} className="text-urgent" />{t("exportPdf")}</Button>}
    </div>
  );
}
