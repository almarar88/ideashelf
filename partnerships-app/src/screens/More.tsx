import { CheckSquare, FileSignature, CalendarDays, BarChart3, Sparkles, Settings as SettingsIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Header } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { useApp } from "@/lib/app-context";
import { daysBetween, todayISO } from "@/lib/ids";

export type Sub = "tasks" | "agreements" | "meetings" | "reports" | "settings" | "calendar";

export function More({ go }: { go: (s: Sub) => void }) {
  const { t, dir } = useT();
  const { tasks, agreements, meetings } = useStore();
  const { openAssistant } = useApp();
  const today = todayISO();
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;
  const items: { id: Sub | "assistant"; icon: typeof CheckSquare; label: string; sub: string; tone?: string }[] = [
    { id: "assistant", icon: Sparkles, label: t("assistant"), sub: t("q1"), tone: "bg-white text-ink" },
    { id: "tasks", icon: CheckSquare, label: t("tasks"), sub: `${tasks.filter((x) => x.status === "open").length} ${t("open")} · ${tasks.filter((x) => x.status === "open" && x.dueAt < today).length} ${t("overdue")}` },
    { id: "agreements", icon: FileSignature, label: t("agreements"), sub: `${agreements.filter((a) => a.status === "signed" && daysBetween(today, a.endAt) <= 90).length} ${t("renewals")}` },
    { id: "meetings", icon: CalendarDays, label: t("meetings"), sub: `${meetings.length}` },
    { id: "calendar", icon: CalendarDays, label: t("calendar"), sub: `${t("dealsClosing")} · ${t("agreementsEnding")} · ${t("tasks")}` },
    { id: "reports", icon: BarChart3, label: t("reports"), sub: t("weeklyReport") },
    { id: "settings", icon: SettingsIcon, label: t("settings"), sub: t("apiKey") },
  ];
  return (
    <div className="pb-32">
      <Header title={t("more")} />
      <div className="list-grid">
        {items.map(({ id, icon: Icon, label, sub, tone }) => (
          <Card key={id} dark={!tone} onClick={() => (id === "assistant" ? openAssistant() : go(id))} className={`flex items-center gap-3 ${tone ?? ""}`}>
            <span className={`h-11 w-11 rounded-xl flex items-center justify-center border ${tone ? "border-ink/15" : "border-white/20"}`}><Icon size={20} /></span>
            <div className="flex-1 min-w-0"><div className="font-bold text-[16px]">{label}</div><div className={`text-[12px] truncate ${tone ? "text-ink/60" : "text-white/50"}`}>{sub}</div></div>
            <Arrow size={18} className="opacity-50" />
          </Card>
        ))}
      </div>
    </div>
  );
}
