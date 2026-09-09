import { CARRIERS, PROVIDERS, cityById, terminalFor } from "@/data/catalog";
import { makeRng } from "@/lib/rng";
import type {
  Cabin,
  CarRental,
  EsimPlan,
  Hotel,
  Provider,
  Quote,
  TransportMode,
  TravelPackage,
  TripOffer,
} from "@/lib/types";

/* ------------------------------------------------------------------ *
 * Price comparison engine
 *
 * Alcode Trips does not sell inventory itself — it queries every partner
 * site for the same trip and surfaces the cheapest total. `searchTrips`,
 * `searchHotels`, `searchCars` and `searchEsim` below are the seams a real
 * integration plugs into: swap the body for the partner HTTP call, keep the
 * signature, and the whole UI keeps working.
 *
 * With no partner credentials configured the functions build results from
 * the bundled demo catalogue. `isLiveData()` reports which mode is active so
 * screens can label the prices honestly instead of implying live fares.
 * ------------------------------------------------------------------ */

export interface PartnerConfig {
  /** Base URL of a backend that fans out to the partner APIs. */
  endpoint?: string;
  apiKey?: string;
}

let partnerConfig: PartnerConfig = {
  endpoint: import.meta.env.VITE_PARTNER_ENDPOINT,
  apiKey: import.meta.env.VITE_PARTNER_KEY,
};

export const configurePartners = (cfg: PartnerConfig) => {
  partnerConfig = { ...partnerConfig, ...cfg };
};

/** True only when a partner endpoint is configured, i.e. prices are real. */
export const isLiveData = () => Boolean(partnerConfig.endpoint && partnerConfig.apiKey);

export interface TripQuery {
  fromId: string;
  toId: string;
  dateISO: string;
  returnISO?: string | null;
  passengers: number;
  cabin: Cabin;
  mode: TransportMode;
}

export type SortKey = "best" | "cheapest" | "fastest" | "earliest" | "rating";

const CABIN_MULTIPLIER: Record<Cabin, number> = { economy: 1, business: 2.35, first: 4.1 };

/** Rough great-circle-ish separation used to scale duration and price. */
const ROUTE_DISTANCE: Record<string, number> = {
  "jkt-bdg": 150, "jkt-dps": 985, "jkt-kul": 1180, "jkt-dxb": 6580,
  "dxb-ist": 3010, "dxb-cai": 2420, "dxb-jed": 1720, "dxb-lon": 5490,
  "jed-cai": 1250, "jed-ist": 2200, "ruh-dxb": 870, "ruh-cai": 1650,
  "ist-par": 2240, "ist-lon": 2500, "par-lon": 340, "cai-ist": 1230,
  "doh-dxb": 380, "doh-ist": 2800, "kul-dps": 2100, "jkt-doh": 6900,
};

function distanceBetween(a: string, b: string): number {
  if (a === b) return 60;
  return ROUTE_DISTANCE[`${a}-${b}`] ?? ROUTE_DISTANCE[`${b}-${a}`] ?? 1450;
}

const MODE_SPEED: Record<TransportMode, number> = { flight: 780, train: 190, boat: 55, bus: 75 };
const MODE_RATE: Record<TransportMode, number> = { flight: 0.085, train: 0.055, boat: 0.045, bus: 0.03 };
const MODE_FLOOR: Record<TransportMode, number> = { flight: 48, train: 12, boat: 15, bus: 8 };

function buildQuotes(
  basePrice: number,
  supports: Provider["supports"][number],
  seedParts: (string | number)[],
  deepLink: string,
): Quote[] {
  const rng = makeRng("quotes", ...seedParts);
  const eligible = PROVIDERS.filter((p) => p.supports.includes(supports));
  const chosen = rng.shuffle(eligible).slice(0, Math.max(3, Math.min(eligible.length, rng.int(3, 5))));
  // Alcode Direct is always quoted so there is a reference price to beat.
  if (!chosen.some((p) => p.id === "alcode")) chosen.push(PROVIDERS[0]);

  return chosen
    .map<Quote>((p) => {
      const spread = rng.float(0.9, 1.16);
      const price = Math.round(basePrice * p.feeFactor * spread);
      return {
        providerId: p.id,
        price,
        fees: rng.chance(0.45) ? Math.round(price * rng.float(0.02, 0.07)) : 0,
        url: `https://partners.alcodetrips.app/go/${p.id}/${deepLink}`,
        cancellation: rng.chance(0.5) ? "free" : rng.chance(0.6) ? "paid" : "none",
        payLater: rng.chance(0.4),
      };
    })
    .sort((a, b) => a.price + a.fees - (b.price + b.fees));
}

