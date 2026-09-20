import { requireSupabase, supabase } from "./supabase";
import { loadSettings } from "./settings";

export interface Voice {
  id: string;
  name: string;
  labels: Record<string, string>;
}

/** Where a page's audio comes from. */
export type NarrationEngine = "cloud" | "device" | "none";

export interface NarrationStatus {
  engine: NarrationEngine;
  playing: boolean;
  loading: boolean;
  page: number | null;
  error: string;
}

export interface Narrator {
  readonly engine: NarrationEngine;
  play(page: number): Promise<void>;
  pause(): void;
  stop(): void;
  setRate(rate: number): void;
  /** Warms the next page so playback continues without a gap. */
  prefetch(page: number): void;
  destroy(): void;
}

export interface NarratorOptions {
  getText: (from: number, to: number) => Promise<{ page: number; text: string }[]>;
  onStatus: (patch: Partial<NarrationStatus>) => void;
  /** Called when a page finishes, so the reader can turn to the next one. */
  onPageEnd: (page: number) => void;
}

/* ------------------------------------------------------------------ */
/* Cloud: ElevenLabs through the narrate function                      */
/* ------------------------------------------------------------------ */

async function cloudUrl(bookId: string, page: number, voiceId: string, modelId: string): Promise<string> {
  const { data, error } = await requireSupabase().functions.invoke("narrate", {
    body: { bookId, page, voiceId: voiceId || undefined, modelId: modelId || undefined },
  });
  if (error) {
    // The function replies with a readable Arabic reason; surface it instead of "non-2xx".
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(String(body.error));
    }
    throw new Error(error.message ?? "تعذر توليد الصوت");
  }
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error("لم يصل رابط الصوت");
  return url;
}

export async function listVoices(): Promise<Voice[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.functions.invoke("voices");
  if (error) return [];
  return ((data as { voices?: Voice[] } | null)?.voices ?? []) as Voice[];
}

