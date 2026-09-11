import { cn } from "@/lib/cn";

/**
 * وسيط بصري مولّد رياضياً (تدرّجات + طبقات ضوء) بدل الصور الفوتوغرافية.
 * القرار مقصود: لا نستخدم صوراً لا نملك حقوقها داخل المنتج.
 */
export function MediaCanvas({
  colors,
  className,
  grain = true,
  label,
}: {
  colors: [string, string, string];
  className?: string;
  grain?: boolean;
  label?: string;
}) {
  const [a, b, c] = colors;
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl2", className)}
      style={{ background: `linear-gradient(150deg, ${a}, ${b} 55%, ${c})` }}
      role="img"
      aria-label={label ?? "وسيط بصري"}
    >
      <div
        className="absolute inset-0 opacity-70 mix-blend-screen"
        style={{
          background: `radial-gradient(60% 50% at 25% 20%, ${c}66, transparent 70%),
                       radial-gradient(55% 45% at 80% 85%, ${a}88, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "repeating-linear-gradient(115deg, rgba(255,255,255,.16) 0 1px, transparent 1px 14px)",
        }}
      />
      {grain && (
        <svg className="absolute inset-0 h-full w-full opacity-[0.16]" aria-hidden>
          <filter id="g">
            <feTurbulence baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#g)" />
        </svg>
      )}
    </div>
  );
}
