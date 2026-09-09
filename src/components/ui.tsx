import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Back chevron that points the right way in both writing directions. */
export function BackButton({ onClick, className = "" }: { onClick?: () => void; className?: string }) {
  const navigate = useNavigate();
  const { dir, t } = useStore();
  const Icon = dir === "rtl" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={t("back")}
      onClick={onClick ?? (() => navigate(-1))}
      className={cx("icon-btn", className)}
    >
      <Icon size={22} strokeWidth={2.4} />
    </button>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  className = "",
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center justify-between", className)}>
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      {actionLabel && (
        <button type="button" onClick={onAction} className="text-[13px] font-semibold text-brand">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the screen behind the sheet from scrolling with it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[440px] animate-fade-up rounded-t-[30px] bg-white pb-safe shadow-float outline-none"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-canvas-deep" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <h3 className="text-[17px] font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-canvas text-ink-soft">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-canvas-deep/70 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(id);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-6">
      <div role="status" className="animate-fade-up rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-white shadow-pill">
        {message}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-canvas p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cx(
              "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition",
              active ? "bg-ink text-white shadow-pill" : "text-ink-muted",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
          <path
            d="M10 1.6l2.5 5.1 5.6.8-4 3.9.9 5.6L10 14.4l-5 2.6.9-5.6-4-3.9 5.6-.8L10 1.6z"
            fill={i < Math.round(value) ? "#FF8A29" : "#DDE0EC"}
          />
        </svg>
      ))}
    </span>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-brand shadow-soft">{icon}</div>
      <p className="text-[15px] font-bold">{title}</p>
      {hint && <p className="max-w-[240px] text-[13px] leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("relative overflow-hidden rounded-2xl bg-white/70", className)}>
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-canvas-deep/60 to-transparent"
      style={{ animation: "shimmer 1.4s infinite" }} />
  </div>;
}
