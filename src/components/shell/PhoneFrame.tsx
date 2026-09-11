import { cn } from "@/lib/cn";

/** إطار الجهاز — على الشاشات الصغيرة يذوب الإطار ويصبح التطبيق ملء الشاشة. */
export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[420px] lg:max-w-[392px]",
        "lg:rounded-[2.9rem] lg:p-[10px]",
        "lg:bg-[linear-gradient(160deg,rgb(var(--surface)/.9),rgb(var(--raised)/.75))]",
        "lg:shadow-float lg:ring-1 lg:ring-[rgb(var(--line)/.8)]",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas lg:h-[812px] lg:rounded-[2.3rem]",
          "bg-[linear-gradient(180deg,rgb(var(--raised)),rgb(var(--surface))_38%,rgb(var(--surface)))]",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden justify-center lg:flex">
          <div className="mt-2 h-6 w-28 rounded-full bg-[rgb(var(--scrim)/.75)]" />
        </div>
        {children}
      </div>
    </div>
  );
}
