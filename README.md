# Alcode Trips

A mobile travel app that puts flights, trains, boats, buses, hotels, car hire,
holiday packages, trip planning and international eSIM data plans behind one
search — and, for every result, shows what each booking site charges so the
cheapest **total** is obvious before you tap through.

The UI is a React web app; the Android app is the same codebase wrapped with
Capacitor, so one build produces both the installable APK and the web version.

- **Arabic (RTL) by default**, English available from Profile → Language.
- **Real prices** from booking partners once keys are configured, with real
  photographs and live exchange rates that need no key at all.
- **Offline-capable**: fonts and artwork are bundled, the app falls back to its
  own catalogue when the network is gone, and bookings, plans and favourites
  persist locally.

## Screens

| | |
|---|---|
| **Home** | Points balance, transport categories, service tiles, upcoming schedules, recommended destinations |
| **Search** | One-way / round trip, city pickers, dates, passengers and cabin |
| **Results** | Sorted offers, filters, and an AI read on whether the price is good |
| **Offer** | Full itinerary plus the price comparison across every site |
| **Ticket** | Boarding pass with barcode, gate, seat, and a downloadable copy |
| **Hotels / Hotel** | Search by city and dates, compare rates per site |
| **Cars** | Compare daily rates, transmission, mileage and insurance terms |
| **Packages** | Flight + hotel + transfers bundles priced against booking separately |
| **eSIM** | Country picker, plans ranked by price per GB, QR-install flow |
| **Trip Planner** | Day-by-day AI itinerary priced from real rates, trimmed to a budget |
| **Assistant** | Chat that answers travel questions and links to the right screen |
| **Trips / Deals / More / Profile / Notifications** | Bookings, vouchers, settings, loyalty tier |

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production web build into dist/
npm run preview    # serve the production build
```

## Building the Android app

Requires the Android SDK (platform 34, build-tools 34) and JDK 17+.

```bash
npm run android:sync     # builds the web app and copies it into android/
npm run android:build    # produces android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:sync` builds with `APP_BASE=./` because Capacitor serves the
bundle from the app's own asset server; the plain `npm run build` keeps the
`/ideashelf/` base that GitHub Pages needs.

For a release build, generate a keystore, add the signing config to
`android/app/build.gradle`, then `./gradlew assembleRelease` (or `bundleRelease`
for a Play Store `.aab`).

The **Build Android APK** GitHub Actions workflow builds the debug APK on
demand and uploads it as a downloadable artifact — useful if you do not have
Android Studio to hand.

## Where the data comes from

The app runs on three tiers of data, and **every screen states which tier it is
showing** — a price comparison tool that implied demo figures were live fares
would be worse than useless.

| Tier | What it covers | Needs a key |
|---|---|---|
| **Live partners** | Real flight and hotel prices, one quote per booking site | Yes — free tiers available |
| **Keyless sources** | Destination and hotel photographs, exchange rates | No |
| **Bundled catalogue** | Everything else, and the fallback when a partner is unreachable | No |

### The backend (`server/`)

The app cannot call partner APIs directly: the credentials would ship inside
the APK, and none of these APIs accept browser origins. `server/` is a small
Node service (no runtime dependencies) that holds the keys, fans one search out
to every configured partner in parallel, merges the responses into a single
comparison, and caches hard because partner calls are metered.

```bash
cd server
cp .env.example .env      # add whichever keys you have
node --env-file=.env index.mjs
```

It starts with no credentials at all — photos and exchange rates need none, and
`/health` reports exactly which partners are active. Point the app at it:

```bash
VITE_API_URL=https://your-server.example.com npm run build
```

Deploy it anywhere that runs Node 20 (Render, Railway, Fly.io, a VPS). Set
`ALLOWED_ORIGIN` to your app's origin in production.

**Endpoints**

| Route | Returns |
|---|---|
| `GET /health` | Which providers are configured, and whether prices are live |
| `GET /api/flights` | Merged flight offers with one quote per booking site |
| `GET /api/hotels` | Hotels with per-site rates and a photo |
| `GET /api/place` | Destination photos plus an encyclopaedia description |
| `GET /api/photos` | Photo search by term |
| `GET /api/rates` | Live exchange rates |
| `GET /api/locations` | Free-text place to IATA code |
| `GET /api/img` | Optional image proxy (`PROXY_IMAGES=1`) |

### Getting real prices

Two partners are implemented. Either one alone gives real fares; both together
give an actual comparison, because the merge puts each site's price for the
same flight on one card.

