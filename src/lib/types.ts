export type TransportMode = "flight" | "train" | "boat" | "bus";
export type Cabin = "economy" | "business" | "first";

export interface Provider {
  /** Stable id used by the aggregator and by real API adapters. */
  id: string;
  name: string;
  /** Short label drawn inside the provider bubble. */
  short: string;
  color: string;
  bg: string;
  /** Typical booking-fee multiplier applied on top of a base fare. */
  feeFactor: number;
  supports: Array<"flight" | "hotel" | "car" | "package" | "esim" | "train" | "bus" | "boat">;
}

export interface City {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  country: string;
  countryAr: string;
  countryCode: string;
  image: string;
}

export interface Carrier {
  id: string;
  name: string;
  nameAr: string;
  mode: TransportMode;
  color: string;
  bg: string;
  rating: number;
}

export interface TripOffer {
  id: string;
  mode: TransportMode;
  carrierId: string;
  cabin: Cabin;
  from: string;
  to: string;
  fromCode: string;
  toCode: string;
  departISO: string;
  arriveISO: string;
  durationMin: number;
  stops: number;
  price: number;
  baseCurrency: string;
  rating: number;
  seatsLeft: number;
  baggageKg: number;
  refundable: boolean;
  reschedulable: boolean;
  co2Kg: number;
  /** Every site that sells this exact trip, cheapest first. */
  quotes: Quote[];
  /** Set on results that came from a partner API rather than the demo data. */
  live?: boolean;
  carrierName?: string;
  segments?: Segment[];
  sources?: string[];
  brandedFare?: string | null;
  baggagePieces?: number | null;
  /** Where to send the traveller to actually buy this trip. */
  bookingUrl?: string;
}

export interface Photo {
  id: string;
  title: string;
  url: string;
  fullUrl?: string;
  /** CC licences require this credit to be shown wherever the photo appears. */
  licence: string;
  author: string;
  descriptionUrl?: string;
  /** False when the picture shows the city rather than the property itself. */
  representative?: boolean;
}

export interface Segment {
  from: string;
  to: string;
  departISO: string;
  arriveISO: string;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  aircraft: string | null;
  durationMin: number;
  terminalFrom: string | null;
  terminalTo: string | null;
}

export interface Quote {
  providerId: string;
  /** Present on live quotes whose provider is not in the static catalogue. */
  providerName?: string;
  currency?: string;
  price: number;
  /** Extras the traveller pays at checkout on that site. */
  fees: number;
  url: string;
  cancellation: "free" | "paid" | "none";
  payLater: boolean;
}

export interface Hotel {
  id: string;
  name: string;
  nameAr: string;
  cityId: string;
  area: string;
  areaAr: string;
  stars: number;
  rating: number;
  reviews: number;
  price: number;
  image: string;
  amenities: string[];
  distanceKm: number;
  breakfast: boolean;
  freeCancel: boolean;
  quotes: Quote[];
  live?: boolean;
  photo?: Photo | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  roomDescription?: string | null;
  board?: string | null;
  sources?: string[];
  bookingUrl?: string;
}

export interface CarRental {
  id: string;
  model: string;
  brand: string;
  cityId: string;
  category: "economy" | "suv" | "luxury" | "van";
  seats: number;
  bags: number;
  transmission: "auto" | "manual";
  pricePerDay: number;
  rating: number;
  image: string;
  unlimitedKm: boolean;
  supplier: string;
  quotes: Quote[];
}

export interface TravelPackage {
  id: string;
  title: string;
  titleAr: string;
  cityId: string;
  nights: number;
  includes: string[];
  includesAr: string[];
  price: number;
  oldPrice: number;
  rating: number;
  image: string;
  departures: string[];
}

export interface EsimPlan {
  id: string;
  countryCode: string;
  country: string;
  countryAr: string;
  flag: string;
  operator: string;
  dataGb: number | "unlimited";
  days: number;
  price: number;
  network: string;
  hotspot: boolean;
  calls: boolean;
  quotes: Quote[];
}

export interface Booking {
  id: string;
  kind: "trip" | "hotel" | "car" | "package" | "esim";
  refId: string;
  title: string;
  subtitle: string;
  dateISO: string;
  price: number;
  /**
   * "saved" means the traveller was handed to a partner to complete the
   * purchase and the app cannot know the outcome. Only an order placed
   * through a booking API is ever "confirmed".
   */
  status: "saved" | "confirmed" | "upcoming" | "completed";
  passenger: string;
  seat?: string;
  gate?: string;
  /** Booking reference. Empty for saved trips — there is no ticket yet. */
  code: string;
  bookingUrl?: string;
  provider?: string;
}

export interface PlannedItem {
  id: string;
  day: number;
  time: string;
  title: string;
  note: string;
  kind: "flight" | "hotel" | "food" | "sight" | "car" | "free";
  cost: number;
}

export interface TripPlan {
  id: string;
  destinationId: string;
  title: string;
  startISO: string;
  days: number;
  travellers: number;
  budget: number;
  items: PlannedItem[];
  createdISO: string;
  /** How the plan was produced — a live model call, or the on-device planner. */
  source: "ai" | "local";
}
