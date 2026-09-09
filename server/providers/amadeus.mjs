import { getJson } from "../lib/http.mjs";

/**
 * Amadeus Self-Service — real flight and hotel inventory.
 *
 * A free key from developers.amadeus.com works against the test host, which
 * serves real (cached) fares for a limited set of routes. Moving to the
 * production host is a switch of AMADEUS_HOST plus a production key.
 *
 * The token is cached in memory and refreshed a minute before it expires, so
 * a burst of searches costs one auth call, not one per search.
 */

const HOST = process.env.AMADEUS_HOST ?? "https://test.api.amadeus.com";
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;

export const isConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET);

let token = null;
let tokenExpires = 0;

async function accessToken() {
  if (token && Date.now() < tokenExpires) return token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();

  const data = await getJson(`${HOST}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  token = data.access_token;
  tokenExpires = Date.now() + (data.expires_in ?? 1799) * 1000 - 60_000;
  return token;
}

const authed = async (path, params) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ).toString();
  return getJson(`${HOST}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
};

const CABIN = { economy: "ECONOMY", business: "BUSINESS", first: "FIRST" };

/** ISO-8601 duration ("PT2H35M") to minutes. */
export function isoDurationToMinutes(iso = "") {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}

/**
 * Real flight offers for a route and date.
 * Returns the app's TripOffer shape, with one quote per offer — the fare
 * Amadeus itself is selling. Other sites' quotes are merged in by the caller.
 */
export async function searchFlights({ from, to, date, adults = 1, cabin = "economy", currency = "USD", max = 12 }) {
  const data = await authed("/v2/shopping/flight-offers", {
    originLocationCode: from,
    destinationLocationCode: to,
    departureDate: date,
    adults,
    travelClass: CABIN[cabin] ?? "ECONOMY",
    currencyCode: currency,
    max,
  });
  return mapFlightOffers(data, { from, to, currency });
}

/**
 * Amadeus flight-offers payload to the app's offer shape.
 *
 * Exported separately from the network call so the mapping can be verified
 * against recorded responses — the part most likely to break when the partner
 * changes a field is then covered without spending API quota.
 */
export function mapFlightOffers(data, { from, to, currency = "USD" } = {}) {
  const carriers = data?.dictionaries?.carriers ?? {};
  const aircraft = data?.dictionaries?.aircraft ?? {};

  return (data?.data ?? []).map((offer) => {
    const itinerary = offer.itineraries?.[0] ?? {};
    const segments = itinerary.segments ?? [];
    const first = segments[0] ?? {};
    const last = segments[segments.length - 1] ?? first;
    const fare = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0] ?? {};
    const bags = fare.includedCheckedBags ?? {};
    const carrierCode = offer.validatingAirlineCodes?.[0] ?? first.carrierCode;
    const perAdult = Number(offer.travelerPricings?.[0]?.price?.total ?? offer.price?.total ?? 0);

    return {
      id: `am-${offer.id}`,
      source: "amadeus",
      mode: "flight",
      carrierCode,
      carrierName: carriers[carrierCode] ?? carrierCode,
      cabin: (fare.cabin ?? "ECONOMY").toLowerCase(),
      fromCode: first.departure?.iataCode ?? from,
      toCode: last.arrival?.iataCode ?? to,
      departISO: first.departure?.at ?? null,
      arriveISO: last.arrival?.at ?? null,
      durationMin: isoDurationToMinutes(itinerary.duration),
      stops: Math.max(0, segments.length - 1),
      price: perAdult,
      currency: offer.price?.currency ?? currency,
      seatsLeft: offer.numberOfBookableSeats ?? null,
      // Amadeus reports allowance either as a weight or a piece count.
      baggageKg: bags.weight ?? null,
      baggagePieces: bags.quantity ?? null,
      brandedFare: fare.brandedFare ?? null,
      refundable: offer.pricingOptions?.refundableFare ?? null,
      lastTicketingDate: offer.lastTicketingDate ?? null,
      segments: segments.map((s) => ({
        from: s.departure?.iataCode,
        to: s.arrival?.iataCode,
        departISO: s.departure?.at,
        arriveISO: s.arrival?.at,
        carrierCode: s.carrierCode,
        carrierName: carriers[s.carrierCode] ?? s.carrierCode,
        flightNumber: `${s.carrierCode}${s.number}`,
        aircraft: aircraft[s.aircraft?.code] ?? s.aircraft?.code ?? null,
        durationMin: isoDurationToMinutes(s.duration),
        terminalFrom: s.departure?.terminal ?? null,
        terminalTo: s.arrival?.terminal ?? null,
      })),
      quotes: [
        {
          providerId: "amadeus",
          providerName: "Amadeus",
          price: perAdult,
          fees: 0,
          currency: offer.price?.currency ?? currency,
          url: null,
          cancellation: offer.pricingOptions?.refundableFare ? "free" : "paid",
          payLater: false,
        },
      ],
    };
  });
}

