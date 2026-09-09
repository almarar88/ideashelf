/**
 * Merging is what turns several partner responses into a comparison.
 *
 * Two providers selling the same flight describe it differently — one gives a
 * marketing carrier, another the operating one; departure times can differ by
 * a minute of rounding. Offers are therefore keyed on route, carrier and the
 * departure time rounded to a five-minute bucket, and every provider's price
 * for that key becomes one quote on a single card.
 */

const bucket = (iso, minutes = 5) => {
  if (!iso) return "x";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "x";
  const size = minutes * 60000;
  return String(Math.round(t / size) * size);
};

const keyOf = (offer) =>
  [offer.fromCode, offer.toCode, (offer.carrierCode ?? "").toUpperCase(), bucket(offer.departISO)].join("|");

export function mergeOffers(lists) {
  const merged = new Map();

  for (const offer of lists.flat()) {
    if (!offer) continue;
    const key = keyOf(offer);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...offer, quotes: [...offer.quotes], sources: [offer.source] });
      continue;
    }

    existing.quotes.push(...offer.quotes);
    if (!existing.sources.includes(offer.source)) existing.sources.push(offer.source);

    // Keep the richest description of the journey: whichever provider gave us
    // segments, seat counts or a baggage allowance wins that field.
    if (!existing.segments?.length && offer.segments?.length) existing.segments = offer.segments;
    if (existing.baggageKg == null && offer.baggageKg != null) existing.baggageKg = offer.baggageKg;
    if (existing.seatsLeft == null && offer.seatsLeft != null) existing.seatsLeft = offer.seatsLeft;
    if (!existing.durationMin && offer.durationMin) existing.durationMin = offer.durationMin;
    if (!existing.arriveISO && offer.arriveISO) existing.arriveISO = offer.arriveISO;
    if (!existing.carrierName && offer.carrierName) existing.carrierName = offer.carrierName;
  }

  for (const offer of merged.values()) {
    offer.quotes.sort((a, b) => a.price + (a.fees ?? 0) - (b.price + (b.fees ?? 0)));
    // The headline price is the cheapest anyone sells it for.
    offer.price = offer.quotes[0]?.price ?? offer.price;
    offer.currency = offer.quotes[0]?.currency ?? offer.currency;
  }

  return [...merged.values()].sort((a, b) => a.price - b.price);
}

/** Hotels merge on name + city rather than on an id no two partners share. */
export function mergeHotels(lists) {
  const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const merged = new Map();

  for (const hotel of lists.flat()) {
    if (!hotel) continue;
    const key = `${norm(hotel.name)}|${hotel.cityCode ?? ""}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...hotel, quotes: [...hotel.quotes], sources: [hotel.source] });
      continue;
    }
    existing.quotes.push(...hotel.quotes);
    if (!existing.sources.includes(hotel.source)) existing.sources.push(hotel.source);
    if (existing.latitude == null && hotel.latitude != null) {
      existing.latitude = hotel.latitude;
      existing.longitude = hotel.longitude;
    }
    if (!existing.address && hotel.address) existing.address = hotel.address;
  }

  for (const hotel of merged.values()) {
    hotel.quotes.sort((a, b) => a.price + (a.fees ?? 0) - (b.price + (b.fees ?? 0)));
    hotel.price = hotel.quotes[0]?.price ?? null;
  }

  return [...merged.values()];
}
