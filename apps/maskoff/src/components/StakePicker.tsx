import type { OptionId, Player, Question } from "@/types/game";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ACCENT_HEX, Avatar } from "./ui/Primitives";

/**
 * Betting step: for each other member, guess which option they picked.
 * One row per member, A/B as a segmented control — fast enough to clear a
 * six-person squad in a few seconds.
 */
export function StakePicker({
  question,
  members,
  stakes,
  onChange,
  disabled = false,
}: {
  question: Question;
  members: Player[];
  stakes: Record<string, OptionId>;
  onChange: (targetId: string, choice: OptionId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {members.map((member) => {
        const value = stakes[member.id];
        return (
          <div key={member.id} className="surface-2 flex items-center gap-3 p-3">
            <Avatar player={member} size={42} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{member.name}</span>

            <div className="flex shrink-0 gap-1.5" role="group" aria-label={member.name}>
              {question.options.map((option, index) => {
                const selected = value === option.id;
                const accent = index === 0 ? ACCENT_HEX.ice : ACCENT_HEX.coral;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => {
                      haptic("tap");
                      onChange(member.id, option.id);
                    }}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-pill font-display text-sm font-extrabold transition-all duration-150 active:scale-90",
                      selected ? "text-ink-900" : "bg-white/[.07] text-muted",
                    )}
                    style={selected ? { background: accent, boxShadow: `0 0 20px -6px ${accent}` } : undefined}
                  >
                    {option.id}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
