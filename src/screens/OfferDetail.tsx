import { Bell, Briefcase, Clock, ExternalLink, Info, Leaf, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { CarrierMark } from "@/components/Art";
import PriceCompare from "@/components/PriceCompare";
import DataBadge from "@/components/DataBadge";
import { BackButton, Toast, cx } from "@/components/ui";
import { carrierById, providerById } from "@/data/catalog";
import { quoteTotal, searchTrips } from "@/lib/aggregator";
import { offerBookingUrl, openBookingSite, savedBooking } from "@/lib/booking";
import { useTripOffers } from "@/lib/live";
import { priceInsight } from "@/lib/ai";
import { clock, duration, formatDate, iso, money, weekday } from "@/lib/format";
import type { TripOffer } from "@/lib/types";
import { useStore } from "@/state/store";

export default function OfferDetail() {
  const { offerId } = useParams();
  const location = useLocation() as { state?: { offer?: TripOffer } };
  const { t, locale, currency, search, profile, dispatch, priceAlerts } = useStore();
  const [toast, setToast] = useState<string | null>(null);

  // Offers are derived, not stored, so a direct link or a refresh rebuilds the
  // same deterministic list and finds the offer again by id.
  // The list screen passes the offer through router state. A refresh or a
  // shared link loses that, so it is re-resolved: live results first (they are
  // cached by the backend for the same query), then the demo catalogue, which
  // is deterministic and rebuilds the same ids.
  const listed = useTripOffers(search, currency);
  const offer = useMemo(() => {
    if (location.state?.offer) return location.state.offer;
    const fromList = listed.data.find((o) => o.id === offerId);
    if (fromList) return fromList;
    for (const mode of ["flight", "train", "boat", "bus"] as const) {
      const found = searchTrips({ ...search, mode }).find((o) => o.id === offerId);
      if (found) return found;
    }
    return null;
  }, [location.state, offerId, search, listed.data]);

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
  const carrierLabel = offer.carrierName ?? (locale === "ar" ? carrier.nameAr : carrier.name);
  const quote = offer.quotes.find((q) => q.providerId === selected) ?? offer.quotes[0];
  const perPax = quoteTotal(quote);
  const total = perPax * search.passengers;
  const insight = priceInsight(searchTrips({ ...search, mode: offer.mode }), offer);
  const alertOn = priceAlerts.includes(offer.id);

  const providerName = providerById(quote.providerId, quote.providerName).name;
  const bookingUrl = offerBookingUrl(offer, search, quote.url);

  /**
   * Records the trip and opens the seller. The record is deliberately a saved
   * trip, not a confirmed booking: the purchase happens on the partner's site
   * and this app never learns whether it went through.
   */
  const book = () => {
    if (!bookingUrl) {
      setToast(t("noResults"));
      return;
    }
    dispatch({
      type: "addBooking",
      booking: savedBooking({
        kind: "trip",
        refId: offer.id,
        title: `${offer.fromCode} → ${offer.toCode}`,
        subtitle: `${carrierLabel} · ${t(offer.cabin === "economy" ? "economy" : offer.cabin === "business" ? "business" : "first")}`,
        dateISO: offer.departISO,
        price: total,
        passenger: profile.name,
        bookingUrl,
        provider: providerName,
      }),
    });
    openBookingSite(bookingUrl);
  };

  const facts = [
    { icon: Clock, label: t("durationLabel"), value: duration(offer.durationMin, locale) },
    offer.baggageKg
      ? { icon: Briefcase, label: t("baggage"), value: `${offer.baggageKg} kg` }
      : offer.baggagePieces
        ? { icon: Briefcase, label: t("baggage"), value: `${offer.baggagePieces} pc` }
        : null,
    offer.seatsLeft ? { icon: Users, label: t("seat"), value: `${offer.seatsLeft}` } : null,
    offer.co2Kg ? { icon: Leaf, label: "CO₂", value: `${offer.co2Kg} kg` } : null,
  ].filter((f): f is { icon: typeof Clock; label: string; value: string } => f !== null);

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

      <DataBadge source={offer.live === true ? listed.source : "demo"} />

      <div className="mx-5 mt-4 card p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: carrier.bg, color: carrier.color }}>
            {offer.live ? (
              <span className="text-[13px] font-extrabold">
                {(offer.carrierName ?? carrier.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <CarrierMark id={carrier.id} className="h-7 w-7" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold">{carrierLabel}</p>
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

        <div className={cx("mt-5 grid gap-2 border-t border-canvas pt-4", facts.length >= 4 ? "grid-cols-4" : facts.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
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

      {offer.segments && offer.segments.length > 0 && (
        <section className="mx-5 mt-3 card p-5">
          <h2 className="text-[15px] font-bold">{t("seeDetails")}</h2>
          <ol className="mt-3 space-y-3">
            {offer.segments.map((seg, i) => (
              <li key={`${seg.flightNumber}-${i}`} className="rounded-2xl bg-canvas px-4 py-3" dir="ltr">
                <p className="flex items-center justify-between text-[13px] font-bold">
                  <span>
                    {seg.from} → {seg.to}
                  </span>
                  <span className="text-ink-soft">{duration(seg.durationMin, locale)}</span>
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {clock(seg.departISO)} – {clock(seg.arriveISO)} · {seg.flightNumber}
                  {seg.aircraft ? ` · ${seg.aircraft}` : ""}
                </p>
                {(seg.terminalFrom || seg.terminalTo) && (
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {seg.terminalFrom ? `${t("terminal")} ${seg.terminalFrom}` : ""}
                    {seg.terminalFrom && seg.terminalTo ? " → " : ""}
                    {seg.terminalTo ? `${t("terminal")} ${seg.terminalTo}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {insight && (
        <p className="mx-5 mt-3 rounded-[22px] bg-white px-4 py-3 text-[12px] leading-relaxed shadow-soft">
          <span className="font-bold">{locale === "ar" ? insight.headlineAr : insight.headline}. </span>
          <span className="text-ink-muted">{locale === "ar" ? insight.detailAr : insight.detail}</span>
        </p>
      )}

      <section className="mt-5 px-5">
        <h2 className="mb-3 text-[17px] font-bold">{t("comparePrices")}</h2>
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-[11.5px] leading-relaxed text-ink-muted shadow-soft">
          <Info size={13} className="mt-0.5 shrink-0 text-brand" />
          <span>
            <span className="font-bold text-ink-soft">{t("handoffTitle")}.</span> {t("handoffBody")}
          </span>
        </p>
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
            <p className="truncate text-[11px] text-ink-muted">
              {t("total")} · {iso(search.passengers)} {t("passengers")} · {t("via")} {providerName}
            </p>
            <p className="text-[20px] font-extrabold leading-tight">{money(total, currency)}</p>
          </div>
          <button type="button" onClick={book} className="btn-dark shrink-0 gap-2 px-5 py-4 text-[14px]">
            <ExternalLink size={16} />
            {t("continueBooking")}
          </button>
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
