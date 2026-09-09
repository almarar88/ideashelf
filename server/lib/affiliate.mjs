/**
 * Booking hand-off links.
 *
 * Alcode Trips does not issue tickets — it compares prices and sends the
 * traveller to the site that sells the trip, which is how every meta-search
 * works. These builders produce the real search URL on each partner, with the
 * affiliate marker appended when one is configured.
 *
 * Without a marker the links still work; they just earn nothing. The traveller
 * experience is identical either way, so a missing marker is never a reason to
 * hide the button.
 */

const MARKER = process.env.TRAVELPAYOUTS_MARKER ?? "";

const withMarker = (url) => {
  if (!MARKER) return url;
  const u = new URL(url);
  u.searchParams.set("marker", MARKER);
  return u.toString();
};

const pad = (n) => String(n).padStart(2, "0");

/** Aviasales encodes a search as ORIGIN + DDMM + DEST + [DDMM] + passengers. */
export function flightSearchUrl({ from, to, date, returnDate, passengers = 1 }) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  let route = `${from}${pad(d.getDate())}${pad(d.getMonth() + 1)}${to}`;
  if (returnDate) {
    const r = new Date(`${returnDate}T00:00:00`);
    if (!Number.isNaN(r.getTime())) route += `${pad(r.getDate())}${pad(r.getMonth() + 1)}`;
  }
  route += Math.min(9, Math.max(1, passengers));

  return withMarker(`https://www.aviasales.com/search/${route}`);
}

export function hotelSearchUrl({ city, checkIn, checkOut, adults = 2 }) {
  const u = new URL("https://search.hotellook.com/hotels");
  u.searchParams.set("destination", city);
  u.searchParams.set("checkIn", checkIn);
  u.searchParams.set("checkOut", checkOut);
  u.searchParams.set("adults", String(adults));
  return withMarker(u.toString());
}

/** A named hotel, so the traveller lands on the property rather than a list. */
export function hotelPropertyUrl({ name, city, checkIn, checkOut, adults = 2 }) {
  const u = new URL("https://search.hotellook.com/hotels");
  u.searchParams.set("destination", `${name}, ${city}`);
  u.searchParams.set("checkIn", checkIn);
  u.searchParams.set("checkOut", checkOut);
  u.searchParams.set("adults", String(adults));
  return withMarker(u.toString());
}

export function carSearchUrl({ city, pickUp, days = 3 }) {
  const u = new URL("https://www.discovercars.com/search");
  u.searchParams.set("country", city);
  u.searchParams.set("pickup-date", pickUp);
  u.searchParams.set("days", String(days));
  return withMarker(u.toString());
}

export function esimUrl({ countryCode }) {
  const u = new URL("https://www.airalo.com/");
  if (countryCode) u.searchParams.set("country", countryCode.toLowerCase());
  return withMarker(u.toString());
}

export const markerConfigured = () => MARKER.length > 0;
