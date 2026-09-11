import { BookOpen, Clapperboard, Layers, Lock, Map } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ScreenId } from "@/lib/types";

const TABS: { id: ScreenId; label: string; Icon: typeof Layers }[] = [
  { id: "feed", label: "المجرى", Icon: Layers },
  { id: "studio", label: "الاستوديو", Icon: Clapperboard },
  { id: "prose", label: "المقالات", Icon: BookOpen },
  { id: "atlas", label: "الأطلس", Icon: Map },
  { id: "vault", label: "الخزنة", Icon: Lock },
];

export function TabBar({
  screen,
  onChange,
}: {
  screen: ScreenId;
  onChange: (s: ScreenId) => void;
}) {
  return (
    <nav
      className="relative z-20 mx-3 mb-[calc(env(safe-area-inset-bottom)+10px)] flex items-center justify-between rounded-full glass px-2 py-1.5 shadow-float"
      aria-label="التنقل الرئيسي"
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = screen === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 transition-colors duration-300",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <span
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background:
                    "linear-gradient(120deg, rgb(var(--rose)/.26), rgb(var(--iris)/.2))",
                }}
              />
            )}
            <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
