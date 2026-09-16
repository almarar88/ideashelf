import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { importPdf, type ImportProgress } from "@/lib/pdf";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface UploadState {
  file: string;
  progress: ImportProgress | null;
  error?: string;
}

/** Shared PDF picker + importer used by the library and the admin dashboard. */
export function UploadButton({
  multiple = true,
  className,
  label = "رفع كتاب PDF",
  tone = "accent",
  onDone,
  onState,
}: {
  multiple?: boolean;
  className?: string;
  label?: string;
  tone?: "accent" | "dark" | "light";
  onDone?: (count: number) => void;
  onState?: (states: UploadState[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<ImportProgress | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const states: UploadState[] = Array.from(files).map((f) => ({ file: f.name, progress: null }));
    onState?.(states);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        await importPdf(f, (p) => {
          setCurrent(p);
          states[i] = { ...states[i], progress: p };
          onState?.([...states]);
        });
        ok++;
      } catch (err) {
        states[i] = { ...states[i], error: err instanceof Error ? err.message : "فشل الاستيراد" };
        onState?.([...states]);
      }
    }
    setBusy(false);
    setCurrent(null);
    if (ref.current) ref.current.value = "";
    onDone?.(ok);
  }

  const pct = current && current.pages ? Math.round((current.page / current.pages) * 100) : 0;

  return (
    <>
      <input ref={ref} type="file" accept="application/pdf,.pdf" multiple={multiple} className="hidden" onChange={(e) => handle(e.target.files)} />
      <Button tone={tone} disabled={busy} onClick={() => ref.current?.click()} className={cn("relative overflow-hidden", className)}>
        {busy && <span className="absolute inset-y-0 start-0 bg-white/20 transition-all" style={{ width: `${pct}%` }} />}
        <Upload size={18} />
        {busy ? (current?.stage === "text" ? `استخراج النص ${pct}%` : "جارٍ الفتح…") : label}
      </Button>
    </>
  );
}
