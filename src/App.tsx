import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Home, Settings as SettingsIcon } from "lucide-react";
import { useIsWide } from "@/hooks/useMedia";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import { HomeScreen } from "@/screens/Home";
import { LibraryScreen } from "@/screens/Library";
import { ReaderScreen } from "@/screens/Reader";
import { InsightsScreen } from "@/screens/Insights";
import { SettingsScreen } from "@/screens/Settings";
import { AdminScreen } from "@/screens/Admin";
import { OnboardingScreen } from "@/screens/Onboarding";

export type Route =
  | { name: "home" }
  | { name: "library" }
  | { name: "reader"; bookId: string }
  | { name: "insights" }
  | { name: "settings" }
  | { name: "admin" };

const TABS: { name: Route["name"]; label: string; Icon: typeof Home }[] = [
  { name: "home", label: "الرئيسية", Icon: Home },
  { name: "library", label: "المكتبة", Icon: BookOpen },
  { name: "insights", label: "التحليل", Icon: BarChart3 },
  { name: "settings", label: "الإعدادات", Icon: SettingsIcon },
];

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const wide = useIsWide();
  const { settings, update } = useSettings();
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("dcl.onboarded") === "1");

  // Android hardware back button (Capacitor) / browser back: go to the previous logical screen.
  useEffect(() => {
    const onPop = () => setRoute((r) => (r.name === "reader" ? { name: "library" } : r.name === "admin" ? { name: "settings" } : { name: "home" }));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (r: Route) => {
    if (r.name === "reader" || r.name === "admin") history.pushState(null, "");
    setRoute(r);
  };

  if (!onboarded) {
    return (
      <OnboardingScreen
        onDone={(name) => {
          if (name) update({ userName: name });
          localStorage.setItem("dcl.onboarded", "1");
          setOnboarded(true);
        }}
      />
    );
  }

  const isReader = route.name === "reader";
  const screen =
    route.name === "home" ? (
      <HomeScreen settings={settings} navigate={navigate} />
    ) : route.name === "library" ? (
      <LibraryScreen navigate={navigate} />
    ) : route.name === "reader" ? (
      <ReaderScreen bookId={route.bookId} settings={settings} wide={wide} onBack={() => navigate({ name: "library" })} />
    ) : route.name === "insights" ? (
      <InsightsScreen navigate={navigate} />
    ) : route.name === "settings" ? (
      <SettingsScreen settings={settings} update={update} navigate={navigate} />
    ) : (
      <AdminScreen settings={settings} update={update} onBack={() => navigate({ name: "settings" })} />
    );

  if (wide) {
    return (
      <div className="flex h-full" style={{ paddingTop: "var(--safe-top)" }}>
        {!isReader && (
          <nav className="flex w-24 shrink-0 flex-col items-center gap-2 py-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-accent font-bold text-lg">‹›</div>
            {TABS.map(({ name, label, Icon }) => (
              <button
                key={name}
                onClick={() => navigate({ name } as Route)}
                className={cn(
                  "flex w-20 flex-col items-center gap-1 rounded-2xl py-3 text-xs transition",
                  route.name === name ? "bg-ink text-cream" : "text-ink hover:bg-black/5",
                )}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </nav>
        )}
        <main className={cn("min-w-0 flex-1 overflow-hidden", !isReader && "py-6 pe-6")}>
          <div className={cn("h-full overflow-hidden", isReader ? "" : "mx-auto max-w-5xl rounded-4xl bg-cream shadow-lift")}>{screen}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-cream" style={{ paddingTop: isReader ? 0 : "var(--safe-top)" }}>
      <main className="min-h-0 flex-1 overflow-hidden">{screen}</main>
      {!isReader && (
        <nav
          className="flex shrink-0 items-center justify-around border-t border-black/5 bg-cream px-2 pt-2"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}
        >
          {TABS.map(({ name, label, Icon }) => {
            const active = route.name === name || (name === "settings" && route.name === "admin");
            return (
              <button
                key={name}
                onClick={() => navigate({ name } as Route)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-4 py-1.5 text-[11px] transition",
                  active ? "text-accent" : "text-ink-muted",
                )}
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", active && "bg-ink text-accent")}>
                  <Icon size={19} />
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
