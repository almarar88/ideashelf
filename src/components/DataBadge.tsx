import { FlaskConical, Loader2, RadioTower, TestTube2 } from "lucide-react";
import { apiConfigured } from "@/lib/api";
import type { DataSource } from "@/lib/live";
import { useStore } from "@/state/store";

/**
 * Says plainly where the numbers on screen came from. The app is a price
 * comparison tool, so implying that demo figures are live fares would be the
 * single most misleading thing it could do — this banner is never optional.
 */
export default function DataBadge({ source, reason }: { source: DataSource; reason?: string }) {
  const { t, locale } = useStore();

  if (source === "loading") {
    return (
      <p className="mx-5 mt-3 flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[11px] font-semibold text-ink-muted">
        <Loader2 size={13} className="animate-spin text-brand" />
        {locale === "ar" ? "جارٍ جلب الأسعار الحقيقية…" : "Fetching live prices…"}
      </p>
    );
  }

  if (source === "live") {
    return (
      <p className="mx-5 mt-3 flex items-center gap-2 rounded-2xl bg-mint-100 px-4 py-2.5 text-[11px] font-semibold text-mint-600">
        <RadioTower size={13} />
        {t("liveDataTitle")}
        <span className="font-normal opacity-80">
          {locale === "ar" ? "— من مزوّدي الحجز مباشرة" : "— straight from the booking partners"}
        </span>
      </p>
    );
  }

  if (source === "mock") {
    return (
      <p className="mx-5 mt-3 flex items-center gap-2 rounded-2xl bg-sun-100 px-4 py-2.5 text-[11px] font-semibold text-sun">
        <FlaskConical size={13} />
        {locale === "ar"
          ? "بيانات محاكاة للتطوير — ليست أسعاراً حقيقية"
          : "Development fixtures — not real prices"}
      </p>
    );
  }

  return (
    <p className="mx-5 mt-3 rounded-2xl bg-white/70 px-4 py-2.5 text-[11px] leading-relaxed text-ink-muted">
      <TestTube2 size={12} className="me-1 inline align-[-2px] text-ink-soft" />
      <span className="font-bold text-ink-soft">{t("demoDataTitle")}:</span>{" "}
      {apiConfigured()
        ? locale === "ar"
          ? `لم تصل نتائج حقيقية لهذا البحث${reason ? ` (${reason})` : ""}، والمعروض من الكتالوج التجريبي.`
          : `No live results for this search${reason ? ` (${reason})` : ""} — showing the demo catalogue.`
        : t("demoDataBody")}
    </p>
  );
}
