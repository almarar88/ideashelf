import { CalendarDays, Home, LayoutGrid, Sparkles, TicketPercent } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cx } from "@/components/ui";
import { useStore } from "@/state/store";

const TABS = [
  { to: "/", key: "navHome", Icon: Home, end: true },
  { to: "/trips", key: "navTrips", Icon: CalendarDays, end: false },
  { to: "/deals", key: "navDeals", Icon: TicketPercent, end: false },
  { to: "/more", key: "navMore", Icon: LayoutGrid, end: false },
] as const;

export default function BottomNav() {
  const { t } = useStore();
  const navigate = useNavigate();

  return (
    <div className="relative shrink-0">
      {/* The assistant sits above the bar so it stays reachable from any tab. */}
      <button
        type="button"
        onClick={() => navigate("/assistant")}
        aria-label={t("assistant")}
        className="absolute -top-16 end-4 grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-pill transition active:scale-95"
      >
        <Sparkles size={22} />
      </button>

      <nav className="mx-3 mb-3 flex items-stretch justify-between rounded-[26px] bg-white px-2 py-2 shadow-card">
        {TABS.map(({ to, key, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="group relative flex flex-1 flex-col items-center gap-1 rounded-3xl px-2 py-2.5"
          >
            {({ isActive }) => (
              <>
                <span
                  className={cx(
                    "grid h-9 w-9 place-items-center rounded-2xl transition",
                    isActive ? "bg-brand-50 text-brand" : "text-ink-faint",
                  )}
                >
                  <Icon size={21} strokeWidth={isActive ? 2.5 : 2} fill={isActive ? "currentColor" : "none"} fillOpacity={isActive ? 0.18 : 0} />
                </span>
                <span className="sr-only">{t(key)}</span>
                <span
                  className={cx(
                    "h-1 w-6 rounded-full transition",
                    isActive ? "bg-brand" : "bg-transparent",
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
