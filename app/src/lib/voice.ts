// Voice input: native speech recognition on phones, Web Speech API in browsers when present.
import { Capacitor } from "@capacitor/core";

type WebRecognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void };
const webCtor = () => (window as unknown as { webkitSpeechRecognition?: new () => WebRecognition; SpeechRecognition?: new () => WebRecognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => WebRecognition }).webkitSpeechRecognition;

export async function voiceAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try { const { SpeechRecognition } = await import("@capacitor-community/speech-recognition"); return (await SpeechRecognition.available()).available; } catch { return false; }
  }
  return Boolean(webCtor());
}

/** Listens once and resolves with the transcript ("" if nothing). onPartial gets live text. */
export async function listenOnce(lang: "ar" | "en", onPartial?: (t: string) => void): Promise<string> {
  const locale = lang === "ar" ? "ar-AE" : "en-US";
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== "granted") throw new Error("mic permission denied");
    // With partialResults the native start() resolves immediately; the transcript arrives through the
    // partialResults events and the session ends with listeningState "stopped" (silence or stop()).
    // Android fires "stopped" (end of speech) BEFORE the final results arrive, so wait a short grace
    // period after it. Recognizer errors (silence timeout etc.) reach JS only through inactivity, so an
    // inactivity timer ends the session too: 8s with nothing heard, 4s after the last words.
    let last = ""; let done = false;
    let finish: (v: string) => void = () => undefined;
    const result = new Promise<string>((resolve) => { finish = (v) => { if (!done) { done = true; resolve(v); } }; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const endSoon = (ms: number, stopEngine: boolean) => { clearTimeout(timer); timer = setTimeout(() => { if (stopEngine) void SpeechRecognition.stop().catch(() => undefined); finish(last); }, ms); };
    const subs = await Promise.all([
      SpeechRecognition.addListener("partialResults", (d: { matches?: string[] }) => { if (d.matches?.[0]) { last = d.matches[0]; onPartial?.(last); endSoon(4000, true); } }),
      SpeechRecognition.addListener("listeningState", (d: { status: "started" | "stopped" }) => { if (d.status === "stopped") endSoon(1200, false); }),
    ]);
    endSoon(8000, true);
    try {
      const r = await SpeechRecognition.start({ language: locale, maxResults: 1, partialResults: true, popup: false });
      const direct = (r as { matches?: string[] } | undefined)?.matches?.[0];
      if (direct) return direct;
      return await result;
    } finally { clearTimeout(timer); subs.forEach((s) => s.remove()); }
  }
  const Ctor = webCtor();
  if (!Ctor) throw new Error("speech recognition unavailable");
  return new Promise((resolve, reject) => {
    const rec = new Ctor(); rec.lang = locale; rec.interimResults = true; rec.continuous = false;
    let text = "";
    rec.onresult = (e) => { text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" "); onPartial?.(text); };
    rec.onend = () => resolve(text.trim());
    rec.onerror = () => reject(new Error("speech error"));
    rec.start();
  });
}

// ---------------------------------------------------------------------------------------------
// Text-to-speech. Native engine on phones (@capacitor-community/text-to-speech: Google TTS on Android,
// AVSpeech on iOS), Web Speech API on desktop/browser. Each agent gets its own voice profile.
// ---------------------------------------------------------------------------------------------
export interface VoiceProfile { pitch: number; rate: number; voice?: number; }
const NATIVE = Capacitor.isNativePlatform();
async function tts() { try { return (await import("@capacitor-community/text-to-speech")).TextToSpeech; } catch { return null; } }
const webSynth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);
export const canSpeak = () => NATIVE || Boolean(webSynth());
const localeOf = (lang: "ar" | "en") => (lang === "ar" ? "ar-AE" : "en-US");

