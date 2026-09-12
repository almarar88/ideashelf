import { Clapperboard, Filter, Fingerprint, Lock, Sparkles, Waypoints } from "lucide-react";
import { cn } from "@/lib/cn";
import { gate } from "@/lib/engine";
import { posts } from "@/lib/data";
import type { ScreenId } from "@/lib/types";

const allComments = posts.flatMap((p) => p.comments);

export type DeckItem = {
  key: string;
  title: string;
  icon: React.ReactNode;
  active: boolean;
  body: React.ReactNode;
};

/**
 * البطاقات الحيّة التي تصاحب الشاشة: تُعرض عائمة حول الجهاز على سطح المكتب،
 * وفي اللوحة الثانية على الشاشات القابلة للطي حين تُفتح.
 */
export function deckItems(screen: ScreenId, busy: boolean, seals: number): DeckItem[] {
  const { signal, noise } = gate(allComments);
  const aiAvg = Math.round(posts.reduce((s, p) => s + p.aiShare, 0) / posts.length);

  return [
    {
      key: "director",
      title: "المخرج الآلي",
      icon: <Clapperboard size={15} className="text-rose" />,
      active: screen === "create",
      body: (
        <>
          <div className="flex h-12 gap-1 overflow-hidden rounded-xl">
            {["#243a86", "#7b5bd0", "#2f4ea8", "#d75fa0"].map((c, i) => (
              <div
                key={c}
                className={cn(
                  "flex-1 transition-opacity duration-700",
                  busy && i % 2 ? "opacity-50" : "",
                )}
                style={{ background: `linear-gradient(160deg, ${c}, ${c}99)` }}
              />
            ))}
            <div className="flex-[0.4] border-2 border-dashed border-[rgb(var(--line))] bg-amber/20" />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {busy ? "يعالج المشهد الآن…" : "لقطة B-Roll واحدة مولّدة لملء الفراغ الزمني"}
          </p>
        </>
      ),
    },
    {
      key: "gate",
      title: "غربال الحوار",
      icon: <Filter size={15} className="text-iris" />,
      active: screen === "feed",
      body: (
        <div className="flex items-end gap-4">
          <Stat n={signal.length} label="نقاش مثري" tone="text-mint" />
          <Stat n={noise.length} label="معزول" tone="text-muted" />
        </div>
      ),
    },
    {
      key: "provenance",
      title: "سجل الأصل الرقمي",
      icon: <Fingerprint size={15} className="text-rose" />,
      active: screen === "settings",
      body: (
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
      ),
    },
    {
      key: "recall",
      title: "استرجاع سياقي",
      icon: <Waypoints size={15} className="text-amber" />,
      active: screen === "atlas",
      body: (
        <>
          <p className="rounded-xl bg-raised px-3 py-2 text-[11.5px] leading-relaxed">
            «اليوم الذي أمضيناه في النفود وكان الجو ماطر…»
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted">
            <Sparkles size={11} /> يجمع الصور والمسار والنص في قصة واحدة
          </p>
        </>
      ),
    },
    {
      key: "vault",
      title: "خزنة صفرية المعرفة",
      icon: <Lock size={15} className="text-mint" />,
      active: screen === "settings",
      body: (
        <p className="text-[11px] leading-relaxed text-muted">
          المسودات مشفّرة بمفتاح على عتاد الجهاز. الخادم لا يرى ما لم تنشره.
        </p>
      ),
    },
  ];
}

export function DeckCard({
  item,
  className,
  style,
}: {
  item: DeckItem;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-xl2 glass p-3.5 shadow-float transition-all duration-500",
        item.active && "ring-2 ring-[rgb(var(--rose)/.45)]",
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">
        {item.icon}
        {item.title}
      </p>
      {item.body}
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
