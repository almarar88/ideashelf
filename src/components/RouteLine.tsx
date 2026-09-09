import { Bus, Plane, Ship, TrainFront } from "lucide-react";
import type { TransportMode } from "@/lib/types";

const ICONS = { flight: Plane, train: TrainFront, boat: Ship, bus: Bus } as const;

/**
 * The dotted origin → destination line used on every schedule and result card.
 * Reads left-to-right in both directions because a journey line is spatial,
 * not textual — only the mode glyph is mirrored.
 */
export default function RouteLine({
  mode,
  label,
  className = "",
}: {
  mode: TransportMode;
  label: string;
  className?: string;
}) {
  const Icon = ICONS[mode];
  return (
    <div className={`flex flex-1 flex-col items-center gap-1 ${className}`} dir="ltr">
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
      <div className="flex w-full items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
        <span className="dotted-line h-px flex-1" />
        <Icon size={15} className="shrink-0 text-ink-soft" strokeWidth={2.2} />
      </div>
    </div>
  );
}
