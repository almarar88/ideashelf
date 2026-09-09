import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mapFlightOffers } from "./amadeus.mjs";

/**
 * Development partner. Runs a recorded Amadeus response through the exact same
 * mapping the live provider uses, so the whole chain — payload, mapping, merge,
 * HTTP, client, UI — can be exercised without credentials or API quota.
 *
 * Enabled only by MOCK_PARTNERS=1, and everything it returns is flagged
 * `mock: true` all the way to the badge on screen. It must never be mistaken
 * for a real fare.
 */

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/amadeus-flight-offers.json", import.meta.url)), "utf8"),
);

export const isEnabled = () => process.env.MOCK_PARTNERS === "1";

/** Re-dates the recorded itineraries onto the requested day. */
function shiftToDate(iso, date) {
  if (!iso) return iso;
  return `${date}T${iso.split("T")[1]}`;
}

export function searchFlights({ from, to, date, currency = "USD" }) {
  const offers = mapFlightOffers(FIXTURE, { from, to, currency });

  return offers.map((offer, i) => {
    const departISO = shiftToDate(offer.departISO, date);
    const arriveISO = shiftToDate(offer.arriveISO, date);

    return {
      ...offer,
      id: `mock-${offer.id}`,
      source: "mock",
      mock: true,
      fromCode: from,
      toCode: to,
      departISO,
      arriveISO,
      segments: offer.segments?.map((s) => ({
        ...s,
        departISO: shiftToDate(s.departISO, date),
        arriveISO: shiftToDate(s.arriveISO, date),
      })),
      quotes: [
        ...offer.quotes,
        // A second site for the same flight, so the comparison view has
        // something to compare — which is the behaviour under test.
        {
          providerId: "aviasales",
          providerName: "Aviasales",
          price: Math.round(offer.price * (i === 0 ? 0.94 : 1.07) * 100) / 100,
          fees: i === 0 ? 0 : 11,
          currency,
          url: `https://www.aviasales.com/search/${from}${date.slice(8, 10)}${date.slice(5, 7)}${to}1`,
          cancellation: i === 0 ? "free" : "paid",
          payLater: i === 0,
        },
      ],
    };
  });
}

export function searchHotels({ cityCode, checkIn, checkOut }) {
  const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
  const seeds = [
    ["Rove Downtown", 78, "Deluxe room, 1 king bed", "ROOM_ONLY"],
    ["Address Sky View", 265, "Suite with skyline view", "BREAKFAST"],
    ["Hyatt Regency Creek", 132, "Twin room, city view", "BREAKFAST"],
  ];

  return seeds.map(([name, base, description, board], i) => ({
    id: `mock-h${i}`,
    source: "mock",
    mock: true,
    name,
    cityCode,
    latitude: null,
    longitude: null,
    address: `${cityCode} city centre`,
    distanceKm: Math.round((1.2 + i * 2.4) * 10) / 10,
    nights,
    quotes: [
      {
        providerId: "amadeus",
        providerName: "Amadeus",
        price: base,
        fees: 0,
        currency: "USD",
        url: null,
        cancellation: i % 2 === 0 ? "free" : "paid",
        payLater: i === 1,
        board,
        description,
      },
      {
        providerId: "roomly",
        providerName: "Roomly",
        price: Math.round(base * 1.09 * 100) / 100,
        fees: 6,
        currency: "USD",
        url: "https://example.com/",
        cancellation: "paid",
        payLater: false,
        board,
        description,
      },
    ],
  }));
}
