import { cn } from "@/lib/cn";
import type { WindowLayout } from "@/hooks/useWindowLayout";

/**
 * تخطيط اللوحتين للأجهزة القابلة للطي واللوحيات الصغيرة.
 * حين تمتد النافذة عبر مفصلة، يقع الفاصل على المفصلة نفسها
 * فلا ينقسم أي محتوى عليها.
 */
export function DualShell({
  layout,
  rail,
  primary,
  secondary,
}: {
  layout: WindowLayout;
  rail: React.ReactNode;
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  const tabletop = layout.mode === "tabletop";

  return (
    <div className="relative z-10 flex h-[100dvh] w-full overflow-hidden bg-canvas">
      {rail}
      <div className={cn("flex min-h-0 min-w-0 flex-1", tabletop ? "flex-col" : "flex-row")}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,rgb(var(--raised)),rgb(var(--surface))_40%)]">
          {primary}
        </div>
        <div
          className={cn("shrink-0 bg-canvas", tabletop ? "hinge-row w-full" : "hinge-col h-full")}
          aria-hidden
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r hairline bg-surface/45">
          {secondary}
        </div>
      </div>
    </div>
  );
}
