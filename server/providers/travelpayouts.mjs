import { getJson } from "../lib/http.mjs";

/**
 * Travelpayouts (Aviasales) — real cached fares plus a bookable deep link.
 *
 * The token is free from travelpayouts.com and, unlike most flight APIs, this
 * one returns an affiliate `link` per fare, which is what makes it useful as a
 * second quote next to Amadeus: a price the traveller can actually click.
 */

const BASE = "https://api.travelpayouts.com";
const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
const MARKER = process.env.TRAVELPAYOUTS_MARKER ?? "";

export const isConfigured = () => Boolean(TOKEN);

/** Fares for a route on a given date. */
export async function searchFlights({ from, to, date, currency = "USD", limit = 12 }) {
  const params = new URLSearchParams({
    origin: from,
    destination: to,
    departure_at: date,
    currency: currency.toLowerCase(),
    sorting: "price",
    limit: String(limit),
    one_way: "true",
    token: TOKEN,
  });

  const data = await getJson(`${BASE}/aviasales/v3/prices_for_dates?${params}`);
  if (!data?.success) return [];

  return (data.data ?? []).map((f) => {
    const depart = f.departure_at ? new Date(f.departure_at) : null;
    const durationMin = f.duration ?? f.duration_to ?? 0;
    const arrive = depart && durationMin ? new Date(depart.getTime() + durationMin * 60000) : null;
    // Aviasales links are site-relative and need the affiliate marker appended.
    const url = f.link
      ? `https://www.aviasales.com${f.link}${MARKER ? `${f.link.includes("?") ? "&" : "?"}marker=${MARKER}` : ""}`
      : null;

    return {
      id: `tp-${f.origin}-${f.destination}-${f.departure_at}-${f.flight_number ?? "x"}`,
      source: "travelpayouts",
      mode: "flight",
      carrierCode: f.airline,
      carrierName: f.airline,
      cabin: "economy",
      fromCode: f.origin,
      toCode: f.destination,
      departISO: depart ? depart.toISOString() : null,
      arriveISO: arrive ? arrive.toISOString() : null,
      durationMin,
      stops: f.transfers ?? 0,
      price: Number(f.price ?? 0),
      currency: currency.toUpperCase(),
      seatsLeft: null,
      baggageKg: null,
      quotes: [
        {
          providerId: "aviasales",
          providerName: "Aviasales",
          price: Number(f.price ?? 0),
          fees: 0,
          currency: currency.toUpperCase(),
          url,
          cancellation: "paid",
          payLater: false,
        },
      ],
    };
  });
}
