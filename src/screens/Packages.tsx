import { Check, ExternalLink, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { DestinationArt } from "@/components/Art";
import { BackButton, Sheet } from "@/components/ui";
import { cityById } from "@/data/catalog";
import { searchPackages } from "@/lib/aggregator";
import { hotelSearchUrl, openBookingSite, savedBooking } from "@/lib/booking";
import { iso, money } from "@/lib/format";
import type { TravelPackage } from "@/lib/types";
import { addDays, todayISO } from "@/lib/format";
import { useStore } from "@/state/store";

export default function Packages() {
  const { t, locale, currency, profile, dispatch } = useStore();
  const packages = useMemo(() => searchPackages(), []);
  const [active, setActive] = useState<TravelPackage | null>(null);

  const book = (pkg: TravelPackage) => {
    const city = cityById(pkg.cityId);
    const checkIn = addDays(todayISO(), 21);
    const bookingUrl = hotelSearchUrl({
      destination: city.name,
      checkIn,
      checkOut: addDays(checkIn, pkg.nights),
      adults: 2,
    });
    dispatch({
      type: "addBooking",
      booking: savedBooking({
        kind: "package",
        refId: pkg.id,
        title: locale === "ar" ? pkg.titleAr : pkg.title,
        subtitle: `${city.name} · ${pkg.nights} ${t("nights")}`,
        dateISO: `${checkIn}T09:00:00`,
        price: pkg.price,
        passenger: profile.name,
        bookingUrl,
        provider: "Hotellook",
      }),
    });
    setActive(null);
    openBookingSite(bookingUrl);
  };

  return (
    <div className="screen pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <h1 className="text-[20px] font-extrabold">{t("packages")}</h1>
      </header>

      <div className="mt-4 space-y-3.5 px-5 stagger">
        {packages.map((pkg) => {
          const city = cityById(pkg.cityId);
          const saved = pkg.oldPrice - pkg.price;
          return (
            <button key={pkg.id} type="button" onClick={() => setActive(pkg)} className="card block w-full overflow-hidden text-start">
              <div className="relative h-[150px]">
                <DestinationArt name={city.image} className="absolute inset-0 h-full w-full" />
                <span className="absolute start-3 top-3 chip bg-white/90 text-[11px]">
                  <Star size={11} className="text-sun" fill="#FF8A29" /> {pkg.rating}
                </span>
                <span className="absolute end-3 top-3 chip bg-rose text-[11px] text-white">
                  {t("save")} {money(saved, currency)}
                </span>
              </div>
              <div className="p-4">
                <p className="text-[16px] font-extrabold">{locale === "ar" ? pkg.titleAr : pkg.title}</p>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {locale === "ar" ? city.nameAr : city.name} · {iso(pkg.nights)} {t("nights")}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(locale === "ar" ? pkg.includesAr : pkg.includes).map((inc) => (
                    <span key={inc} className="chip bg-canvas text-[10px] text-ink-soft">
                      <Check size={10} /> {inc}
                    </span>
                  ))}
                </div>
                <div className="mt-3.5 flex items-end justify-between border-t border-canvas pt-3">
                  <span>
                    <span className="block text-[11px] text-ink-faint line-through">{money(pkg.oldPrice, currency)}</span>
                    <span className="block text-[19px] font-extrabold leading-tight">{money(pkg.price, currency)}</span>
                  </span>
                  <span className="btn-dark px-5 py-3 text-[13px]">{t("seeDetails")}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? (locale === "ar" ? active.titleAr : active.title) : ""}
        footer={
          active && (
            <button type="button" onClick={() => book(active)} className="btn-dark w-full gap-2 py-4">
              <ExternalLink size={16} /> {t("continueOn")} Hotellook
            </button>
          )
        }
      >
        {active && (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {t("includes")}: {(locale === "ar" ? active.includesAr : active.includes).join(" · ")}
            </p>
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-[12px] text-ink-muted">{t("estimatedTotal")}</p>
              <p className="text-[24px] font-extrabold">{money(active.price, currency)}</p>
              <p className="mt-1 text-[11px] text-mint-600">
                {t("save")} {money(active.oldPrice - active.price, currency)}
              </p>
            </div>
            <ul className="space-y-2">
              {active.departures.map((d) => (
                <li key={d} className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <Check size={14} className="text-mint-600" /> {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </div>
  );
}