/** Total the traveller actually pays on that site. */
export const quoteTotal = (q: Quote) => q.price + q.fees;

/** How much the cheapest quote saves against the most expensive one. */
export function savingsOf(quotes: Quote[]): number {
  if (quotes.length < 2) return 0;
  const totals = quotes.map(quoteTotal);
  return Math.max(...totals) - Math.min(...totals);
}

export function searchTrips(q: TripQuery): TripOffer[] {
  const rng = makeRng("trips", q.fromId, q.toId, q.dateISO, q.mode, q.cabin);
  const distance = distanceBetween(q.fromId, q.toId);
  const carriers = CARRIERS.filter((c) => c.mode === q.mode);
  const count = rng.int(6, 9);
  // A malformed or missing date must degrade to today rather than throw while
  // rendering — Date arithmetic on NaN would take the whole screen down.
  const parsed = new Date(`${q.dateISO}T00:00:00`);
  const day = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const offers: TripOffer[] = [];
  for (let i = 0; i < count; i++) {
    const carrier = carriers[i % carriers.length];
    const departMin = rng.int(5, 21) * 60 + rng.pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const stops = q.mode === "flight" ? (rng.chance(0.68) ? 0 : rng.chance(0.8) ? 1 : 2) : 0;
    const durationMin = Math.round((distance / MODE_SPEED[q.mode]) * 60 + 35 + stops * rng.int(55, 130));

    const depart = new Date(day);
    depart.setMinutes(departMin);
    const arrive = new Date(depart.getTime() + durationMin * 60000);

    const raw =
      MODE_FLOOR[q.mode] +
      distance * MODE_RATE[q.mode] * rng.float(0.82, 1.3) * CABIN_MULTIPLIER[q.cabin] -
      stops * 9;
    const price = Math.max(MODE_FLOOR[q.mode], Math.round(raw));

    const id = `${q.mode}-${q.fromId}-${q.toId}-${i}`;
    offers.push({
      id,
      mode: q.mode,
      carrierId: carrier.id,
      cabin: q.cabin,
      from: cityById(q.fromId).name,
      to: cityById(q.toId).name,
      fromCode: terminalFor(q.fromId, q.mode),
      toCode: terminalFor(q.toId, q.mode),
      departISO: depart.toISOString(),
      arriveISO: arrive.toISOString(),
      durationMin,
      stops,
      price,
      baseCurrency: "USD",
      rating: Math.round((carrier.rating + rng.float(-0.35, 0.25)) * 10) / 10,
      seatsLeft: rng.int(2, 34),
      baggageKg: q.cabin === "economy" ? rng.pick([5, 7, 20]) : rng.pick([25, 30, 40]),
      refundable: rng.chance(q.cabin === "economy" ? 0.3 : 0.75),
      reschedulable: rng.chance(0.7),
      co2Kg: Math.round(distance * (q.mode === "flight" ? 0.11 : q.mode === "bus" ? 0.03 : 0.04)),
      quotes: buildQuotes(price, q.mode, [id, q.dateISO], id),
    });
  }
  return offers;
}

export function sortOffers(offers: TripOffer[], key: SortKey): TripOffer[] {
  const cheapest = (o: TripOffer) => Math.min(...o.quotes.map(quoteTotal));
  const list = offers.slice();
  switch (key) {
    case "cheapest":
      return list.sort((a, b) => cheapest(a) - cheapest(b));
    case "fastest":
      return list.sort((a, b) => a.durationMin - b.durationMin);
    case "earliest":
      return list.sort((a, b) => +new Date(a.departISO) - +new Date(b.departISO));
    case "rating":
      return list.sort((a, b) => b.rating - a.rating);
    default: {
      // "Best" balances price against duration and rating rather than picking
      // the cheapest slow option or the fastest expensive one.
      const prices = list.map(cheapest);
      const durs = list.map((o) => o.durationMin);
      const span = (arr: number[]) => Math.max(1, Math.max(...arr) - Math.min(...arr));
      const pMin = Math.min(...prices);
      const dMin = Math.min(...durs);
      const score = (o: TripOffer) =>
        ((cheapest(o) - pMin) / span(prices)) * 0.55 +
        ((o.durationMin - dMin) / span(durs)) * 0.3 +
        ((5 - o.rating) / 5) * 0.15;
      return list.sort((a, b) => score(a) - score(b));
    }
  }
}

