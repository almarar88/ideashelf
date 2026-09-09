import { Bed, Bell, Bus, Car, Globe, Heart, HelpCircle, Info, Package, Plane, Ship, Smartphone, Sparkles, TrainFront, User, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cx } from "@/components/ui";
import type { StringKey } from "@/lib/i18n";
import { useStore } from "@/state/store";

const TILES: Array<{ key: StringKey; to: string; Icon: typeof Plane; tone: string; mode?: "flight" | "train" | "boat" | "bus" }> = [
  { key: "flights", to: "/search", Icon: Plane, tone: "bg-brand-100 text-brand", mode: "flight" },
  { key: "trains", to: "/search", Icon: TrainFront, tone: "bg-mint-100 text-mint-600", mode: "train" },
  { key: "boats", to: "/search", Icon: Ship, tone: "bg-brand-50 text-brand", mode: "boat" },
  { key: "bus", to: "/search", Icon: Bus, tone: "bg-coral-100 text-coral-600", mode: "bus" },
  { key: "hotels", to: "/hotels", Icon: Bed, tone: "bg-mint-100 text-mint-600" },
  { key: "cars", to: "/cars", Icon: Car, tone: "bg-brand-50 text-brand" },
  { key: "packages", to: "/packages", Icon: Package, tone: "bg-rose-100 text-rose" },
  { key: "esim", to: "/esim", Icon: Smartphone, tone: "bg-sun-100 text-sun" },
  { key: "planner", to: "/planner", Icon: Sparkles, tone: "bg-brand-100 text-brand" },
  { key: "assistant", to: "/assistant", Icon: Sparkles, tone: "bg-canvas text-ink" },
  { key: "favourites", to: "/profile", Icon: Heart, tone: "bg-rose-100 text-rose" },
  { key: "profile", to: "/profile", Icon: User, tone: "bg-canvas text-ink" },
];

const ROWS: Array<{ key: StringKey; to: string; Icon: typeof Bell }> = [
  { key: "notifications", to: "/notifications", Icon: Bell },
  { key: "paymentMethods", to: "/profile", Icon: Wallet },
  { key: "language", to: "/profile", Icon: Globe },
  { key: "help", to: "/profile", Icon: HelpCircle },
  { key: "about", to: "/profile", Icon: Info },
];

export default function More() {
  const navigate = useNavigate();
  const { t, dispatch } = useStore();

  return (
    <div className="screen pb-6">
      <header className="px-5 pt-safe">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("navMore")}</h1>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-3 px-5 stagger">
        {TILES.map(({ key, to, Icon, tone, mode }) => (
          <button
            key={`${key}-${to}-${mode ?? ""}`}
            type="button"
            onClick={() => {
              if (mode) dispatch({ type: "setSearch", search: { mode } });
              navigate(to);
            }}
            className="card flex flex-col items-center gap-2 px-2 py-4 transition active:scale-95"
          >
            <span className={cx("grid h-11 w-11 place-items-center rounded-2xl", tone)}>
              <Icon size={19} />
            </span>
            <span className="text-center text-[11px] font-bold leading-tight">{t(key)}</span>
          </button>
        ))}
      </div>

      <div className="mx-5 mt-5 overflow-hidden rounded-[26px] bg-white shadow-card">
        {ROWS.map(({ key, to, Icon }, i) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(to)}
            className={cx("flex w-full items-center gap-3 px-4 py-4 text-start", i > 0 && "border-t border-canvas")}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-canvas text-ink-soft">
              <Icon size={17} />
            </span>
            <span className="flex-1 text-[14px] font-semibold">{t(key)}</span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] text-ink-faint">Alcode Trips · v1.0.0</p>
    </div>
  );
}
