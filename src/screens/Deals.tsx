import { Copy, Percent, Sparkles, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DestinationArt } from "@/components/Art";
import { Toast, cx } from "@/components/ui";
import { cityById } from "@/data/catalog";
import { searchPackages } from "@/lib/aggregator";
import { money } from "@/lib/format";
import { useStore } from "@/state/store";

const VOUCHERS = [
  { code: "ALCODE30", ar: "خصم ٣٠٪ للأعضاء الجدد", en: "30% off for new members", tone: "brand" },
  { code: "STAY15", ar: "١٥٪ على الفنادق", en: "15% off hotels", tone: "mint" },
  { code: "DRIVE2X", ar: "يومان مجاناً على تأجير السيارات", en: "2 free days on car hire", tone: "coral" },
  { code: "SIM5", ar: "٥٪ على شرائح eSIM", en: "5% off eSIM plans", tone: "sun" },
] as const;

const TONES = {
  brand: "bg-brand-100 text-brand-900",
  mint: "bg-mint-100 text-mint-600",
  coral: "bg-coral-100 text-coral-600",
  sun: "bg-sun-100 text-sun",
} as const;

export default function Deals() {
  const navigate = useNavigate();
  const { t, locale, currency } = useStore();
  const packages = useMemo(() => searchPackages(), []);
  const [toast, setToast] = useState<string | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast(`${t("copied")}: ${code}`);
    } catch {
      setToast(code);
    }
  };

  return (
    <div className="screen pb-6">
      <header className="px-5 pt-safe">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("navDeals")}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">{t("vouchers")}</p>
      </header>

      <div className="mt-4 space-y-3 px-5 stagger">
        {VOUCHERS.map((v) => (
          <div key={v.code} className={cx("relative overflow-hidden rounded-[26px] p-4", TONES[v.tone])}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/60">
                <Percent size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold">{locale === "ar" ? v.ar : v.en}</p>
                <p className="mt-0.5 text-[11px] opacity-70">{t("vouchers")}</p>
              </div>
              <button
                type="button"
                onClick={() => copy(v.code)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-extrabold"
              >
                <Copy size={12} /> {v.code}
              </button>
            </div>
            <span className="absolute -end-8 -top-8 h-24 w-24 rounded-full bg-white/30" />
          </div>
        ))}
      </div>

      <h2 className="mt-6 px-5 text-[17px] font-bold">{t("packages")}</h2>
      <div className="mt-3 space-y-3 px-5">
        {packages.slice(0, 3).map((pkg) => {
          const city = cityById(pkg.cityId);
          return (
            <button key={pkg.id} type="button" onClick={() => navigate("/packages")} className="card flex w-full items-center gap-3 overflow-hidden p-3 text-start">
              <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl">
                <DestinationArt name={city.image} className="absolute inset-0 h-full w-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold">{locale === "ar" ? pkg.titleAr : pkg.title}</span>
                <span className="mt-0.5 block text-[11px] text-ink-muted">{pkg.nights} {t("nights")}</span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-[15px] font-extrabold">{money(pkg.price, currency)}</span>
                <span className="text-[10px] text-mint-600">{t("save")} {money(pkg.oldPrice - pkg.price, currency)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => navigate("/assistant")} className="mx-5 mt-6 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-[24px] bg-ink px-4 py-4 text-start text-white shadow-pill">
        <Sparkles size={19} />
        <span className="flex-1 text-[14px] font-bold">{t("assistant")}</span>
        <Ticket size={18} className="opacity-60" />
      </button>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
