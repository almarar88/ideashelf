import { Infinity as InfinityIcon, PhoneCall, QrCode, Search as SearchIcon, Signal, Wifi } from "lucide-react";
import { useMemo, useState } from "react";
import { SimArt } from "@/components/Art";
import PriceCompare from "@/components/PriceCompare";
import { BackButton, Sheet, cx } from "@/components/ui";
import { esimCountries, isLiveData, quoteTotal, savingsOf, searchEsim } from "@/lib/aggregator";
import { iso, money } from "@/lib/format";
import type { Booking, EsimPlan } from "@/lib/types";
import { useStore } from "@/state/store";

export default function Esim() {
  const { t, locale, currency, profile, dispatch } = useStore();
  const [country, setCountry] = useState("SA");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<EsimPlan | null>(null);

  const countries = useMemo(() => esimCountries(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => [c.country, c.countryAr, c.countryCode].some((v) => v.toLowerCase().includes(q)));
  }, [countries, query]);

  const plans = useMemo(() => {
    const list = searchEsim(country);
    // Cheapest per gigabyte first — the only ranking that compares plans fairly
    // when both the data bundle and the validity window differ.
    return list.slice().sort((a, b) => pricePerGb(a) - pricePerGb(b));
  }, [country]);

  const selected = countries.find((c) => c.countryCode === country);

  const buy = (plan: EsimPlan) => {
    const booking: Booking = {
      id: `bk-${Date.now()}`,
      kind: "esim",
      refId: plan.id,
      title: `eSIM ${locale === "ar" ? plan.countryAr : plan.country}`,
      subtitle: `${plan.dataGb === "unlimited" ? t("unlimited") : `${plan.dataGb} GB`} · ${plan.days} ${t("days")}`,
      dateISO: new Date().toISOString(),
      price: quoteTotal(plan.quotes[0]),
      status: "confirmed",
      passenger: profile.name,
      code: `SM${plan.countryCode}${plan.days}${plan.dataGb === "unlimited" ? "UL" : plan.dataGb}`,
    };
    dispatch({ type: "addBooking", booking });
    setActive(null);
  };

  return (
    <div className="screen pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <h1 className="text-[20px] font-extrabold">{t("esim")}</h1>
      </header>

      <div className="mx-5 mt-4 flex items-center gap-3 overflow-hidden rounded-[26px] bg-sun-100 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold">{t("esimTitle")}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{t("esimSub")}</p>
        </div>
        <SimArt className="h-16 w-20 shrink-0" />
      </div>

      <div className="mx-5 mt-4 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-soft">
        <SearchIcon size={17} className="shrink-0 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchCountry")}
          className="w-full bg-transparent text-[14px] outline-none"
        />
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-5">
        {filtered.map((c) => (
          <button
            key={c.countryCode}
            type="button"
            onClick={() => setCountry(c.countryCode)}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-[12px] font-semibold transition",
              country === c.countryCode ? "bg-ink text-white" : "bg-white text-ink-soft shadow-soft",
            )}
          >
            <span aria-hidden>{c.flag}</span>
            {locale === "ar" ? c.countryAr : c.country}
          </button>
        ))}
      </div>

      {selected && (
        <p className="mt-4 flex items-center gap-2 px-5 text-[12px] text-ink-muted">
          <Signal size={13} className="text-brand" /> {selected.network}
        </p>
      )}

      {!isLiveData() && (
        <p className="mx-5 mt-3 rounded-2xl bg-white/70 px-4 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          <span className="font-bold text-ink-soft">{t("demoDataTitle")}:</span> {t("demoDataBody")}
        </p>
      )}

      <div className="mt-3 space-y-3 px-5 stagger">
        {plans.map((plan) => {
          const best = quoteTotal(plan.quotes[0]);
          const saved = savingsOf(plan.quotes);
          return (
            <button key={plan.id} type="button" onClick={() => setActive(plan)} className="card flex w-full items-center gap-3.5 p-4 text-start">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sun-100 text-sun">
                {plan.dataGb === "unlimited" ? <InfinityIcon size={24} /> : <span className="text-[15px] font-extrabold">{plan.dataGb}GB</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">
                  {plan.dataGb === "unlimited" ? t("unlimited") : iso(`${plan.dataGb} GB`)} · {iso(plan.days)} {t("days")}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-muted">{plan.operator}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-ink-soft">
                  {plan.hotspot && <span className="inline-flex items-center gap-1"><Wifi size={10} /> {t("hotspot")}</span>}
                  {plan.calls && <span className="inline-flex items-center gap-1"><PhoneCall size={10} /> {t("calls")}</span>}
                  <span className="text-brand">{money(pricePerGb(plan), currency, { decimals: 2 })} {t("perGb")}</span>
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-[16px] font-extrabold leading-none">{money(best, currency, { decimals: 2 })}</span>
                {saved > 0 && <span className="mt-1 inline-block rounded-full bg-mint-100 px-2 py-0.5 text-[9px] font-bold text-mint-600">−{money(saved, currency, { decimals: 2 })}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <section className="mx-5 mt-6 rounded-[26px] bg-white p-5 shadow-card">
        <h2 className="text-[15px] font-bold">{t("esimHowTitle")}</h2>
        <ol className="mt-3 space-y-3">
          {[t("esimStep1"), t("esimStep2"), t("esimStep3")].map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand">{i + 1}</span>
              <span className="text-[13px] text-ink-soft">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `${active.dataGb === "unlimited" ? t("unlimited") : `${active.dataGb} GB`} · ${active.days} ${t("days")}` : ""}
        footer={
          active && (
            <button type="button" onClick={() => buy(active)} className="btn-dark w-full gap-2 py-4">
              <QrCode size={17} /> {t("buyEsim")} · {money(quoteTotal(active.quotes[0]), currency, { decimals: 2 })}
            </button>
          )
        }
      >
        {active && <PriceCompare quotes={active.quotes} />}
      </Sheet>
    </div>
  );
}

/** Unlimited plans are costed against a 25 GB fair-use assumption. */
function pricePerGb(plan: EsimPlan) {
  const gb = plan.dataGb === "unlimited" ? 25 : plan.dataGb;
  return quoteTotal(plan.quotes[0]) / gb;
}
