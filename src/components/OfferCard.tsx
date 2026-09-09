import { Bookmark, Heart, Star } from "lucide-react";
import { CarrierMark } from "@/components/Art";
import RouteLine from "@/components/RouteLine";
import { cx } from "@/components/ui";
import { carrierById } from "@/data/catalog";
import { quoteTotal } from "@/lib/aggregator";
import { clock, duration, money } from "@/lib/format";
import type { TripOffer } from "@/lib/types";
import { useStore } from "@/state/store";

export default function OfferCard({
  offer,
  onOpen,
}: {
  offer: TripOffer;
  onOpen: () => void;
}) {
  const { t, locale, currency, dispatch, isFav, isSaved } = useStore();
  const carrier = carrierById(offer.carrierId);
  const best = offer.quotes[0];
  const cabinLabel = t(offer.cabin === "economy" ? "economy" : offer.cabin === "business" ? "business" : "first");

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: carrier.bg, color: carrier.color }}>
          <CarrierMark id={carrier.id} className="h-6 w-6" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-ink-muted">{cabinLabel}</p>
          <p className="truncate text-[15px] font-bold leading-tight">
            {locale === "ar" ? carrier.nameAr : carrier.name}
          </p>
        </div>

        <button
          type="button"
          aria-label={t("favourites")}
          aria-pressed={isFav(offer.id)}
          onClick={() => dispatch({ type: "toggleFavourite", id: offer.id })}
          className={cx("grid h-9 w-9 place-items-center rounded-2xl transition active:scale-90", isFav(offer.id) ? "bg-rose-100 text-rose" : "bg-canvas text-ink-faint")}
        >
          <Heart size={17} fill={isFav(offer.id) ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          aria-label={t("saved")}
          aria-pressed={isSaved(offer.id)}
          onClick={() => dispatch({ type: "toggleSaved", id: offer.id })}
          className={cx("grid h-9 w-9 place-items-center rounded-2xl transition active:scale-90", isSaved(offer.id) ? "bg-brand text-white" : "bg-brand-50 text-brand")}
        >
          <Bookmark size={17} fill={isSaved(offer.id) ? "currentColor" : "none"} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="mt-3 block w-full text-start">
        <div className="flex items-center gap-3" dir="ltr">
          <div className="w-[62px] shrink-0">
            <p className="text-[15px] font-extrabold leading-tight">{offer.fromCode}</p>
            <p className="text-[11px] text-ink-muted">{clock(offer.departISO)}</p>
          </div>
          <RouteLine mode={offer.mode} label={duration(offer.durationMin, locale)} />
          <div className="w-[62px] shrink-0 text-end">
            <p className="text-[15px] font-extrabold leading-tight">{offer.toCode}</p>
            <p className="text-[11px] text-ink-muted">{clock(offer.arriveISO)}</p>
          </div>
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <span className="flex items-center gap-1.5">
              <Star size={14} className="text-sun" fill="#FF8A29" />
              <span className="text-[13px] font-bold">{offer.rating.toFixed(1)}</span>
              <span className="text-[11px] text-ink-muted">
                · {offer.stops === 0 ? t("direct") : `${offer.stops} ${offer.stops === 1 ? t("stop") : t("stops")}`}
              </span>
            </span>
            {offer.reschedulable && (
              <span className="chip bg-brand-100 text-brand-900">{t("abilityToReschedule")}</span>
            )}
          </div>

          <span className="btn-dark shrink-0 gap-1 px-4 py-3 text-[14px]">
            {money(quoteTotal(best), currency)}
            <span className="text-[10px] font-medium opacity-70">{t("perPax")}</span>
          </span>
        </div>
      </button>
    </article>
  );
}
