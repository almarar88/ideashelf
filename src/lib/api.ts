import { CITIES, cityById } from "@/data/catalog";
import type { Hotel, Photo, TripOffer } from "@/lib/types";

/**
 * Client for the Alcode Trips backend (server/ in this repo).
 *
 * The backend holds the partner credentials and does the fan-out; this module
 * only speaks to it. Every call is best-effort: if the backend is not
 * configured, is unreachable, or answers slowly, the caller falls back to the
 * bundled catalogue rather than showing an error page.
 */

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const apiConfigured = () => BASE.length > 0;

/** Origin of the backend, for resolving the relative URLs it returns. */
export const apiBase = () => BASE;

export interface ProviderStatus {
  amadeus: boolean;
  travelpayouts: boolean;
  photos: boolean;
  rates: boolean;
}

async function get<T>(path: string, timeoutMs = 12000): Promise<T | null> {
  if (!BASE) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Offline, blocked, or too slow — the caller keeps its local data.
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export const health = () =>
  get<{ ok: boolean; providers: ProviderStatus; livePrices: boolean }>("/health", 6000);

/* ------------------------------- flights -------------------------------- */

interface ApiOffer {
  id: string;
  carrierCode: string;
  carrierName: string;
  cabin: string;
  fromCode: string;
  toCode: string;
  departISO: string | null;
  arriveISO: string | null;
  durationMin: number;
  stops: number;
  price: number;
  currency: string;
  seatsLeft: number | null;
  baggageKg: number | null;
  baggagePieces?: number | null;
  brandedFare?: string | null;
  refundable?: boolean | null;
  segments?: TripOffer["segments"];
  sources?: string[];
  quotes: Array<{
    providerId: string;
    providerName?: string;
    price: number;
    fees?: number;
    currency?: string;
    url?: string | null;
    cancellation?: "free" | "paid" | "none";
    payLater?: boolean;
  }>;
}

/** Map a code back to a catalogue city so screens can show a local name. */
const cityIdForCode = (code: string) =>
  CITIES.find((c) => c.code === code)?.id ?? null;

function toTripOffer(o: ApiOffer, fallbackCabin: TripOffer["cabin"]): TripOffer | null {
  if (!o.departISO) return null;
  const arrive = o.arriveISO ?? new Date(new Date(o.departISO).getTime() + o.durationMin * 60000).toISOString();
  const fromId = cityIdForCode(o.fromCode);
  const toId = cityIdForCode(o.toCode);

  return {
    id: o.id,
    mode: "flight",
    // Live carriers are not in the static catalogue; the IATA code is carried
    // through and carrierName is what the UI actually renders.
    carrierId: o.carrierCode?.toLowerCase() ?? "unknown",
    carrierName: o.carrierName || o.carrierCode,
    cabin: (["economy", "business", "first"] as const).includes(o.cabin as TripOffer["cabin"])
      ? (o.cabin as TripOffer["cabin"])
      : fallbackCabin,
    from: fromId ? cityById(fromId).name : o.fromCode,
    to: toId ? cityById(toId).name : o.toCode,
    fromCode: o.fromCode,
    toCode: o.toCode,
    departISO: o.departISO,
    arriveISO: arrive,
    durationMin: o.durationMin,
    stops: o.stops,
    price: o.price,
    baseCurrency: o.currency,
    // Partner APIs do not publish a passenger rating; the UI hides it rather
    // than inventing one, so 0 means "unrated" here.
    rating: 0,
    seatsLeft: o.seatsLeft ?? 0,
    baggageKg: o.baggageKg ?? 0,
    baggagePieces: o.baggagePieces ?? null,
    brandedFare: o.brandedFare ?? null,
    refundable: Boolean(o.refundable),
    reschedulable: false,
    co2Kg: 0,
    segments: o.segments,
    sources: o.sources,
    live: true,
    quotes: o.quotes.map((q) => ({
      providerId: q.providerId,
      providerName: q.providerName,
      price: q.price,
      fees: q.fees ?? 0,
      currency: q.currency ?? o.currency,
      url: q.url ?? "",
      cancellation: q.cancellation ?? "paid",
      payLater: Boolean(q.payLater),
    })),
  };
}

export interface LiveFlights {
  offers: TripOffer[];
  live: boolean;
  /** Development fixtures. Rendered with its own badge, never as live. */
  mock?: boolean;
  reason?: string;
  providers?: ProviderStatus;
  fetchedISO?: string;
}

export async function fetchFlights(params: {
  from: string;
  to: string;
  date: string;
  adults: number;
  cabin: TripOffer["cabin"];
  currency: string;
}): Promise<LiveFlights | null> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    date: params.date,
    adults: String(params.adults),
    cabin: params.cabin,
    currency: params.currency,
  });
  const data = await get<{ live: boolean; mock?: boolean; reason?: string; offers: ApiOffer[]; providers?: ProviderStatus; fetchedISO?: string }>(
    `/api/flights?${qs}`,
    15000,
  );
  if (!data) return null;
  return {
    live: data.live,
    mock: data.mock,
    reason: data.reason,
    providers: data.providers,
    fetchedISO: data.fetchedISO,
    offers: data.offers.map((o) => toTripOffer(o, params.cabin)).filter((o): o is TripOffer => o !== null),
  };
}

