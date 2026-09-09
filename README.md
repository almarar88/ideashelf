# Alcode Trips

A mobile travel app that puts flights, trains, boats, buses, hotels, car hire,
holiday packages, trip planning and international eSIM data plans behind one
search — and, for every result, shows what each booking site charges so the
cheapest **total** is obvious before you tap through.

The UI is a React web app; the Android app is the same codebase wrapped with
Capacitor, so one build produces both the installable APK and the web version.

- **Arabic (RTL) by default**, English available from Profile → Language.
- **Offline-capable**: fonts and artwork are bundled, nothing is fetched at
  runtime, and the traveller's bookings, plans and favourites persist locally.

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

## Where the prices come from

**The bundled build ships a demo catalogue, not live fares, and every screen
says so.** Prices, availability and provider quotes are generated from a seeded
local dataset so results are stable and the app works with no network.

`src/lib/aggregator.ts` is the seam for a real integration. `searchTrips`,
`searchHotels`, `searchCars` and `searchEsim` each take a query and return
results with a `quotes[]` array — one entry per booking site, sorted by the true
total (price + that site's fees). Replace the body of each function with the
partner HTTP call, keep the signature, and the entire UI works unchanged.

Connect partners by setting:

```
VITE_PARTNER_ENDPOINT=https://your-backend.example.com
VITE_PARTNER_KEY=...
```

`isLiveData()` then returns true and the "demo prices" notices disappear.

> Partner APIs (Amadeus, Booking.com, Expedia Rapid, Airalo, and the car-hire
> aggregators) require commercial agreements and server-side keys. Route them
> through your own backend — never ship a partner key in the app bundle.

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
  components/   Art (all inline SVG), BottomNav, OfferCard, PriceCompare, ui primitives
  data/         catalog.ts — providers, cities, carriers, terminals
  lib/          aggregator.ts (search + comparison), ai.ts, i18n.ts, format.ts, rng.ts, types.ts
  screens/      one file per screen
  state/        store.tsx — reducer + localStorage persistence
android/        Capacitor Android project (generated; safe to regenerate)
```

## Deploying the web build

The repository still carries the two Jekyll Pages workflows from before this
app existed; they publish the repo root and will not build a Vite app. The
**Deploy web app to Pages** workflow here does build it, but is manual
(`workflow_dispatch`) so the two cannot race. To make it automatic, delete
`.github/workflows/jekyll-*.yml` and add a `push: branches: [main]` trigger.
