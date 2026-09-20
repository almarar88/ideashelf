import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { requireSupabase, supabase } from "./supabase";
import { loadSettings } from "./settings";

export interface Voice {
  id: string;
  name: string;
  labels: Record<string, string>;
}

/** Where a page's audio comes from. */
export type NarrationEngine = "cloud" | "native" | "device" | "none";

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

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Hands-free listening only works if the screen stays on: Android suspends the WebView's
 * JavaScript when the device sleeps, which stops the chunk-to-chunk chaining and the page
 * turns. Held while narrating, released the moment it stops.
 */
export async function setScreenAwake(on: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch {
    /* plugin unavailable on this platform */
  }
}

export function deviceVoicesAvailable(): boolean {
  return isNative() || (typeof window !== "undefined" && "speechSynthesis" in window);
}

/** Android's own speech engine. The WebView does not expose the Web Speech API, so the
 *  browser path silently does nothing inside the app — this is the one that works. */
export async function nativeArabicAvailable(): Promise<boolean> {
  try {
    const { supported } = await TextToSpeech.isLanguageSupported({ lang: "ar" });
    if (supported) return true;
  } catch {
    /* fall through to the full list */
  }
  try {
    const { languages } = await TextToSpeech.getSupportedLanguages();
    return languages.some((l) => l.toLowerCase().startsWith("ar"));
  } catch {
    return false;
  }
}

/** Opens Android's "install voice data" screen so the reader can add the Arabic voice. */
export async function openVoiceInstall(): Promise<void> {
  try {
    await TextToSpeech.openInstall();
  } catch {
    /* not available on this platform */
  }
}

function createNativeNarrator(opts: NarratorOptions): Narrator {
  let destroyed = false;
  let current: number | null = null;
  let generation = 0;

  return {
    engine: "native",
    async play(page) {
      if (destroyed) return;
      const run = ++generation;
      opts.onStatus({ loading: true, error: "", page });
      await TextToSpeech.stop().catch(() => {});
      const rows = await opts.getText(page, page);
      const text = rows.map((r) => r.text).join("\n").trim();
      if (!text) {
        opts.onStatus({ loading: false, error: "لا يوجد نص في هذه الصفحة" });
        return;
      }
      if (!(await nativeArabicAvailable())) {
        opts.onStatus({ loading: false, error: "لا يوجد صوت عربي على الجهاز. اضغط لتثبيته." });
        return;
      }
      current = page;
      opts.onStatus({ loading: false, playing: true });
      // speak() resolves when a chunk finishes, so chunking also gives us pause points.
      for (const part of chunk(text, 400)) {
        if (destroyed || run !== generation) return;
        try {
          await TextToSpeech.speak({ text: part, lang: "ar", rate: loadSettings().ttsRate, category: "playback" });
        } catch {
          if (run === generation) opts.onStatus({ playing: false, error: "توقف النطق" });
          return;
        }
      }
      if (destroyed || run !== generation) return;
      opts.onStatus({ playing: false });
      if (current != null) opts.onPageEnd(current);
    },
    pause() {
      generation += 1;
      void TextToSpeech.stop().catch(() => {});
      opts.onStatus({ playing: false });
    },
    stop() {
      generation += 1;
      void TextToSpeech.stop().catch(() => {});
      current = null;
      opts.onStatus({ playing: false, loading: false, page: null });
    },
    setRate() {
      /* applied to the next chunk */
    },
    prefetch() {
      /* synthesis is local */
    },
    destroy() {
      destroyed = true;
      generation += 1;
      void TextToSpeech.stop().catch(() => {});
    },
  };
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
  if (isNative()) return createNativeNarrator(opts);
  if (typeof window !== "undefined" && "speechSynthesis" in window) return createDeviceNarrator(opts);
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
