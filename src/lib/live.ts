import { useEffect, useMemo, useRef, useState } from "react";
import { cityById } from "@/data/catalog";
import { apiConfigured, fetchFlights, fetchHotels, fetchPlace } from "@/lib/api";
import type { PlaceInfo } from "@/lib/api";
import { searchHotels as demoHotels, searchTrips as demoTrips } from "@/lib/aggregator";
import type { HotelQuery, TripQuery } from "@/lib/aggregator";
import type { Hotel, Photo, TripOffer } from "@/lib/types";

/** Catalogue cities carry their own IATA code; live queries need just that. */
const fromCode = (cityId: string) => cityById(cityId).code;

export type DataSource = "live" | "mock" | "demo" | "loading";

interface Result<T> {
  data: T;
  source: DataSource;
  /** Why live data was unavailable, when the backend told us. */
  reason?: string;
  refreshedISO?: string;
}

/**
 * Results arrive in two passes: the bundled catalogue paints instantly so the
 * screen is never empty, then live partner results replace it if the backend
 * returns any. A failed or empty live call leaves the demo data in place and
 * says so, rather than blanking a working screen.
 */
export function useTripOffers(query: TripQuery, currency: string): Result<TripOffer[]> {
  const demo = useMemo(() => demoTrips(query), [query]);
  const [live, setLive] = useState<Result<TripOffer[]> | null>(null);
  const requestId = useRef(0);

  const key = `${query.fromId}|${query.toId}|${query.dateISO}|${query.mode}|${query.cabin}|${query.passengers}|${currency}`;

  useEffect(() => {
    // Only flights have a partner behind them today; the other modes stay on
    // the catalogue, and the UI labels them accordingly.
    if (!apiConfigured() || query.mode !== "flight") {
      setLive(null);
      return;
    }

    const id = ++requestId.current;
    setLive({ data: [], source: "loading" });

    (async () => {
      const res = await fetchFlights({
        from: fromCode(query.fromId),
        to: fromCode(query.toId),
        date: query.dateISO,
        adults: query.passengers,
        cabin: query.cabin,
        currency,
      });
      // A newer search started while this one was in flight — drop the result.
      if (id !== requestId.current) return;

      if (!res || res.offers.length === 0) {
        setLive({ data: [], source: "demo", reason: res?.reason ?? "no live results" });
        return;
      }
      setLive({ data: res.offers, source: res.mock ? "mock" : "live", refreshedISO: res.fetchedISO });
    })();
  }, [key, query.mode, query.fromId, query.toId, query.dateISO, query.passengers, query.cabin, currency]);

  if (live?.source === "live" || live?.source === "mock") return live;
  if (live?.source === "loading") return { data: demo, source: "loading" };
  return { data: demo, source: "demo", reason: live?.reason };
}

export function useHotelResults(query: HotelQuery, currency: string): Result<Hotel[]> {
  const demo = useMemo(() => demoHotels(query), [query]);
  const [live, setLive] = useState<Result<Hotel[]> | null>(null);
  const requestId = useRef(0);

  const key = `${query.cityId}|${query.checkInISO}|${query.nights}|${query.guests}|${query.rooms}|${currency}`;

  useEffect(() => {
    if (!apiConfigured()) {
      setLive(null);
      return;
    }
    const id = ++requestId.current;
    setLive({ data: [], source: "loading" });

    (async () => {
      const checkOut = new Date(`${query.checkInISO}T00:00:00`);
      checkOut.setDate(checkOut.getDate() + query.nights);

      const res = await fetchHotels({
        cityId: query.cityId,
        checkIn: query.checkInISO,
        checkOut: checkOut.toISOString().slice(0, 10),
        adults: query.guests,
        rooms: query.rooms,
        currency,
      });
      if (id !== requestId.current) return;

      if (!res || res.hotels.length === 0) {
        setLive({ data: [], source: "demo", reason: res?.reason ?? "no live results" });
        return;
      }
      setLive({ data: res.hotels, source: res.mock ? "mock" : "live" });
    })();
  }, [key, query.cityId, query.checkInISO, query.nights, query.guests, query.rooms, currency]);

  if (live?.source === "live" || live?.source === "mock") return live;
  if (live?.source === "loading") return { data: demo, source: "loading" };
  return { data: demo, source: "demo", reason: live?.reason };
}

/**
 * Destination photos, cached for the life of the session.
 *
 * The recommendation rows ask for the same handful of cities on every visit,
 * and the backend caches for a day, but repeating the request on each mount
 * still costs a round trip and a flash of the placeholder — so resolved places
 * are held here too.
 */
const placeCache = new Map<string, PlaceInfo | null>();

export function useCityPhoto(cityId: string | null): Photo | null {
  const query = cityId ? `${cityById(cityId).name}, ${cityById(cityId).country}` : null;
  const [photo, setPhoto] = useState<Photo | null>(() => (query ? placeCache.get(query)?.photos[0] ?? null : null));

  useEffect(() => {
    if (!query || !apiConfigured()) return;
    if (placeCache.has(query)) {
      setPhoto(placeCache.get(query)?.photos[0] ?? null);
      return;
    }
    let cancelled = false;
    fetchPlace(query, 1).then((info) => {
      placeCache.set(query, info);
      if (!cancelled) setPhoto(info?.photos[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return photo;
}

/** Real photos and an encyclopaedia description for a destination. */
export function usePlace(query: string | null, limit = 5): PlaceInfo | null {
  const [info, setInfo] = useState<PlaceInfo | null>(null);

  useEffect(() => {
    if (!query || !apiConfigured()) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    fetchPlace(query, limit).then((res) => {
      if (!cancelled) setInfo(res);
    });
    return () => {
      cancelled = true;
    };
  }, [query, limit]);

  return info;
}
