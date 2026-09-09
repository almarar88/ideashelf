import { Bell, Search as SearchIcon, Sparkles, Star } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BoatArt, BusArt, CarArt, DestinationArt, HotelArt, PackageArt, PlaneArt, SimArt, TrainArt } from "@/components/Art";
import Photo from "@/components/Photo";
import RouteLine from "@/components/RouteLine";
import { SectionHeader, cx } from "@/components/ui";
import { CARRIERS, CITIES, cityById, terminalFor } from "@/data/catalog";
import { searchPackages, searchTrips } from "@/lib/aggregator";
import { clock, duration, formatDate, money } from "@/lib/format";
import type { StringKey } from "@/lib/i18n";
import type { TransportMode } from "@/lib/types";
import { useCityPhoto } from "@/lib/live";
import { useStore } from "@/state/store";

const CATEGORIES: Array<{
  key: StringKey;
  mode: TransportMode;
  bg: string;
  Art: (p: { className?: string }) => JSX.Element;
  badge?: string;
}> = [
  { key: "trains", mode: "train", bg: "bg-mint-200", Art: TrainArt },
  { key: "flights", mode: "flight", bg: "bg-brand-100", Art: PlaneArt, badge: "20%" },
  { key: "boats", mode: "boat", bg: "bg-brand-50", Art: BoatArt },
  { key: "bus", mode: "bus", bg: "bg-coral-100", Art: BusArt },
];

const SERVICES: Array<{ key: StringKey; to: string; bg: string; Art: (p: { className?: string }) => JSX.Element }> = [
  { key: "hotels", to: "/hotels", bg: "bg-mint-100", Art: HotelArt },
  { key: "cars", to: "/cars", bg: "bg-brand-50", Art: CarArt },
  { key: "packages", to: "/packages", bg: "bg-rose-100", Art: PackageArt },
  { key: "esimShort", to: "/esim", bg: "bg-sun-100", Art: SimArt },
];

