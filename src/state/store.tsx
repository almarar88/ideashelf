import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { STRINGS } from "@/lib/i18n";
import type { Booking, TripPlan } from "@/lib/types";
import { fetchRates } from "@/lib/api";
import { setLiveRates } from "@/lib/format";

export interface SearchState {
  fromId: string;
  toId: string;
  dateISO: string;
  returnISO: string | null;
  passengers: number;
  cabin: "economy" | "business" | "first";
  mode: "flight" | "train" | "boat" | "bus";
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  points: number;
  memberSinceISO: string;
}

interface State {
  locale: Locale;
  currency: string;
  profile: Profile;
  search: SearchState;
  favourites: string[];
  saved: string[];
  bookings: Booking[];
  plans: TripPlan[];
  priceAlerts: string[];
  seenIntro: boolean;
}

type Action =
  | { type: "setLocale"; locale: Locale }
  | { type: "setCurrency"; currency: string }
  | { type: "setProfile"; profile: Partial<Profile> }
  | { type: "setSearch"; search: Partial<SearchState> }
  | { type: "toggleFavourite"; id: string }
  | { type: "toggleSaved"; id: string }
  | { type: "togglePriceAlert"; id: string }
  | { type: "addBooking"; booking: Booking }
  | { type: "addPlan"; plan: TripPlan }
  | { type: "removePlan"; id: string }
  | { type: "seenIntro" }
  | { type: "hydrate"; state: Partial<State> };

const STORAGE_KEY = "alcode-trips:v1";

function defaultDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const initialState: State = {
  locale: "ar",
  currency: "USD",
  profile: {
    name: "Alves Farhat",
    email: "traveller@alcodetrips.app",
    phone: "+966 5X XXX XXXX",
    points: 320,
    memberSinceISO: "2023-06-01",
  },
  search: {
    fromId: "jkt",
    toId: "bdg",
    dateISO: defaultDate(14),
    returnISO: null,
    passengers: 1,
    cabin: "business",
    mode: "flight",
  },
  favourites: [],
  saved: [],
  bookings: [],
  plans: [],
  priceAlerts: [],
  seenIntro: false,
};

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setLocale":
      return { ...state, locale: action.locale };
    case "setCurrency":
      return { ...state, currency: action.currency };
    case "setProfile":
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case "setSearch":
      return { ...state, search: { ...state.search, ...action.search } };
    case "toggleFavourite":
      return { ...state, favourites: toggle(state.favourites, action.id) };
    case "toggleSaved":
      return { ...state, saved: toggle(state.saved, action.id) };
    case "togglePriceAlert":
      return { ...state, priceAlerts: toggle(state.priceAlerts, action.id) };
    case "addBooking":
      return {
        ...state,
        bookings: [action.booking, ...state.bookings],
        // Loyalty points accrue at 1 point per $2 spent.
        profile: { ...state.profile, points: state.profile.points + Math.round(action.booking.price / 2) },
      };
    case "addPlan":
      return { ...state, plans: [action.plan, ...state.plans.filter((p) => p.id !== action.plan.id)] };
    case "removePlan":
      return { ...state, plans: state.plans.filter((p) => p.id !== action.id) };
    case "seenIntro":
      return { ...state, seenIntro: true };
    case "hydrate":
      // Nested objects are merged, never replaced: a payload saved by an older
      // build can be missing fields the current one needs.
      return {
        ...state,
        ...action.state,
        profile: { ...state.profile, ...action.state.profile },
        search: { ...state.search, ...action.state.search },
      };
    default:
      return state;
  }
}

interface Ctx extends State {
  dispatch: React.Dispatch<Action>;
  t: (key: keyof typeof STRINGS) => string;
  dir: "rtl" | "ltr";
  isFav: (id: string) => boolean;
  isSaved: (id: string) => boolean;
}

const StoreContext = createContext<Ctx | null>(null);

function loadPersisted(): Partial<State> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<State>;
    // Keep only known keys, and only those actually present, so a stale or
    // partial payload can never null out a default the app depends on.
    const allowed = [
      "locale", "currency", "profile", "favourites", "saved",
      "bookings", "plans", "priceAlerts", "seenIntro", "search",
    ] as const satisfies readonly (keyof State)[];
    const out: Partial<State> = {};
    for (const key of allowed) {
      if (parsed[key] !== undefined && parsed[key] !== null) {
        (out as Record<string, unknown>)[key] = parsed[key];
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const persisted = loadPersisted();
    if (Object.keys(persisted).length) dispatch({ type: "hydrate", state: persisted });
  }, []);

  useEffect(() => {
    // One call at boot; the backend caches for six hours so this is cheap.
    let cancelled = false;
    fetchRates("USD").then((payload) => {
      if (!cancelled && payload?.live) setLiveRates(payload.rates);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Private mode or a full quota — the app still works in memory. */
    }
  }, [state]);

  const dir = state.locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.documentElement.dir = dir;
  }, [state.locale, dir]);

  const translate = useCallback((key: keyof typeof STRINGS) => STRINGS[key][state.locale], [state.locale]);
  const isFav = useCallback((id: string) => state.favourites.includes(id), [state.favourites]);
  const isSaved = useCallback((id: string) => state.saved.includes(id), [state.saved]);

  const value = useMemo<Ctx>(
    () => ({ ...state, dispatch, t: translate, dir, isFav, isSaved }),
    [state, translate, dir, isFav, isSaved],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
