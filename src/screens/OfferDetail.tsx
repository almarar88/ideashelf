import { Bell, Briefcase, Clock, Leaf, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CarrierMark } from "@/components/Art";
import PriceCompare from "@/components/PriceCompare";
import { BackButton, Toast, cx } from "@/components/ui";
import { carrierById } from "@/data/catalog";
import { quoteTotal, searchTrips } from "@/lib/aggregator";
import { priceInsight } from "@/lib/ai";
import { clock, duration, formatDate, iso, money, weekday } from "@/lib/format";
import type { Booking, TripOffer } from "@/lib/types";
import { useStore } from "@/state/store";

function makeCode(seed: string) {
  const letters = seed.toUpperCase().replace(/[^A-Z]/g, "").padEnd(3, "X").slice(0, 3);
  const digits = Math.abs([...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 100000;
  return `${letters}${String(digits).padStart(5, "0")}`;
}

export default function OfferDetail() {
  const { offerId } = useParams();
  const location = useLocation() as { state?: { offer?: TripOffer } };
  const navigate = useNavigate();
  const { t, locale, currency, search, profile, dispatch, priceAlerts } = useStore();
  const [toast, setToast] = useState<string | null>(null);

  // Offers are derived, not stored, so a direct link or a refresh rebuilds the
  // same deterministic list and finds the offer again by id.
  const offer = useMemo(() => {
    if (location.state?.offer) return location.state.offer;
    for (const mode of ["flight", "train", "boat", "bus"] as const) {
      const found = searchTrips({ ...search, mode }).find((o) => o.id === offerId);
      if (found) return found;
    }
    return null;
  }, [location.state, offerId, search]);

  const [selected, setSelected] = useState<string | null>(null);

  if (!offer) {
    return (
      <div className="screen px-5 pt-safe">
        <BackButton />
        <p className="mt-10 text-center text-[14px] text-ink-muted">{t("noResults")}</p>
      </div>
    );
  }

  const carrier = carrierById(offer.carrierId);
  const quote = offer.quotes.find((q) => q.providerId === selected) ?? offer.quotes[0];
  const perPax = quoteTotal(quote);
  const total = perPax * search.passengers;
  const insight = priceInsight(searchTrips({ ...search, mode: offer.mode }), offer);
  const alertOn = priceAlerts.includes(offer.id);

  const book = () => {
    const booking: Booking = {
      id: `bk-${Date.now()}`,
      kind: "trip",
      refId: offer.id,
      title: `${offer.fromCode} → ${offer.toCode}`,
      subtitle: `${locale === "ar" ? carrier.nameAr : carrier.name} · ${t(offer.cabin === "economy" ? "economy" : offer.cabin === "business" ? "business" : "first")}`,
      dateISO: offer.departISO,
      price: total,
      status: "upcoming",
      passenger: profile.name,
      seat: `${1 + (Math.abs(offer.id.length * 7) % 30)}${"ABCDEF"[offer.id.length % 6]}`,
      gate: `G${1 + (offer.id.length % 9)}`,
      code: makeCode(offer.id),
    };
    dispatch({ type: "addBooking", booking });
    navigate(`/ticket/${booking.id}`, { replace: true });
  };

  const facts = [
    { icon: Clock, label: t("date"), value: duration(offer.durationMin, locale) },
    { icon: Briefcase, label: t("baggage"), value: `${offer.baggageKg} kg` },
    { icon: Users, label: t("seat"), value: `${offer.seatsLeft}` },
    { icon: Leaf, label: "CO₂", value: `${offer.co2Kg} kg` },
  ];

  return (
    <div className="screen pb-40">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <div className="ms-auto">
          <button
            type="button"
            aria-label={t("priceAlerts")}
            aria-pressed={alertOn}
            onClick={() => {
              dispatch({ type: "togglePriceAlert", id: offer.id });
              setToast(t("priceAlerts"));
            }}
            className={cx("icon-btn", alertOn && "bg-brand text-white")}
          >
            <Bell size={18} strokeWidth={2.4} fill={alertOn ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      <div className="mx-5 mt-4 card p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: carrier.bg, color: carrier.color }}>
            <CarrierMark id={carrier.id} className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold">{locale === "ar" ? carrier.nameAr : carrier.name}</p>
            <p className="text-[12px] text-ink-muted">
              {formatDate(offer.departISO, locale)} · {weekday(offer.departISO, locale)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-stretch gap-4" dir="ltr">
          <div className="flex flex-col items-center pt-1.5">
            <span className="h-3 w-3 rounded-full border-[3px] border-brand" />
            <span className="my-1 w-0.5 flex-1 bg-canvas-deep" />
            <span className="h-3 w-3 rounded-full bg-brand" />
          </div>
          <div className="flex-1 space-y-6">
            <div>
              <p className="text-[19px] font-extrabold leading-none">{clock(offer.departISO)}</p>
              <p className="mt-1 text-[13px] font-semibold">{offer.fromCode} · {offer.from}</p>
            </div>
            <div>
              <p className="text-[19px] font-extrabold leading-none">{clock(offer.arriveISO)}</p>
              <p className="mt-1 text-[13px] font-semibold">{offer.toCode} · {offer.to}</p>
            </div>
          </div>
          <div className="flex flex-col items-end justify-center">
            <span className="chip bg-canvas text-[11px] text-ink-soft">{duration(offer.durationMin, locale)}</span>
            <span className="mt-2 chip bg-canvas text-[11px] text-ink-soft">
              {offer.stops === 0 ? t("direct") : `${offer.stops} ${offer.stops === 1 ? t("stop") : t("stops")}`}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 border-t border-canvas pt-4">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <Icon size={16} className="mx-auto text-brand" />
              <p className="mt-1.5 text-[13px] font-bold">{value}</p>
              <p className="text-[10px] text-ink-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {offer.reschedulable && (
            <span className="chip bg-brand-100 text-brand-900">
              <RefreshCw size={11} /> {t("abilityToReschedule")}
            </span>
          )}
          {offer.refundable && (
            <span className="chip bg-mint-100 text-mint-600">
              <ShieldCheck size={11} /> {t("freeCancellation")}
            </span>
          )}
        </div>
      </div>

      {insight && (
        <p className="mx-5 mt-3 rounded-[22px] bg-white px-4 py-3 text-[12px] leading-relaxed shadow-soft">
          <span className="font-bold">{locale === "ar" ? insight.headlineAr : insight.headline}. </span>
          <span className="text-ink-muted">{locale === "ar" ? insight.detailAr : insight.detail}</span>
        </p>
      )}

      <section className="mt-5 px-5">
        <h2 className="mb-3 text-[17px] font-bold">{t("comparePrices")}</h2>
        <PriceCompare
          quotes={offer.quotes}
          unitLabel={t("perPax")}
          selectedId={quote.providerId}
          onSelect={(q) => setSelected(q.providerId)}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[440px] border-t border-canvas-deep/60 bg-white/95 px-5 pb-safe pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-muted">
              {t("total")} · {iso(search.passengers)} {t("passengers")}
            </p>
            <p className="text-[20px] font-extrabold leading-tight">{money(total, currency)}</p>
          </div>
          <button type="button" onClick={book} className="btn-dark px-8 py-4 text-[15px]">
            {t("bookNow")}
          </button>
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
