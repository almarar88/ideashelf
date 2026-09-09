import { cityById } from "@/data/catalog";
import type { Booking, Hotel, TripOffer } from "@/lib/types";

/**
 * Booking hand-off.
 *
 * Alcode Trips is a comparison app: it finds the cheapest total across sites
 * and then hands the traveller to the site that actually sells the trip. That
 * site takes the payment and issues the ticket, exactly as Skyscanner or Kayak
 * work — which is why nothing here fabricates a ticket number or a boarding
 * pass. The app records what the traveller went to book, and nothing more,
 * until a real order comes back from a booking API.
 *
 * The links are built here as well as on the server so the button still works
 * with no backend configured.
 */

const MARKER = import.meta.env.VITE_AFFILIATE_MARKER ?? "";

const withMarker = (url: string) => {
  if (!MARKER) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("marker", MARKER);
    return u.toString();
  } catch {
    return url;
  }
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Aviasales encodes a search as ORIGIN + DDMM + DEST + [DDMM] + passengers. */
export function flightSearchUrl(params: {
  from: string;
  to: string;
  dateISO: string;
  returnISO?: string | null;
  passengers?: number;
}) {
  const d = new Date(`${params.dateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  let route = `${params.from}${pad(d.getDate())}${pad(d.getMonth() + 1)}${params.to}`;
  if (params.returnISO) {
    const r = new Date(`${params.returnISO.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(r.getTime())) route += `${pad(r.getDate())}${pad(r.getMonth() + 1)}`;
  }
  route += Math.min(9, Math.max(1, params.passengers ?? 1));

  return withMarker(`https://www.aviasales.com/search/${route}`);
}

export function hotelSearchUrl(params: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
}) {
  const u = new URL("https://search.hotellook.com/hotels");
  u.searchParams.set("destination", params.destination);
  u.searchParams.set("checkIn", params.checkIn);
  u.searchParams.set("checkOut", params.checkOut);
  u.searchParams.set("adults", String(params.adults ?? 2));
  return withMarker(u.toString());
}

export function carSearchUrl(params: { city: string; pickUp: string; days: number }) {
  const u = new URL("https://www.discovercars.com/search");
  u.searchParams.set("country", params.city);
  u.searchParams.set("pickup-date", params.pickUp);
  u.searchParams.set("days", String(params.days));
  return withMarker(u.toString());
}

export function esimUrl(countryCode: string) {
  const u = new URL("https://www.airalo.com/");
  if (countryCode) u.searchParams.set("country", countryCode.toLowerCase());
  return withMarker(u.toString());
}

/**
 * Where "book" should send the traveller for a flight offer.
 * A partner's own deep link goes straight to that fare, so it wins; the route
 * search is the fallback that at least lands on the right journey.
 */
export function offerBookingUrl(
  offer: TripOffer,
  search: { dateISO: string; returnISO: string | null; passengers: number },
  preferredQuoteUrl?: string,
) {
  if (isDeepLink(preferredQuoteUrl)) return preferredQuoteUrl!;
  if (isDeepLink(offer.bookingUrl)) return offer.bookingUrl!;
  return flightSearchUrl({
    from: offer.fromCode,
    to: offer.toCode,
    dateISO: offer.departISO,
    returnISO: search.returnISO,
    passengers: search.passengers,
  });
}

export function hotelBookingUrl(hotel: Hotel, checkIn: string, checkOut: string, guests: number) {
  if (isDeepLink(hotel.bookingUrl)) return hotel.bookingUrl!;
  const city = cityById(hotel.cityId);
  return hotelSearchUrl({
    destination: `${hotel.name}, ${city.name}`,
    checkIn,
    checkOut,
    adults: guests,
  });
}

/** A link that lands on something specific, not a partner's front page. */
function isDeepLink(url?: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, "").length > 0 || u.search.length > 0;
  } catch {
    return false;
  }
}

/**
 * Opens the partner in the system browser.
 *
 * Inside the Android WebView a plain window.open can land in a chromeless view
 * the traveller cannot leave or trust; `_blank` with noopener hands it to the
 * real browser, where the address bar and the site's own padlock are visible.
 * That matters when the next screen asks for a card.
 */
export function openBookingSite(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
}

/** A record of a trip the traveller went off to book. Never a ticket. */
export function savedBooking(params: {
  kind: Booking["kind"];
  refId: string;
  title: string;
  subtitle: string;
  dateISO: string;
  price: number;
  passenger: string;
  bookingUrl: string;
  provider: string;
}): Booking {
  return {
    id: `sv-${Date.now()}`,
    kind: params.kind,
    refId: params.refId,
    title: params.title,
    subtitle: params.subtitle,
    dateISO: params.dateISO,
    price: params.price,
    // "saved" is deliberately not "confirmed": the app has no idea whether the
    // traveller completed the purchase on the partner's site.
    status: "saved",
    passenger: params.passenger,
    bookingUrl: params.bookingUrl,
    provider: params.provider,
    code: "",
  };
}
