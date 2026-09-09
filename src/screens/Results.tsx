import { ArrowLeftRight, MapPin, MoreHorizontal, Share2, SlidersHorizontal, Sparkles, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import OfferCard from "@/components/OfferCard";
import { BackButton, Empty, Sheet, Toast, cx } from "@/components/ui";
import { cityById } from "@/data/catalog";
import { quoteTotal, sortOffers } from "@/lib/aggregator";
import type { SortKey } from "@/lib/aggregator";
import { useTripOffers } from "@/lib/live";
import { priceInsight } from "@/lib/ai";
import { money } from "@/lib/format";
import type { StringKey } from "@/lib/i18n";
import { useStore } from "@/state/store";
import DataBadge from "@/components/DataBadge";

const SORTS: Array<{ key: SortKey; label: StringKey }> = [
  { key: "best", label: "best" },
  { key: "cheapest", label: "cheapest" },
  { key: "fastest", label: "fastest" },
  { key: "earliest", label: "earliest" },
  { key: "rating", label: "topRated" },
];

export default function Results() {
  const navigate = useNavigate();
  const { t, locale, currency, search, dispatch } = useStore();
  const [sort, setSort] = useState<SortKey>("best");
  const [filterOpen, setFilterOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [directOnly, setDirectOnly] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const result = useTripOffers(search, currency);
  const all = result.data;

  const priceCeiling = useMemo(
    () => Math.max(...all.map((o) => Math.min(...o.quotes.map(quoteTotal)))),
    [all],
  );

  const visible = useMemo(() => {
    let list = all;
    if (directOnly) list = list.filter((o) => o.stops === 0);
    if (maxPrice !== null) list = list.filter((o) => Math.min(...o.quotes.map(quoteTotal)) <= maxPrice);
    return sortOffers(list, sort);
  }, [all, sort, maxPrice, directOnly]);

  const insight = useMemo(() => priceInsight(visible), [visible]);
  const from = cityById(search.fromId);
  const to = cityById(search.toId);

  const share = async () => {
    const text = `${from.name} → ${to.name} · ${visible.length} ${t("resultsFrom")}`;
    try {
      if (navigator.share) await navigator.share({ title: "Alcode Trips", text });
      else {
        await navigator.clipboard.writeText(text);
        setToast(t("copied"));
      }
    } catch {
      /* The user dismissed the share sheet — nothing to report. */
    }
  };

  return (
    <div className="screen pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <div className="ms-auto flex items-center gap-2.5">
          <button type="button" aria-label={t("share")} onClick={share} className="icon-btn">
            <Share2 size={18} strokeWidth={2.4} />
          </button>
          <button type="button" aria-label={t("filter")} onClick={() => setFilterOpen(true)} className="icon-btn">
            <MoreHorizontal size={20} strokeWidth={2.6} />
          </button>
        </div>
      </header>

      <h1 className="mt-4 px-5 text-[28px] font-extrabold tracking-tight">{t("searchResults")}</h1>
      <p className="mt-1 px-5 text-[13px] leading-relaxed text-ink-muted">
        {t("thereAre")} <span className="font-bold text-brand">{visible.length}</span> {t("resultsFrom")}{" "}
        {locale === "ar" ? from.nameAr : from.name} {locale === "ar" ? "إلى" : "to"}{" "}
        {locale === "ar" ? to.nameAr : to.name}
      </p>

      <div className="relative mt-4 flex items-center gap-2 px-5">
        <div className="field flex-1 bg-white shadow-soft">
          <MapPin size={15} className="shrink-0 text-brand" />
          <span className="min-w-0">
            <span className="label-xs block">{t("from")}</span>
            <span className="block truncate text-[13px] font-bold">{locale === "ar" ? from.nameAr : from.name}</span>
          </span>
        </div>
        <button
          type="button"
          aria-label="swap"
          onClick={() => dispatch({ type: "setSearch", search: { fromId: search.toId, toId: search.fromId } })}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand transition active:scale-90"
        >
          <ArrowLeftRight size={16} strokeWidth={2.6} />
        </button>
        <div className="field flex-1 bg-white shadow-soft">
          <MapPin size={15} className="shrink-0 text-mint-600" />
          <span className="min-w-0">
            <span className="label-xs block">{t("to")}</span>
            <span className="block truncate text-[13px] font-bold">{locale === "ar" ? to.nameAr : to.name}</span>
          </span>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex items-center gap-2 overflow-x-auto px-5">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="chip shrink-0 bg-ink py-2.5 text-white"
        >
          <SlidersHorizontal size={13} /> {t("filter")}
        </button>
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            className={cx(
              "chip shrink-0 py-2.5 transition",
              sort === s.key ? "bg-brand text-white" : "bg-white text-ink-soft shadow-soft",
            )}
          >
            {t(s.label)}
          </button>
        ))}
      </div>

      {insight && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-[24px] bg-white p-4 shadow-card">
          <span
            className={cx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
              insight.verdict === "buy" ? "bg-mint-100 text-mint-600" : insight.verdict === "wait" ? "bg-coral-100 text-coral-600" : "bg-brand-50 text-brand",
            )}
          >
            {insight.verdict === "buy" ? <TrendingDown size={19} /> : <Sparkles size={19} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">{locale === "ar" ? insight.headlineAr : insight.headline}</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
              {locale === "ar" ? insight.detailAr : insight.detail}
            </p>
          </div>
        </div>
      )}

      <DataBadge source={result.source} reason={result.reason} />

      <div className="mt-4 space-y-3 px-5 stagger">
        {visible.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onOpen={() => navigate(`/offer/${offer.id}`, { state: { offer } })} />
        ))}
      </div>

      {visible.length === 0 && <Empty title={t("noResults")} hint={t("noResultsHint")} icon={<SlidersHorizontal size={24} />} />}

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t("filter")}
        footer={
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMaxPrice(null);
                setDirectOnly(false);
              }}
              className="btn-light flex-1 py-3.5"
            >
              {t("reset")}
            </button>
            <button type="button" onClick={() => setFilterOpen(false)} className="btn-dark flex-[2] py-3.5">
              {t("apply")}
            </button>
          </div>
        }
      >
        <label className="block">
          <span className="flex items-center justify-between text-[13px] font-bold">
            {t("maxPrice")}
            <span className="text-brand">{money(maxPrice ?? priceCeiling, currency)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={priceCeiling}
            step={1}
            value={maxPrice ?? priceCeiling}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="mt-3 w-full accent-[#6C5CE7]"
          />
        </label>

        <button
          type="button"
          onClick={() => setDirectOnly((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-canvas px-4 py-3.5"
        >
          <span className="text-[14px] font-bold">{t("direct")}</span>
          <span className={cx("h-6 w-11 rounded-full p-0.5 transition", directOnly ? "bg-brand" : "bg-ink-faint/40")}>
            <span className={cx("block h-5 w-5 rounded-full bg-white transition", directOnly && "translate-x-5 rtl:-translate-x-5")} />
          </span>
        </button>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
