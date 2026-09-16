import { Home, Users, KanbanSquare, Lightbulb, LayoutGrid, Bot } from "lucide-react";
import { useT } from "@/lib/useT";
import { useApp } from "@/lib/app-context";
import type { Tab } from "@/components/BottomNav";
import type { TKey } from "@/lib/i18n";

const items: { id: Tab; icon: typeof Home; key: TKey }[] = [
  { id: "home", icon: Home, key: "home" }, { id: "partners", icon: Users, key: "partners" }, { id: "pipeline", icon: KanbanSquare, key: "pipeline" }, { id: "studies", icon: Lightbulb, key: "studies" }, { id: "more", icon: LayoutGrid, key: "more" },
];

/** Side navigation for wide screens (foldables unfolded, tablets). */
export function NavRail({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useT();
  const { openAssistant } = useApp();
  return (
    <aside className="hidden md:flex flex-col items-center gap-2 w-[88px] py-4 sticky top-0 h-screen shrink-0">
      <div className="text-[13px] font-bold mb-3">{t("appName")}</div>
      {items.map(({ id, icon: Icon, key }) => {
        const active = tab === id;
        return <button key={id} onClick={() => onChange(id)} className="flex flex-col items-center gap-1 w-full py-1"><span className={`h-11 w-11 rounded-2xl flex items-center justify-center transition ${active ? "bg-white text-ink" : "bg-white/5 text-white/70"}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} /></span><span className={`text-[10px] ${active ? "text-white" : "text-white/50"}`}>{t(key)}</span></button>;
      })}
      <button onClick={() => openAssistant()} className="mt-auto flex flex-col items-center gap-1"><span className="h-12 w-12 rounded-full bg-white text-ink flex items-center justify-center shadow-card"><Bot size={22} /></span><span className="text-[10px] text-white/60">{t("agent")}</span></button>
    </aside>
  );
}
