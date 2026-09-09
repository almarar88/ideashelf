import type { Locale } from "@/lib/i18n";

export const CURRENCIES: Record<string, { symbol: string; rate: number; code: string }> = {
  USD: { symbol: "$", rate: 1, code: "USD" },
  SAR: { symbol: "﷼", rate: 3.75, code: "SAR" },
  AED: { symbol: "د.إ", rate: 3.67, code: "AED" },
  EUR: { symbol: "€", rate: 0.92, code: "EUR" },
  EGP: { symbol: "ج.م", rate: 48.5, code: "EGP" },
  TRY: { symbol: "₺", rate: 34.2, code: "TRY" },
};

/**
 * Live rates, once the backend has supplied them. The table above is only a
 * last resort: pegged currencies barely move, but a hard-coded TRY or EGP rate
 * goes badly stale within months and quietly misprices every screen.
 */
let liveRates: Record<string, number> | null = null;

export function setLiveRates(rates: Record<string, number> | null) {
  liveRates = rates;
}

export const ratesAreLive = () => liveRates !== null;

/** USD amount converted with the best rate available, then formatted. */
export function money(usd: number, currency = "USD", opts?: { decimals?: number }) {
  const c = CURRENCIES[currency] ?? CURRENCIES.USD;
  const rate = liveRates?.[c.code] ?? c.rate;
  const value = usd * rate;
  const decimals = opts?.decimals ?? (value < 20 ? 2 : 0);
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${c.symbol} ${formatted}`;
}

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDate(iso: string, locale: Locale, style: "long" | "short" = "long") {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  const months = locale === "ar" ? AR_MONTHS : EN_MONTHS;
  // Arabic month names are not abbreviated by truncation — "يونيو" clipped to
  // three letters is not a word — so only English gets the short form.
  const month =
    style === "short" && locale === "en" ? months[d.getMonth()].slice(0, 3) : months[d.getMonth()];
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

export function weekday(iso: string, locale: Locale) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return (locale === "ar" ? AR_DAYS : EN_DAYS)[d.getDay()];
}

/** 24-hour clock, matching the reference design's schedule cards. */
export function clock(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function duration(minutes: number, locale: Locale) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === "ar") {
    if (h && m) return `${h}س ${m}د`;
    return h ? `${h}س` : `${m}د`;
  }
  if (h && m) return `${h}hr ${m}min`;
  return h ? `${h}hr` : `${m}min`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(aISO: string, bISO: string) {
  const a = new Date(`${aISO}T00:00:00`).getTime();
  const b = new Date(`${bISO}T00:00:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

/**
 * Wraps a value in Unicode isolate marks. In an RTL paragraph a neutral
 * character such as "·" sitting between Arabic text and a number gets pulled
 * to the wrong side — "بالي · 5 ليالٍ" renders as "بالي ٥٠ ليالٍ". Isolating
 * the number fixes the run without forcing direction on the whole line.
 */
export const iso = (value: string | number) => `\u2066${value}\u2069`;
