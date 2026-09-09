import { Briefcase, CalendarDays, Gauge, MapPin, Settings2, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { CarArt } from "@/components/Art";
import PriceCompare from "@/components/PriceCompare";
import { BackButton, Sheet, cx } from "@/components/ui";
import { CITIES, cityById } from "@/data/catalog";
import { quoteTotal, savingsOf, searchCars } from "@/lib/aggregator";
import { addDays, formatDate, iso, money, todayISO } from "@/lib/format";
import type { Booking, CarRental } from "@/lib/types";
import { useStore } from "@/state/store";

const CATEGORIES = [
  { id: "all", label: "catAll" },
  { id: "economy", label: "catEconomy" },
  { id: "suv", label: "catSuv" },
  { id: "luxury", label: "catLuxury" },
  { id: "van", label: "catVan" },
] as const;

export default function Cars() {
  const { t, locale, currency, profile, dispatch } = useStore();
  const [cityId, setCityId] = useState("dxb");
  const [pickup, setPickup] = useState(addDays(todayISO(), 14));
  const [days, setDays] = useState(3);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [cityOpen, setCityOpen] = useState(false);
  const [active, setActive] = useState<CarRental | null>(null);

  const cars = useMemo(() => searchCars(cityId, pickup, days), [cityId, pickup, days]);
  const visible = useMemo(
    () =>
      (category === "all" ? cars : cars.filter((c) => c.category === category)).sort(
        (a, b) => Math.min(...a.quotes.map(quoteTotal)) - Math.min(...b.quotes.map(quoteTotal)),
      ),
    [cars, category],
  );

  const city = cityById(cityId);

  const book = (car: CarRental) => {
    const booking: Booking = {
      id: `bk-${Date.now()}`,
      kind: "car",
      refId: car.id,
      title: `${car.brand} ${car.model}`,
      subtitle: `${locale === "ar" ? city.nameAr : city.name} · ${iso(days)} ${t("days")}`,
      dateISO: `${pickup}T10:00:00`,
      price: Math.min(...car.quotes.map(quoteTotal)),
      status: "upcoming",
      passenger: profile.name,
      code: `CR${car.id.length}${car.seats}${car.bags}00`,
    };
    dispatch({ type: "addBooking", booking });
    setActive(null);
  };

  return (
    <div className="screen pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <h1 className="text-[20px] font-extrabold">{t("cars")}</h1>
      </header>

      <div className="mx-5 mt-4 card space-y-2.5 p-4">
        <button type="button" onClick={() => setCityOpen(true)} className="field w-full text-start">
          <MapPin size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="label-xs block">{t("pickUp")}</span>
            <span className="block truncate text-[15px] font-bold">{locale === "ar" ? city.nameAr : city.name}</span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field cursor-pointer">
            <CalendarDays size={16} className="shrink-0 text-coral" />
            <span className="min-w-0 flex-1">
              <span className="label-xs block">{t("date")}</span>
              <span className="block truncate text-[13px] font-bold">{formatDate(pickup, locale, "short")}</span>
            </span>
            <input type="date" aria-label={t("date")} min={todayISO()} value={pickup} onChange={(e) => setPickup(e.target.value)} className="absolute h-0 w-0 opacity-0" />
          </label>
          <div className="field">
            <span className="min-w-0 flex-1">
              <span className="label-xs block capitalize">{t("days")}</span>
              <span className="block text-[13px] font-bold">{days}</span>
            </span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="-" onClick={() => setDays((d) => Math.max(1, d - 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">−</button>
              <button type="button" aria-label="+" onClick={() => setDays((d) => Math.min(60, d + 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">+</button>
            </span>
          </div>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cx("chip shrink-0 py-2.5", category === c.id ? "bg-brand text-white" : "bg-white text-ink-soft shadow-soft")}
          >
            {t(c.label)}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 px-5 stagger">
        {visible.map((car) => {
          const best = Math.min(...car.quotes.map(quoteTotal));
          const saved = savingsOf(car.quotes);
          return (
            <button key={car.id} type="button" onClick={() => setActive(car)} className="card flex w-full items-center gap-3 p-4 text-start">
              <span className="grid h-16 w-20 shrink-0 place-items-center rounded-2xl bg-brand-50">
                <CarArt className="h-12 w-16" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{car.brand} {car.model}</span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{car.supplier}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-soft">
                  <span className="inline-flex items-center gap-1"><Users size={11} /> {car.seats}</span>
                  <span className="inline-flex items-center gap-1"><Briefcase size={11} /> {car.bags}</span>
                  <span className="inline-flex items-center gap-1"><Settings2 size={11} /> {car.transmission === "auto" ? t("automatic") : t("manual")}</span>
                  {car.unlimitedKm && <span className="inline-flex items-center gap-1 text-mint-600"><Gauge size={11} /> {t("unlimitedKm")}</span>}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="flex items-center justify-end gap-1 text-[11px] font-bold">
                  <Star size={11} className="text-sun" fill="#FF8A29" /> {car.rating}
                </span>
                <span className="mt-1 block text-[16px] font-extrabold leading-none">{money(best / days, currency, { decimals: 0 })}</span>
                <span className="block text-[10px] text-ink-muted">{t("perDay")}</span>
                {saved > 0 && <span className="mt-1 inline-block rounded-full bg-mint-100 px-2 py-0.5 text-[9px] font-bold text-mint-600">−{money(saved, currency, { decimals: 0 })}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title={t("pickUp")}>
        <ul className="space-y-1.5">
          {CITIES.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { setCityId(c.id); setCityOpen(false); }} className="w-full rounded-2xl px-3 py-3 text-start text-[14px] font-bold transition hover:bg-canvas">
                {locale === "ar" ? c.nameAr : c.name}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `${active.brand} ${active.model}` : ""}
        footer={
          active && (
            <button type="button" onClick={() => book(active)} className="btn-dark w-full py-4">
              {t("bookNow")} · {money(Math.min(...active.quotes.map(quoteTotal)), currency)}
            </button>
          )
        }
      >
        {active && <PriceCompare quotes={active.quotes} unitLabel={`${days} ${t("days")}`} />}
      </Sheet>
    </div>
  );
}
