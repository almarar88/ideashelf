import { Clapperboard, Filter, Fingerprint, Lock, Sparkles, Waypoints } from "lucide-react";
import { cn } from "@/lib/cn";
import { gate } from "@/lib/engine";
import { posts } from "@/lib/data";
import type { ScreenId } from "@/lib/types";

const allComments = posts.flatMap((p) => p.comments);

/**
 * بطاقات عائمة حول الجهاز — مستوحاة من تخطيط المرجع البصري،
 * لكنها هنا حيّة: تعرض حالة التطبيق الفعلية لا زخرفة ثابتة.
 */
export function FloatingDeck({ screen, busy, seals }: { screen: ScreenId; busy: boolean; seals: number }) {
  const { signal, noise } = gate(allComments);
  const aiAvg = Math.round(posts.reduce((s, p) => s + p.aiShare, 0) / posts.length);

  return (
    <>
      {/* اليسار */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[26vw] max-w-[330px] flex-col justify-center gap-5 pr-6 xl:flex">
        <DeckCard
          className="animate-floaty"
          icon={<Clapperboard size={15} className="text-rose" />}
          title="المخرج الآلي"
          active={screen === "studio"}
        >
          <div className="flex h-12 gap-1 overflow-hidden rounded-xl">
            {["#243a86", "#7b5bd0", "#2f4ea8", "#d75fa0"].map((c, i) => (
              <div
                key={c}
                className={cn("flex-1 transition-opacity duration-700", busy && i % 2 ? "opacity-50" : "")}
                style={{ background: `linear-gradient(160deg, ${c}, ${c}99)` }}
              />
            ))}
            <div className="flex-[0.4] border-2 border-dashed border-[rgb(var(--line))] bg-amber/20" />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {busy ? "يعالج المشهد الآن…" : "لقطة B-Roll واحدة مولّدة لملء الفراغ الزمني"}
          </p>
        </DeckCard>

        <DeckCard
          style={{ animationDelay: "1.2s" }}
          className="animate-floaty"
          icon={<Filter size={15} className="text-iris" />}
          title="غربال الحوار"
          active={screen === "feed"}
        >
          <div className="flex items-end gap-3">
            <Stat n={signal.length} label="نقاش مثري" tone="text-mint" />
            <Stat n={noise.length} label="معزول" tone="text-muted" />
          </div>
        </DeckCard>
      </div>

      {/* اليمين */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[26vw] max-w-[330px] flex-col justify-center gap-5 pl-6 xl:flex">
        <DeckCard
          style={{ animationDelay: "0.6s" }}
          className="animate-floaty"
          icon={<Fingerprint size={15} className="text-rose" />}
          title="سجل الأصل الرقمي"
          active={screen === "vault"}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(rgb(var(--rose)) 0 ${aiAvg}%, rgb(var(--iris)) ${aiAvg}% 100%)`,
                mask: "radial-gradient(circle, transparent 54%, #000 55%)",
                WebkitMask: "radial-gradient(circle, transparent 54%, #000 55%)",
              }}
            />
            <div className="text-[11px] leading-relaxed text-muted">
              <p>
                <span className="font-semibold text-ink">{aiAvg}٪</span> ذكاء اصطناعي
              </p>
              <p>
                <span className="font-semibold text-ink">{100 - aiAvg}٪</span> إنسان
              </p>
              <p className="mt-1">{seals} عمل مختوم</p>
            </div>
          </div>
        </DeckCard>

        <DeckCard
          style={{ animationDelay: "1.8s" }}
          className="animate-floaty"
          icon={<Waypoints size={15} className="text-amber" />}
          title="استرجاع سياقي"
          active={screen === "atlas"}
        >
          <p className="rounded-xl bg-raised px-3 py-2 text-[11.5px] leading-relaxed">
            «اليوم الذي أمضيناه في النفود وكان الجو ماطر…»
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted">
            <Sparkles size={11} /> يجمع الصور والمسار والنص في قصة واحدة
          </p>
        </DeckCard>

        <DeckCard
          style={{ animationDelay: "2.4s" }}
          className="animate-floaty"
          icon={<Lock size={15} className="text-mint" />}
          title="خزنة صفرية المعرفة"
          active={screen === "vault"}
        >
          <p className="text-[11px] leading-relaxed text-muted">
            المسودات مشفّرة بمفتاح على عتاد الجهاز. الخادم لا يرى ما لم تنشره.
          </p>
        </DeckCard>
      </div>
    </>
  );
}

function DeckCard({
  icon,
  title,
  children,
  active,
  className,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "pointer-events-auto rounded-xl2 glass p-3.5 shadow-float transition-all duration-500",
        active && "ring-2 ring-[rgb(var(--rose)/.45)]",
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div>
      <p className={cn("text-[20px] font-semibold tabular-nums", tone)}>{n}</p>
      <p className="text-[10.5px] text-muted">{label}</p>
    </div>
  );
}
