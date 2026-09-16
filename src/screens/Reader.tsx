import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BookOpenText,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Minimize2,
  Minus,
  MoreHorizontal,
  Plus,
  Sparkles,
} from "lucide-react";
import { db, logReading } from "@/lib/db";
import { ensureTextCurrent, openPdf, renderPageFitted } from "@/lib/pdf";
import type { PageEffect, Settings } from "@/lib/settings";
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
type Dir = "next" | "prev";

interface Geom {
  fit: Fit;
  zoom: number;
  availWidth: number;
  availHeight: number;
}

const FLIP_MS = 540;
const SLIDE_MS = 300;
const CHROME_HEIGHT = 330; // bottom control panel
const AUTO_HIDE_MS = 2200;

/* ---------- canvas helpers ---------- */
function blit(src: HTMLCanvasElement, dst: HTMLCanvasElement, withCssSize = true) {
  dst.width = src.width;
  dst.height = src.height;
  if (withCssSize) {
    dst.style.width = src.style.width;
    dst.style.height = src.style.height;
  }
  dst.getContext("2d")?.drawImage(src, 0, 0);
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.style.width = src.style.width;
  c.style.height = src.style.height;
  c.getContext("2d")?.drawImage(src, 0, 0);
  return c;
}

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
  const [page, setPage] = useState(1);
  const [aiOpen, setAiOpen] = useState(wide);
  const [mode, setMode] = useState<Mode>("summary");
  const [fit, setFit] = useState<Fit>("page");
  const [zoom, setZoom] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [viewportKey, setViewportKey] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLCanvasElement>(null);
  const faceShadeRef = useRef<HTMLDivElement>(null);
  const underShadeRef = useRef<HTMLDivElement>(null);

  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [docReady, setDocReady] = useState(false);
  const pageRef = useRef(1);
  const bookRef = useRef(book);
  bookRef.current = book;
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const effectRef = useRef<PageEffect>(settings.pageEffect);
  effectRef.current = wide ? settings.pageEffect : settings.pageEffect;

  const cacheRef = useRef(new Map<string, HTMLCanvasElement>());
  const pendingRef = useRef(new Map<string, Promise<HTMLCanvasElement | null>>());

  /* ---------- open the document ---------- */
  useEffect(() => {
    aliveRef.current = true;
    let opened: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const b = await db.books.get(bookId);
        if (!b) return;
        opened = await openPdf(b.file);
        if (!aliveRef.current) {
          void opened.destroy();
          return;
        }
        docRef.current = opened;
        const start = Math.min(Math.max(1, b.lastPage || 1), opened.numPages);
        setPage(start);
        pageRef.current = start;
        setDocReady(true);
        void db.books.update(bookId, { lastOpenedAt: Date.now() });
        // Books imported before the Arabic extraction fix hold unusable text; redo it in
        // the background so summaries and analysis work on them.
        void ensureTextCurrent(opened, b).catch(() => {
          /* the document may be torn down mid-pass; the next open retries */
        });
      } catch (e) {
        if (aliveRef.current) setError(e instanceof Error ? e.message : "تعذر فتح الملف");
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    })();
    return () => {
      aliveRef.current = false;
      cacheRef.current.clear();
      pendingRef.current.clear();
      docRef.current = null;
      if (opened) void opened.destroy();
    };
  }, [bookId]);

  /* ---------- open fullscreen: show the controls briefly, then get out of the way ---------- */
  useEffect(() => {
    if (wide) return;
    const t = setTimeout(() => setChrome(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [wide]);

  /* ---------- geometry ---------- */
  const pad = chrome ? 8 : 0;
  const geometry = useCallback((): Geom | null => {
    const holder = holderRef.current;
    if (!holder) return null;
    return {
      fit,
      zoom,
      availWidth: Math.max(80, holder.clientWidth - pad * 2),
      availHeight: Math.max(80, holder.clientHeight - pad * 2),
    };
  }, [fit, zoom, pad]);

  const keyFor = (p: number, g: Geom) =>
    `${p}|${g.fit}|${g.zoom}|${Math.round(g.availWidth)}x${Math.round(g.availHeight)}`;

  /** Render a page into a detached canvas, memoised per page + geometry. */
  const getPageCanvas = useCallback(async (p: number, g: Geom): Promise<HTMLCanvasElement | null> => {
    const key = keyFor(p, g);
    const hit = cacheRef.current.get(key);
    if (hit) return hit;
    const inflight = pendingRef.current.get(key);
    if (inflight) return inflight;
    const job = (async () => {
      const d = docRef.current;
      if (!d || p < 1 || p > d.numPages) return null;
      const off = document.createElement("canvas");
      const task = await renderPageFitted(d, p, off, g);
      await task?.promise;
      if (!aliveRef.current) return null;
      if (cacheRef.current.size >= 6) {
        const oldest = cacheRef.current.keys().next().value;
        if (oldest) cacheRef.current.delete(oldest);
      }
      cacheRef.current.set(key, off);
      return off;
    })()
      .catch(() => null)
      .finally(() => pendingRef.current.delete(key));
    pendingRef.current.set(key, job);
    return job;
  }, []);

  const prefetch = useCallback(
    (p: number, g: Geom) => {
      const run = () => {
        void getPageCanvas(p + 1, g);
        void getPageCanvas(p - 1, g);
      };
      if ("requestIdleCallback" in window) (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
      else setTimeout(run, 120);
    },
    [getPageCanvas],
  );

  /* ---------- repaint the current page when the geometry changes ---------- */
  useEffect(() => {
    if (!docReady) return;
    cacheRef.current.clear();
    let cancelled = false;
    (async () => {
      const g = geometry();
      if (!g) return;
      const c = await getPageCanvas(pageRef.current, g);
      if (cancelled || !c || !canvasRef.current) return;
      blit(c, canvasRef.current);
      prefetch(pageRef.current, g);
    })();
    return () => {
      cancelled = true;
    };
  }, [docReady, geometry, getPageCanvas, prefetch, viewportKey]);

  /* ---------- resize (fold / unfold / rotate) ----------
   * A callback ref, not an effect: on phones the AI panel replaces the reader, so the
   * holder unmounts and a new node takes its place. An observer bound to the old node
   * never fires again and the page comes back blank. */
  const mountsRef = useRef(0);
  const setHolder = useCallback((node: HTMLDivElement | null) => {
    holderRef.current = node;
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node) return;
    let last = `${node.clientWidth}x${node.clientHeight}`;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      const now = `${node.clientWidth}x${node.clientHeight}`;
      if (now === last) return;
      last = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setViewportKey(`${now}#${mountsRef.current}`), 120);
    });
    ro.observe(node);
    roRef.current = ro;
    mountsRef.current += 1;
    setViewportKey(`${last}#${mountsRef.current}`);
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  /* ---------- the page-turn animation ---------- */
  const animateTurn = useCallback(async (dir: Dir, face: HTMLCanvasElement, onSettle: () => void) => {
    const layer = flipRef.current;
    const faceCanvas = faceRef.current;
    const holder = holderRef.current;
    if (!layer || !faceCanvas) {
      onSettle();
      return;
    }
    const effect = effectRef.current;
    blit(face, faceCanvas, false);
    layer.style.width = face.style.width;
    layer.style.height = face.style.height;
    layer.style.display = "block";
    // the turning sheet swings past the screen edge; don't let it grow the scroll area
    const prevOverflow = holder?.style.overflow ?? "";
    if (holder) holder.style.overflow = "hidden";

    const duration = effect === "slide" ? SLIDE_MS : FLIP_MS;
    const frames =
      effect === "slide"
        ? dir === "next"
          ? [{ transform: "translateX(0)" }, { transform: "translateX(105%)" }]
          : [{ transform: "translateX(105%)" }, { transform: "translateX(0)" }]
        : dir === "next"
          ? [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }]
          : [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }];

    const anims = [
      layer.animate(frames, { duration, easing: "cubic-bezier(.36,.06,.24,1)", fill: "forwards" }),
    ];
    if (effect === "flip") {
      const timing = { duration, easing: "linear" } as const;
      if (faceShadeRef.current) {
        anims.push(faceShadeRef.current.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }], timing));
      }
      if (underShadeRef.current) {
        // The lifted sheet spans [W·(1−cosθ), W], so its free edge sits at W·(1−cosθ).
        // Scaling the shadow band to that fraction keeps the contact shadow under that edge.
        const opening = [
          { transform: "scaleX(0)", opacity: 0, offset: 0 },
          { transform: "scaleX(0.3)", opacity: 0.55, offset: 0.28 },
          { transform: "scaleX(1)", opacity: 0.5, offset: 0.55 },
          { transform: "scaleX(1)", opacity: 0, offset: 1 },
        ];
        const closing = [
          { transform: "scaleX(1)", opacity: 0, offset: 0 },
          { transform: "scaleX(1)", opacity: 0.5, offset: 0.45 },
          { transform: "scaleX(0.3)", opacity: 0.55, offset: 0.72 },
          { transform: "scaleX(0)", opacity: 0, offset: 1 },
        ];
        anims.push(underShadeRef.current.animate(dir === "next" ? opening : closing, timing));
      }
    }
    await Promise.allSettled(anims.map((a) => a.finished));
    onSettle();
    layer.style.display = "none";
    for (const a of anims) a.cancel();
    if (holder) holder.style.overflow = prevOverflow;
  }, []);

  /* ---------- navigation ---------- */
  const goTo = useCallback(
    async (target: number, animate = true) => {
      const b = bookRef.current;
      if (!b || busyRef.current || !docRef.current) return;
      const current = pageRef.current;
      const next = Math.max(1, Math.min(b.pages, Math.round(target)));
      if (next === current) return;

      busyRef.current = true;
      try {
        const base = geometry();
        const main = canvasRef.current;
        if (!base || !main) return;
        // Flipping while zoomed in is confusing — snap back to the fitted view.
        const g: Geom = { ...base, zoom: 1 };
        if (zoom !== 1) setZoom(1);

        const incoming = await getPageCanvas(next, g);
        if (!incoming || !aliveRef.current) return;

        const dir: Dir = next > current ? "next" : "prev";
        const canAnimate = animate && effectRef.current !== "none" && main.width > 0;

        if (!canAnimate) {
          blit(incoming, main);
        } else if (dir === "next") {
          const outgoing = cloneCanvas(main);
          blit(incoming, main); // revealed underneath as the old page swings away
          await animateTurn("next", outgoing, () => {});
        } else {
          await animateTurn("prev", incoming, () => blit(incoming, main));
        }

        pageRef.current = next;
        setPage(next);
        if (next > current) void logReading(bookId, 0, next - current);
        void db.books.update(bookId, { lastPage: next });
        prefetch(next, g);
      } finally {
        busyRef.current = false;
      }
    },
    [animateTurn, bookId, geometry, getPageCanvas, prefetch, zoom],
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
      if (e.key === "ArrowLeft" || e.key === "PageDown" || e.key === " ") void goTo(pageRef.current + 1);
      if (e.key === "ArrowRight" || e.key === "PageUp") void goTo(pageRef.current - 1);
      if (e.key === "Escape") setChrome((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  /* ---------- touch: swipe to turn, pinch to zoom, double tap ---------- */
  const touch = useRef({ x: 0, y: 0, dist: 0, zoom: 1, lastTap: 0 });
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      touch.current.dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      touch.current.zoom = zoom;
      return;
    }
    touch.current.x = e.touches[0].clientX;
    touch.current.y = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !touch.current.dist) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    setZoom(Math.round(Math.min(4, Math.max(1, touch.current.zoom * (d / touch.current.dist))) * 20) / 20);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touch.current.dist) {
      touch.current.dist = 0;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    // RTL book: the spine is on the right, so dragging left→right turns to the next page.
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4 && zoom === 1) {
      void goTo(pageRef.current + (dx > 0 ? 1 : -1));
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
      {/* page surface — fills the whole screen when the controls are hidden */}
      <div
        ref={setHolder}
        className="absolute inset-x-0 overflow-auto no-scrollbar"
        style={{
          top: showChrome ? "calc(var(--safe-top) + 58px)" : 0,
          bottom: showChrome ? CHROME_HEIGHT : 0,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
        onClick={() => {
          if (!wide && !("ontouchstart" in window)) setChrome((v) => !v);
        }}
      >
        <div className="flex min-h-full items-center justify-center" style={{ padding: pad }}>
          <div className="relative" style={{ perspective: "2000px" }}>
            <canvas ref={canvasRef} className={cn("block bg-white", showChrome && "rounded-lg")} />
            {/* shadow the lifted sheet casts on the page underneath */}
            <div
              ref={underShadeRef}
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                opacity: 0,
                transformOrigin: "left center",
                transform: "scaleX(0)",
                background: "linear-gradient(to left, rgba(0,0,0,.55), rgba(0,0,0,0) 32%)",
              }}
            />
            {/* the turning sheet */}
            <div
              ref={flipRef}
              className="pointer-events-none absolute start-auto end-0 top-0"
              style={{
                display: "none",
                transformStyle: "preserve-3d",
                transformOrigin: "right center",
                willChange: "transform",
                filter: "drop-shadow(-6px 4px 12px rgba(0,0,0,.45))",
              }}
            >
              <canvas ref={faceRef} className="absolute inset-0 h-full w-full rounded-lg bg-white" style={{ backfaceVisibility: "hidden" }} />
              <div
                ref={faceShadeRef}
                className="absolute inset-0 rounded-lg"
                style={{ opacity: 0, backfaceVisibility: "hidden", background: "linear-gradient(to left, rgba(0,0,0,.65), rgba(0,0,0,0) 55%)" }}
              />
              {/* back of the sheet */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  transform: "rotateY(180deg)",
                  backfaceVisibility: "hidden",
                  background: "linear-gradient(to right, #faf7f1 0%, #ece5d9 55%, #d9d0c2 100%)",
                }}
              />
            </div>
          </div>
        </div>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/60">جارٍ فتح الملف…</div>}
        {error && <div className="absolute inset-x-6 top-1/2 rounded-2xl bg-red-100 p-4 text-center text-xs text-red-800">{error}</div>}
      </div>

      {/* top bar */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-start gap-2 bg-gradient-to-b from-ink via-ink/90 to-transparent px-3 pb-6 transition-opacity duration-300",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}
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
            <Minimize2 size={18} />
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
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => void goTo(1, false)}>
                الذهاب للبداية
              </button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => void goTo(book.pages, false)}>
                الذهاب للنهاية
              </button>
            </div>
          )}
        </div>
      </header>

      {/* fullscreen: a single unobtrusive button back to the controls */}
      {!showChrome && (
        <button
          onClick={() => setChrome(true)}
          className="absolute end-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-cream/80 backdrop-blur"
          style={{ top: "calc(var(--safe-top) + 10px)" }}
          aria-label="إظهار الأدوات"
        >
          <MoreHorizontal size={18} />
        </button>
      )}

      {/* fullscreen page counter */}
      {!showChrome && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 text-center text-[11px] text-cream/40"
          style={{ bottom: "calc(var(--safe-bottom) + 8px)" }}
        >
          {page} من {book.pages}
        </div>
      )}

      {/* bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink to-transparent pt-3 transition-transform duration-300",
          showChrome ? "translate-y-0" : "translate-y-full",
        )}
      >
        {!wide && (
          <div className="mb-1 flex items-center justify-end gap-2 px-6">
            <span className="text-xs text-cream/60">لوحة الذكاء الاصطناعي</span>
            <Toggle checked={aiOpen} onChange={setAiOpen} label="فتح لوحة الذكاء الاصطناعي" />
          </div>
        )}

        <Gauge value={progress} size={190} startLabel="1" endLabel={String(book.pages)}>
          <div className="flex items-center gap-3">
            <IconButton tone="light" size="sm" onClick={() => void goTo(page - 1)} disabled={page <= 1} aria-label="الصفحة السابقة">
              <Minus size={16} />
            </IconButton>
            <div className="text-center">
              <p className="text-[10px] text-cream/60">الصفحة</p>
              <p className="text-3xl font-bold leading-none tabular-nums">{page}</p>
              <p className="mt-0.5 text-[10px] text-cream/50">من {book.pages}</p>
            </div>
            <IconButton tone="accent" size="sm" onClick={() => void goTo(page + 1)} disabled={page >= book.pages} aria-label="الصفحة التالية">
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
            onChange={(e) => void goTo(+e.target.value, false)}
            aria-label="الانتقال إلى صفحة"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-cream/20 accent-[#ee7a4b]"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 px-4 pb-4 pt-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
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