/* ----------------------------- hotels ----------------------------- */

const HOTEL_NAMES: Array<[string, string]> = [
  ["Aurora Grand", "أورورا غراند"],
  ["The Lumen Suites", "ذا لومن سويتس"],
  ["Marisol Bay Resort", "ماريسول باي ريزورت"],
  ["Cedar & Stone", "سيدار آند ستون"],
  ["Nova Boutique", "نوفا بوتيك"],
  ["Palmyra Residence", "بالميرا ريزيدنس"],
  ["Skyline Park Hotel", "سكايلاين بارك"],
  ["Amber Court", "آمبر كورت"],
  ["Lagoon Pearl", "لاغون بيرل"],
  ["Old Town House", "أولد تاون هاوس"],
];
const AREAS: Array<[string, string]> = [
  ["City Centre", "وسط المدينة"],
  ["Old Town", "المدينة القديمة"],
  ["Beachfront", "على الشاطئ"],
  ["Business District", "الحي التجاري"],
  ["Airport Area", "منطقة المطار"],
];
const AMENITIES = ["wifi", "pool", "gym", "spa", "parking", "breakfast", "beach", "airport"];

export interface HotelQuery {
  cityId: string;
  checkInISO: string;
  nights: number;
  guests: number;
  rooms: number;
}

export function searchHotels(q: HotelQuery): Hotel[] {
  const rng = makeRng("hotels", q.cityId, q.checkInISO, q.nights);
  return HOTEL_NAMES.map(([name, nameAr], i) => {
    const [area, areaAr] = AREAS[i % AREAS.length];
    const stars = rng.int(3, 5);
    const price = Math.round((38 + stars * rng.float(18, 46)) * (q.rooms || 1));
    const id = `hotel-${q.cityId}-${i}`;
    return {
      id,
      name,
      nameAr,
      cityId: q.cityId,
      area,
      areaAr,
      stars,
      rating: Math.round(rng.float(7.6, 9.7) * 10) / 10,
      reviews: rng.int(120, 4200),
      price,
      image: `hotel-${i % 6}`,
      amenities: rng.shuffle(AMENITIES).slice(0, rng.int(3, 6)),
      distanceKm: Math.round(rng.float(0.3, 9.4) * 10) / 10,
      breakfast: rng.chance(0.6),
      freeCancel: rng.chance(0.7),
      quotes: buildQuotes(price, "hotel", [id, q.checkInISO], id),
    } satisfies Hotel;
  });
}

/* ------------------------------ cars ------------------------------ */

const CARS: Array<[string, string, CarRental["category"], number, number]> = [
  ["Toyota", "Yaris", "economy", 5, 2],
  ["Hyundai", "Accent", "economy", 5, 2],
  ["Kia", "Sportage", "suv", 5, 3],
  ["Toyota", "Land Cruiser", "suv", 7, 4],
  ["Mercedes", "E-Class", "luxury", 5, 3],
  ["BMW", "5 Series", "luxury", 5, 3],
  ["Hyundai", "Staria", "van", 8, 5],
  ["Volkswagen", "Golf", "economy", 5, 2],
];
const SUPPLIERS = ["Hertz", "Avis", "Sixt", "Budget", "Europcar", "Local Rent"];

export function searchCars(cityId: string, dateISO: string, days: number): CarRental[] {
  const rng = makeRng("cars", cityId, dateISO, days);
  return CARS.map(([brand, model, category, seats, bags], i) => {
    const base = { economy: 22, suv: 48, luxury: 96, van: 62 }[category];
    const pricePerDay = Math.round(base * rng.float(0.85, 1.28));
    const id = `car-${cityId}-${i}`;
    return {
      id,
      brand,
      model,
      cityId,
      category,
      seats,
      bags,
      transmission: rng.chance(0.85) ? "auto" : "manual",
      pricePerDay,
      rating: Math.round(rng.float(3.9, 4.9) * 10) / 10,
      image: `car-${category}`,
      unlimitedKm: rng.chance(0.6),
      supplier: rng.pick(SUPPLIERS),
      quotes: buildQuotes(pricePerDay * Math.max(1, days), "car", [id, dateISO, days], id),
    } satisfies CarRental;
  });
}

/* ---------------------------- packages ---------------------------- */

