import { Bed, CalendarDays, Car, Plane, Smartphone, Sparkles, Ticket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, cx } from "@/components/ui";
import { formatDate, iso, money } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useStore } from "@/state/store";

const KIND_ICON: Record<Booking["kind"], typeof Plane> = {
  trip: Plane,
  hotel: Bed,
  car: Car,
  package: Ticket,
  esim: Smartphone,
};

type Tab = "upcoming" | "completed" | "plans";

export default function Trips() {
  const navigate = useNavigate();
  const { t, locale, currency, bookings, plans, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>("upcoming");

  const now = Date.now();
  const upcoming = bookings.filter((b) => +new Date(b.dateISO) >= now || b.kind === "esim");
  const past = bookings.filter((b) => +new Date(b.dateISO) < now && b.kind !== "esim");
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="screen pb-6">
      <header className="px-5 pt-safe">
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("myTrips")}</h1>
      </header>

      <div className="mx-5 mt-4 flex gap-1 rounded-full bg-white p-1 shadow-soft">
        {(
          [
            ["upcoming", t("upcoming")],
            ["completed", t("completed")],
            ["plans", t("plans")],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              "flex-1 rounded-full py-2.5 text-[13px] font-semibold transition",
              tab === key ? "bg-ink text-white shadow-pill" : "text-ink-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "plans" && (
        <div className="mt-4 space-y-3 px-5 stagger">
          {list.map((b) => {
            const Icon = KIND_ICON[b.kind];
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => (b.kind === "trip" ? navigate(`/ticket/${b.id}`) : undefined)}
                className="card flex w-full items-center gap-3.5 p-4 text-start"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand">
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{b.title}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">{b.subtitle}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-ink-soft">
                    {formatDate(b.dateISO, locale, "short")} · {iso(b.code)}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block text-[15px] font-extrabold">{money(b.price, currency)}</span>
                  <span className="mt-1 inline-block rounded-full bg-mint-100 px-2 py-0.5 text-[9px] font-bold text-mint-600">
                    {t(b.status === "completed" ? "completed" : "upcoming")}
                  </span>
                </span>
              </button>
            );
          })}
          {list.length === 0 && <Empty title={t("noBookings")} hint={t("noBookingsHint")} icon={<CalendarDays size={24} />} />}
        </div>
      )}

      {tab === "plans" && (
        <div className="mt-4 space-y-3 px-5 stagger">
          {plans.map((p) => (
            <article key={p.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{p.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-muted">
                    {formatDate(p.startISO, locale, "short")} · {iso(p.travellers)} {t("travellers")} · {iso(p.items.length)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="delete"
                  onClick={() => dispatch({ type: "removePlan", id: p.id })}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-canvas text-ink-faint transition active:scale-90"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-canvas pt-3">
                <span className="text-[11px] text-ink-muted">{t("estimatedTotal")}</span>
                <span className="text-[15px] font-extrabold">
                  {money(p.items.reduce((s, i) => s + i.cost, 0), currency)}
                </span>
              </div>
            </article>
          ))}
          {plans.length === 0 && (
            <Empty title={t("noPlans")} hint={t("plannerSub")} icon={<Sparkles size={24} />} />
          )}
        </div>
      )}
    </div>
  );
}
