import { useEffect, useState } from "react";
import { useStore, actions } from "./lib/store";
import { Icon } from "./components/ui";
import { t } from "./lib/i18n";
import Home from "./screens/Home";
import Chat from "./screens/Chat";
import Agents from "./screens/Agents";
import Files from "./screens/Files";
import Analytics from "./screens/Analytics";
import Settings from "./screens/Settings";
import Onboarding from "./screens/Onboarding";
import Auth from "./screens/Auth";
import { App as CapApp } from "@capacitor/app";
import { useAccount } from "./lib/account";
import { HOSTED_ENABLED } from "./config";
import { Spinner } from "./components/ui";

export type Tab = "home" | "agents" | "files" | "analytics" | "settings";
export interface Nav { tab: Tab; chatId?: string; }

export default function App() {
  const settings = useStore((s) => s.settings);
  const account = useAccount();
  const [nav, setNav] = useState<Nav>({ tab: "home" });
  const lang = settings.lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.body.className = settings.theme === "dark" ? "theme-dark" : "";
  }, [lang, settings.theme]);

  // Android hardware back button
  useEffect(() => {
    const sub = CapApp.addListener("backButton", () => {
      setNav((n) => (n.chatId ? { tab: n.tab } : n.tab !== "home" ? { tab: "home" } : (CapApp.exitApp(), n)));
    });
    return () => { sub.then((h) => h.remove()); };
  }, []);

  if (!settings.onboarded) return <Onboarding onDone={() => actions.updateSettings({ onboarded: true })} />;

  if (HOSTED_ENABLED && settings.aiMode === "hosted") {
    if (!account.ready) return <div className="empty" style={{ paddingTop: "40vh" }}><Spinner size={28} /></div>;
    if (!account.session) return <Auth onSkipToKey={() => actions.updateSettings({ aiMode: "byok" })} />;
  }

  if (nav.chatId) return <Chat groupId={nav.chatId} onBack={() => setNav({ tab: nav.tab })} />;

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "home", icon: "home", label: t(lang, "home") },
    { id: "agents", icon: "users", label: t(lang, "agents") },
    { id: "files", icon: "folder", label: t(lang, "files") },
    { id: "analytics", icon: "chart", label: t(lang, "analytics") },
    { id: "settings", icon: "settings", label: t(lang, "settings") },
  ];

  return (
    <>
      {nav.tab === "home" && <Home openChat={(id) => setNav({ tab: "home", chatId: id })} goAgents={() => setNav({ tab: "agents" })} goSettings={() => setNav({ tab: "settings" })} />}
      {nav.tab === "agents" && <Agents />}
      {nav.tab === "files" && <Files openChat={(id) => setNav({ tab: "files", chatId: id })} />}
      {nav.tab === "analytics" && <Analytics />}
      {nav.tab === "settings" && <Settings />}
      <nav className="bottom-nav">
        {tabs.map((tb) => (
          <button key={tb.id} className={"nav-btn" + (nav.tab === tb.id ? " on" : "")} onClick={() => setNav({ tab: tb.id })}>
            <span className="ic"><Icon name={tb.icon} /></span>
            <span>{tb.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
