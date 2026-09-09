import { CalendarDays, Heart, MapPin, Search as SearchIcon, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DestinationArt } from "@/components/Art";
import { BackButton, Sheet, cx } from "@/components/ui";
import { CITIES, cityById } from "@/data/catalog";
import { isLiveData, quoteTotal, savingsOf, searchHotels } from "@/lib/aggregator";
import { addDays, formatDate, iso, money, todayISO } from "@/lib/format";
import { useStore } from "@/state/store";

type Sort = "best" | "cheapest" | "rating";

export default function Hotels() {
  const navigate = useNavigate();
  const { t, locale, currency, dispatch, isFav } = useStore();
  const [cityId, setCityId] = useState("dxb");
  const [checkIn, setCheckIn] = useState(addDays(todayISO(), 14));
  const [nights, setNights] = useState(3);
  const [guests, setGuests] = useState(2);
  const [sort, setSort] = useState<Sort>("best");
  const [cityOpen, setCityOpen] = useState(false);

  const hotels = useMemo(
    () => searchHotels({ cityId, checkInISO: checkIn, nights, guests, rooms: Math.max(1, Math.ceil(guests / 2)) }),
    [cityId, checkIn, nights, guests],
  );

  const sorted = useMemo(() => {
    const cheapest = (h: (typeof hotels)[number]) => Math.min(...h.quotes.map(quoteTotal));
    const list = hotels.slice();
    if (sort === "cheapest") return list.sort((a, b) => cheapest(a) - cheapest(b));
    if (sort === "rating") return list.sort((a, b) => b.rating - a.rating);
    return list.sort((a, b) => b.rating / cheapest(b) - a.rating / cheapest(a));
  }, [hotels, sort]);

  const city = cityById(cityId);

  return (
    <div className="screen pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <h1 className="text-[20px] font-extrabold">{t("hotels")}</h1>
      </header>

      <div className="mx-5 mt-4 card space-y-2.5 p-4">
        <button type="button" onClick={() => setCityOpen(true)} className="field w-full text-start">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand shadow-soft">
            <MapPin size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="label-xs block">{t("destination")}</span>
            <span className="block truncate text-[15px] font-bold">{locale === "ar" ? city.nameAr : city.name}</span>
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="field cursor-pointer">
            <CalendarDays size={16} className="shrink-0 text-coral" />
            <span className="min-w-0 flex-1">
              <span className="label-xs block">{t("checkIn")}</span>
              <span className="block truncate text-[13px] font-bold">{formatDate(checkIn, locale, "short")}</span>
            </span>
            <input type="date" aria-label={t("checkIn")} min={todayISO()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="absolute h-0 w-0 opacity-0" />
          </label>

          <div className="field">
            <span className="min-w-0 flex-1">
              <span className="label-xs block capitalize">{t("nights")}</span>
              <span className="block text-[13px] font-bold">{nights}</span>
            </span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="-" onClick={() => setNights((n) => Math.max(1, n - 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">−</button>
              <button type="button" aria-label="+" onClick={() => setNights((n) => Math.min(30, n + 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">+</button>
            </span>
          </div>
        </div>

        <div className="field">
          <Users size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="label-xs block capitalize">{t("guests")}</span>
            <span className="block text-[13px] font-bold">{guests}</span>
          </span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="-" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">−</button>
            <button type="button" aria-label="+" onClick={() => setGuests((g) => Math.min(12, g + 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">+</button>
          </span>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
        {([["best", "best"], ["cheapest", "cheapest"], ["rating", "topRated"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={cx("chip shrink-0 py-2.5", sort === key ? "bg-brand text-white" : "bg-white text-ink-soft shadow-soft")}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {!isLiveData() && (
        <p className="mx-5 mt-3 rounded-2xl bg-white/70 px-4 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          <span className="font-bold text-ink-soft">{t("demoDataTitle")}:</span> {t("demoDataBody")}
        </p>
      )}

      <div className="mt-4 space-y-3 px-5 stagger">
        {sorted.map((h) => {
          const best = Math.min(...h.quotes.map(quoteTotal));
          const saved = savingsOf(h.quotes);
          return (
            <article key={h.id} className="card relative overflow-hidden">
              <button type="button" onClick={() => navigate(`/hotels/${h.id}`, { state: { hotel: h, nights } })} className="block w-full text-start">
                <div className="relative h-[132px]">
                  <DestinationArt name={city.image} className="absolute inset-0 h-full w-full" />
                  <span className="absolute start-3 top-3 chip bg-white/90 text-[11px] text-ink">
                    <Star size={11} className="text-sun" fill="#FF8A29" /> {h.rating}
                  </span>
                  {saved > 0 && (
                    <span className="absolute end-3 top-3 chip bg-mint text-[11px] text-white">
                      {t("save")} {money(saved, currency, { decimals: 0 })}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate text-[15px] font-bold">{locale === "ar" ? h.nameAr : h.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                    {locale === "ar" ? h.areaAr : h.area} · {iso(`${h.distanceKm} km`)} {t("fromCentre")}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {h.breakfast && <span className="chip bg-mint-100 text-[10px] text-mint-600">{t("breakfastIncluded")}</span>}
                      {h.freeCancel && <span className="chip bg-brand-50 text-[10px] text-brand">{t("freeCancellation")}</span>}
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-[17px] font-extrabold leading-none">{money(best, currency)}</p>
                      <p className="text-[10px] text-ink-muted">{t("perNight")}</p>
                    </div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={t("favourites")}
                onClick={() => dispatch({ type: "toggleFavourite", id: h.id })}
                className={cx("absolute end-3 top-[86px] grid h-9 w-9 place-items-center rounded-full transition active:scale-90", isFav(h.id) ? "bg-rose text-white" : "bg-white/90 text-ink-soft")}
              >
                <Heart size={16} fill={isFav(h.id) ? "currentColor" : "none"} />
              </button>
            </article>
          );
        })}
      </div>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title={t("destination")}>
        <ul className="space-y-1.5">
          {CITIES.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setCityId(c.id);
                  setCityOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition hover:bg-canvas"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand">
                  <SearchIcon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{locale === "ar" ? c.nameAr : c.name}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{locale === "ar" ? c.countryAr : c.country}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
