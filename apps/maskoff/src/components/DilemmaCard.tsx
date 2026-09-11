import { useCallback, useRef, useState } from "react";
import type { OptionId, Question } from "@/types/game";
import { haptic, sfx } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ACCENT_HEX, IconBadge } from "./ui/Primitives";
import { IconArrow, IconCheck } from "./ui/Icons";

/**
 * The dilemma as two oversized pastel tiles (reference: the stacked service
 * cards with the circular ↗ action). Tap either tile, or drag the stack
 * horizontally — drag past the threshold and the card commits, which is much
 * faster than tapping when you're doing this every night.
 */
export function DilemmaCard({
  question,
  value,
  onChange,
  hint,
  disabled = false,
}: {
  question: Question;
  value: OptionId | null;
  onChange: (choice: OptionId) => void;
  hint: string;
  disabled?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const pointerId = useRef<number | null>(null);

  const COMMIT_PX = 78;
  /** Movement below this is a tap, not a drag. */
  const DRAG_SLOP = 10;

  const choose = useCallback(
    (choice: OptionId) => {
      if (disabled) return;
      haptic("select");
      sfx("select");
      onChange(choice);
    },
    [disabled, onChange],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    startX.current = event.clientX;
    pointerId.current = null;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = event.clientX - startX.current;

    // Capture only once this is unambiguously a drag. Capturing on pointerdown
    // retargets the subsequent click to this container, which would swallow
    // taps on the option buttons entirely.
    if (pointerId.current === null && Math.abs(dx) > DRAG_SLOP) {
      pointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (pointerId.current !== null) setDragX(dx);
  };

  const onPointerUp = () => {
    if (startX.current === null) return;
    // A tap never committed a drag; let the button's own click handle it.
    if (pointerId.current === null) {
      startX.current = null;
      return;
    }
    // Drag right commits A, drag left commits B. Mirrored under RTL so the
    // gesture always matches the on-screen order of the tiles.
    const rtl = document.documentElement.dir === "rtl";
    if (Math.abs(dragX) > COMMIT_PX) {
      const towardsFirst = rtl ? dragX < 0 : dragX > 0;
      choose(towardsFirst ? "A" : "B");
    }
    startX.current = null;
    pointerId.current = null;
    setDragX(0);
  };

  const tilt = Math.max(-10, Math.min(10, dragX / 12));

  return (
    <div className="select-none">
      <p className="mb-5 text-balance font-display text-[26px] font-extrabold leading-[1.28]">
        {question.question_text}
      </p>

      <div
        className="space-y-3 touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dragX * 0.35}px) rotate(${tilt * 0.25}deg)`,
          transition: startX.current === null ? "transform .28s cubic-bezier(.16,1,.3,1)" : "none",
        }}
      >
        {question.options.map((option, index) => {
          const accent = index === 0 ? ACCENT_HEX.ice : ACCENT_HEX.coral;
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => choose(option.id)}
              aria-pressed={selected}
              className={cn(
                "tile flex w-full items-center gap-4 p-5 text-start transition-all duration-200",
                selected ? "scale-[1.015] opacity-100" : "opacity-90",
                disabled && "cursor-default",
              )}
              style={{
                background: accent,
                boxShadow: selected ? `0 0 0 3px ${accent}, 0 22px 44px -20px ${accent}` : undefined,
              }}
            >
              <IconBadge onInk tone="rgba(23,19,31,.08)" className="text-ink-900">
                <span className="font-display text-base font-extrabold">{option.id}</span>
              </IconBadge>

              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-snug text-ink-900">{option.text}</span>
              </span>

              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-pill transition-colors",
                  selected ? "bg-ink-900 text-white" : "bg-white text-ink-900",
                )}
              >
                {selected ? <IconCheck /> : <IconArrow className="flip-rtl h-[18px] w-[18px]" />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs font-medium text-muted">{hint}</p>
    </div>
  );
}
