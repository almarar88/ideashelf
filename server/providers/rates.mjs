import { getJson } from "../lib/http.mjs";

/**
 * Live exchange rates, no key required. The app prices everything in USD and
 * converts on display, so a stale table quietly misprices every screen — this
 * is refreshed daily and falls back to a fixed table only if the call fails.
 */

const FALLBACK = { USD: 1, SAR: 3.75, AED: 3.6725, EUR: 0.92, EGP: 48.5, TRY: 34.2, GBP: 0.79 };

export async function fetchRates(base = "USD") {
  try {
    const data = await getJson(`https://open.er-api.com/v6/latest/${base}`, { timeoutMs: 8000 });
    if (data?.result !== "success" || !data?.rates) throw new Error("unexpected payload");
    return {
      base,
      rates: data.rates,
      updatedISO: new Date((data.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString(),
      source: "open.er-api.com",
      live: true,
    };
  } catch {
    // Pegged currencies barely move, so the fallback is usable — but it is
    // labelled so the UI can say the rates are not live.
    return { base, rates: FALLBACK, updatedISO: null, source: "fallback table", live: false };
  }
}