/* -------------------------------- hotels -------------------------------- */

interface ApiHotel {
  id: string;
  name: string;
  cityCode: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  nights: number;
  photo?: Photo | null;
  sources?: string[];
  quotes: Array<{
    providerId: string;
    providerName?: string;
    price: number;
    fees?: number;
    currency?: string;
    url?: string | null;
    cancellation?: "free" | "paid" | "none";
    payLater?: boolean;
    room?: string | null;
    board?: string | null;
    description?: string | null;
  }>;
}

export interface LiveHotels {
  hotels: Hotel[];
  live: boolean;
  mock?: boolean;
  reason?: string;
}

export async function fetchHotels(params: {
  cityId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  currency: string;
}): Promise<LiveHotels | null> {
  const city = cityById(params.cityId);
  const qs = new URLSearchParams({
    city: city.code,
    cityName: city.name,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: String(params.adults),
    rooms: String(params.rooms),
    currency: params.currency,
  });
  const data = await get<{ live: boolean; mock?: boolean; reason?: string; hotels: ApiHotel[] }>(`/api/hotels?${qs}`, 18000);
  if (!data) return null;

  return {
    live: data.live,
    mock: data.mock,
    reason: data.reason,
    hotels: data.hotels.map<Hotel>((h) => ({
      id: h.id,
      name: h.name,
      nameAr: h.name,
      cityId: params.cityId,
      // The address is rendered on its own line; the area slot shows the
      // city so the two do not print the same string twice.
      area: city.name,
      areaAr: city.nameAr,
      // Partner hotel lists carry no star rating or review count in the
      // self-service tier, so the UI omits them rather than guessing.
      stars: 0,
      rating: 0,
      reviews: 0,
      price: h.quotes[0]?.price ?? 0,
      image: city.image,
      amenities: [],
      distanceKm: h.distanceKm ?? 0,
      breakfast: h.quotes.some((q) => (q.board ?? "").toUpperCase().includes("BREAKFAST")),
      freeCancel: h.quotes.some((q) => q.cancellation === "free"),
      live: true,
      photo: h.photo ?? null,
      address: h.address,
      latitude: h.latitude,
      longitude: h.longitude,
      roomDescription: h.quotes[0]?.description ?? null,
      board: humaniseBoard(h.quotes[0]?.board),
      sources: h.sources,
      quotes: h.quotes.map((q) => ({
        providerId: q.providerId,
        providerName: q.providerName,
        price: q.price,
        fees: q.fees ?? 0,
        currency: q.currency,
        url: q.url ?? "",
        cancellation: q.cancellation ?? "paid",
        payLater: Boolean(q.payLater),
      })),
    })),
  };
}

/** Partner board codes are SHOUTED_SNAKE_CASE; make them readable. */
function humaniseBoard(code?: string | null): string | null {
  if (!code) return null;
  return code
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/* ------------------------------ places & FX ----------------------------- */

export interface PlaceInfo {
  place: string;
  description: string;
  shortDescription: string;
  photos: Photo[];
}

export const fetchPlace = (query: string, limit = 5) =>
  get<PlaceInfo>(`/api/place?q=${encodeURIComponent(query)}&limit=${limit}`, 10000);

export const fetchPhotos = (query: string, limit = 6) =>
  get<{ term: string; photos: Photo[] }>(`/api/photos?q=${encodeURIComponent(query)}&limit=${limit}`, 10000);

export interface RatesPayload {
  base: string;
  rates: Record<string, number>;
  updatedISO: string | null;
  source: string;
  live: boolean;
}

export const fetchRates = (base = "USD") => get<RatesPayload>(`/api/rates?base=${base}`, 8000);
