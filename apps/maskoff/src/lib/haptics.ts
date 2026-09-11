/**
 * Haptics + micro-audio. Both are best-effort: Android Chrome supports
 * navigator.vibrate, iOS Safari does not, and autoplay policy means audio only
 * works after the first user gesture. Nothing here is allowed to throw.
 */

type Pattern = "tap" | "select" | "lock" | "reveal" | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: [12, 26, 12],
  lock: [18, 40, 18, 40, 34],
  reveal: [40, 60, 40, 60, 120],
  error: [60, 50, 60],
};

export function haptic(pattern: Pattern): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    /* vibration is a nicety, never a failure path */
  }
}

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Short synthesized blip — no audio assets to ship or fail to load. */
export function blip(frequency: number, durationMs = 90, gain = 0.05): void {
  const context = audioContext();
  if (!context) return;
  try {
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain, context.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
    osc.connect(amp).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + durationMs / 1000);
  } catch {
    /* ignore */
  }
}

export function sfx(kind: "select" | "lock" | "reveal" | "tick"): void {
  switch (kind) {
    case "select":
      blip(520, 70);
      break;
    case "lock":
      blip(360, 110);
      setTimeout(() => blip(540, 130), 90);
      break;
    case "reveal":
      blip(300, 140, 0.06);
      setTimeout(() => blip(450, 140, 0.06), 120);
      setTimeout(() => blip(680, 220, 0.07), 250);
      break;
    case "tick":
      blip(880, 35, 0.025);
      break;
  }
}
