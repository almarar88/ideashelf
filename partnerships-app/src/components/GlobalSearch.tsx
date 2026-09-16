import { useMemo, useState } from "react";
import { Search, Users, Briefcase, CheckSquare, FileSignature, Lightbulb, CalendarDays } from "lucide-react";
import { Sheet } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { useApp, type NavTarget } from "@/lib/app-context";

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { navigate } = useApp();
  const { partners, deals, tasks, agreements, studies, meetings } = useStore();
  const [q, setQ] = useState("");
  const n = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (n.length < 2) return [];
    const hit = (s: string) => s.toLowerCase().includes(n);
    const out: { icon: typeof Users; title: string; sub: string; go: NavTarget }[] = [];
    partners.filter((p) => hit(p.name + p.sector + p.country + p.tags.join(" ") + p.notes + p.contacts.map((c) => c.name).join(" "))).forEach((p) => out.push({ icon: Users, title: p.name, sub: `${t("partner")} · ${p.sector}`, go: { kind: "partner", id: p.id } }));
    deals.filter((d) => hit(d.title + d.nextStep + d.notes)).forEach((d) => out.push({ icon: Briefcase, title: d.title, sub: `${t("deals")} · ${partners.find((p) => p.id === d.partnerId)?.name ?? ""}`, go: { kind: "tab", tab: "pipeline" } }));
    tasks.filter((x) => hit(x.title)).forEach((x) => out.push({ icon: CheckSquare, title: x.title, sub: `${t("tasks")} · ${x.dueAt}`, go: { kind: "sub", sub: "tasks" } }));
    agreements.filter((a) => hit(a.title + a.summary)).forEach((a) => out.push({ icon: FileSignature, title: a.title, sub: `${t("agreements")} · ${a.endAt}`, go: { kind: "sub", sub: "agreements" } }));
    studies.filter((s) => hit(s.input.title + s.input.idea + s.input.sector)).forEach((s) => out.push({ icon: Lightbulb, title: s.input.title, sub: `${t("studies")} · ${s.input.sector}`, go: { kind: "study", id: s.id } }));
    meetings.filter((m) => hit(m.title + m.rawNotes + (m.summary ?? ""))).forEach((m) => out.push({ icon: CalendarDays, title: m.title, sub: `${t("meetings")} · ${m.at}`, go: { kind: "sub", sub: "meetings" } }));
    return out.slice(0, 30);
  }, [n, partners, deals, tasks, agreements, studies, meetings, t]);
  return (
    <Sheet open={open} onClose={onClose} title={t("globalSearch")} full>
      <div className="relative mb-3">
        <Search size={18} className="absolute top-3.5 start-4 text-white/50" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchEverything")} className="field ps-11" />
      </div>
      <div className="space-y-2">
        {results.map((r, i) => (
          <button key={i} onClick={() => { navigate(r.go); onClose(); }} className="w-full card-white p-3 flex items-center gap-3 text-start">
            <span className="h-9 w-9 rounded-xl bg-olive-100 flex items-center justify-center shrink-0"><r.icon size={17} /></span>
            <div className="min-w-0"><div className="font-semibold truncate">{r.title}</div><div className="text-[12px] text-muted truncate">{r.sub}</div></div>
          </button>
        ))}
        {n.length >= 2 && results.length === 0 && <div className="text-center text-white/40 py-8">{t("noData")}</div>}
      </div>
    </Sheet>
  );
}