export default function Home() {
  const navigate = useNavigate();
  const { t, locale, currency, profile, dispatch, search, bookings } = useStore();

  // Upcoming cards: the traveller's own bookings first, then a couple of live
  // examples from the aggregator so the row is never empty on a fresh install.
  const schedules = useMemo(() => {
    const sample = searchTrips({ ...search, mode: "flight" }).slice(0, 2);
    const trains = searchTrips({ ...search, mode: "train" }).slice(0, 1);
    return [...sample, ...trains];
  }, [search]);

  const deals = useMemo(() => searchPackages().slice(0, 4), []);

  const openCategory = (mode: TransportMode) => {
    dispatch({ type: "setSearch", search: { mode } });
    navigate("/search");
  };

  return (
    <div className="screen pb-4">
      <header className="flex items-center gap-3 px-5 pt-safe">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pe-4 ps-1.5 shadow-soft transition active:scale-95"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-sun text-white">
            <Star size={17} fill="currentColor" />
          </span>
          <span className="text-[13px] font-bold">
            {profile.points} <span className="font-semibold text-ink-soft">{t("points")}</span>
          </span>
        </button>

        <div className="ms-auto flex items-center gap-2.5">
          <button type="button" aria-label={t("search_")} onClick={() => navigate("/search")} className="icon-btn">
            <SearchIcon size={19} strokeWidth={2.4} />
          </button>
          <button type="button" aria-label={t("notifications")} onClick={() => navigate("/notifications")} className="icon-btn relative">
            <Bell size={19} strokeWidth={2.4} />
            <span className="absolute end-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose" />
          </button>
        </div>
      </header>

      <h1 className="mt-5 px-5 text-[30px] font-extrabold leading-[1.15] tracking-tight">
        {t("taglineLine1")}
        <br />
        {t("taglineLine2")}
      </h1>

      <div className="mt-5 grid grid-cols-4 gap-2.5 px-5 stagger">
        {CATEGORIES.map(({ key, mode, bg, Art, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => openCategory(mode)}
            className={cx("relative h-[86px] overflow-hidden rounded-[22px] p-2.5 text-start transition active:scale-95", bg)}
          >
            <span className="relative z-10 text-[12px] font-bold">{t(key)}</span>
            {badge && (
              <span className="absolute end-1.5 top-1.5 z-10 rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
            <Art className="absolute bottom-0 -end-0.5 h-[46px] w-[88%]" />
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2.5 px-5">
        {SERVICES.map(({ key, to, bg, Art }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(to)}
            className={cx("relative h-[74px] overflow-hidden rounded-[22px] p-2.5 text-start transition active:scale-95", bg)}
          >
            <span className="relative z-10 text-[11px] font-bold leading-tight">{t(key)}</span>
            <Art className="absolute bottom-0 -end-0.5 h-[38px] w-[82%] opacity-95" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate("/planner")}
        className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-[24px] bg-ink px-4 py-3.5 text-start text-white shadow-pill transition active:scale-[.98]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15">
          <Sparkles size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{t("plannerTitle")}</span>
          <span className="block truncate text-[11px] text-white/70">{t("plannerSub")}</span>
        </span>
      </button>

      <SectionHeader
        className="mt-6 px-5"
        title={t("upcomingSchedules")}
        actionLabel={t("viewAll")}
        onAction={() => navigate("/trips")}
      />

      <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {bookings.slice(0, 2).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => navigate(`/ticket/${b.id}`)}
            className="card w-[262px] shrink-0 snap-start p-4 text-start"
          >
            <p className="text-[11px] font-medium text-ink-muted">{formatDate(b.dateISO, locale, "short")}</p>
            <p className="mt-0.5 truncate text-[15px] font-bold">{b.title}</p>
            <p className="mt-1 truncate text-[12px] text-ink-muted">{b.subtitle}</p>
            <div className="mt-3 flex items-center justify-between border-t border-canvas pt-3">
              <span className="text-[12px] font-semibold text-ink-soft">{b.code}</span>
              <span className="btn-dark px-4 py-2.5 text-[12px]">{t("seeDetails")}</span>
            </div>
          </button>
        ))}

        {schedules.map((offer) => {
          const carrier = CARRIERS.find((c) => c.id === offer.carrierId)!;
          return (
            <article key={offer.id} className="card w-[262px] shrink-0 snap-start p-4">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: carrier.bg, color: carrier.color }}>
                  <span className="text-[10px] font-extrabold">{carrier.name.slice(0, 2).toUpperCase()}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-ink-muted">{t("oneWay")}</p>
                  <p className="truncate text-[14px] font-bold leading-tight">
                    {locale === "ar" ? carrier.nameAr : carrier.name}
                  </p>
                </div>
                <span className="chip shrink-0 bg-coral-100 text-[10px] text-coral-600">
                  {formatDate(offer.departISO, locale, "short")}
                </span>
              </div>

              <div className="mt-3.5 flex items-center gap-2.5" dir="ltr">
                <div className="w-[54px] shrink-0">
                  <p className="text-[14px] font-extrabold leading-tight">{offer.fromCode}</p>
                  <p className="text-[11px] text-ink-muted">{clock(offer.departISO)}</p>
                </div>
                <RouteLine mode={offer.mode} label={duration(offer.durationMin, locale)} />
                <div className="w-[54px] shrink-0 text-end">
                  <p className="text-[14px] font-extrabold leading-tight">{offer.toCode}</p>
                  <p className="text-[11px] text-ink-muted">{clock(offer.arriveISO)}</p>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between border-t border-canvas pt-3">
                <div>
                  <p className="text-[10px] text-ink-muted">{t("baggage")}</p>
                  <p className="text-[13px] font-bold">{offer.baggageKg} kg</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/offer/${offer.id}`, { state: { offer } })}
                  className="btn-dark px-4 py-2.5 text-[12px]"
                >
                  {t("seeDetails")}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <SectionHeader
        className="mt-6 px-5"
        title={t("recommendations")}
        actionLabel={t("viewAll")}
        onAction={() => navigate("/packages")}
      />

      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
        {deals.map((pkg) => (
          <DestinationCard
            key={pkg.id}
            cityId={pkg.cityId}
            price={money(pkg.price, currency)}
            fromLabel={t("from")}
            onClick={() => navigate("/packages")}
          />
        ))}
      </div>

      <SectionHeader className="mt-5 px-5" title={t("selectCountry")} actionLabel={t("viewAll")} onAction={() => navigate("/esim")} />
      <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto px-5 pb-3">
        {CITIES.slice(0, 8).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              dispatch({ type: "setSearch", search: { toId: c.id } });
              navigate("/search");
            }}
            className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-2.5 shadow-soft transition active:scale-95"
          >
            <span className="text-[12px] font-bold">{locale === "ar" ? c.nameAr : c.name}</span>
            <span className="text-[10px] font-semibold text-ink-faint">{terminalFor(c.id, "flight")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One recommendation tile. Split out so each card can resolve its own photo —
 * hooks cannot be called inside a map callback.
 */
function DestinationCard({
  cityId,
  price,
  fromLabel,
  onClick,
}: {
  cityId: string;
  price: string;
  fromLabel: string;
  onClick: () => void;
}) {
  const { locale } = useStore();
  const city = cityById(cityId);
  const photo = useCityPhoto(cityId);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-[176px] w-[142px] shrink-0 overflow-hidden rounded-[24px] text-start shadow-card transition active:scale-95"
    >
      <Photo
        photo={photo}
        alt={city.name}
        showCredit={false}
        className="absolute inset-0 h-full w-full"
        fallback={<DestinationArt name={city.image} className="h-full w-full" />}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-3">
        <span className="block text-[13px] font-bold text-white">
          {locale === "ar" ? city.nameAr : city.name}
        </span>
        <span className="block text-[11px] text-white/80">
          {fromLabel} {price}
        </span>
      </span>
    </button>
  );
}
