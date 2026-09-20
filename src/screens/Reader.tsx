import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpenText,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Headphones,
  Lock,
  Minimize2,
  Minus,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { db, logReading } from "@/lib/db";
import { TEXT_VERSION } from "@/lib/pdf";
import { createCloudSource, createLocalSource, type Geom, type PageSource, type RenderHandle } from "@/lib/reader-source";
import { saveProgress } from "@/lib/cloud";
import { createNarrator, openVoiceInstall, setScreenAwake, type NarrationStatus, type Narrator } from "@/lib/narration";
import type { PageEffect, Settings } from "@/lib/settings";
import { Gauge } from "@/components/Gauge";
import { IconButton, Toggle } from "@/components/ui";
import { AIPanel, type Mode } from "@/screens/AIPanel";
import { cn } from "@/lib/utils";

export type ReaderTarget =
  | { kind: "local"; bookId: string }
  | { kind: "cloud"; bookId: string; pages: number; title: string; author?: string; previewPages: number; readable: boolean };

/** Set when the reader is opened from a "listen" action, so narration starts by itself. */
export type ReaderIntent = { autoPlay?: boolean };

const MODES: { id: Mode; label: string; Icon: typeof Sparkles }[] = [
  { id: "summary", label: "تلخيص", Icon: Sparkles },
  { id: "analysis", label: "تحليل", Icon: Lightbulb },
  { id: "chat", label: "سؤال", Icon: HelpCircle },
  { id: "quiz", label: "اختبار", Icon: ListChecks },
];

type Fit = "page" | "width";
type Dir = "next" | "prev";

