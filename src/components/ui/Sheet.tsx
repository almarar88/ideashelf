import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** لوح عميق ينزلق من الأسفل — تجسيد الانتقال من "السطح" إلى "العمق". */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-[rgb(var(--scrim)/0.45)] backdrop-blur-[3px]"
      />
      <div
        className={cn(
          "depth-enter relative max-h-[86%] overflow-y-auto no-scrollbar rounded-t-xl4 bg-surface px-5 pb-6 pt-4 shadow-float",
          className,
        )}
      >
        <div className="sticky top-0 -mx-5 mb-3 flex items-start justify-between gap-3 bg-surface px-5 pb-3 pt-1">
          <div className="min-w-0">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h3 className="truncate text-[17px] font-semibold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="mt-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-muted transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
