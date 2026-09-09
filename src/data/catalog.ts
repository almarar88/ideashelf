import type { Carrier, City, Provider } from "@/lib/types";

/**
 * Booking sites Alcode Trips compares. `feeFactor` and the adapters in
 * lib/aggregator.ts are what a real integration would replace: each provider
 * here maps 1:1 to an affiliate/partner API (Amadeus, Booking.com, Expedia
 * Rapid, Airalo, …). Until API keys are supplied the aggregator runs on the
 * bundled demo catalogue, and every screen labels the prices as such.
 */
export const PROVIDERS: Provider[] = [
  { id: "alcode", name: "Alcode Direct", short: "AL", color: "#6C5CE7", bg: "#E4E0FD", feeFactor: 1.0, supports: ["flight", "hotel", "car", "package", "esim", "train", "bus", "boat"] },
  { id: "skyfare", name: "Skyfare", short: "SF", color: "#0F8FE0", bg: "#DCEEFB", feeFactor: 1.04, supports: ["flight", "train"] },
  { id: "gotrip", name: "GoTrip", short: "GT", color: "#F36C36", bg: "#FFE3D8", feeFactor: 1.02, supports: ["flight", "hotel", "package", "bus"] },
  { id: "roomly", name: "Roomly", short: "RM", color: "#E0356F", bg: "#FFE1EA", feeFactor: 1.06, supports: ["hotel", "package"] },
  { id: "staynow", name: "StayNow", short: "SN", color: "#1FA97F", bg: "#D9F4EA", feeFactor: 1.01, supports: ["hotel"] },
  { id: "wheelz", name: "Wheelz", short: "WZ", color: "#5B4BD6", bg: "#E4E0FD", feeFactor: 1.03, supports: ["car"] },
  { id: "driveo", name: "Driveo", short: "DR", color: "#3AA9A4", bg: "#DFF4F2", feeFactor: 1.05, supports: ["car"] },
  { id: "simglobe", name: "SimGlobe", short: "SG", color: "#FF8A29", bg: "#FFEFD6", feeFactor: 1.0, supports: ["esim"] },
  { id: "nomadsim", name: "NomadSim", short: "NS", color: "#7C3AED", bg: "#EDE6FE", feeFactor: 1.08, supports: ["esim"] },
];

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

export const CITIES: City[] = [
  { id: "jkt", code: "CGK", name: "Jakarta", nameAr: "جاكرتا", country: "Indonesia", countryAr: "إندونيسيا", countryCode: "ID", image: "jakarta" },
  { id: "bdg", code: "BDG", name: "Bandung", nameAr: "باندونغ", country: "Indonesia", countryAr: "إندونيسيا", countryCode: "ID", image: "bandung" },
  { id: "dps", code: "DPS", name: "Bali", nameAr: "بالي", country: "Indonesia", countryAr: "إندونيسيا", countryCode: "ID", image: "bali" },
  { id: "dxb", code: "DXB", name: "Dubai", nameAr: "دبي", country: "UAE", countryAr: "الإمارات", countryCode: "AE", image: "dubai" },
  { id: "ist", code: "IST", name: "Istanbul", nameAr: "إسطنبول", country: "Türkiye", countryAr: "تركيا", countryCode: "TR", image: "istanbul" },
  { id: "cai", code: "CAI", name: "Cairo", nameAr: "القاهرة", country: "Egypt", countryAr: "مصر", countryCode: "EG", image: "cairo" },
  { id: "jed", code: "JED", name: "Jeddah", nameAr: "جدة", country: "Saudi Arabia", countryAr: "السعودية", countryCode: "SA", image: "jeddah" },
  { id: "ruh", code: "RUH", name: "Riyadh", nameAr: "الرياض", country: "Saudi Arabia", countryAr: "السعودية", countryCode: "SA", image: "riyadh" },
  { id: "lon", code: "LHR", name: "London", nameAr: "لندن", country: "United Kingdom", countryAr: "المملكة المتحدة", countryCode: "GB", image: "london" },
  { id: "par", code: "CDG", name: "Paris", nameAr: "باريس", country: "France", countryAr: "فرنسا", countryCode: "FR", image: "paris" },
  { id: "kul", code: "KUL", name: "Kuala Lumpur", nameAr: "كوالالمبور", country: "Malaysia", countryAr: "ماليزيا", countryCode: "MY", image: "kualalumpur" },
  { id: "doh", code: "DOH", name: "Doha", nameAr: "الدوحة", country: "Qatar", countryAr: "قطر", countryCode: "QA", image: "doha" },
];

