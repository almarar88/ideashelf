import { cn } from "@/lib/cn";

/** إطار الجهاز — على الشاشات الصغيرة يذوب الإطار ويصبح التطبيق ملء الشاشة. */
export function PhoneFrame({
  children,
  className,
  framed = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** إطار الجهاز يظهر فقط في وضع العرض على الشاشات الواسعة */
  framed?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[420px]",
        framed &&
          "max-w-[392px] rounded-[2.9rem] p-[10px] shadow-float ring-1 ring-[rgb(var(--line)/.8)] bg-[linear-gradient(160deg,rgb(var(--surface)/.9),rgb(var(--raised)/.75))]",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-canvas",
          "bg-[linear-gradient(180deg,rgb(var(--raised)),rgb(var(--surface))_38%,rgb(var(--surface)))]",
          // مساحة إضافية أعلى الإطار حتى لا تصطدم الترويسة بنتوء الشاشة
          framed ? "h-[812px] rounded-[2.3rem] pt-6" : "h-[100dvh]",
        )}
      >
        {framed && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
            <div className="mt-2 h-6 w-28 rounded-full bg-[rgb(var(--scrim)/.75)]" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
