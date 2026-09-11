import { cn } from "@/lib/utils";
import { IconVault, IconMask, IconEye, IconStar } from "./ui/Icons";

export type Screen = "vault" | "play" | "showdown" | "persona";

const ITEMS: { key: Screen; Icon: typeof IconVault }[] = [
  { key: "vault", Icon: IconVault },
  { key: "play", Icon: IconMask },
  { key: "showdown", Icon: IconEye },
  { key: "persona", Icon: IconStar },
];

/**
 * Floating pill navigation (reference: the rounded bar with circular icon
 * buttons). The active item lifts into a filled white circle.
 */
export function PillNav({
  active,
  onChange,
  labels,
  badge,
}: {
  active: Screen;
  onChange: (screen: Screen) => void;
  labels: Record<Screen, string>;
  badge?: Partial<Record<Screen, boolean>>;
}) {
  return (
    <nav
      className="glass-nav fixed inset-x-0 bottom-0 z-40 mx-auto mb-[calc(var(--safe-bottom)+14px)] flex w-[min(92%,420px)] items-center justify-between p-2"
      aria-label="main"
    >
      {ITEMS.map(({ key, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 rounded-pill py-2 transition-all duration-200",
              isActive ? "text-ink-900" : "text-muted",
            )}
          >
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-pill transition-all duration-200",
                isActive && "bg-white shadow-[0_10px_26px_-10px_rgba(255,255,255,.65)]",
              )}
            >
              <Icon className="h-[19px] w-[19px]" />
            </span>
            <span className={cn("text-[10px] font-semibold", isActive ? "text-white" : "text-muted")}>
              {labels[key]}
            </span>
            {badge?.[key] && !isActive && (
              <span className="absolute end-[26%] top-1 h-2 w-2 rounded-pill bg-coral" aria-hidden />
            )}
          </button>
        );
      })}
    </nav>
  );
}