export const cityById = (id: string) => CITIES.find((c) => c.id === id) ?? CITIES[0];
export const cityByCode = (code: string) => CITIES.find((c) => c.code === code);

export const CARRIERS: Carrier[] = [
  { id: "garuda", name: "Garuda Airline", nameAr: "طيران غارودا", mode: "flight", color: "#0B6BA8", bg: "#E1F0FA", rating: 4.7 },
  { id: "emirates", name: "Emirates", nameAr: "طيران الإمارات", mode: "flight", color: "#C8102E", bg: "#FCE3E7", rating: 4.8 },
  { id: "turkish", name: "Turkish Airlines", nameAr: "الخطوط التركية", mode: "flight", color: "#C8102E", bg: "#FDE7E7", rating: 4.6 },
  { id: "qatar", name: "Qatar Airways", nameAr: "الخطوط القطرية", mode: "flight", color: "#5C0632", bg: "#F6E3EC", rating: 4.8 },
  { id: "airasia", name: "AirAsia", nameAr: "إير آسيا", mode: "flight", color: "#E0353C", bg: "#FDE6E7", rating: 4.2 },
  { id: "whoosh", name: "Whoosh", nameAr: "ووش", mode: "train", color: "#E0356F", bg: "#FFE1EA", rating: 4.6 },
  { id: "kai", name: "KAI", nameAr: "كاي", mode: "train", color: "#0F5FA8", bg: "#DEEBF8", rating: 4.4 },
  { id: "railink", name: "Railink", nameAr: "ريلينك", mode: "train", color: "#3AA9A4", bg: "#DFF4F2", rating: 4.3 },
  { id: "searay", name: "SeaRay Ferry", nameAr: "عبّارة سي راي", mode: "boat", color: "#5B4BD6", bg: "#E4E0FD", rating: 4.1 },
  { id: "bluewave", name: "BlueWave", nameAr: "بلو ويف", mode: "boat", color: "#0F8FE0", bg: "#DCEEFB", rating: 4.0 },
  { id: "citybus", name: "CityBus Express", nameAr: "سيتي باص", mode: "bus", color: "#F36C36", bg: "#FFE3D8", rating: 4.2 },
  { id: "nightliner", name: "NightLiner", nameAr: "نايت لاينر", mode: "bus", color: "#FF8A29", bg: "#FFEFD6", rating: 4.0 },
];

export const carrierById = (id: string) => CARRIERS.find((c) => c.id === id) ?? CARRIERS[0];

/** Stations/terminals per mode so a route reads correctly for trains vs flights. */
export const TERMINALS: Record<string, Partial<Record<"flight" | "train" | "boat" | "bus", string>>> = {
  jkt: { flight: "CGK", train: "GMR", boat: "TJP", bus: "KPB" },
  bdg: { flight: "BDO", train: "BDG", boat: "CJT", bus: "LSW" },
  dps: { flight: "DPS", train: "—", boat: "BNO", bus: "MGW" },
  dxb: { flight: "DXB", train: "UAQ", boat: "DPT", bus: "IBN" },
  ist: { flight: "IST", train: "HYD", boat: "KAD", bus: "ESN" },
  cai: { flight: "CAI", train: "RMS", boat: "ALX", bus: "TRG" },
  jed: { flight: "JED", train: "JDH", boat: "JEP", bus: "JBS" },
  ruh: { flight: "RUH", train: "RHR", boat: "—", bus: "RBS" },
  lon: { flight: "LHR", train: "STP", boat: "DVR", bus: "VCS" },
  par: { flight: "CDG", train: "PNO", boat: "CAL", bus: "BCY" },
  kul: { flight: "KUL", train: "KLS", boat: "PKG", bus: "TBS" },
  doh: { flight: "DOH", train: "MSR", boat: "DPH", bus: "DBS" },
};

export const terminalFor = (cityId: string, mode: "flight" | "train" | "boat" | "bus") =>
  TERMINALS[cityId]?.[mode] ?? cityById(cityId).code;
