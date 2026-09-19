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
    let last = "";
    const sub = await SpeechRecognition.addListener("partialResults", (d: { matches?: string[] }) => { if (d.matches?.[0]) { last = d.matches[0]; onPartial?.(last); } });
    try {
      const r = await SpeechRecognition.start({ language: locale, maxResults: 1, partialResults: true, popup: false });
      return (r as { matches?: string[] }).matches?.[0] ?? last;
    } finally { sub.remove(); }
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

export async function stopListening(): Promise<void> {
  if (Capacitor.isNativePlatform()) { try { const { SpeechRecognition } = await import("@capacitor-community/speech-recognition"); await SpeechRecognition.stop(); } catch { /* ignore */ } }
}
