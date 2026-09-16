export type ModelId = "claude-opus-5" | "claude-sonnet-5" | "claude-haiku-4-5";
export type Effort = "low" | "medium" | "high";
export type Lang = "ar" | "en";

export interface Settings {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  userName: string;
  lang: Lang;
  theme: "system" | "light" | "dark";
  catalogUrl: string;
}

const KEY = "dcl.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-opus-5",
  effort: "medium",
  userName: "",
  lang: "ar",
  theme: "system",
  catalogUrl: "./catalog.json",
};

export const MODELS: { id: ModelId; label: string; hint: string }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", hint: "الأعلى جودة للتحليل العميق" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "توازن بين السرعة والجودة" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "الأسرع والأرخص" },
];

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — keep in memory only */
  }
}