**Amadeus Self-Service** — real flights *and* hotels.
Sign up free at [developers.amadeus.com](https://developers.amadeus.com),
create a Self-Service app, and copy the key and secret into
`AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`. The default test host serves
real cached fares on a limited set of routes; a production key plus
`AMADEUS_HOST=https://api.amadeus.com` switches to full inventory.

**Travelpayouts (Aviasales)** — real fares that come with a bookable affiliate
link, which is what makes the "Book on…" button go somewhere. Free token from
[travelpayouts.com](https://www.travelpayouts.com) into `TRAVELPAYOUTS_TOKEN`.

Verify before pointing the app at it:

```bash
node --env-file=server/.env server/test-providers.mjs
```

It checks every configured provider, skips the ones without keys, and always
runs the response-mapping checks from a recorded payload — so a partner
changing a field is caught without spending quota.

Adding a third partner is one file in `server/providers/` exporting
`searchFlights` or `searchHotels` in the shape the others return, plus a line
in the fan-out in `server/index.mjs`. The merge and the whole UI follow.

### Photos, and what they are honest about

Destination and hotel photographs come from Wikimedia Commons and Wikipedia —
real images, no key, no quota. They are CC-licensed, so the licence is shown on
every thumbnail and the full credit with the author on detail screens.

A hotel only gets a photo *of that hotel* when the file genuinely matches the
property name. Otherwise the app falls back to a photo of the city and labels
it "city photo, not this property" rather than passing it off as the hotel. The
illustrated scene stays behind every image, so a slow or offline connection
shows a designed placeholder instead of a grey box.

Exchange rates are fetched daily from a keyless provider; the fixed table in
`src/lib/format.ts` is only a fallback, and the app knows the difference.

### Developing without partner keys

`MOCK_PARTNERS=1` serves a recorded Amadeus response through the exact same
mapping, merge and HTTP path the live providers use, so the whole chain can be
exercised without credentials. Everything it returns is flagged and appears
under an amber "development fixtures — not real prices" badge. Never enable it
in production.

## Booking

The app hands the traveller to the site that sells the trip — the partner takes
the payment and issues the ticket, which is how every meta-search works. That
flow is built and working: the button on each offer opens the partner's real
booking page, and the trip is recorded as a *saved trip*, never as a ticket the
app did not issue.

Add `VITE_AFFILIATE_MARKER` (app) and `TRAVELPAYOUTS_MARKER` (server) to earn
commission on those hand-offs. Without them the links still work.

Booking *inside* the app is a different undertaking — a travel licence, card
handling and 24/7 support, not just code. The provider for it
(`server/providers/duffel.mjs`) is implemented and tested, and the endpoints
are guarded behind `ENABLE_BOOKING`. **[BOOKING.md](BOOKING.md) compares both
paths and lists exactly what each one needs.**

## The AI layer

`src/lib/ai.ts` runs in one of two modes, and the UI always labels which:

- **On-device** (default): a deterministic planner that reasons over the real
  catalogue — it prices a genuine flight and hotel for your dates, builds a
  day-by-day itinerary, then trims optional activities until the total fits your
  budget. No key, no network, grounded in actual numbers.
- **Live model**: set `VITE_AI_ENDPOINT` and `VITE_AI_KEY` to point at a backend
  that proxies a model provider. The client never holds the provider key. If the
  call fails or returns malformed output, the on-device plan is used instead.

The price verdict on the results screen ("below the usual price" / "above the
median fare") is computed from the spread of the returned offers, not guessed.

## Project layout

```
src/
  components/   Art (inline SVG), Photo, DataBadge, OfferCard, PriceCompare, ui primitives
  data/         catalog.ts — providers, cities, carriers, terminals
  lib/          api.ts (backend client), live.ts (live/demo hooks), aggregator.ts
                (demo catalogue + comparison), ai.ts, i18n.ts, format.ts, rng.ts, types.ts
  screens/      one file per screen
  state/        store.tsx — reducer + localStorage persistence
server/
  index.mjs     HTTP routing, caching, image proxy
  providers/    amadeus, travelpayouts, commons (photos), rates, mock
  lib/          cache (TTL + single-flight), merge (one card per flight), http
  fixtures/     recorded partner payloads for the mapping tests
android/        Capacitor Android project (generated; safe to regenerate)
```

## Deploying the web build

The repository still carries the two Jekyll Pages workflows from before this
app existed; they publish the repo root and will not build a Vite app. The
**Deploy web app to Pages** workflow here does build it, but is manual
(`workflow_dispatch`) so the two cannot race. To make it automatic, delete
`.github/workflows/jekyll-*.yml` and add a `push: branches: [main]` trigger.
