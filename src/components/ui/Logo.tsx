import { cn } from "@/lib/cn";

/**
 * شعار Chrono AI: خط واحد متصل يلتف حلزونياً من الداخل إلى الخارج.
 *
 * الفكرة: الأثر. الحلزون هو شكل الزمن حين يُراكم — حلقات الشجرة، ودوّامة
 * البصمة، وموجة تتسع من لحظة واحدة. يبدأ من نقطة (اللحظة) وينتهي مفتوحاً
 * (ما لم يُكتب بعد). مرسوم بضربة واحدة، فيبقى مقروءاً عند 24 بكسل.
 */
// لفّة ونصف: المسافة بين اللفّات أوسع من سماكة الخط، فلا تلتحم عند 24 بكسل
const SPIRAL = "M27,30 A6,6 0 0 1 27,18 A12,12 0 0 1 27,42 A18,18 0 0 1 27,6";
const STROKE = 4.8;

export function Logo({
  size = 32,
  className,
  tone = "gradient",
}: {
  size?: number;
  className?: string;
  /** gradient: تدرّج الهوية · mono: يرث لون النص المحيط */
  tone?: "gradient" | "mono";
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Chrono AI"
    >
      {tone === "gradient" && (
        <defs>
          <linearGradient id="chronoSpiral" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgb(var(--iris))" />
            <stop offset="100%" stopColor="rgb(var(--rose))" />
          </linearGradient>
        </defs>
      )}
      <path
        d={SPIRAL}
        stroke={tone === "gradient" ? "url(#chronoSpiral)" : "currentColor"}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** الشعار مع اسم التطبيق — يُستعمل في الترويسات وشريط التنقل. */
export function Wordmark({
  size = 28,
  className,
  subtitle,
}: {
  size?: number;
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)} dir="ltr">
      <Logo size={size} />
      <div className="text-left">
        <p className="text-[15px] font-semibold leading-none tracking-[-0.01em]">Chrono AI</p>
        {subtitle && <p className="mt-1 text-[10.5px] leading-none text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
