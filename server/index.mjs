import { createServer } from "node:http";
import { createCache } from "./lib/cache.mjs";
import { USER_AGENT } from "./lib/http.mjs";
import { mergeHotels, mergeOffers } from "./lib/merge.mjs";
import * as amadeus from "./providers/amadeus.mjs";
import * as travelpayouts from "./providers/travelpayouts.mjs";
import * as commons from "./providers/commons.mjs";
import * as mock from "./providers/mock.mjs";
import { fetchRates } from "./providers/rates.mjs";

/**
 * Alcode Trips backend.
 *
 * The app cannot call partner APIs directly — the keys would ship inside the
 * APK and none of these APIs allow browser origins anyway. This process holds
 * the credentials, fans a single search out to every configured partner,
 * merges the responses into one comparison, and caches aggressively because
 * partner calls are metered.
 *
 * It runs with no credentials at all: the photo and exchange-rate providers
 * need none, and /health reports exactly which partners are live so the app
 * can tell the user whether prices are real.
 */

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";
const cache = createCache({ max: 800 });

const TTL = {
  flights: 10 * 60_000,
  hotels: 15 * 60_000,
  photos: 7 * 24 * 60 * 60_000,
  rates: 6 * 60 * 60_000,
  places: 24 * 60 * 60_000,
};

/**
 * Photo hotlinking is the default: Wikimedia serves its thumbnails from a CDN
 * and proxying them would put that bandwidth on this box for no gain. Some
 * corporate and mobile networks block those hosts outright, though, so
 * PROXY_IMAGES=1 rewrites every photo URL through /api/img instead.
 */
const PROXY_IMAGES = process.env.PROXY_IMAGES === "1";

/** Only Wikimedia's own image hosts — this endpoint must not become an SSRF. */
const IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org", "commons.wikimedia.org"]);

const proxiedUrl = (raw) =>
  PROXY_IMAGES && raw ? `/api/img?u=${encodeURIComponent(raw)}` : raw;

/**
 * Returns a copy of the payload with photo URLs pointed at /api/img.
 *
 * This must not mutate: responses are served straight out of the TTL cache, so
 * rewriting in place would wrap the same URL again on every cache hit until it
 * was nested beyond use.
 */
function rewritePhotos(node) {
  if (!PROXY_IMAGES || !node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(rewritePhotos);

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = rewritePhotos(value);
  }
  // A photo is an object carrying both a url and a licence; leave anything
  // already pointing at this server alone.
  if (typeof node.url === "string" && typeof node.licence === "string" && !node.url.startsWith("/api/img")) {
    out.url = proxiedUrl(node.url);
  }
  return out;
}

const providerStatus = () => ({
  amadeus: amadeus.isConfigured(),
  travelpayouts: travelpayouts.isConfigured(),
  photos: true,
  rates: true,
  mock: mock.isEnabled(),
});

const anyPriceProvider = () => amadeus.isConfigured() || travelpayouts.isConfigured();

/* ------------------------------- handlers ------------------------------- */

async function handleFlights(q) {
  const from = (q.get("from") ?? "").toUpperCase();
  const to = (q.get("to") ?? "").toUpperCase();
  const date = q.get("date") ?? "";
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) throw badRequest("from and to must be 3-letter IATA codes");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("date must be YYYY-MM-DD");

  const adults = clampInt(q.get("adults"), 1, 9, 1);
  const cabin = ["economy", "business", "first"].includes(q.get("cabin")) ? q.get("cabin") : "economy";
  const currency = (q.get("currency") ?? "USD").toUpperCase();
  const key = `flights|${from}|${to}|${date}|${adults}|${cabin}|${currency}`;

  return cache.wrap(key, TTL.flights, async () => {
    // Partners are queried in parallel and independently: one failing or timing
    // out must not lose the results the others returned.
    const jobs = [];
    if (amadeus.isConfigured()) {
      jobs.push(amadeus.searchFlights({ from, to, date, adults, cabin, currency }));
    }
    if (travelpayouts.isConfigured()) {
      jobs.push(travelpayouts.searchFlights({ from, to, date, currency }));
    }
    if (jobs.length === 0 && mock.isEnabled()) {
      // Flagged as mock, never as live: the badge in the app depends on this.
      return {
        live: false,
        mock: true,
        offers: mergeOffers([mock.searchFlights({ from, to, date, currency })]),
        providers: providerStatus(),
        fetchedISO: new Date().toISOString(),
      };
    }
    if (jobs.length === 0) {
      return { live: false, reason: "no price partner configured", offers: [], providers: providerStatus() };
    }

    const settled = await Promise.allSettled(jobs);
    const lists = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
    const errors = settled.filter((s) => s.status === "rejected").map((s) => String(s.reason?.message ?? s.reason));

    return {
      live: lists.some((l) => l.length > 0),
      offers: mergeOffers(lists),
      errors,
      providers: providerStatus(),
      fetchedISO: new Date().toISOString(),
    };
  });
}

