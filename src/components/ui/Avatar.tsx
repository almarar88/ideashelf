import { cn } from "@/lib/cn";
import type { Person } from "@/lib/types";

const sizes = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-11 w-11 text-[13px]",
  lg: "h-14 w-14 text-[15px]",
  xl: "h-16 w-16 text-base",
};

/**
 * صورة رمزية مولّدة بالكامل من درجة اللون — لا صور خارجية،
 * فلا حقوق ملكية لطرف ثالث ولا طلبات شبكة.
 */
export function Avatar({
  person,
  size = "md",
  ring = false,
  className,
}: {
  person: Person;
  size?: keyof typeof sizes;
  ring?: boolean;
  className?: string;
}) {
  const a = `hsl(${person.hue} 85% 62%)`;
  const b = `hsl(${(person.hue + 48) % 360} 90% 72%)`;
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full",
        ring && "p-[2.5px]",
        className,
      )}
      style={
        ring
          ? { background: `conic-gradient(from 140deg, ${a}, ${b}, ${a})` }
          : undefined
      }
    >
      <span
        className={cn(
          "grid place-items-center rounded-full font-semibold text-white shadow-lift",
          sizes[size],
        )}
        style={{ background: `linear-gradient(145deg, ${a}, ${b})` }}
        aria-hidden
      >
        {person.name.slice(0, 1)}
      </span>
      <span className="sr-only">{person.name}</span>
    </span>
  );
}
