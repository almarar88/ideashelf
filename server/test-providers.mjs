import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mapFlightOffers } from "./providers/amadeus.mjs";
import * as amadeus from "./providers/amadeus.mjs";
import * as travelpayouts from "./providers/travelpayouts.mjs";
import * as commons from "./providers/commons.mjs";
import { fetchRates } from "./providers/rates.mjs";
import { mergeOffers } from "./lib/merge.mjs";

/**
 * Checks every provider this build can reach.
 *
 * Run it after adding credentials to confirm they work before pointing the app
 * at the server: `node server/test-providers.mjs`. Providers without keys are
 * skipped rather than failed, and the response-mapping check runs always, from
 * a recorded payload, so a partner change is caught without spending quota.
 */

let failures = 0;
const pass = (name, detail = "") => console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail) => {
  failures++;
  console.log(`  FAIL  ${name} — ${detail}`);
};
const skip = (name, why) => console.log(`  SKIP  ${name} — ${why}`);

async function check(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail);
  } catch (err) {
    fail(name, err.message);
  }
}

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

console.log("\nAlcode Trips — provider check\n");

console.log("Mapping (no network, no credentials)");
await check("amadeus flight-offers mapping", () => {
  const payload = JSON.parse(
    readFileSync(fileURLToPath(new URL("./fixtures/amadeus-flight-offers.json", import.meta.url)), "utf8"),
  );
  const offers = mapFlightOffers(payload, { from: "DXB", to: "IST", currency: "USD" });
  if (offers.length !== 2) throw new Error(`expected 2 offers, got ${offers.length}`);
  const ek = offers.find((o) => o.carrierCode === "EK");
  if (!ek) throw new Error("EK offer missing");
  if (ek.durationMin !== 265) throw new Error(`EK duration ${ek.durationMin} != 265`);
  if (ek.baggageKg !== 30) throw new Error(`EK baggage ${ek.baggageKg} != 30`);
  if (ek.segments[0].aircraft !== "BOEING 777-300ER") throw new Error("aircraft not resolved from dictionary");
  const qr = offers.find((o) => o.carrierCode === "QR");
  if (qr.stops !== 1) throw new Error(`QR stops ${qr.stops} != 1`);
  return `${offers.length} offers, segments and dictionaries resolved`;
});

await check("multi-provider merge", () => {
  const a = [{ id: "a", source: "x", fromCode: "DXB", toCode: "IST", carrierCode: "EK", departISO: "2030-01-01T08:02:00", price: 410, quotes: [{ providerId: "x", price: 410, fees: 0 }] }];
  const b = [{ id: "b", source: "y", fromCode: "DXB", toCode: "IST", carrierCode: "EK", departISO: "2030-01-01T08:00:00", price: 389, quotes: [{ providerId: "y", price: 389, fees: 0 }] }];
  const merged = mergeOffers([a, b]);
  if (merged.length !== 1) throw new Error(`the same flight from two sites should merge into 1 card, got ${merged.length}`);
  if (merged[0].quotes.length !== 2) throw new Error("both quotes should survive the merge");
  if (merged[0].price !== 389) throw new Error(`headline price should be the cheapest quote, got ${merged[0].price}`);
  return "same flight from two sites merges into one comparison";
});

console.log("\nNo-credential providers");
await check("exchange rates", async () => {
  const r = await fetchRates("USD");
  if (!r.live) throw new Error(`fell back to the fixed table (source: ${r.source})`);
  if (!r.rates.EUR) throw new Error("EUR missing from the response");
  return `live, EUR ${r.rates.EUR}, updated ${r.updatedISO}`;
});

await check("destination photos", async () => {
  const d = await commons.destinationPhotos("Istanbul", { limit: 3 });
  if (d.photos.length === 0) throw new Error("no photos returned");
  if (!d.photos[0].licence) throw new Error("photo returned without a licence — attribution would be impossible");
  return `${d.photos.length} photos, first: ${d.photos[0].title.slice(0, 40)}`;
});

console.log("\nPartner providers");
if (amadeus.isConfigured()) {
  await check("amadeus auth + flight search", async () => {
    const offers = await amadeus.searchFlights({ from: "DXB", to: "IST", date: tomorrow(), adults: 1 });
    if (offers.length === 0) throw new Error("authenticated but no offers for this route/date — try another route");
    return `${offers.length} offers, cheapest ${offers[0].price} ${offers[0].currency}`;
  });
  await check("amadeus hotel search", async () => {
    const checkIn = tomorrow();
    const checkOut = new Date(new Date(checkIn).getTime() + 2 * 86400000).toISOString().slice(0, 10);
    const hotels = await amadeus.searchHotels({ cityCode: "DXB", checkIn, checkOut });
    if (hotels.length === 0) throw new Error("no hotels with availability for these dates");
    return `${hotels.length} hotels, cheapest ${hotels[0].quotes[0].price.toFixed(2)}/night`;
  });
} else {
  skip("amadeus", "AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET not set");
}

if (travelpayouts.isConfigured()) {
  await check("travelpayouts flight prices", async () => {
    const offers = await travelpayouts.searchFlights({ from: "DXB", to: "IST", date: tomorrow().slice(0, 7) });
    if (offers.length === 0) throw new Error("token accepted but no fares cached for this route");
    return `${offers.length} fares, cheapest ${offers[0].price} ${offers[0].currency}`;
  });
} else {
  skip("travelpayouts", "TRAVELPAYOUTS_TOKEN not set");
}

console.log(
  failures === 0
    ? "\nAll available checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
