import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { NavRail } from "@/components/NavRail";
import { AppProvider, useApp, type NavTarget } from "@/lib/app-context";
import { setFormatLang } from "@/lib/ids";
import { Calendar } from "@/screens/Calendar";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { Home } from "@/screens/Home";
import { Partners } from "@/screens/Partners";
import { Pipeline } from "@/screens/Pipeline";
import { Studies } from "@/screens/Studies";
import { More, type Sub } from "@/screens/More";
import { Tasks } from "@/screens/Tasks";
import { Agreements } from "@/screens/Agreements";
import { Meetings } from "@/screens/Meetings";
import { Reports } from "@/screens/Reports";
import { SettingsScreen } from "@/screens/Settings";
import { Assistant } from "@/screens/Assistant";

function Shell() {
  const { dir, lang } = useT();
  const { openAssistant, assistantOpen, registerNav } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [sub, setSub] = useState<Sub | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [studyId, setStudyId] = useState<string | null>(null);
  const seeded = useStore((s) => s.settings.demoSeeded);
  const loadDemo = useStore((s) => s.loadDemo);

  useEffect(() => { document.documentElement.dir = dir; document.documentElement.lang = lang; setFormatLang(lang); }, [dir, lang]);

  // global navigation (search results, calendar, agent deep links)
  useEffect(() => {
    registerNav((tgt: NavTarget) => {
      if (tgt.kind === "tab") { setSub(null); setTab(tgt.tab); }
      else if (tgt.kind === "partner") { setSub(null); setPartnerId(tgt.id); setTab("partners"); }
      else if (tgt.kind === "study") { setSub(null); setStudyId(tgt.id); setTab("studies"); }
      else { setTab("more"); setSub(tgt.sub); }
    });
  }, [registerNav]);

  // local reminders (native only): reschedule when data changes, debounced
  const tasks = useStore((s) => s.tasks); const agreements = useStore((s) => s.agreements); const notif = useStore((s) => s.settings.notifications);
  useEffect(() => {
    if (!notif) return;
    const h = window.setTimeout(() => { import("@/lib/notifications").then((m) => m.scheduleReminders()).catch(() => undefined); }, 1500);
    return () => window.clearTimeout(h);
  }, [tasks, agreements, notif]);
  useEffect(() => { if (!seeded) loadDemo(); }, [seeded, loadDemo]);

  // Android hardware back button
  useEffect(() => {
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const h = await CapApp.addListener("backButton", () => {
          if (assistantOpen) return; // sheet handles its own close via overlay
          if (sub) { setSub(null); return; }
          if (partnerId) { setPartnerId(null); return; }
          if (studyId) { setStudyId(null); return; }
          if (tab !== "home") { setTab("home"); return; }
          CapApp.exitApp();
        });
        remove = () => h.remove();
      } catch { /* not running in Capacitor */ }
    })();
    return () => remove?.();
  }, [assistantOpen, sub, partnerId, studyId, tab]);

  useEffect(() => {
    (async () => {
      try { const { StatusBar, Style } = await import("@capacitor/status-bar"); await StatusBar.setStyle({ style: Style.Dark }); await StatusBar.setBackgroundColor({ color: "#4B5343" }); } catch { /* web */ }
      try { const { SplashScreen } = await import("@capacitor/splash-screen"); await SplashScreen.hide(); } catch { /* web */ }
    })();
  }, []);

  const openPartner = (id: string) => { setSub(null); setPartnerId(id); setTab("partners"); };
  const goTab = (t: Tab) => { setSub(null); setTab(t); };
  const openSettings = () => { setTab("more"); setSub("settings"); };

  let screen: React.ReactNode;
  if (tab === "more" && sub) {
    const back = () => setSub(null);
    screen = sub === "tasks" ? <Tasks onBack={back} /> : sub === "agreements" ? <Agreements onBack={back} /> : sub === "meetings" ? <Meetings onBack={back} /> : sub === "reports" ? <Reports onBack={back} /> : sub === "calendar" ? <Calendar onBack={back} /> : <SettingsScreen onBack={back} />;
  } else if (tab === "home") screen = <Home go={goTab} openPartner={openPartner} openSettings={openSettings} />;
  else if (tab === "partners") screen = <Partners selectedId={partnerId} onSelect={setPartnerId} />;
  else if (tab === "pipeline") screen = <Pipeline openPartner={openPartner} />;
  else if (tab === "studies") screen = <Studies selectedId={studyId} onSelect={setStudyId} />;
  else screen = <More go={setSub} />;

  return (
    <div className="topo min-h-full">
      <div className="mx-auto max-w-[520px] md:max-w-[1180px] px-4 md:flex md:gap-6" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
        <NavRail tab={tab} onChange={goTab} />
        <div className="flex-1 min-w-0">{screen}</div>
      </div>
      {!(tab === "more" && sub === "settings") && (
        <button onClick={() => openAssistant()} className="md:hidden fixed z-40 end-4 h-14 w-14 rounded-full bg-white text-ink shadow-card flex items-center justify-center active:scale-95 transition" style={{ bottom: "calc(var(--safe-bottom) + 100px)" }} aria-label="AI"><Bot size={24} /></button>
      )}
      <div className="md:hidden"><BottomNav tab={tab} onChange={goTab} /></div>
      <Assistant />
    </div>
  );
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}
