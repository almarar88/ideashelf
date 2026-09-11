import { Moon, Search, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { me } from "@/lib/data";
import type { Theme } from "@/hooks/useTheme";

export function TopBar({
  theme,
  onToggleTheme,
  light,
  onSearch,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  light: { label: string; warmth: number };
  onSearch: () => void;
}) {
  return (
    <header className="relative z-20 flex items-center gap-3 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
      <Avatar person={me} size="lg" ring />
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[17px] font-semibold tracking-tight">{me.handle}</p>
        <p className="text-[11px] text-muted">
          أثر · {light.label}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
          className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-lift transition active:scale-95"
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button
          type="button"
          onClick={onSearch}
          aria-label="بحث"
          className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-lift transition active:scale-95"
        >
          <Search size={17} />
        </button>
      </div>
    </header>
  );
}