/** Strip markdown / links / emoji so the engine reads clean prose. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*#`_>|~]/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

let voiceCache: { lang: string; ids: number[] } | null = null;
/** Indexes (into the engine's voice list) of the voices that speak `lang`; [] when unknown. */
export async function voiceIndexes(lang: "ar" | "en"): Promise<number[]> {
  if (voiceCache?.lang === lang) return voiceCache.ids;
  let ids: number[] = [];
  try {
    if (NATIVE) { const T = await tts(); const { voices } = await T!.getSupportedVoices(); ids = voices.map((v, i) => (v.lang.toLowerCase().startsWith(lang) ? i : -1)).filter((i) => i >= 0); }
    else { const s = webSynth(); ids = (s?.getVoices() ?? []).map((v, i) => (v.lang.toLowerCase().startsWith(lang) ? i : -1)).filter((i) => i >= 0); }
  } catch { ids = []; }
  voiceCache = { lang, ids };
  return ids;
}

/** Deterministic, distinct-sounding profile per speaker (pitch/rate from the avatar + humor, a different engine voice when available). */
export function voiceProfileFor(seed: number, humor: number, judge = false, voices: number[] = []): VoiceProfile {
  if (judge) return { pitch: 0.9, rate: 0.95, voice: voices.length ? voices[0] : undefined };
  const pitch = 0.85 + ((seed * 7 + Math.round(humor / 10)) % 9) * 0.05;   // 0.85 … 1.25
  const rate = 0.95 + Math.round(humor / 25) * 0.05;                       // 0.95 … 1.15
  return { pitch: Number(pitch.toFixed(2)), rate: Number(rate.toFixed(2)), voice: voices.length ? voices[(seed + 1) % voices.length] : undefined };
}

/** Speaks and resolves when the utterance has finished (or was cancelled). */
export async function speakAsync(text: string, lang: "ar" | "en", p: VoiceProfile = { pitch: 1, rate: 1 }): Promise<void> {
  const clean = cleanForSpeech(text).slice(0, 2000);
  if (!clean) return;
  if (NATIVE) {
    const T = await tts(); if (!T) return;
    await T.speak({ text: clean, lang: localeOf(lang), rate: p.rate, pitch: p.pitch, volume: 1, ...(p.voice !== undefined ? { voice: p.voice } : {}), category: "playback" }).catch(() => undefined);
    return;
  }
  const s = webSynth(); if (!s) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = localeOf(lang); u.rate = p.rate; u.pitch = p.pitch;
    const voices = s.getVoices(); if (p.voice !== undefined && voices[p.voice]) u.voice = voices[p.voice];
    u.onend = () => resolve(); u.onerror = () => resolve();
    s.speak(u);
  });
}

export function stopSpeaking(): void {
  if (NATIVE) { tts().then((T) => T?.stop()).catch(() => undefined); }
  webSynth()?.cancel();
}

/** Fire-and-forget read-aloud (used by the "read replies aloud" setting). */
export function speakText(text: string, lang: "ar" | "en", p?: VoiceProfile): void { stopSpeaking(); void speakAsync(text, lang, p); }

/** Sequential speech queue for a voice call: chunks are spoken in order, one speaker at a time. */
export class Speaker {
  private q: { text: string; lang: "ar" | "en"; p: VoiceProfile; tag: string }[] = [];
  private busy = false;
  private gen = 0;
  onStart: (tag: string) => void = () => undefined;
  onIdle: () => void = () => undefined;
  get speaking() { return this.busy; }
  get pending() { return this.q.length; }
  enqueue(text: string, lang: "ar" | "en", p: VoiceProfile, tag: string) {
    if (!cleanForSpeech(text)) return;
    this.q.push({ text, lang, p, tag });
    if (!this.busy) void this.run();
  }
  private async run() {
    this.busy = true; const g = this.gen;
    while (this.q.length && g === this.gen) {
      const it = this.q.shift()!;
      this.onStart(it.tag);
      await speakAsync(it.text, it.lang, it.p);
    }
    if (g === this.gen) { this.busy = false; this.onIdle(); }
  }
  stop() { this.gen++; this.q = []; this.busy = false; stopSpeaking(); }
}

export async function stopListening(): Promise<void> {
  if (Capacitor.isNativePlatform()) { try { const { SpeechRecognition } = await import("@capacitor-community/speech-recognition"); await SpeechRecognition.stop(); } catch { /* ignore */ } }
}
