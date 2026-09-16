import { Home, Users, KanbanSquare, Lightbulb, LayoutGrid } from "lucide-react";
import { useT } from "@/lib/useT";
import type { TKey } from "@/lib/i18n";

export type Tab = "home" | "partners" | "pipeline" | "studies" | "more";

const items: { id: Tab; icon: typeof Home; key: TKey }[] = [
  { id: "home", icon: Home, key: "home" },
  { id: "partners", icon: Users, key: "partners" },
  { id: "pipeline", icon: KanbanSquare, key: "pipeline" },
  { id: "studies", icon: Lightbulb, key: "studies" },
  { id: "more", icon: LayoutGrid, key: "more" },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useT();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none" style={{ paddingBottom: "calc(var(--safe-bottom) + 10px)" }}>
      <div className="pointer-events-auto mx-4 w-full max-w-[520px] rounded-[28px] bg-olive-800/95 backdrop-blur px-3 py-2 flex items-center justify-around shadow-card border border-white/10">
        {items.map(({ id, icon: Icon, key }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => onChange(id)} className="flex flex-col items-center gap-1 w-[60px]">
              <span className={`h-10 w-10 rounded-full flex items-center justify-center transition ${active ? "bg-white text-ink" : "text-white/70"}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} /></span>
              <span className={`text-[10px] ${active ? "text-white" : "text-white/50"}`}>{t(key)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