async function handleHotels(q) {
  const cityCode = (q.get("city") ?? "").toUpperCase();
  const checkIn = q.get("checkIn") ?? "";
  const checkOut = q.get("checkOut") ?? "";
  if (!/^[A-Z]{3}$/.test(cityCode)) throw badRequest("city must be a 3-letter IATA city code");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    throw badRequest("checkIn and checkOut must be YYYY-MM-DD");
  }

  const adults = clampInt(q.get("adults"), 1, 9, 2);
  const rooms = clampInt(q.get("rooms"), 1, 5, 1);
  const currency = (q.get("currency") ?? "USD").toUpperCase();
  // Photo search needs a place name a photographer would have typed; "DXB"
  // matches nothing on Commons, "Dubai" matches thousands. The client knows
  // the name, so it sends it and the code is only a fallback.
  const cityName = (q.get("cityName") ?? "").trim().slice(0, 60) || cityCode;
  const key = `hotels|${cityCode}|${checkIn}|${checkOut}|${adults}|${rooms}|${currency}`;

  return cache.wrap(key, TTL.hotels, async () => {
    if (!amadeus.isConfigured() && mock.isEnabled()) {
      const hotels = mergeHotels([mock.searchHotels({ cityCode, checkIn, checkOut })]);
      await Promise.all(
        hotels.map(async (h) => {
          h.photo = await cache
            .wrap(`hotelphoto|${h.name}|${cityName}`, TTL.photos, () => commons.hotelPhoto(h.name, cityName))
            .catch(() => null);
        }),
      );
      return { live: false, mock: true, hotels, providers: providerStatus(), fetchedISO: new Date().toISOString() };
    }
    if (!amadeus.isConfigured()) {
      return { live: false, reason: "no hotel partner configured", hotels: [], providers: providerStatus() };
    }
    const list = await amadeus
      .searchHotels({ cityCode, checkIn, checkOut, adults, rooms, currency })
      .catch((err) => {
        throw new Error(`amadeus hotels: ${err.message}`);
      });

    const hotels = mergeHotels([list]);

    // Photos are enriched per hotel, but only where the picture genuinely
    // depicts that property — see hotelPhoto().
    await Promise.all(
      hotels.slice(0, 8).map(async (h) => {
        h.photo = await cache
          .wrap(`hotelphoto|${h.name}|${cityName}`, TTL.photos, () => commons.hotelPhoto(h.name, cityName))
          .catch(() => null);
      }),
    );

    return { live: hotels.length > 0, hotels, providers: providerStatus(), fetchedISO: new Date().toISOString() };
  });
}

async function handlePlace(q) {
  const name = (q.get("q") ?? "").trim();
  if (!name || name.length > 80) throw badRequest("q is required");
  const limit = clampInt(q.get("limit"), 1, 8, 5);
  return cache.wrap(`place|${name}|${limit}`, TTL.places, () =>
    commons.destinationPhotos(name, { limit }),
  );
}

async function handlePhotos(q) {
  const term = (q.get("q") ?? "").trim();
  if (!term || term.length > 80) throw badRequest("q is required");
  const limit = clampInt(q.get("limit"), 1, 12, 6);
  return cache.wrap(`photos|${term}|${limit}`, TTL.photos, () =>
    commons.searchPhotos(term, { limit }).then((photos) => ({ term, photos })),
  );
}

async function handleRates(q) {
  const base = (q.get("base") ?? "USD").toUpperCase();
  return cache.wrap(`rates|${base}`, TTL.rates, () => fetchRates(base));
}

async function handleLocations(q) {
  const keyword = (q.get("q") ?? "").trim();
  if (!keyword) throw badRequest("q is required");
  if (!amadeus.isConfigured()) return { locations: [], live: false };
  return cache.wrap(`loc|${keyword}`, TTL.places, async () => ({
    locations: await amadeus.findLocation(keyword),
    live: true,
  }));
}

const ROUTES = {
  "/api/flights": handleFlights,
  "/api/hotels": handleHotels,
  "/api/place": handlePlace,
  "/api/photos": handlePhotos,
  "/api/rates": handleRates,
  "/api/locations": handleLocations,
};

/* -------------------------------- server -------------------------------- */

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function clampInt(raw, min, max, fallback) {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function send(res, status, payload) {
  const body = JSON.stringify(rewritePhotos(payload));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "public, max-age=60",
  });
  res.end(body);
}

/** Streams one Wikimedia image through this server. */
async function streamImage(url, res) {
  const raw = url.searchParams.get("u") ?? "";
  let target;
  try {
    target = new URL(raw);
  } catch {
    return send(res, 400, { error: "u must be an absolute URL" });
  }
  if (target.protocol !== "https:" || !IMAGE_HOSTS.has(target.hostname)) {
    return send(res, 403, { error: "host not allowed" });
  }

  try {
    const upstream = await fetch(target, { headers: { "User-Agent": USER_AGENT } });
    if (!upstream.ok || !upstream.body) return send(res, 502, { error: `upstream ${upstream.status}` });

    res.writeHead(200, {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      // Commons files are immutable at a given thumbnail URL.
      "Cache-Control": "public, max-age=604800, immutable",
    });
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    send(res, 502, { error: String(err.message ?? "image fetch failed") });
  }
}

export const app = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }
  if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health" || url.pathname === "/") {
    return send(res, 200, {
      ok: true,
      service: "alcode-trips-api",
      providers: providerStatus(),
      livePrices: anyPriceProvider(),
      cached: cache.size,
      time: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/img") return streamImage(url, res);

  const handler = ROUTES[url.pathname];
  if (!handler) return send(res, 404, { error: "not found" });

  try {
    return send(res, 200, await handler(url.searchParams));
  } catch (err) {
    const status = err.status ?? 502;
    // Never leak a key or an upstream URL in an error body.
    const message = String(err.message ?? "upstream error").replace(/([?&](token|apikey|client_secret)=)[^&\s]+/gi, "$1***");
    return send(res, status, { error: message });
  }
});

// Importing this file for tests must not bind a port.
if (process.argv[1] && process.argv[1].endsWith("index.mjs")) {
  app.listen(PORT, () => {
    const live = Object.entries(providerStatus())
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(", ");
    console.log(`alcode-trips-api listening on :${PORT}`);
    console.log(`providers active: ${live || "none"}`);
    if (!anyPriceProvider()) {
      console.log("no price partner configured — /api/flights and /api/hotels will report live:false");
    }
  });
}