const FLIP_MS = 540;
const SLIDE_MS = 300;
const CHROME_HEIGHT = 330;
const AUTO_HIDE_MS = 4000;

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
  target,
  settings,
  update,
  wide,
  userId,
  watermark,
  onBack,
  onBuy,
}: {
  target: ReaderTarget & ReaderIntent;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  wide: boolean;
  userId: string | null;
  watermark: string;
  onBack: () => void;
  onBuy?: () => void;
}) {
  const localBook = useLiveQuery(
    async () => (target.kind === "local" ? await db.books.get(target.bookId) : undefined),
    [target.kind, target.bookId],
  );

  const meta = useMemo(() => {
    if (target.kind === "cloud") {
      return { id: target.bookId, title: target.title, author: target.author ?? "", pages: target.pages };
    }
    return localBook ? { id: localBook.id, title: localBook.title, author: localBook.author, pages: localBook.pages } : null;
  }, [target, localBook]);

  /** Pages a preview reader may open before paying. */
  const maxPage = target.kind === "cloud" && !target.readable ? Math.max(1, target.previewPages) : (meta?.pages ?? 1);

  const [source, setSource] = useState<PageSource | null>(null);
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
  const [narration, setNarration] = useState<NarrationStatus>({ engine: "none", playing: false, loading: false, page: null, error: "" });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLCanvasElement>(null);
  const faceShadeRef = useRef<HTMLDivElement>(null);
  const underShadeRef = useRef<HTMLDivElement>(null);

  const taskRef = useRef<RenderHandle | null>(null);
  const sourceRef = useRef<PageSource | null>(null);
  const pageRef = useRef(1);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const effectRef = useRef<PageEffect>(settings.pageEffect);
  effectRef.current = settings.pageEffect;

  const narratorRef = useRef<Narrator | null>(null);
  const goToRef = useRef<(p: number, animate?: boolean) => Promise<void>>(async () => {});
  const maxPageRef = useRef(1);
  const playingRef = useRef(false);
  /** True while auto-advance drives the turn, so goTo does not also start playback. */
  const advancingRef = useRef(false);
  const autoAdvanceRef = useRef(settings.ttsAutoAdvance);
  autoAdvanceRef.current = settings.ttsAutoAdvance;
  playingRef.current = narration.playing;

  const cacheRef = useRef(new Map<string, HTMLCanvasElement>());
  const pendingRef = useRef(new Map<string, Promise<HTMLCanvasElement | null>>());

  /* ---------- open ---------- */
  useEffect(() => {
    aliveRef.current = true;
    let built: PageSource | null = null;
    (async () => {
      try {
        built =
          target.kind === "local"
            ? await createLocalSource(target.bookId)
            : await createCloudSource(target.bookId, target.pages, watermark);
        if (!aliveRef.current) {
          built.destroy();
          return;
        }
        sourceRef.current = built;
        setSource(built);

        let start = 1;
        if (target.kind === "local") {
          const b = await db.books.get(target.bookId);
          start = Math.min(Math.max(1, b?.lastPage ?? 1), built.pageCount);
          void db.books.update(target.bookId, { lastOpenedAt: Date.now() });
          if (b && b.textVersion !== TEXT_VERSION) {
            const { ensureTextCurrent, openPdf } = await import("@/lib/pdf");
            void openPdf(b.file)
              .then(async (d) => {
                await ensureTextCurrent(d, b);
                await d.destroy();
              })
              .catch(() => {});
          }
        }
        setPage(start);
        pageRef.current = start;
      } catch (e) {
        if (aliveRef.current) setError(e instanceof Error ? e.message : "تعذر فتح الكتاب");
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    })();
    return () => {
      aliveRef.current = false;
      try {
        taskRef.current?.cancel();
      } catch {
        /* already settled */
      }
      cacheRef.current.clear();
      pendingRef.current.clear();
      sourceRef.current = null;
      built?.destroy();
    };
  }, [target, watermark]);

  /* ---------- open fullscreen after a short glimpse of the controls ---------- */
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

  const keyFor = (p: number, g: Geom) => `${p}|${g.fit}|${g.zoom}|${Math.round(g.availWidth)}x${Math.round(g.availHeight)}`;

  const getPageCanvas = useCallback(async (p: number, g: Geom): Promise<HTMLCanvasElement | null> => {
    const key = keyFor(p, g);
    const hit = cacheRef.current.get(key);
    if (hit) return hit;
    const inflight = pendingRef.current.get(key);
    if (inflight) return inflight;
    const job = (async () => {
      const src = sourceRef.current;
      if (!src || p < 1 || p > src.pageCount) return null;
      const off = document.createElement("canvas");
      const handle = await src.render(p, off, g);
      taskRef.current = handle;
      await handle?.done;
      if (!aliveRef.current || off.width < 2) return null;
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
        if (p + 1 <= maxPage) void getPageCanvas(p + 1, g);
        void getPageCanvas(p - 1, g);
      };
      if ("requestIdleCallback" in window) (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
      else setTimeout(run, 120);
    },
    [getPageCanvas, maxPage],
  );

  /* ---------- repaint on geometry change ---------- */
  useEffect(() => {
    if (!source) return;
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
  }, [source, geometry, getPageCanvas, prefetch, viewportKey]);

  /* ---------- resize: rebind on every mount, the AI panel replaces this pane ---------- */
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

  /* ---------- page turn ---------- */
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

    const anims = [layer.animate(frames, { duration, easing: "cubic-bezier(.36,.06,.24,1)", fill: "forwards" })];
    if (effect === "flip") {
      const timing = { duration, easing: "linear" } as const;
      if (faceShadeRef.current) anims.push(faceShadeRef.current.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }], timing));
      if (underShadeRef.current) {
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

  const persist = useCallback(
    (next: number, delta: number) => {
      if (target.kind === "local") {
        if (delta > 0) void logReading(target.bookId, 0, delta);
        void db.books.update(target.bookId, { lastPage: next });
      } else if (userId) {
        void saveProgress(userId, target.bookId, { last_page: next }).catch(() => {});
      }
    },
    [target, userId],
  );

  const goTo = useCallback(
    async (rawTarget: number, animate = true) => {
      if (busyRef.current || !sourceRef.current) return;
      const current = pageRef.current;
      const next = Math.max(1, Math.min(maxPage, Math.round(rawTarget)));
      if (next === current) return;

      busyRef.current = true;
      try {
        const base = geometry();
        const main = canvasRef.current;
        if (!base || !main) return;
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
          blit(incoming, main);
          await animateTurn("next", outgoing, () => {});
        } else {
          await animateTurn("prev", incoming, () => blit(incoming, main));
        }

        pageRef.current = next;
        setPage(next);
        persist(next, next - current);
        prefetch(next, g);
        if (advancingRef.current) {
          if (next + 1 <= maxPageRef.current) narratorRef.current?.prefetch(next + 1);
        }
        else if (playingRef.current) void narratorRef.current?.play(next);
        else narratorRef.current?.prefetch(next);
      } finally {
        busyRef.current = false;
      }
    },
    [animateTurn, geometry, getPageCanvas, maxPage, persist, prefetch, zoom],
  );

  goToRef.current = goTo;

  useEffect(() => {
    if (!source) return;
    const n = createNarrator(target.kind, target.bookId, {
      getText: (from, to) => (sourceRef.current ? sourceRef.current.getText(from, to) : Promise.resolve([])),
      onStatus: (patch) => setNarration((prev) => ({ ...prev, ...patch })),
      onPageEnd: (finished) => {
        if (!autoAdvanceRef.current) return;
        const next = finished + 1;
        if (next > maxPageRef.current) return;
        advancingRef.current = true;
        void goToRef.current(next)
          .then(() => narratorRef.current?.play(next))
          .finally(() => {
            advancingRef.current = false;
          });
      },
    });
    narratorRef.current = n;
    setNarration((prev) => ({ ...prev, engine: n.engine }));
    return () => {
      n.destroy();
      narratorRef.current = null;
      setNarration({ engine: "none", playing: false, loading: false, page: null, error: "" });
    };
  }, [source, target]);

  useEffect(() => {
    if (!target.autoPlay || !source || !narratorRef.current) return;
    const t = setTimeout(() => void narratorRef.current?.play(pageRef.current), 400);
    return () => clearTimeout(t);
  }, [target.autoPlay, source, narration.engine]);

  // Keep the screen on only while it is actually reading aloud.
  useEffect(() => {
    void setScreenAwake(narration.playing);
    return () => {
      void setScreenAwake(false);
    };
  }, [narration.playing]);

  const toggleNarration = useCallback(() => {
    const n = narratorRef.current;
    if (!n) return;
    if (narration.playing) n.pause();
    else void n.play(pageRef.current);
  }, [narration.playing]);

  useEffect(() => {
    if (target.kind !== "local") return;
    const TICK = 15;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void logReading(target.bookId, TICK);
    }, TICK * 1000);
    return () => clearInterval(t);
  }, [target]);

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

  const getText = useMemo(
    () => (from: number, to: number) => (sourceRef.current ? sourceRef.current.getText(from, to) : Promise.resolve([])),
    [],
  );

  if (!meta) {
    return (
      <div className="flex h-full items-center justify-center bg-ink text-cream">
        <p className="text-sm text-cream/60">{localBook === undefined ? "جارٍ التحميل…" : "الكتاب غير موجود"}</p>
      </div>
    );
  }

  maxPageRef.current = maxPage;
  const progress = maxPage > 1 ? (page - 1) / (maxPage - 1) : 1;
  const showChrome = chrome || wide;
  const atPreviewEnd = target.kind === "cloud" && !target.readable && page >= maxPage;

  const readerPane = (
    <div className="relative h-full min-h-0 overflow-hidden bg-ink text-cream">
      <div
        ref={setHolder}
        className="absolute inset-x-0 overflow-auto no-scrollbar"
        style={{ top: showChrome ? "calc(var(--safe-top) + 58px)" : 0, bottom: showChrome ? CHROME_HEIGHT : 0 }}
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
            <div
              ref={underShadeRef}
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{ opacity: 0, transformOrigin: "left center", transform: "scaleX(0)", background: "linear-gradient(to left, rgba(0,0,0,.55), rgba(0,0,0,0) 32%)" }}
            />
            <div
              ref={flipRef}
              className="pointer-events-none absolute end-0 top-0"
              style={{ display: "none", transformStyle: "preserve-3d", transformOrigin: "right center", willChange: "transform", filter: "drop-shadow(-6px 4px 12px rgba(0,0,0,.45))" }}
            >
              <canvas ref={faceRef} className="absolute inset-0 h-full w-full rounded-lg bg-white" style={{ backfaceVisibility: "hidden" }} />
              <div ref={faceShadeRef} className="absolute inset-0 rounded-lg" style={{ opacity: 0, backfaceVisibility: "hidden", background: "linear-gradient(to left, rgba(0,0,0,.65), rgba(0,0,0,0) 55%)" }} />
              <div className="absolute inset-0 rounded-lg" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", background: "linear-gradient(to right, #faf7f1 0%, #ece5d9 55%, #d9d0c2 100%)" }} />
            </div>
          </div>
        </div>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/60">جارٍ فتح الكتاب…</div>}
        {error && <div className="absolute inset-x-6 top-1/2 rounded-2xl bg-red-100 p-4 text-center text-xs text-red-800">{error}</div>}
      </div>

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
          <p className="truncate text-sm font-semibold">{meta.title}</p>
          <p className="text-[11px] text-cream/50">
            {target.kind === "cloud" && !target.readable ? `معاينة · ${maxPage} صفحات` : fit === "page" ? "الصفحة كاملة" : "ملء العرض"}
            {zoom > 1 && ` · تكبير ${Math.round(zoom * 100)}%`}
          </p>
        </div>
        <IconButton
          tone={narration.playing ? "accent" : "ghost"}
          onClick={toggleNarration}
          aria-label={narration.playing ? "إيقاف الاستماع" : "استمع للكتاب"}
        >
          <Headphones size={18} />
        </IconButton>
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
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => { setFit("page"); setZoom(1); }}>عرض الصفحة كاملة</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => { setFit("width"); setZoom(1); }}>ملء عرض الشاشة</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}>تكبير +</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}>تصغير −</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => void goTo(1, false)}>الذهاب للبداية</button>
              <button className="w-full px-4 py-3 text-start text-sm hover:bg-black/5" onClick={() => void goTo(maxPage, false)}>الذهاب للنهاية</button>
            </div>
          )}
        </div>
      </header>

      {!showChrome && (
        <button onClick={() => setChrome(true)} className="absolute end-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-cream/80 backdrop-blur" style={{ top: "calc(var(--safe-top) + 10px)" }} aria-label="إظهار الأدوات">
          <MoreHorizontal size={18} />
        </button>
      )}

      {!showChrome && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center gap-3 text-[11px] text-cream/40" style={{ bottom: "calc(var(--safe-bottom) + 8px)" }}>
          {narration.engine !== "none" && (
            <button
              onClick={toggleNarration}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-cream/80 backdrop-blur"
              aria-label={narration.playing ? "إيقاف الاستماع" : "استمع"}
            >
              {narration.playing ? <Pause size={15} /> : <Play size={15} className="-scale-x-100" />}
            </button>
          )}
          <span>
            {page} من {maxPage}
          </span>
        </div>
      )}

      {atPreviewEnd && (
        <div className="absolute inset-x-5 bottom-0 z-20 mb-2 rounded-3xl bg-cream p-4 text-ink shadow-lift" style={{ marginBottom: showChrome ? CHROME_HEIGHT + 8 : 24 }}>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lock size={14} className="text-accent" /> انتهت المعاينة المجانية
          </p>
          <p className="mt-1 text-xs leading-6 text-ink-muted">اشترِ هذا الكتاب أو اشترك شهريًا لتقرأه كاملًا.</p>
          {onBuy && (
            <button onClick={onBuy} className="mt-3 h-11 w-full rounded-full bg-accent text-sm font-semibold text-white">
              خيارات الشراء والاشتراك
            </button>
          )}
        </div>
      )}

      <div className={cn("absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink to-transparent pt-3 transition-transform duration-300", showChrome ? "translate-y-0" : "translate-y-full")}>
        {!wide && (
          <div className="mb-1 flex items-center justify-end gap-2 px-6">
            <span className="text-xs text-cream/60">لوحة الذكاء الاصطناعي</span>
            <Toggle checked={aiOpen} onChange={setAiOpen} label="فتح لوحة الذكاء الاصطناعي" />
          </div>
        )}

        <Gauge value={progress} size={190} startLabel="1" endLabel={String(maxPage)}>
          <div className="flex items-center gap-3">
            <IconButton tone="light" size="sm" onClick={() => void goTo(page - 1)} disabled={page <= 1} aria-label="الصفحة السابقة">
              <Minus size={16} />
            </IconButton>
            <div className="text-center">
              <p className="text-[10px] text-cream/60">الصفحة</p>
              <p className="text-3xl font-bold leading-none tabular-nums">{page}</p>
              <p className="mt-0.5 text-[10px] text-cream/50">من {maxPage}</p>
            </div>
            <IconButton tone="accent" size="sm" onClick={() => void goTo(page + 1)} disabled={page >= maxPage} aria-label="الصفحة التالية">
              <Plus size={16} />
            </IconButton>
          </div>
        </Gauge>

        <div className="px-6 pb-1">
          <input type="range" min={1} max={maxPage} value={page} onChange={(e) => void goTo(+e.target.value, false)} aria-label="الانتقال إلى صفحة" className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-cream/20 accent-[#ee7a4b]" />
        </div>

        {(
          <div className="mx-4 mb-2 mt-1 flex items-center gap-3 rounded-3xl bg-white/10 px-3 py-2">
            <button
              onClick={narration.error.includes("اضغط لتثبيته") ? () => void openVoiceInstall() : toggleNarration}
              disabled={narration.loading || narration.engine === "none"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95",
                narration.playing ? "bg-cream text-ink" : "bg-accent text-white",
                narration.loading && "opacity-60",
              )}
              aria-label={narration.playing ? "إيقاف الاستماع" : "استمع للصفحة"}
            >
              {narration.playing ? <Pause size={18} /> : <Play size={18} className="-scale-x-100" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Headphones size={13} className="text-accent" />
                {narration.loading ? "جارٍ تحضير الصوت…" : narration.playing ? `يقرأ الصفحة ${narration.page ?? page}` : "استماع للكتاب"}
              </p>
              <p className="truncate text-[10px] text-cream/50">
                {narration.error
                  ? narration.error
                  : narration.engine === "cloud"
                    ? "صوت عربي طبيعي · يتابع الصفحة التالية تلقائيًا"
                    : narration.engine === "none"
                      ? "القراءة الصوتية غير مدعومة على هذا الجهاز"
                      : "صوت الجهاز · يتابع الصفحة التالية تلقائيًا"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {narration.engine !== "none" && [1, 1.25, 1.5].map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    update({ ttsRate: r });
                    narratorRef.current?.setRate(r);
                  }}
                  className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", settings.ttsRate === r ? "bg-accent text-white" : "bg-white/10 text-cream/70")}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        )}

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

  const aiPane = (
    <AIPanel
      book={meta}
      getText={getText}
      page={page}
      mode={mode}
      setMode={setMode}
      settings={settings}
      textStale={target.kind === "local" && localBook?.textVersion !== TEXT_VERSION}
      onClose={wide ? undefined : () => setAiOpen(false)}
    />
  );

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
