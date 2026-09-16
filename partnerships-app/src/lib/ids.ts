export const uid = (): string =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const SYMBOLS: Record<string, { ar: string; en: string }> = {
  AED: { ar: "د.إ", en: "AED" }, SAR: { ar: "ر.س", en: "SAR" }, USD: { ar: "$", en: "$" }, EUR: { ar: "€", en: "€" }, KWD: { ar: "د.ك", en: "KWD" }, QAR: { ar: "ر.ق", en: "QAR" }, BHD: { ar: "د.ب", en: "BHD" }, OMR: { ar: "ر.ع", en: "OMR" }, EGP: { ar: "ج.م", en: "EGP" }, GBP: { ar: "£", en: "£" },
};
let currentLang: "ar" | "en" = "ar";
export const setFormatLang = (l: "ar" | "en") => { currentLang = l; };
export const currencySymbol = (code = "AED"): string => SYMBOLS[code]?.[currentLang] ?? code;

export const fmtMoney = (n: number, currency = "AED"): string => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? (abs / 1_000_000).toFixed(1) + (currentLang === "ar" ? " م" : "M") : abs >= 1000 ? (abs / 1000).toFixed(0) + (currentLang === "ar" ? " ألف" : "K") : abs.toFixed(0);
  return `${n < 0 ? "-" : ""}${s} ${currencySymbol(currency)}`;
};

export const fmtMoneyFull = (n: number, currency = "AED"): string => `${Math.round(n).toLocaleString("en-US")} ${currencySymbol(currency)}`;

/** Human-readable date, e.g. "16 سبتمبر 2026" / "16 Sep 2026". */
export const fmtDate = (iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(currentLang === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short", ...(opts.year === false ? {} : { year: "numeric" }), ...(opts.weekday ? { weekday: "long" } : {}) }).format(d);
};

export const fmtMonthYear = (iso: string): string => new Intl.DateTimeFormat(currentLang === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00"));
export const weekdayName = (iso: string, short = false): string => new Intl.DateTimeFormat(currentLang === "ar" ? "ar-AE" : "en-GB", { weekday: short ? "short" : "long" }).format(new Date(iso + "T00:00:00"));

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
