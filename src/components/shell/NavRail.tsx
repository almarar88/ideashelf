import { BookOpen, Clapperboard, Layers, Lock, Map, Moon, Search, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PulseCore } from "./PulseButton";
import { cn } from "@/lib/cn";
import { me } from "@/lib/data";
import type { PulseMode } from "@/lib/pulse";
import type { ScreenId } from "@/lib/types";
import type { Theme } from "@/hooks/useTheme";

const TABS: { id: ScreenId; label: string; Icon: typeof Layers }[] = [
  { id: "feed", label: "المجرى", Icon: Layers },
  { id: "studio", label: "الاستوديو", Icon: Clapperboard },
  { id: "prose", label: "المقالات", Icon: BookOpen },
  { id: "atlas", label: "الأطلس", Icon: Map },
  { id: "vault", label: "الخزنة", Icon: Lock },
];

/** شريط تنقل رأسي — يحل محل الشريط السفلي حين تتسع الشاشة (الجهاز مفتوح). */
export function NavRail({
  screen,
  onChange,
  theme,
  onToggleTheme,
  onSearch,
  pulse,
  busy,
  onPulse,
}: {
  screen: ScreenId;
  onChange: (s: ScreenId) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onSearch: () => void;
  pulse: PulseMode;
  busy: boolean;
  onPulse: () => void;
}) {
  return (
    <nav
      className="flex w-[86px] shrink-0 flex-col items-center gap-1 border-l hairline bg-surface/70 py-4"
      aria-label="التنقل الرئيسي"
    >
      <Avatar person={me} size="md" ring />
      <div className="mt-3 flex flex-1 flex-col items-center gap-1">
        {TABS.map(({ id, label, Icon }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex w-[70px] flex-col items-center gap-1 rounded-xl2 px-1 py-2.5 transition-colors duration-300",
                active ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {active && (
                <span
                  className="absolute inset-0 -z-10 rounded-xl2"
                  style={{
                    background:
                      "linear-gradient(140deg, rgb(var(--rose)/.26), rgb(var(--iris)/.2))",
                  }}
                />
              )}
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      <PulseCore mode={pulse} busy={busy} onPress={onPulse} className="mb-3" />

      <button
        type="button"
        onClick={onSearch}
        aria-label="بحث"
        className="grid h-10 w-10 place-items-center rounded-full bg-raised text-muted transition hover:text-ink"
      >
        <Search size={17} />
      </button>
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
        className="mt-1 grid h-10 w-10 place-items-center rounded-full bg-raised text-muted transition hover:text-ink"
      >
        {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </nav>
  );
}
