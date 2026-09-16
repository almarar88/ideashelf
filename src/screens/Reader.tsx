import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { BookOpenText, ChevronRight, HelpCircle, Lightbulb, ListChecks, Minus, MoreHorizontal, Plus, Sparkles } from "lucide-react";
import { db, logReading } from "@/lib/db";
import { openPdf, renderPageToCanvas } from "@/lib/pdf";
import type { Settings } from "@/lib/settings";
import { Gauge } from "@/components/Gauge";
import { IconButton, Toggle } from "@/components/ui";
import { AIPanel, type Mode } from "@/screens/AIPanel";
import { cn } from "@/lib/utils";

const MODES: { id: Mode; label: string; Icon: typeof Sparkles }[] = [
  { id: "summary", label: "تلخيص", Icon: Sparkles },
  { id: "analysis", label: "تحليل", Icon: Lightbulb },
  { id: "chat", label: "سؤال", Icon: HelpCircle },
  { id: "quiz", label: "اختبار", Icon: ListChecks },
];

export function ReaderScreen({ bookId, settings, wide, onBack }: { bookId: string; settings: Settings; wide: boolean; onBack: () => void }) {
  const book = useLiveQuery(() => db.books.get(bookId), [bookId]);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [aiOpen, setAiOpen] = useState(wide);
  const [mode, setMode] = useState<Mode>("summary");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  // Open the PDF once.
  useEffect(() => {
    let cancelled = false;
    let d: PDFDocumentProxy | null = null;
    (async () => {
      const b = await db.books.get(bookId);
      if (!b) return;
      d = await openPdf(b.file);
      if (cancelled) {
        void d.destroy();
        return;
      }
      setDoc(d);
      setPage(b.lastPage || 1);
      pageRef.current = b.lastPage || 1;
      void db.books.update(bookId, { lastOpenedAt: Date.now() });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      if (d) void d.destroy();
    };
  }, [bookId]);

  // Render current page whenever page/zoom/size changes.
  const render = useCallback(async () => {
    if (!doc || !canvasRef.current || !holderRef.current) return;
    const width = Math.max(200, holderRef.current.clientWidth - 24) * zoom;
    try {
      await renderPageToCanvas(doc, page, canvasRef.current, width);
    } catch {
      /* render can be cancelled when a new page starts */
    }
  }, [doc, page, zoom]);

  useEffect(() => {
    void render();
    const ro = new ResizeObserver(() => void render());
    if (holderRef.current) ro.observe(holderRef.current);
    return () => ro.disconnect();
  }, [render]);

  // Persist page + reading time.
  const go = (p: number) => {
    if (!book) return;
    const next = Math.max(1, Math.min(book.pages, p));
    if (next === page) return;
    if (next > page) void logReading(bookId, 0, next - page);
    pageRef.current = next;
    setPage(next);
    void db.books.update(bookId, { lastPage: next });
    holderRef.current?.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const TICK = 15;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void logReading(bookId, TICK);
    }, TICK * 1000);
    return () => clearInterval(t);
  }, [bookId]);

  // Keyboard navigation for desktop / foldables with keyboards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") go(pageRef.current + 1); // RTL: left = forward
      if (e.key === "ArrowRight") go(pageRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.pages]);

  // Touch swipe.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 60 || zoom > 1) return;
    go(dx < 0 ? page - 1 : page + 1); // RTL: swipe left goes back
  };

  if (!book) {
    return (
      <div className="flex h-full items-center justify-center bg-ink text-cream">
        <p className="text-sm text-cream/60">{book === undefined ? "جارٍ التحميل…" : "الكتاب غير موجود"}</p>
      </div>
    );
  }

  const progress = book.pages > 1 ? (page - 1) / (book.pages - 1) : 1;

  const readerPane = (
    <div className="flex h-full min-h-0 flex-col bg-ink text-cream">
      <header className="flex items-center justify-between px-4 pb-2 pt-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <IconButton tone="ghost" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
        <div className="relative">
          <IconButton tone="ghost" onClick={() => setShowPdfMenu((v) => !v)} aria-label="خيارات">
            <MoreHorizontal size={20} />
          </IconButton>
          {showPdfMenu && (
            <div className="absolute end-0 top-12 z-20 w-44 overflow-hidden rounded-2xl bg-cream text-ink shadow-lift" onClick={() => setShowPdfMenu(false)}>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>تكبير +</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>تصغير −</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom(1)}>ملاءمة العرض</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => go(1)}>الذهاب للبداية</button>
            </div>
          )}
        </div>
      </header>

      <div className="flex items-start justify-between gap-3 px-6">
        <h1 className="line-clamp-2 text-2xl font-bold leading-snug">{book.title}</h1>
        {!wide && (
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="text-xs text-cream/60">AI</span>
            <Toggle checked={aiOpen} onChange={setAiOpen} label="فتح لوحة الذكاء الاصطناعي" />
          </div>
        )}
      </div>

      {/* Page canvas */}
      <div ref={holderRef} className="relative mx-4 mt-4 min-h-0 flex-1 overflow-auto rounded-3xl bg-cream-deep p-3 no-scrollbar" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">جارٍ فتح الملف…</div>}
        <canvas ref={canvasRef} className="mx-auto block rounded-xl bg-white" />
      </div>

      {/* Dial */}
      <div className="px-4 pb-3 pt-2">
        <Gauge value={progress} size={230} startLabel="1" endLabel={String(book.pages)}>
          <div className="flex items-center gap-3">
            <IconButton tone="light" size="sm" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="الصفحة السابقة">
              <Minus size={16} />
            </IconButton>
            <div className="text-center">
              <p className="text-[11px] text-cream/60">الصفحة</p>
              <p className="text-4xl font-bold leading-none tabular-nums">{page}</p>
              <p className="mt-1 text-[11px] text-cream/50">من {book.pages}</p>
            </div>
            <IconButton tone="accent" size="sm" onClick={() => go(page + 1)} disabled={page >= book.pages} aria-label="الصفحة التالية">
              <Plus size={16} />
            </IconButton>
          </div>
        </Gauge>
      </div>

      {/* Mode chips */}
      <div className="grid grid-cols-4 gap-2 px-4 pb-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id && aiOpen;
          return (
            <button
              key={id}
              onClick={() => {
                setMode(id);
                setAiOpen(true);
              }}
              className={cn("flex flex-col items-center gap-1.5 rounded-3xl py-3 text-[11px] transition", active ? "bg-cream text-ink" : "bg-white/10 text-cream/80")}
            >
              <Icon size={18} className={active ? "text-accent" : ""} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const aiPane = <AIPanel book={book} page={page} mode={mode} setMode={setMode} settings={settings} onClose={wide ? undefined : () => setAiOpen(false)} />;

  if (wide) {
    return (
      <div className="flex h-full">
        <div className={cn("h-full min-w-0 transition-all", aiOpen ? "w-[46%]" : "flex-1")}>{readerPane}</div>
        {aiOpen ? (
          <div className="h-full min-w-0 flex-1 border-s border-black/10 bg-cream">{aiPane}</div>
        ) : (
          <button onClick={() => setAiOpen(true)} className="flex w-14 flex-col items-center justify-center gap-2 bg-cream text-ink">
            <BookOpenText size={20} />
            <span className="text-[10px] [writing-mode:vertical-rl]">لوحة الذكاء الاصطناعي</span>
          </button>
        )}
        {wide && (
          <div className="absolute end-4 top-4 z-10 hidden items-center gap-2 rounded-full bg-ink/80 px-3 py-1.5 text-xs text-cream backdrop-blur md:flex">
            AI <Toggle checked={aiOpen} onChange={setAiOpen} />
          </div>
        )}
      </div>
    );
  }

  return <div className="h-full">{aiOpen ? aiPane : readerPane}</div>;
}
