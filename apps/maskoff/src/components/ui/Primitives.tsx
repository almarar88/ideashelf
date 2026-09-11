import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/game";

/* -------------------------------------------------------------------------- *
 *  Shared primitives drawn from the design reference: ringed circular icon
 *  buttons, oversized pastel tiles, colored stat chips, and the chevron
 *  progress stepper.
 * -------------------------------------------------------------------------- */

export const ACCENT_HEX: Record<Player["accent"], string> = {
  ice: "#B9C9F2",
  coral: "#F08D7C",
  pistachio: "#C7E89C",
  butter: "#F2D06B",
  grape: "#B429E0",
  neon: "#8B5CF6",
};

/** True when white text on this accent would be unreadable. */
const INK_ON: Record<Player["accent"], boolean> = {
  ice: true,
  coral: true,
  pistachio: true,
  butter: true,
  grape: false,
  neon: false,
};

export function IconBadge({
  children,
  onInk = false,
  className,
  tone,
}: {
  children: ReactNode;
  onInk?: boolean;
  className?: string;
  tone?: string;
}) {
  return (
    <span
      className={cn("badge-ring", onInk && "badge-ring-ink", className)}
      style={tone ? { background: tone } : undefined}
    >
      {children}
    </span>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  onInk = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  onInk?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "badge-ring transition-transform duration-150 active:scale-90",
        onInk ? "badge-ring-ink text-ink-900" : "text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Large pastel tile with dark ink content (reference: the service cards). */
export function Tile({
  accent,
  children,
  className,
  onClick,
  style,
}: {
  accent: Player["accent"] | string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const background = accent in ACCENT_HEX ? ACCENT_HEX[accent as Player["accent"]] : accent;
  const ink = accent in ACCENT_HEX ? INK_ON[accent as Player["accent"]] : true;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn("tile block w-full p-5 text-start", onClick && "active:scale-[.985] transition-transform", className)}
      style={{ background, color: ink ? "#17131F" : "#FFFFFF", ...style }}
    >
      {children}
    </Tag>
  );
}

export function Avatar({
  player,
  size = 44,
  dim = false,
  ring = true,
}: {
  player: Player;
  size?: number;
  dim?: boolean;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-pill bg-ink-700 transition-opacity",
        dim && "opacity-35",
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        boxShadow: ring ? `0 0 0 2px ${ACCENT_HEX[player.accent]}` : undefined,
      }}
      title={player.name}
      aria-label={player.name}
    >
      <span aria-hidden>{player.emoji}</span>
    </span>
  );
}

/** The colored count row (reference: 5 All / 2 In Progress / 1 Cancelled). */
export function StatTiles({
  items,
}: {
  items: { value: string | number; label: string; color: string }[];
}) {
  return (
    <div className="flex gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="stat-tile" style={{ background: item.color }}>
          <span className="tnum font-display text-2xl font-extrabold leading-none">{item.value}</span>
          <span className="text-[11px] font-semibold opacity-70">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Chevron progress stepper (reference: Checking >>> Completed). */
export function Stepper({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div className="surface-2 flex items-center justify-between gap-2 px-4 py-3">
      {steps.map((step, index) => (
        <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "truncate text-xs font-semibold transition-colors",
              index === activeIndex ? "text-white" : index < activeIndex ? "text-pistachio" : "text-muted",
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <span className="flex shrink-0 items-center text-muted" aria-hidden>
              {[0, 1, 2].map((dot) => (
                <svg
                  key={dot}
                  viewBox="0 0 24 24"
                  className={cn("flip-rtl h-3 w-3", index < activeIndex && "text-pistachio")}
                  style={{ animationDelay: `${dot * 120}ms` }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="surface animate-sheet-in relative m-3 w-full max-w-md p-6 pb-8"
      >
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-lg font-extrabold">{children}</h2>
      {action}
    </div>
  );
}
