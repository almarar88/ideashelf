import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  BookOpenText,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  Plus,
  Sparkles,
} from "lucide-react";
import { db, logReading } from "@/lib/db";
import { openPdf, renderPageFitted } from "@/lib/pdf";
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

type Fit = "page" | "width";

export function ReaderScreen({
  bookId,
  settings,
  wide,
  onBack,
}: {
  bookId: string;
  settings: Settings;
  wide: boolean;
  onBack: () => void;
}) {
  const book = useLiveQuery(() => db.books.get(bookId), [bookId]);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [aiOpen, setAiOpen] = useState(wide);
  const [mode, setMode] = useState<Mode>("summary");
  const [fit, setFit] = useState<Fit>("page");
  const [zoom, setZoom] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const pageRef = useRef(1);

  /* ---------- open ---------- */
  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const b = await db.books.get(bookId);
        if (!b) return;
        opened = await openPdf(b.file);
        if (cancelled) {
          void opened.destroy();
          return;
        }
        setDoc(opened);
        const start = Math.min(Math.max(1, b.lastPage || 1), opened.numPages);
        setPage(start);
        pageRef.current = start;
        void db.books.update(bookId, { lastOpenedAt: Date.now() });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذر فتح الملف");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        taskRef.current?.cancel();
      } catch {
        /* already finished */
      }
      if (opened) void opened.destroy();
    };
  }, [bookId]);

  /* ---------- render ---------- */
  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    const holder = holderRef.current;
    if (!doc || !canvas || !holder) return;
    try {
      taskRef.current?.cancel();
    } catch {
      /* previous task already settled */
    }
    // clientHeight includes the padding that keeps the page clear of the floating top bar,
    // so subtract it or "fit page" would overflow and crop the bottom of the page.
    const cs = getComputedStyle(holder);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const availWidth = Math.max(80, holder.clientWidth - 16);
    const availHeight = Math.max(80, holder.clientHeight - padY - 16);
    try {
      const task = await renderPageFitted(doc, page, canvas, { fit, zoom, availWidth, availHeight });
      taskRef.current = task;
      await task?.promise;
    } catch {
      /* cancelled by a newer render */
    }
  }, [doc, page, fit, zoom]);

  useEffect(() => {
    void render();
    const holder = holderRef.current;
    if (!holder) return;
    let last = `${holder.clientWidth}x${holder.clientHeight}`;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      const now = `${holder.clientWidth}x${holder.clientHeight}`;
      if (now === last) return; // ignore no-op notifications
      last = now;
      // Debounce: the chrome show/hide animates the pane height, and folding/unfolding
      // fires a burst of resizes. Render once the size settles.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void render(), 120);
    });
    ro.observe(holder);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [render]);

  /* ---------- navigation ---------- */
  const go = useCallback(
    (p: number) => {
      if (!book) return;
      const next = Math.max(1, Math.min(book.pages, p));
      if (next === pageRef.current) return;
      if (next > pageRef.current) void logReading(bookId, 0, next - pageRef.current);
      pageRef.current = next;
      setPage(next);
      setZoom(1);
      void db.books.update(bookId, { lastPage: next });
      holderRef.current?.scrollTo({ top: 0 });
    },
    [book, bookId],
  );

  useEffect(() => {
    const TICK = 15;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void logReading(bookId, TICK);
    }, TICK * 1000);
    return () => clearInterval(t);
  }, [bookId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft" || e.key === "PageDown" || e.key === " ") go(pageRef.current + 1);
      if (e.key === "ArrowRight" || e.key === "PageUp") go(pageRef.current - 1);
      if (e.key === "Escape") setChrome(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /* ---------- touch: swipe, pinch, double-tap ---------- */
  const touch = useRef({ x: 0, y: 0, dist: 0, zoom: 1, moved: false, lastTap: 0 });
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      touch.current.dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      touch.current.zoom = zoom;
      touch.current.moved = true;
      return;
    }
    touch.current.x = e.touches[0].clientX;
    touch.current.y = e.touches[0].clientY;
    touch.current.moved = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !touch.current.dist) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const next = Math.min(4, Math.max(1, touch.current.zoom * (d / touch.current.dist)));
    setZoom(Math.round(next * 20) / 20);
    touch.current.moved = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touch.current.dist) {
      touch.current.dist = 0;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && zoom === 1) {
      go(dx < 0 ? pageRef.current - 1 : pageRef.current + 1); // RTL: swipe left goes back
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const now = Date.now();
      if (now - touch.current.lastTap < 300) {
        setZoom((z) => (z > 1 ? 1 : 2));
        touch.current.lastTap = 0;
      } else {
        touch.current.lastTap = now;
        setTimeout(() => {
          if (touch.current.lastTap === now) setChrome((v) => !v);
        }, 300);
      }
    }
  };

  if (!book) {
    return (
      <div className="flex h-full items-center justify-center bg-ink text-cream">
        <p className="text-sm text-cream/60">{book === undefined ? "جارٍ التحميل…" : "الكتاب غير موجود"}</p>
      </div>
    );
  }

  const progress = book.pages > 1 ? (page - 1) / (book.pages - 1) : 1;
  const showChrome = chrome || wide;

  const readerPane = (
    <div className="relative h-full min-h-0 overflow-hidden bg-ink text-cream">
      {/* page surface fills the pane; controls float over it */}
      <div
        ref={holderRef}
        className={cn("absolute inset-x-0 top-0 overflow-auto no-scrollbar transition-[bottom] duration-300", showChrome ? "bottom-[340px]" : "bottom-0")}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
        style={{ paddingTop: showChrome ? "calc(var(--safe-top) + 64px)" : "var(--safe-top)" }}
      >
        <div className="flex min-h-full items-center justify-center p-2">
          <canvas ref={canvasRef} className="block rounded-lg bg-white" />
        </div>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/60">جارٍ فتح الملف…</div>}
        {error && <div className="absolute inset-x-6 top-1/2 rounded-2xl bg-red-100 p-4 text-center text-xs text-red-800">{error}</div>}
      </div>

      {/* top bar */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-start gap-3 bg-gradient-to-b from-ink via-ink/90 to-transparent px-4 pb-6 transition-opacity duration-300",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
      >
        <IconButton tone="ghost" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
        <div className="min-w-0 flex-1 pt-2">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="text-[11px] text-cream/50">
            {fit === "page" ? "الصفحة كاملة" : "ملء العرض"}
            {zoom > 1 && ` · تكبير ${Math.round(zoom * 100)}%`}
          </p>
        </div>
        {!wide && (
          <IconButton tone="ghost" onClick={() => setChrome(false)} aria-label="ملء الشاشة">
            <Maximize2 size={18} />
          </IconButton>
        )}
        <div className="relative">
          <IconButton tone="ghost" onClick={() => setMenu((v) => !v)} aria-label="خيارات">
            <MoreHorizontal size={20} />
          </IconButton>
          {menu && (
            <div className="absolute end-0 top-12 z-20 w-48 overflow-hidden rounded-2xl bg-cream text-ink shadow-lift" onClick={() => setMenu(false)}>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => { setFit("page"); setZoom(1); }}>
                عرض الصفحة كاملة
              </button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => { setFit("width"); setZoom(1); }}>
                ملء عرض الشاشة
              </button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}>
                تكبير +
              </button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}>
                تصغير −
              </button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => go(1)}>
                الذهاب للبداية
              </button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => go(book.pages)}>
                الذهاب للنهاية
              </button>
            </div>
          )}
        </div>
      </header>

      {/* floating exit-fullscreen button */}
      {!showChrome && (
        <button
          onClick={() => setChrome(true)}
          className="absolute end-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-cream backdrop-blur"
          style={{ top: "calc(var(--safe-top) + 12px)" }}
          aria-label="إظهار الأدوات"
        >
          <Minimize2 size={18} />
        </button>
      )}

      {/* bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink to-transparent pt-4 transition-transform duration-300",
          showChrome ? "translate-y-0" : "translate-y-full",
        )}
      >
        {!wide && (
          <div className="mb-1 flex items-center justify-end gap-2 px-6">
            <span className="text-xs text-cream/60">لوحة الذكاء الاصطناعي</span>
            <Toggle checked={aiOpen} onChange={setAiOpen} label="فتح لوحة الذكاء الاصطناعي" />
          </div>
        )}

        <Gauge value={progress} size={196} startLabel="1" endLabel={String(book.pages)}>
          <div className="flex items-center gap-3">
            <IconButton tone="light" size="sm" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="الصفحة السابقة">
              <Minus size={16} />
            </IconButton>
            <div className="text-center">
              <p className="text-[10px] text-cream/60">الصفحة</p>
              <p className="text-3xl font-bold leading-none tabular-nums">{page}</p>
              <p className="mt-0.5 text-[10px] text-cream/50">من {book.pages}</p>
            </div>
            <IconButton tone="accent" size="sm" onClick={() => go(page + 1)} disabled={page >= book.pages} aria-label="الصفحة التالية">
              <Plus size={16} />
            </IconButton>
          </div>
        </Gauge>

        <div className="px-6 pb-1">
          <input
            type="range"
            min={1}
            max={book.pages}
            value={page}
            onChange={(e) => go(+e.target.value)}
            aria-label="الانتقال إلى صفحة"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-cream/20 accent-[#ee7a4b]"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 px-4 pb-4 pt-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}>
          {MODES.map(({ id, label, Icon }) => {
            const active = mode === id && aiOpen;
            return (
              <button
                key={id}
                onClick={() => {
                  setMode(id);
                  setAiOpen(true);
                }}
                className={cn("flex flex-col items-center gap-1.5 rounded-3xl py-2.5 text-[11px] transition", active ? "bg-cream text-ink" : "bg-white/10 text-cream/80")}
              >
                <Icon size={18} className={active ? "text-accent" : ""} />
                {label}
              </button>
            );
          })}
        </div>
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
      </div>
    );
  }

  return <div className="h-full">{aiOpen ? aiPane : readerPane}</div>;
}
