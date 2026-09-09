import { BadgeCheck, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { providerById } from "@/data/catalog";
import { quoteTotal, savingsOf } from "@/lib/aggregator";
import { money } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { cx } from "@/components/ui";
import { useStore } from "@/state/store";

/**
 * The comparison table. Quotes arrive sorted cheapest-first from the
 * aggregator; the first row is therefore the best total and is marked as such.
 * Totals always include the site's own fees, so the number shown is what the
 * traveller actually pays.
 */
export default function PriceCompare({
  quotes,
  unitLabel,
  onSelect,
  selectedId,
}: {
  quotes: Quote[];
  unitLabel?: string;
  onSelect?: (q: Quote) => void;
  selectedId?: string;
}) {
  const { t, currency } = useStore();
  const savings = savingsOf(quotes);

  return (
    <div className="space-y-3">
      {savings > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-mint-100 px-4 py-3">
          <span className="text-[12px] font-semibold text-mint-600">
            {quotes.length} {t("sitesCompared")}
          </span>
          <span className="text-[13px] font-extrabold text-mint-600">
            {t("youSave")} {money(savings, currency)}
          </span>
        </div>
      )}

      <ul className="space-y-2.5">
        {quotes.map((q, i) => {
          const p = providerById(q.providerId);
          const best = i === 0;
          const active = selectedId === q.providerId;
          return (
            <li key={q.providerId}>
              <button
                type="button"
                onClick={() => onSelect?.(q)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-3xl border-2 px-3.5 py-3 text-start transition active:scale-[.99]",
                  active ? "border-brand bg-brand-50" : best ? "border-mint-200 bg-white" : "border-transparent bg-white",
                )}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[13px] font-extrabold"
                  style={{ background: p.bg, color: p.color }}
                >
                  {p.short}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-bold">{p.name}</span>
                    {best && (
                      <span className="chip bg-mint-100 py-0.5 text-[10px] text-mint-600">
                        <BadgeCheck size={11} /> {t("bestPrice")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-muted">
                    <span>{q.fees ? `+ ${money(q.fees, currency)} ${t("fees")}` : t("noFees")}</span>
                    {q.cancellation === "free" && (
                      <span className="inline-flex items-center gap-1 text-mint-600">
                        <ShieldCheck size={11} /> {t("freeCancellation")}
                      </span>
                    )}
                    {q.payLater && (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <Wallet size={11} /> {t("payLater")}
                      </span>
                    )}
                  </span>
                </span>

                <span className="shrink-0 text-end">
                  <span className="block text-[15px] font-extrabold">{money(quoteTotal(q), currency)}</span>
                  {unitLabel && <span className="block text-[10px] text-ink-muted">{unitLabel}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-1.5 px-1 text-[11px] leading-relaxed text-ink-faint">
        <ExternalLink size={12} className="shrink-0" />
        {t("total")} = {t("bestPrice")} + {t("fees")}
      </p>
    </div>
  );
}