function createCloudNarrator(bookId: string, opts: NarratorOptions): Narrator {
  const audio = new Audio();
  audio.preload = "auto";
  const urls = new Map<number, string>();
  const pending = new Map<number, Promise<string>>();
  let current: number | null = null;
  let destroyed = false;

  const settings = () => loadSettings();

  function urlFor(page: number): Promise<string> {
    const hit = urls.get(page);
    if (hit) return Promise.resolve(hit);
    // Dedupe: a page turn and a prefetch can ask for the same page at once, and each
    // generation request costs money and a round trip.
    const inflight = pending.get(page);
    if (inflight) return inflight;
    const s = settings();
    const job = cloudUrl(bookId, page, s.ttsVoiceId, s.ttsModelId)
      .then((url) => {
        if (urls.size > 6) urls.delete(urls.keys().next().value as number);
        urls.set(page, url);
        return url;
      })
      .finally(() => pending.delete(page));
    pending.set(page, job);
    return job;
  }

  audio.addEventListener("ended", () => {
    if (destroyed || current == null) return;
    opts.onStatus({ playing: false });
    opts.onPageEnd(current);
  });
  audio.addEventListener("playing", () => opts.onStatus({ playing: true, loading: false, error: "" }));
  audio.addEventListener("pause", () => opts.onStatus({ playing: false }));
  audio.addEventListener("waiting", () => opts.onStatus({ loading: true }));

  return {
    engine: "cloud",
    async play(page) {
      if (destroyed) return;
      // Already on this page and running — a second call would restart it.
      if (current === page && !audio.paused && !audio.ended) return;
      opts.onStatus({ loading: true, error: "", page });
      try {
        const url = await urlFor(page);
        if (destroyed) return;
        if (audio.src !== url) {
          audio.src = url;
          audio.load();
        }
        audio.playbackRate = settings().ttsRate;
        current = page;
        await audio.play();
      } catch (e) {
        opts.onStatus({ loading: false, playing: false, error: e instanceof Error ? e.message : "تعذر تشغيل الصوت" });
      }
    },
    pause() {
      audio.pause();
    },
    stop() {
      audio.pause();
      audio.removeAttribute("src");
      current = null;
      opts.onStatus({ playing: false, loading: false, page: null });
    },
    setRate(rate) {
      audio.playbackRate = rate;
    },
    prefetch(page) {
      void urlFor(page).catch(() => {});
    },
    destroy() {
      destroyed = true;
      audio.pause();
      audio.removeAttribute("src");
      urls.clear();
      pending.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Device: the phone's own Arabic voice. Free, works offline, and the  */
/* only option for books the reader imported themselves.               */
/* ------------------------------------------------------------------ */

export function deviceVoicesAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickArabicVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang?.toLowerCase().startsWith("ar")) ?? null;
}

/** Long text is split so engines with per-utterance caps do not truncate it. */
function chunk(text: string, max = 220): string[] {
  const out: string[] = [];
  let buf = "";
  for (const part of text.split(/(?<=[.!?؟।\n])\s+/)) {
    if (buf.length + part.length > max && buf) {
      out.push(buf.trim());
      buf = "";
    }
    buf += part + " ";
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

function createDeviceNarrator(opts: NarratorOptions): Narrator {
  let destroyed = false;
  let current: number | null = null;
  let queue: string[] = [];
  let index = 0;

  function speakNext() {
    if (destroyed || index >= queue.length) {
      if (!destroyed && current != null) {
        opts.onStatus({ playing: false });
        opts.onPageEnd(current);
      }
      return;
    }
    const u = new SpeechSynthesisUtterance(queue[index]);
    const voice = pickArabicVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "ar-SA";
    u.rate = loadSettings().ttsRate;
    u.onend = () => {
      index += 1;
      speakNext();
    };
    u.onerror = () => opts.onStatus({ playing: false, loading: false, error: "تعذر تشغيل صوت الجهاز" });
    window.speechSynthesis.speak(u);
  }

  return {
    engine: "device",
    async play(page) {
      if (destroyed) return;
      opts.onStatus({ loading: true, error: "", page });
      window.speechSynthesis.cancel();
      const rows = await opts.getText(page, page);
      const text = rows.map((r) => r.text).join("\n").trim();
      if (!text) {
        opts.onStatus({ loading: false, error: "لا يوجد نص في هذه الصفحة" });
        return;
      }
      if (!pickArabicVoice()) {
        opts.onStatus({ loading: false, error: "لا يوجد صوت عربي مثبّت على هذا الجهاز. ثبّت حزمة النطق العربية من إعدادات النظام." });
        return;
      }
      queue = chunk(text);
      index = 0;
      current = page;
      opts.onStatus({ loading: false, playing: true });
      speakNext();
    },
    pause() {
      window.speechSynthesis.pause();
      opts.onStatus({ playing: false });
    },
    stop() {
      window.speechSynthesis.cancel();
      current = null;
      queue = [];
      opts.onStatus({ playing: false, loading: false, page: null });
    },
    setRate() {
      /* applied to the next utterance; changing mid-sentence is not supported */
    },
    prefetch() {
      /* nothing to fetch — synthesis is local */
    },
    destroy() {
      destroyed = true;
      window.speechSynthesis.cancel();
    },
  };
}

/* ------------------------------------------------------------------ */

export function createNarrator(kind: "local" | "cloud", bookId: string, opts: NarratorOptions): Narrator {
  if (kind === "cloud" && supabase) return createCloudNarrator(bookId, opts);
  if (deviceVoicesAvailable()) return createDeviceNarrator(opts);
  return {
    engine: "none",
    async play() {
      opts.onStatus({ error: "القراءة الصوتية غير مدعومة على هذا الجهاز" });
    },
    pause() {},
    stop() {},
    setRate() {},
    prefetch() {},
    destroy() {},
  };
}
