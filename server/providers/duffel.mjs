import { getJson } from "../lib/http.mjs";

/**
 * Duffel — the path to booking inside the app rather than handing off.
 *
 * Duffel holds the IATA accreditation and issues the ticket, which is what
 * makes in-app booking reachable without becoming an accredited travel agent
 * first. A free test token works immediately and creates real-shaped orders
 * against test airlines; live mode needs their approval and a payment
 * arrangement. See the booking section of the README before switching it on.
 *
 * The three-step shape below is the API's, not a choice: an offer expires, so
 * it must be re-priced immediately before an order is created, and the price
 * that comes back from that confirmation is the one the traveller pays.
 */

const HOST = "https://api.duffel.com";
const TOKEN = process.env.DUFFEL_TOKEN;
const VERSION = "v2";

export const isConfigured = () => Boolean(TOKEN);

/** True only for a live token; test tokens cannot take real money. */
export const isLiveMode = () => Boolean(TOKEN && !TOKEN.startsWith("duffel_test"));

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  "Duffel-Version": VERSION,
  "Content-Type": "application/json",
});

const CABIN = { economy: "economy", business: "business", first: "first" };

function isoDurationToMinutes(iso = "") {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}

/**
 * Step 1 — ask for offers. Duffel creates an "offer request" and returns the
 * offers with it, each carrying the id an order is later placed against.
 */
export async function searchFlights({ from, to, date, adults = 1, cabin = "economy", currency = "USD" }) {
  const body = JSON.stringify({
    data: {
      slices: [{ origin: from, destination: to, departure_date: date }],
      passengers: Array.from({ length: adults }, () => ({ type: "adult" })),
      cabin_class: CABIN[cabin] ?? "economy",
    },
  });

  const res = await getJson(`${HOST}/air/offer_requests?return_offers=true&supplier_timeout=20000`, {
    method: "POST",
    headers: headers(),
    body,
    timeoutMs: 30000,
  });

  return mapOffers(res?.data?.offers ?? [], currency);
}

export function mapOffers(offers, currency = "USD") {
  return offers.map((offer) => {
    const slice = offer.slices?.[0] ?? {};
    const segments = slice.segments ?? [];
    const first = segments[0] ?? {};
    const last = segments[segments.length - 1] ?? first;
    const carrier = offer.owner ?? first.marketing_carrier ?? {};
    const baggage = first.passengers?.[0]?.baggages?.find((b) => b.type === "checked");

    return {
      id: `df-${offer.id}`,
      // The raw id is what an order is created against; keep it intact.
      offerId: offer.id,
      source: "duffel",
      mode: "flight",
      bookable: true,
      carrierCode: carrier.iata_code ?? "",
      carrierName: carrier.name ?? carrier.iata_code ?? "",
      cabin: (first.passengers?.[0]?.cabin_class ?? "economy").toLowerCase(),
      fromCode: first.origin?.iata_code ?? "",
      toCode: last.destination?.iata_code ?? "",
      departISO: first.departing_at ?? null,
      arriveISO: last.arriving_at ?? null,
      durationMin: isoDurationToMinutes(slice.duration),
      stops: Math.max(0, segments.length - 1),
      price: Number(offer.total_amount ?? 0),
      currency: offer.total_currency ?? currency,
      seatsLeft: null,
      baggagePieces: baggage?.quantity ?? null,
      baggageKg: null,
      // An offer is only valid until this moment; after it, re-search.
      expiresISO: offer.expires_at ?? null,
      conditions: {
        changeable: offer.conditions?.change_before_departure?.allowed ?? null,
        refundable: offer.conditions?.refund_before_departure?.allowed ?? null,
      },
      segments: segments.map((s) => ({
        from: s.origin?.iata_code,
        to: s.destination?.iata_code,
        departISO: s.departing_at,
        arriveISO: s.arriving_at,
        carrierCode: s.marketing_carrier?.iata_code,
        carrierName: s.marketing_carrier?.name ?? s.marketing_carrier?.iata_code,
        flightNumber: `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? ""}`,
        aircraft: s.aircraft?.name ?? null,
        durationMin: isoDurationToMinutes(s.duration),
        terminalFrom: s.origin_terminal ?? null,
        terminalTo: s.destination_terminal ?? null,
      })),
      quotes: [
        {
          providerId: "duffel",
          providerName: carrier.name ?? "Duffel",
          price: Number(offer.total_amount ?? 0),
          fees: 0,
          currency: offer.total_currency ?? currency,
          url: null,
          cancellation: offer.conditions?.refund_before_departure?.allowed ? "free" : "paid",
          payLater: false,
        },
      ],
    };
  });
}

/**
 * Step 2 — confirm the price. Fares move and offers expire, so this must run
 * immediately before creating an order; the amount it returns is what the
 * traveller is charged, and it can differ from the searched price.
 */
export async function confirmPrice(offerId) {
  const res = await getJson(`${HOST}/air/offers/${encodeURIComponent(offerId)}?return_available_services=false`, {
    headers: headers(),
    timeoutMs: 20000,
  });
  const offer = res?.data;
  if (!offer) throw new Error("offer not found or expired — search again");
  return {
    offerId: offer.id,
    total: Number(offer.total_amount ?? 0),
    currency: offer.total_currency,
    expiresISO: offer.expires_at,
    // Present when the airline requires details the traveller has not given
    // yet (passport, date of birth); an order without them is rejected.
    passengerIds: (offer.passengers ?? []).map((p) => p.id),
  };
}

/**
 * Step 3 — create the order. This is the call that takes money and issues a
 * ticket, so it is deliberately explicit: nothing else in this codebase can
 * reach it by accident.
 *
 * `passengers` must match the ids from confirmPrice, each with the traveller's
 * legal name, date of birth, gender and contact details as the airline
 * requires. `payment` is normally { type: "balance" } once funds are held with
 * Duffel; card payments go through their Payments product.
 */
export async function createOrder({ offerId, passengers, payment, metadata }) {
  if (!isConfigured()) throw new Error("DUFFEL_TOKEN is not set");
  if (!offerId) throw new Error("offerId is required");
  if (!Array.isArray(passengers) || passengers.length === 0) throw new Error("passengers are required");
  if (!payment) throw new Error("payment is required");

  const body = JSON.stringify({
    data: {
      type: "instant",
      selected_offers: [offerId],
      passengers,
      payments: [payment],
      metadata: metadata ?? {},
    },
  });

  const res = await getJson(`${HOST}/air/orders`, {
    method: "POST",
    headers: headers(),
    body,
    timeoutMs: 45000,
  });

  const order = res?.data;
  return {
    orderId: order?.id ?? null,
    reference: order?.booking_reference ?? null,
    total: Number(order?.total_amount ?? 0),
    currency: order?.total_currency ?? null,
    live: isLiveMode(),
    documents: order?.documents ?? [],
    passengers: order?.passengers ?? [],
  };
}

export async function getOrder(orderId) {
  const res = await getJson(`${HOST}/air/orders/${encodeURIComponent(orderId)}`, {
    headers: headers(),
    timeoutMs: 20000,
  });
  return res?.data ?? null;
}
