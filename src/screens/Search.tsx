import { ArrowLeftRight, ArrowUpDown, CalendarDays, Grip, MapPin, Navigation, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeroTrainScene } from "@/components/Art";
import { BackButton, Segmented, Sheet, cx } from "@/components/ui";
import { CITIES, cityById } from "@/data/catalog";
import { addDays, formatDate, todayISO } from "@/lib/format";
import type { Cabin } from "@/lib/types";
import { useStore } from "@/state/store";

type Picker = "from" | "to" | null;

export default function Search() {
  const navigate = useNavigate();
  const { t, locale, search, dispatch } = useStore();
  const [picker, setPicker] = useState<Picker>(null);
  const [paxOpen, setPaxOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");

  const roundTrip = search.returnISO !== null;
  const from = cityById(search.fromId);
  const to = cityById(search.toId);

  const swap = () => dispatch({ type: "setSearch", search: { fromId: search.toId, toId: search.fromId } });

  const chooseCity = (id: string) => {
    if (picker === "from") {
      dispatch({ type: "setSearch", search: { fromId: id, ...(id === search.toId ? { toId: search.fromId } : {}) } });
    } else if (picker === "to") {
      dispatch({ type: "setSearch", search: { toId: id, ...(id === search.fromId ? { fromId: search.toId } : {}) } });
    }
    setPicker(null);
    setCityQuery("");
  };

  const filteredCities = CITIES.filter((c) => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.nameAr, c.code, c.country, c.countryAr].some((v) => v.toLowerCase().includes(q));
  });

  const cabinLabel = t(search.cabin === "economy" ? "economy" : search.cabin === "business" ? "business" : "first");

  return (
    <div className="screen relative">
      <div className="relative h-[248px]">
        <HeroTrainScene className="absolute inset-0 h-full w-full" />
        <div className="relative flex items-center justify-between px-5 pt-safe">
          <BackButton />
          <button type="button" aria-label={t("navMore")} onClick={() => navigate("/more")} className="icon-btn">
            <Grip size={20} strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="relative mt-4 px-6 text-[30px] font-extrabold leading-[1.15] tracking-tight text-ink">
          {t("findLine1")}
          <br />
          {t("findLine2")}
        </h1>
      </div>

      <div className="relative -mt-16 px-4">
        <div className="card p-4">
          <Segmented
            value={roundTrip ? "round" : "one"}
            onChange={(v) =>
              dispatch({
                type: "setSearch",
                search: { returnISO: v === "round" ? addDays(search.dateISO, 5) : null },
              })
            }
            options={[
              { value: "one", label: t("oneWay"), icon: <Navigation size={14} /> },
              { value: "round", label: t("roundTrip"), icon: <ArrowLeftRight size={14} /> },
            ]}
          />

          <div className="relative mt-3.5 space-y-2.5">
            <button type="button" onClick={() => setPicker("from")} className="field w-full text-start">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand shadow-soft">
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label-xs block">{t("from")}</span>
                <span className="block truncate text-[15px] font-bold">
                  {locale === "ar" ? from.nameAr : from.name}
                </span>
              </span>
              <span className="text-[12px] font-bold text-ink-faint">{from.code}</span>
            </button>

            <button type="button" onClick={() => setPicker("to")} className="field w-full text-start">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-mint-600 shadow-soft">
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label-xs block">{t("to")}</span>
                <span className="block truncate text-[15px] font-bold">
                  {locale === "ar" ? to.nameAr : to.name}
                </span>
              </span>
              <span className="text-[12px] font-bold text-ink-faint">{to.code}</span>
            </button>

            <button
              type="button"
              aria-label="swap"
              onClick={swap}
              className="absolute end-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-brand text-white shadow-pill transition active:scale-90"
            >
              <ArrowUpDown size={18} strokeWidth={2.6} />
            </button>
          </div>

          <div className={cx("mt-2.5 grid gap-2.5", roundTrip && "grid-cols-2")}>
            <label className="field cursor-pointer">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-coral shadow-soft">
                <CalendarDays size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label-xs block">{t("date")}</span>
                <span className="block truncate text-[15px] font-bold">{formatDate(search.dateISO, locale)}</span>
              </span>
              <input
                type="date"
                aria-label={t("date")}
                min={todayISO()}
                value={search.dateISO}
                onChange={(e) => dispatch({ type: "setSearch", search: { dateISO: e.target.value } })}
                className="absolute h-0 w-0 opacity-0"
              />
            </label>

            {roundTrip && (
              <label className="field cursor-pointer">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-coral shadow-soft">
                  <CalendarDays size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="label-xs block">{t("returnDate")}</span>
                  <span className="block truncate text-[15px] font-bold">
                    {formatDate(search.returnISO ?? addDays(search.dateISO, 5), locale)}
                  </span>
                </span>
                <input
                  type="date"
                  aria-label={t("returnDate")}
                  min={search.dateISO}
                  value={search.returnISO ?? addDays(search.dateISO, 5)}
                  onChange={(e) => dispatch({ type: "setSearch", search: { returnISO: e.target.value } })}
                  className="absolute h-0 w-0 opacity-0"
                />
              </label>
            )}
          </div>

          <button type="button" onClick={() => setPaxOpen(true)} className="field mt-2.5 w-full text-start">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand shadow-soft">
              <Users size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="label-xs block">{t("passenger")}</span>
              <span className="block truncate text-[15px] font-bold">
                {search.passengers} {t("passengers")}, {cabinLabel}
              </span>
            </span>
          </button>

          <button type="button" onClick={() => navigate("/results")} className="btn-dark mt-4 w-full py-4 text-[15px]">
            {t("search")}
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between px-5">
        <h2 className="text-[17px] font-bold">{t("vouchers")}</h2>
        <button type="button" onClick={() => navigate("/deals")} className="text-[13px] font-semibold text-brand">
          {t("viewAll")}
        </button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-6">
        <VoucherCard title={locale === "ar" ? "عضو جديد" : "New member"} value="30%" sub={locale === "ar" ? "خصم خاص" : "Special discount"} tone="brand" />
        <VoucherCard title={locale === "ar" ? "عرض حصري" : "Exclusive Deal"} value="2+1" sub={locale === "ar" ? "اشترِ ٢ واحصل على ١" : "Buy 2 get 1"} tone="mint" />
        <VoucherCard title={locale === "ar" ? "فنادق" : "Hotels"} value="15%" sub={locale === "ar" ? "على أول حجز" : "On your first stay"} tone="coral" />
      </div>

      <Sheet open={picker !== null} onClose={() => setPicker(null)} title={picker === "from" ? t("from") : t("to")}>
        <input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          placeholder={t("searchCountry")}
          className="mb-3 w-full rounded-2xl bg-canvas px-4 py-3 text-[14px] outline-none"
        />
        <ul className="space-y-1.5">
          {filteredCities.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => chooseCity(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-start transition hover:bg-canvas active:scale-[.99]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-[11px] font-extrabold text-brand">
                  {c.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{locale === "ar" ? c.nameAr : c.name}</span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {locale === "ar" ? c.countryAr : c.country}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={paxOpen} onClose={() => setPaxOpen(false)} title={t("passenger")}
        footer={<button type="button" onClick={() => setPaxOpen(false)} className="btn-dark w-full py-3.5">{t("apply")}</button>}>
        <div className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3.5">
          <span className="text-[14px] font-bold">{t("passengers")}</span>
          <span className="flex items-center gap-4">
            <button
              type="button"
              aria-label="-"
              onClick={() => dispatch({ type: "setSearch", search: { passengers: Math.max(1, search.passengers - 1) } })}
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-[18px] font-bold shadow-soft"
            >
              −
            </button>
            <span className="w-5 text-center text-[15px] font-extrabold">{search.passengers}</span>
            <button
              type="button"
              aria-label="+"
              onClick={() => dispatch({ type: "setSearch", search: { passengers: Math.min(9, search.passengers + 1) } })}
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-[18px] font-bold shadow-soft"
            >
              +
            </button>
          </span>
        </div>

        <p className="mb-2 mt-4 text-[13px] font-bold">{t("cabinClass")}</p>
        <div className="grid grid-cols-3 gap-2">
          {(["economy", "business", "first"] as Cabin[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: "setSearch", search: { cabin: c } })}
              className={cx(
                "rounded-2xl px-3 py-3 text-[13px] font-semibold transition",
                search.cabin === c ? "bg-ink text-white" : "bg-canvas text-ink-soft",
              )}
            >
              {t(c === "economy" ? "economy" : c === "business" ? "business" : "first")}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function VoucherCard({ title, value, sub, tone }: { title: string; value: string; sub: string; tone: "brand" | "mint" | "coral" }) {
  const tones = {
    brand: "from-brand-200 to-brand-100 text-brand-900",
    mint: "from-mint-200 to-mint-100 text-mint-600",
    coral: "from-coral-200 to-coral-100 text-coral-600",
  } as const;
  return (
    <div className={cx("relative w-[220px] shrink-0 overflow-hidden rounded-[24px] bg-gradient-to-br p-4 shadow-card", tones[tone])}>
      <p className="text-[11px] font-semibold opacity-80">{title}</p>
      <p className="mt-1 text-[30px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[12px] font-semibold opacity-90">{sub}</p>
      <span className="absolute -end-6 -top-6 h-20 w-20 rounded-full bg-white/40" />
      <span className="absolute -bottom-7 end-8 h-16 w-16 rounded-full bg-white/25" />
    </div>
  );
}
