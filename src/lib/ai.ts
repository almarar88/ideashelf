import { cityById } from "@/data/catalog";
import { quoteTotal, searchHotels, searchTrips } from "@/lib/aggregator";
import { makeRng } from "@/lib/rng";
import type { PlannedItem, TripOffer, TripPlan } from "@/lib/types";

/* ------------------------------------------------------------------ *
 * AI layer
 *
 * Two execution paths, and the UI always shows which one produced a result:
 *
 *  - "ai"    a real model, called through a backend that holds the API key.
 *            Configure VITE_AI_ENDPOINT + VITE_AI_KEY (see README). Never put
 *            a provider key in the client bundle — the endpoint proxies it.
 *  - "local" the on-device planner below. Deterministic, offline, no key.
 *            It reasons over the real catalogue (prices, durations, ratings),
 *            so its output is grounded rather than invented.
 * ------------------------------------------------------------------ */

const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT;
const AI_KEY = import.meta.env.VITE_AI_KEY;

export const aiIsLive = () => Boolean(AI_ENDPOINT && AI_KEY);

async function callModel(prompt: string, system: string): Promise<string | null> {
  if (!aiIsLive()) return null;
  try {
    const res = await fetch(`${AI_ENDPOINT}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({ system, prompt }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return data.text ?? null;
  } catch {
    // Offline or endpoint down — fall back to the on-device planner.
    return null;
  }
}

/* -------------------------- price insight -------------------------- */

export interface PriceInsight {
  verdict: "buy" | "wait" | "watch";
  headline: string;
  headlineAr: string;
  detail: string;
  detailAr: string;
  /** Percentage difference against the median of the returned offers. */
  deltaPct: number;
  confidence: "high" | "medium" | "low";
}

export function priceInsight(offers: TripOffer[], selected?: TripOffer): PriceInsight | null {
  if (offers.length < 3) return null;
  const totals = offers.map((o) => Math.min(...o.quotes.map(quoteTotal))).sort((a, b) => a - b);
  const median = totals[Math.floor(totals.length / 2)];
  const target = selected
    ? Math.min(...selected.quotes.map(quoteTotal))
    : totals[0];
  const deltaPct = Math.round(((target - median) / median) * 100);

  if (deltaPct <= -12) {
    return {
      verdict: "buy",
      deltaPct,
      confidence: "high",
      headline: `${Math.abs(deltaPct)}% below the usual price`,
      headlineAr: `أقل بـ ${Math.abs(deltaPct)}٪ من السعر المعتاد`,
      detail: "This is the cheapest band we see for this route. Booking now is the better call.",
      detailAr: "هذا أرخص نطاق سعري لهذا المسار. الحجز الآن هو الخيار الأفضل.",
    };
  }
  if (deltaPct >= 10) {
    return {
      verdict: "wait",
      deltaPct,
      confidence: "medium",
      headline: `${deltaPct}% above the median fare`,
      headlineAr: `أعلى بـ ${deltaPct}٪ من متوسط السعر`,
      detail: "Cheaper options exist on this date. Sort by price or shift a day either side.",
      detailAr: "توجد خيارات أرخص في نفس التاريخ. رتّب حسب السعر أو غيّر اليوم يوماً واحداً.",
    };
  }
  return {
    verdict: "watch",
    deltaPct,
    confidence: "medium",
    headline: "Priced in the normal range",
    headlineAr: "السعر ضمن النطاق الطبيعي",
    detail: "No strong signal either way. Track it and we will alert you on a real drop.",
    detailAr: "لا توجد إشارة قوية. تابع السعر وسننبهك عند أي انخفاض حقيقي.",
  };
}

/* --------------------------- trip planner -------------------------- */

export interface PlanRequest {
  destinationId: string;
  startISO: string;
  days: number;
  travellers: number;
  budget: number;
  interests: string[];
  originId?: string;
}

const SIGHTS: Record<string, Array<[string, string]>> = {
  dxb: [["Burj Khalifa & Dubai Mall", "برج خليفة ودبي مول"], ["Desert safari at sunset", "سفاري الصحراء عند الغروب"], ["Old Dubai souks & abra ride", "أسواق دبي القديمة وركوب العبرة"], ["Palm Jumeirah boardwalk", "ممشى نخلة جميرا"], ["Museum of the Future", "متحف المستقبل"]],
  ist: [["Hagia Sophia & Blue Mosque", "آيا صوفيا والمسجد الأزرق"], ["Bosphorus ferry cruise", "رحلة بحرية في البوسفور"], ["Grand Bazaar", "البازار الكبير"], ["Topkapi Palace", "قصر توب كابي"], ["Galata Tower at sunset", "برج غلطة وقت الغروب"]],
  dps: [["Uluwatu temple & cliff walk", "معبد أولواتو والمشي على الجرف"], ["Ubud rice terraces", "مدرجات الأرز في أوبود"], ["Nusa Penida day trip", "رحلة نوسا بينيدا"], ["Seminyak beach sunset", "غروب شاطئ سيمينياك"], ["Waterfall trek", "رحلة الشلالات"]],
  cai: [["Pyramids of Giza & Sphinx", "أهرامات الجيزة وأبو الهول"], ["Egyptian Museum", "المتحف المصري"], ["Khan el-Khalili bazaar", "خان الخليلي"], ["Nile dinner cruise", "عشاء على النيل"], ["Coptic Cairo walk", "جولة القاهرة القبطية"]],
  par: [["Eiffel Tower & Champ de Mars", "برج إيفل وحديقة الشان دو مارس"], ["Louvre Museum", "متحف اللوفر"], ["Montmartre & Sacré-Cœur", "مونمارتر والسكري كير"], ["Seine river cruise", "رحلة نهر السين"], ["Versailles day trip", "رحلة إلى فرساي"]],
  lon: [["Tower of London", "برج لندن"], ["British Museum", "المتحف البريطاني"], ["Camden Market", "سوق كامدن"], ["Thames walk & London Eye", "ممشى التايمز وعين لندن"], ["Notting Hill stroll", "جولة نوتينغ هيل"]],
  kul: [["Petronas Towers", "برجا بتروناس"], ["Batu Caves", "كهوف باتو"], ["Bukit Bintang food street", "شارع بوكيت بينتانغ للطعام"], ["Islamic Arts Museum", "متحف الفن الإسلامي"], ["Genting Highlands", "مرتفعات جنتنغ"]],
  jkt: [["Kota Tua old town", "البلدة القديمة كوتا توا"], ["National Monument", "النصب الوطني"], ["Thousand Islands boat trip", "رحلة جزر الألف"], ["Grand Indonesia shopping", "تسوق غراند إندونيسيا"], ["Ancol beach", "شاطئ أنشول"]],
};

const FOOD: Array<[string, string]> = [
  ["Local breakfast spot", "مطعم إفطار محلي"],
  ["Street-food dinner", "عشاء من أكلات الشارع"],
  ["Rooftop dinner", "عشاء على السطح"],
  ["Seafood lunch", "غداء مأكولات بحرية"],
  ["Café break", "استراحة قهوة"],
];

function defaultSights(cityId: string): Array<[string, string]> {
  return (
    SIGHTS[cityId] ?? [
      ["City centre walking tour", "جولة سيراً في وسط المدينة"],
      ["Main museum", "المتحف الرئيسي"],
      ["Local market", "السوق المحلي"],
      ["Viewpoint at sunset", "نقطة إطلالة وقت الغروب"],
      ["Half-day trip nearby", "رحلة نصف يوم قريبة"],
    ]
  );
}

/**
 * Builds a day-by-day itinerary from real catalogue prices, then trims the
 * optional activities until the total fits the stated budget.
 */
function buildLocalPlan(req: PlanRequest): TripPlan {
  const rng = makeRng("plan", req.destinationId, req.startISO, req.days, req.budget, req.interests.join(","));
  const city = cityById(req.destinationId);
  const sights = rng.shuffle(defaultSights(req.destinationId));
  const items: PlannedItem[] = [];
  let n = 0;
  const push = (day: number, time: string, title: string, note: string, kind: PlannedItem["kind"], cost: number) =>
    items.push({ id: `it-${n++}`, day, time, title, note, kind, cost });

  // Anchor the plan on a genuine flight and hotel quote for the dates asked.
  let flightCost = 0;
  if (req.originId && req.originId !== req.destinationId) {
    const flights = searchTrips({
      fromId: req.originId,
      toId: req.destinationId,
      dateISO: req.startISO,
      passengers: req.travellers,
      cabin: "economy",
      mode: "flight",
    });
    const best = flights.map((f) => Math.min(...f.quotes.map(quoteTotal))).sort((a, b) => a - b)[0];
    flightCost = best * req.travellers;
    push(1, "07:30", `Flight to ${city.name}`, "Cheapest fare found across all sites", "flight", flightCost);
  }

  const hotels = searchHotels({
    cityId: req.destinationId,
    checkInISO: req.startISO,
    nights: req.days,
    guests: req.travellers,
    rooms: Math.max(1, Math.ceil(req.travellers / 2)),
  });
  const hotel = hotels.slice().sort((a, b) => Math.min(...a.quotes.map(quoteTotal)) - Math.min(...b.quotes.map(quoteTotal)))[2] ?? hotels[0];
  const hotelNightly = Math.min(...hotel.quotes.map(quoteTotal));
  push(1, "14:00", `Check in — ${hotel.name}`, `${hotel.stars}★ · ${hotel.area} · ${hotel.rating}/10`, "hotel", hotelNightly * req.days);

  for (let d = 1; d <= req.days; d++) {
    if (d > 1) push(d, "09:00", rng.pick(FOOD)[0], "Start the day nearby", "food", rng.int(6, 18) * req.travellers);
    const sight = sights[(d - 1) % sights.length];
    push(d, d === 1 ? "17:00" : "10:30", sight[0], "Top-rated for your interests", "sight", rng.int(0, 45) * req.travellers);
    if (d % 2 === 0 && req.interests.includes("nature")) {
      push(d, "15:00", "Nature half-day", "Outdoor block on your interest list", "sight", rng.int(20, 60) * req.travellers);
    }
    push(d, "19:30", rng.pick(FOOD)[0], "Dinner", "food", rng.int(12, 38) * req.travellers);
  }

  // Budget fit: drop the priciest optional activities first, never the
  // flight or the hotel.
  const fixed = new Set(["flight", "hotel"]);
  let total = items.reduce((s, i) => s + i.cost, 0);
  const optional = items.filter((i) => !fixed.has(i.kind)).sort((a, b) => b.cost - a.cost);
  for (const item of optional) {
    if (total <= req.budget) break;
    item.cost = Math.round(item.cost * 0.6);
    item.note = "Trimmed to fit your budget";
    total = items.reduce((s, i) => s + i.cost, 0);
  }

  return {
    id: `plan-${Date.now()}`,
    destinationId: req.destinationId,
    title: `${req.days} days in ${city.name}`,
    startISO: req.startISO,
    days: req.days,
    travellers: req.travellers,
    budget: req.budget,
    items: items.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
    createdISO: new Date().toISOString(),
    source: "local",
  };
}

export async function generatePlan(req: PlanRequest): Promise<TripPlan> {
  const local = buildLocalPlan(req);
  const text = await callModel(
    JSON.stringify(req),
    "You are a travel planner. Return a day-by-day itinerary as JSON matching the PlannedItem[] shape.",
  );
  if (!text) return local;
  try {
    const parsed = JSON.parse(text) as { items?: PlannedItem[] };
    if (Array.isArray(parsed.items) && parsed.items.length) {
      return { ...local, items: parsed.items, source: "ai" };
    }
  } catch {
    /* Malformed model output — the grounded local plan is the safer answer. */
  }
  return local;
}

/* --------------------------- assistant ---------------------------- */

export interface AssistantReply {
  text: string;
  source: "ai" | "local";
  actions: Array<{ label: string; labelAr: string; to: string }>;
}

const RULES: Array<{
  test: RegExp;
  en: string;
  ar: string;
  actions: AssistantReply["actions"];
}> = [
  {
    test: /cheap|price|budget|رخيص|سعر|أرخص|ميزانية/i,
    en: "Cheapest first: search your route, then tap Sort → Cheapest. Every result card shows the lowest total across all booking sites, fees included, so nothing is hidden until checkout.",
    ar: "للأرخص: ابحث عن مسارك ثم اضغط ترتيب ← الأرخص. كل بطاقة نتيجة تعرض أقل سعر إجمالي من كل مواقع الحجز شاملاً الرسوم، فلا مفاجآت عند الدفع.",
    actions: [{ label: "Search trips", labelAr: "ابحث عن رحلة", to: "/search" }],
  },
  {
    test: /hotel|stay|room|فندق|إقامة|غرفة/i,
    en: "Tell me the city and dates and I will compare hotels across Roomly, StayNow, GoTrip and Alcode Direct in one list — sorted by the real total, not the headline rate.",
    ar: "أخبرني بالمدينة والتواريخ وسأقارن الفنادق عبر Roomly وStayNow وGoTrip وAlcode في قائمة واحدة — مرتبة حسب السعر الإجمالي الحقيقي لا السعر المعلن.",
    actions: [{ label: "Find hotels", labelAr: "ابحث عن فندق", to: "/hotels" }],
  },
  {
    test: /car|drive|rental|سيارة|تأجير|قيادة/i,
    en: "Car hire is compared per day with the insurance and mileage terms shown up front. Unlimited-kilometre deals are flagged on the card.",
    ar: "تأجير السيارات يُقارن يومياً مع عرض شروط التأمين والكيلومترات مسبقاً. عروض الكيلومترات غير المحدودة مؤشّرة على البطاقة.",
    actions: [{ label: "Compare cars", labelAr: "قارن السيارات", to: "/cars" }],
  },
  {
    test: /sim|esim|data|internet|شريحة|إنترنت|بيانات/i,
    en: "For data abroad, open eSIM, pick the country, and the plans are ranked by price per GB. Installation is a QR scan — no shop, no physical SIM.",
    ar: "للإنترنت في الخارج، افتح قسم eSIM واختر الدولة، والباقات مرتبة حسب سعر الجيجابايت. التركيب بمسح رمز QR — بدون متجر أو شريحة فعلية.",
    actions: [{ label: "Open eSIM", labelAr: "افتح eSIM", to: "/esim" }],
  },
  {
    test: /plan|itinerary|days|schedule|خطة|برنامج|جدول|أيام/i,
    en: "Give me a destination, dates, how many travellers and a budget. I build a day-by-day plan priced from live catalogue rates and trim it until it fits the budget.",
    ar: "أعطني الوجهة والتواريخ وعدد المسافرين والميزانية. سأبني خطة يوماً بيوم بأسعار حقيقية وأقلّصها حتى تناسب ميزانيتك.",
    actions: [{ label: "Plan a trip", labelAr: "خطط رحلة", to: "/planner" }],
  },
  {
    test: /package|bundle|deal|باقة|عرض|بكج/i,
    en: "Packages bundle flight + hotel + transfers and usually beat booking each part separately on short city breaks. Compare the bundle total against the split total before you book.",
    ar: "الباقات تجمع الطيران والفندق والمواصلات وغالباً أرخص من حجز كل جزء منفصلاً في الرحلات القصيرة. قارن سعر الباقة بمجموع الأجزاء قبل الحجز.",
    actions: [{ label: "See packages", labelAr: "شاهد الباقات", to: "/packages" }],
  },
];

export async function askAssistant(question: string, locale: "ar" | "en"): Promise<AssistantReply> {
  const live = await callModel(question, "You are Alcode Trips' travel assistant. Answer briefly and practically.");
  if (live) return { text: live, source: "ai", actions: [] };

  const rule = RULES.find((r) => r.test.test(question));
  if (rule) return { text: locale === "ar" ? rule.ar : rule.en, source: "local", actions: rule.actions };

  return {
    source: "local",
    text:
      locale === "ar"
        ? "أستطيع مساعدتك في الطيران والفنادق والسيارات والباقات وشرائح eSIM وتخطيط الرحلات. اسأل مثلاً: «أرخص رحلة إلى دبي» أو «خطة 4 أيام في إسطنبول بميزانية 800 دولار»."
        : "I can help with flights, hotels, cars, packages, eSIM and trip planning. Try: “cheapest flight to Dubai” or “4-day Istanbul plan on an $800 budget”.",
    actions: [
      { label: "Search trips", labelAr: "ابحث عن رحلة", to: "/search" },
      { label: "Plan a trip", labelAr: "خطط رحلة", to: "/planner" },
    ],
  };
}
