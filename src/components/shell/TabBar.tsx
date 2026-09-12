import { Compass, Layers, Map, Sparkles, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useMe } from "@/store/store";
import type { ScreenId } from "@/lib/types";

const TABS: { id: ScreenId; label: string; Icon: typeof Layers }[] = [
  { id: "feed", label: "المجرى", Icon: Layers },
  { id: "explore", label: "استكشاف", Icon: Compass },
  { id: "create", label: "الإنشاء", Icon: Sparkles },
  { id: "atlas", label: "الأطلس", Icon: Map },
  { id: "profile", label: "حسابي", Icon: User },
];

export function TabBar({
  screen,
  onChange,
}: {
  screen: ScreenId;
  onChange: (s: ScreenId) => void;
}) {
  const me = useMe();
  return (
    <nav
      className="relative z-20 mx-3 mb-[calc(env(safe-area-inset-bottom)+10px)] flex items-center justify-between rounded-full glass px-2 py-1.5 shadow-float"
      aria-label="التنقل الرئيسي"
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = screen === id || (id === "profile" && screen === "settings");
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
            {id === "profile" ? (
              <Avatar person={me} size="xs" />
            ) : (
              <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
            )}
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
