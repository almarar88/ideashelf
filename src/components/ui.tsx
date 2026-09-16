import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* Round icon button — the little circular controls in the reference design */
export function IconButton({
  className,
  tone = "light",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "light" | "dark" | "accent" | "ghost"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "h-9 w-9",
        size === "md" && "h-11 w-11",
        size === "lg" && "h-14 w-14",
        tone === "light" && "bg-cream-soft text-ink hover:bg-cream-deep",
        tone === "dark" && "bg-ink-soft text-cream hover:bg-[#4a4542]",
        tone === "accent" && "bg-accent text-white hover:bg-accent-deep",
        tone === "ghost" && "bg-white/10 text-white hover:bg-white/20",
        className,
      )}
    />
  );
}

/* Pill / chip */
export function Pill({ children, className, active }: { children: ReactNode; className?: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        active ? "bg-accent text-white" : "bg-black/10 text-current",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* iOS-style toggle in accent color */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-black/20",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "start-6" : "start-1",
        )}
      />
    </button>
  );
}

/* Card surfaces */
export function Card({
  children,
  className,
  tone = "light",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark" | "white" | "accent";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "rounded-3xl text-start",
        tone === "light" && "bg-cream-soft text-ink",
        tone === "white" && "bg-white text-ink",
        tone === "dark" && "bg-ink text-cream",
        tone === "accent" && "bg-accent text-white",
        onClick && "transition active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

export function Button({
  className,
  tone = "dark",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "dark" | "accent" | "light" | "outline" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
        tone === "dark" && "bg-ink text-cream hover:bg-ink-soft",
        tone === "accent" && "bg-accent text-white hover:bg-accent-deep",
        tone === "light" && "bg-cream-soft text-ink hover:bg-cream-deep",
        tone === "outline" && "border border-current bg-transparent",
        className,
      )}
    />
  );
}