/** Hotels in a city, with real offers for the stay. */
export async function searchHotels({ cityCode, checkIn, checkOut, adults = 2, rooms = 1, currency = "USD", limit = 12 }) {
  const list = await authed("/v1/reference-data/locations/hotels/by-city", {
    cityCode,
    radius: 20,
    radiusUnit: "KM",
    hotelSource: "ALL",
  });

  const hotels = (list?.data ?? []).slice(0, limit);
  if (hotels.length === 0) return [];

  const offers = await authed("/v3/shopping/hotel-offers", {
    hotelIds: hotels.map((h) => h.hotelId).join(","),
    adults,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    roomQuantity: rooms,
    currency,
    bestRateOnly: false,
  }).catch(() => ({ data: [] }));

  const byId = new Map((offers?.data ?? []).map((o) => [o.hotel?.hotelId, o]));

  return hotels
    .map((h) => {
      const withOffers = byId.get(h.hotelId);
      const list = withOffers?.offers ?? [];
      if (list.length === 0) return null; // No availability for these dates.

      const nights = Math.max(
        1,
        Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000),
      );

      return {
        id: `am-${h.hotelId}`,
        source: "amadeus",
        name: h.name,
        cityCode: h.iataCode ?? cityCode,
        latitude: h.geoCode?.latitude ?? null,
        longitude: h.geoCode?.longitude ?? null,
        address: withOffers?.hotel?.address?.lines?.join(", ") ?? null,
        distanceKm: h.distance?.value ?? null,
        nights,
        quotes: list.map((offer) => ({
          providerId: "amadeus",
          providerName: "Amadeus",
          // Amadeus prices the whole stay; the app compares per-night rates.
          price: Number(offer.price?.total ?? 0) / nights,
          fees: 0,
          currency: offer.price?.currency ?? currency,
          url: null,
          cancellation: offer.policies?.cancellations?.[0]?.amount ? "paid" : "free",
          payLater: offer.policies?.paymentType === "guarantee",
          room: offer.room?.typeEstimated?.category ?? null,
          beds: offer.room?.typeEstimated?.beds ?? null,
          board: offer.boardType ?? null,
          description: offer.room?.description?.text ?? null,
        })),
      };
    })
    .filter(Boolean);
}

/** Resolve a free-text place to its IATA city/airport code. */
export async function findLocation(keyword) {
  const data = await authed("/v1/reference-data/locations", {
    subType: "CITY,AIRPORT",
    keyword,
    "page[limit]": 5,
  });
  return (data?.data ?? []).map((l) => ({
    code: l.iataCode,
    name: l.name,
    city: l.address?.cityName,
    country: l.address?.countryName,
    countryCode: l.address?.countryCode,
    type: l.subType,
    latitude: l.geoCode?.latitude ?? null,
    longitude: l.geoCode?.longitude ?? null,
  }));
}
