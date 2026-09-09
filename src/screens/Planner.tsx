import { Bed, Bookmark, CalendarDays, Car, Coffee, MapPin, Plane, Sparkles, Sun, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { BackButton, Sheet, Toast, cx } from "@/components/ui";
import { CITIES, cityById } from "@/data/catalog";
import { generatePlan } from "@/lib/ai";
import { addDays, formatDate, money, todayISO } from "@/lib/format";
import type { StringKey } from "@/lib/i18n";
import type { PlannedItem, TripPlan } from "@/lib/types";
import { useStore } from "@/state/store";

const INTERESTS: Array<{ id: string; key: StringKey }> = [
  { id: "culture", key: "intCulture" },
  { id: "food", key: "intFood" },
  { id: "nature", key: "intNature" },
  { id: "shopping", key: "intShopping" },
  { id: "nightlife", key: "intNightlife" },
  { id: "family", key: "intFamily" },
  { id: "adventure", key: "intAdventure" },
  { id: "relax", key: "intRelax" },
];

const KIND_ICON: Record<PlannedItem["kind"], typeof Plane> = {
  flight: Plane,
  hotel: Bed,
  food: Coffee,
  sight: Sun,
  car: Car,
  free: MapPin,
};

export default function Planner() {
  const { t, locale, currency, dispatch, search } = useStore();
  const [destination, setDestination] = useState("ist");
  const [startISO, setStartISO] = useState(addDays(todayISO(), 21));
  const [days, setDays] = useState(4);
  const [travellers, setTravellers] = useState(2);
  const [budget, setBudget] = useState(1200);
  const [interests, setInterests] = useState<string[]>(["culture", "food"]);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const city = cityById(destination);

  const build = async () => {
    setBusy(true);
    try {
      const result = await generatePlan({
        destinationId: destination,
        startISO,
        days,
        travellers,
        budget,
        interests,
        originId: search.fromId,
      });
      setPlan(result);
    } finally {
      setBusy(false);
    }
  };

  const total = plan ? plan.items.reduce((s, i) => s + i.cost, 0) : 0;
  const withinBudget = total <= budget;

  return (
    <div className="screen pb-10">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <h1 className="text-[20px] font-extrabold">{t("planner")}</h1>
      </header>

      <div className="mx-5 mt-4 flex items-start gap-3 rounded-[26px] bg-ink p-4 text-white">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15">
          <Sparkles size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold">{t("plannerTitle")}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/70">{t("plannerSub")}</p>
        </div>
      </div>

      <div className="mx-5 mt-4 card space-y-2.5 p-4">
        <button type="button" onClick={() => setCityOpen(true)} className="field w-full text-start">
          <MapPin size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="label-xs block">{t("destination")}</span>
            <span className="block truncate text-[15px] font-bold">{locale === "ar" ? city.nameAr : city.name}</span>
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="field cursor-pointer">
            <CalendarDays size={16} className="shrink-0 text-coral" />
            <span className="min-w-0 flex-1">
              <span className="label-xs block">{t("date")}</span>
              <span className="block truncate text-[13px] font-bold">{formatDate(startISO, locale, "short")}</span>
            </span>
            <input type="date" aria-label={t("date")} min={todayISO()} value={startISO} onChange={(e) => setStartISO(e.target.value)} className="absolute h-0 w-0 opacity-0" />
          </label>
          <div className="field">
            <span className="min-w-0 flex-1">
              <span className="label-xs block capitalize">{t("days")}</span>
              <span className="block text-[13px] font-bold">{days}</span>
            </span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="-" onClick={() => setDays((d) => Math.max(1, d - 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">−</button>
              <button type="button" aria-label="+" onClick={() => setDays((d) => Math.min(21, d + 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">+</button>
            </span>
          </div>
        </div>

        <div className="field">
          <Users size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="label-xs block">{t("travellers")}</span>
            <span className="block text-[13px] font-bold">{travellers}</span>
          </span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="-" onClick={() => setTravellers((v) => Math.max(1, v - 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">−</button>
            <button type="button" aria-label="+" onClick={() => setTravellers((v) => Math.min(9, v + 1))} className="grid h-7 w-7 place-items-center rounded-full bg-white font-bold shadow-soft">+</button>
          </span>
        </div>

        <div className="field flex-col items-stretch gap-2 py-3.5">
          <span className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold">
              <Wallet size={15} className="text-mint-600" /> {t("budget")}
            </span>
            <span className="text-[14px] font-extrabold text-brand">{money(budget, currency)}</span>
          </span>
          <input
            type="range"
            min={200}
            max={8000}
            step={50}
            value={budget}
            aria-label={t("budget")}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-[#6C5CE7]"
          />
        </div>

        <div>
          <p className="mb-2 mt-1 text-[12px] font-bold">{t("interests")}</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = interests.includes(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setInterests((prev) => (on ? prev.filter((x) => x !== i.id) : [...prev, i.id]))}
                  className={cx("chip py-2", on ? "bg-brand text-white" : "bg-canvas text-ink-soft")}
                >
                  {t(i.key)}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={build} disabled={busy} className="btn-dark mt-2 w-full gap-2 py-4 text-[15px] disabled:opacity-70">
          <Sparkles size={17} /> {busy ? t("building") : plan ? t("regenerate") : t("generatePlan")}
        </button>
      </div>

      {plan && (
        <section className="mt-5 px-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-bold">{plan.title}</h2>
            <span className={cx("chip text-[10px]", plan.source === "ai" ? "bg-brand-100 text-brand-900" : "bg-canvas text-ink-soft")}>
              {plan.source === "ai" ? t("liveModel") : t("onDevice")}
            </span>
          </div>

          <div className={cx("mb-4 flex items-center justify-between rounded-[22px] px-4 py-3.5", withinBudget ? "bg-mint-100" : "bg-coral-100")}>
            <span className="text-[12px] font-semibold">{t("estimatedTotal")}</span>
            <span className="text-end">
              <span className={cx("block text-[17px] font-extrabold", withinBudget ? "text-mint-600" : "text-coral-600")}>
                {money(total, currency)}
              </span>
              <span className="block text-[10px] text-ink-muted">{withinBudget ? t("withinBudget") : t("overBudget")}</span>
            </span>
          </div>

          {Array.from({ length: plan.days }, (_, d) => d + 1).map((d) => {
            const items = plan.items.filter((i) => i.day === d);
            if (!items.length) return null;
            return (
              <div key={d} className="mb-4">
                <p className="mb-2 text-[13px] font-extrabold text-brand">
                  {t("day")} {d}
                </p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const Icon = KIND_ICON[item.kind];
                    return (
                      <li key={item.id} className="card flex items-center gap-3 p-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand">
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold">{item.title}</span>
                          <span className="block truncate text-[11px] text-ink-muted">
                            {item.time} · {item.note}
                          </span>
                        </span>
                        {item.cost > 0 && (
                          <span className="shrink-0 text-[13px] font-extrabold">{money(item.cost, currency)}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              dispatch({ type: "addPlan", plan });
              setToast(t("planSaved"));
            }}
            className="btn-light w-full gap-2 py-4 text-[14px]"
          >
            <Bookmark size={16} /> {t("savePlan")}
          </button>
        </section>
      )}

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title={t("destination")}>
        <ul className="space-y-1.5">
          {CITIES.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { setDestination(c.id); setCityOpen(false); }} className="w-full rounded-2xl px-3 py-3 text-start text-[14px] font-bold transition hover:bg-canvas">
                {locale === "ar" ? c.nameAr : c.name}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
