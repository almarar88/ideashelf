import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { GroupProvider, useGroup } from "@/state/GroupContext";
import { GameProvider, useGame } from "@/state/GameContext";
import { PillNav, type Screen } from "@/components/PillNav";
import { SimDrawer } from "@/components/SimDrawer";
import { Vault } from "@/screens/Vault";
import { Dilemma } from "@/screens/Dilemma";
import { Showdown } from "@/screens/Showdown";
import { PersonaHub } from "@/screens/PersonaHub";
import { Onboarding } from "@/screens/Onboarding";
import { isRtl, t } from "@/lib/i18n";
import type { Lang } from "@/types/game";

function Shell() {
  const { lang } = useGroup();
  const { phase, mySubmission } = useGame();
  const [screen, setScreen] = useState<Screen>("vault");

  // Follow the round: when the reveal opens, the showdown is where you want
  // to be — but never yank someone out of a screen they navigated to.
  const [autoFollowed, setAutoFollowed] = useState(false);
  useEffect(() => {
    if (phase === "revealed" && !autoFollowed) {
      setScreen("showdown");
      setAutoFollowed(true);
    }
  }, [phase, autoFollowed]);

  return (
    <>
      <main className="pad-top pad-bottom mx-auto w-full max-w-md px-5">
        {screen === "vault" && <Vault onNavigate={setScreen} />}
        {screen === "play" && <Dilemma onNavigate={setScreen} />}
        {screen === "showdown" && <Showdown />}
        {screen === "persona" && <PersonaHub />}
      </main>

      <SimDrawer />

      <PillNav
        active={screen}
        onChange={setScreen}
        labels={{
          vault: t(lang, "nav_vault"),
          play: t(lang, "nav_play"),
          showdown: t(lang, "nav_showdown"),
          persona: t(lang, "nav_persona"),
        }}
        badge={{
          play: phase === "open" && !mySubmission,
          showdown: phase === "revealed",
        }}
      />
    </>
  );
}

function Gate() {
  const { userId, ready } = useAuth();
  const { lang, setLang } = useGroup();

  // Document direction has to follow the group language for RTL to work.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  if (!ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <span className="text-sm font-semibold text-muted">{t(lang, "loading")}</span>
      </div>
    );
  }

  if (!userId) {
    return <Onboarding lang={lang} onLang={(next: Lang) => void setLang(next)} />;
  }

  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GroupProvider>
        <Gate />
      </GroupProvider>
    </AuthProvider>
  );
}
