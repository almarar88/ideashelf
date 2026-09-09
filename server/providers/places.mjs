import { getJson } from "../lib/http.mjs";

/**
 * Global places and airlines, no API key.
 *
 * Travelpayouts publishes these datasets openly. They replace the app's
 * built-in list of a dozen cities with every airport and city in the world,
 * and give real airline names for the two-letter codes that partner APIs
 * return — so "EK" reads as "Emirates" even when the fare came from a
 * provider that sent no carrier dictionary.
 */

const AUTOCOMPLETE = "https://autocomplete.travelpayouts.com/places2";
const AIRLINES = "https://api.travelpayouts.com/data/en/airlines.json";

/** Search cities and airports by free text. */
export async function searchPlaces(term, { locale = "en", limit = 8 } = {}) {
  const url = `${AUTOCOMPLETE}?term=${encodeURIComponent(term)}&locale=${locale}&types[]=city&types[]=airport`;
  const data = await getJson(url, { timeoutMs: 8000 });

  return (Array.isArray(data) ? data : [])
    .filter((p) => p.code)
    .slice(0, limit)
    .map((p) => ({
      code: p.code,
      name: p.name,
      type: p.type,
      city: p.city_name ?? p.name,
      country: p.country_name,
      countryCode: p.country_code,
      latitude: p.coordinates?.lat ?? null,
      longitude: p.coordinates?.lon ?? null,
      // Airports carry the city they serve, which is what a hotel or car
      // search needs when the traveller picked an airport.
      cityCode: p.city_code ?? p.code,
    }));
}

let airlineIndex = null;
let airlineFetchedAt = 0;
const AIRLINE_TTL = 7 * 24 * 60 * 60_000;

/** IATA code to airline name, loaded once and held for a week. */
export async function airlineName(code) {
  if (!code) return null;
  const index = await airlineIndexOrLoad();
  return index.get(code.toUpperCase()) ?? null;
}

export async function airlineIndexOrLoad() {
  if (airlineIndex && Date.now() - airlineFetchedAt < AIRLINE_TTL) return airlineIndex;
  try {
    const list = await getJson(AIRLINES, { timeoutMs: 15000 });
    const next = new Map();
    for (const a of list ?? []) {
      if (a.code && a.name) next.set(a.code.toUpperCase(), a.name);
    }
    // Only replace a working index if the new one actually loaded.
    if (next.size > 0) {
      airlineIndex = next;
      airlineFetchedAt = Date.now();
    }
  } catch {
    /* Keep whatever we already had; codes are a usable fallback. */
  }
  return airlineIndex ?? new Map();
}
