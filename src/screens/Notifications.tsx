import { Bell, Percent, Plane, TrendingDown } from "lucide-react";
import { useMemo } from "react";
import { BackButton, Empty } from "@/components/ui";
import { cityById } from "@/data/catalog";
import { money } from "@/lib/format";
import { useStore } from "@/state/store";

export default function Notifications() {
  const { t, locale, currency, priceAlerts, bookings, search } = useStore();

  // The feed is derived from what the traveller actually tracks and books, so
  // it is never a wall of invented alerts on a fresh install.
  const items = useMemo(() => {
    const from = cityById(search.fromId);
    const to = cityById(search.toId);
    const feed: Array<{ id: string; icon: typeof Bell; tone: string; title: string; body: string }> = [];

    priceAlerts.forEach((id, i) =>
      feed.push({
        id: `alert-${id}`,
        icon: TrendingDown,
        tone: "bg-mint-100 text-mint-600",
        title: locale === "ar" ? "تنبيه سعر مفعّل" : "Price alert active",
        body:
          locale === "ar"
            ? `نتابع ${from.nameAr} ← ${to.nameAr} وسننبهك عند أي انخفاض. (${i + 1})`
            : `Watching ${from.name} → ${to.name}. We'll alert you on a drop. (${i + 1})`,
      }),
    );

    bookings.slice(0, 4).forEach((b) =>
      feed.push({
        id: `bk-${b.id}`,
        icon: Plane,
        tone: "bg-brand-50 text-brand",
        title: locale === "ar" ? "تم تأكيد الحجز" : "Booking confirmed",
        body: `${b.title} · ${b.code} · ${money(b.price, currency)}`,
      }),
    );

    feed.push({
      id: "promo",
      icon: Percent,
      tone: "bg-sun-100 text-sun",
      title: locale === "ar" ? "قسيمة جديدة" : "New voucher",
      body: locale === "ar" ? "استخدم ALCODE30 لخصم ٣٠٪ على أول حجز." : "Use ALCODE30 for 30% off your first booking.",
    });

    return feed;
  }, [priceAlerts, bookings, search, locale, currency]);

  return (
    <div className="screen pb-6">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <h1 className="text-[20px] font-extrabold">{t("notifications")}</h1>
      </header>

      <div className="mt-4 space-y-3 px-5 stagger">
        {items.map(({ id, icon: Icon, tone, title, body }) => (
          <article key={id} className="card flex items-start gap-3 p-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">{title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{body}</p>
            </div>
          </article>
        ))}
        {items.length === 0 && <Empty title={t("notifications")} icon={<Bell size={24} />} />}
      </div>
    </div>
  );
}
