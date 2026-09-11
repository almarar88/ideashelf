import { cn } from "@/lib/cn";

export function Pill({
  active,
  children,
  onClick,
  className,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "pill whitespace-nowrap",
        active ? "pill-live" : "pill-idle hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