export function searchPackages(): TravelPackage[] {
  const seeds: Array<[string, string, string, number]> = [
    ["dps", "Bali Escape", "رحلة بالي", 5],
    ["ist", "Istanbul Discovery", "اكتشف إسطنبول", 4],
    ["dxb", "Dubai City Break", "عطلة دبي", 3],
    ["cai", "Cairo & Nile", "القاهرة والنيل", 6],
    ["par", "Paris Romance", "باريس الرومانسية", 4],
    ["kul", "Malaysia Highlights", "أبرز معالم ماليزيا", 5],
  ];
  return seeds.map(([cityId, title, titleAr, nights], i) => {
    const rng = makeRng("package", cityId, i);
    const price = Math.round(rng.float(430, 1650));
    return {
      id: `pkg-${cityId}`,
      title,
      titleAr,
      cityId,
      nights,
      includes: ["Flights", "Hotel", "Transfers", "2 Tours", "Breakfast"],
      includesAr: ["طيران", "فندق", "مواصلات", "جولتان", "إفطار"],
      price,
      oldPrice: Math.round(price * rng.float(1.15, 1.4)),
      rating: Math.round(rng.float(4.2, 4.9) * 10) / 10,
      image: `pkg-${cityId}`,
      departures: ["Every Friday", "Every Monday"],
    } satisfies TravelPackage;
  });
}

/* ------------------------------ eSIM ------------------------------ */

const ESIM_COUNTRIES: Array<[string, string, string, string, string]> = [
  ["SA", "Saudi Arabia", "السعودية", "🇸🇦", "STC 5G"],
  ["AE", "United Arab Emirates", "الإمارات", "🇦🇪", "Etisalat 5G"],
  ["TR", "Türkiye", "تركيا", "🇹🇷", "Turkcell 5G"],
  ["EG", "Egypt", "مصر", "🇪🇬", "Vodafone 4G"],
  ["GB", "United Kingdom", "المملكة المتحدة", "🇬🇧", "EE 5G"],
  ["FR", "France", "فرنسا", "🇫🇷", "Orange 5G"],
  ["ID", "Indonesia", "إندونيسيا", "🇮🇩", "Telkomsel 4G"],
  ["MY", "Malaysia", "ماليزيا", "🇲🇾", "Maxis 5G"],
  ["QA", "Qatar", "قطر", "🇶🇦", "Ooredoo 5G"],
  ["US", "United States", "الولايات المتحدة", "🇺🇸", "T-Mobile 5G"],
  ["JP", "Japan", "اليابان", "🇯🇵", "NTT Docomo 5G"],
  ["IT", "Italy", "إيطاليا", "🇮🇹", "TIM 5G"],
  ["ES", "Spain", "إسبانيا", "🇪🇸", "Movistar 5G"],
  ["DE", "Germany", "ألمانيا", "🇩🇪", "Telekom 5G"],
  ["TH", "Thailand", "تايلاند", "🇹🇭", "AIS 5G"],
  ["MA", "Morocco", "المغرب", "🇲🇦", "Maroc Telecom 4G"],
];

const ESIM_TIERS: Array<[number | "unlimited", number]> = [
  [1, 7], [3, 15], [5, 30], [10, 30], [20, 30], ["unlimited", 15],
];

export function esimCountries() {
  return ESIM_COUNTRIES.map(([countryCode, country, countryAr, flag, network]) => ({
    countryCode,
    country,
    countryAr,
    flag,
    network,
  }));
}

export function searchEsim(countryCode: string): EsimPlan[] {
  const meta = ESIM_COUNTRIES.find((c) => c[0] === countryCode) ?? ESIM_COUNTRIES[0];
  const [code, country, countryAr, flag, network] = meta;
  return ESIM_TIERS.map(([dataGb, days], i) => {
    const rng = makeRng("esim", code, i);
    const gb = dataGb === "unlimited" ? 25 : dataGb;
    const price = Math.round((3.4 + gb * 1.15 + days * 0.22) * rng.float(0.85, 1.25) * 100) / 100;
    const id = `esim-${code}-${i}`;
    return {
      id,
      countryCode: code,
      country,
      countryAr,
      flag,
      operator: rng.pick(["Alcode Mobile", "SimGlobe", "NomadSim"]),
      dataGb,
      days,
      price,
      network,
      hotspot: rng.chance(0.75),
      calls: rng.chance(0.3),
      quotes: buildQuotes(Math.max(2, Math.round(price)), "esim", [id], id),
    } satisfies EsimPlan;
  });
}
