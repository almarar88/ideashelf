import { useCallback, useEffect, useState } from "react";
import { BarChart3, BookOpen, Home, Settings as SettingsIcon, Store, User } from "lucide-react";
import { useIsWide } from "@/hooks/useMedia";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { cloudEnabled } from "@/lib/supabase";
import { getBook, isReadable } from "@/lib/cloud";
import { cn } from "@/lib/utils";
import { HomeScreen } from "@/screens/Home";
import { LibraryScreen } from "@/screens/Library";
import { ReaderScreen, type ReaderTarget } from "@/screens/Reader";
import { InsightsScreen } from "@/screens/Insights";
import { SettingsScreen } from "@/screens/Settings";
import { AdminScreen } from "@/screens/Admin";
import { OnboardingScreen } from "@/screens/Onboarding";
import { AuthScreen } from "@/screens/Auth";
import { StoreScreen } from "@/screens/Store";
import { AccountScreen } from "@/screens/Account";

export type Route =
  | { name: "home" }
  | { name: "store" }
  | { name: "library" }
  | { name: "reader"; target: ReaderTarget }
  | { name: "insights" }
  | { name: "settings" }
  | { name: "admin" }
  | { name: "account" }
  | { name: "auth" };

const BASE_TABS: { name: Route["name"]; label: string; Icon: typeof Home }[] = [
  { name: "home", label: "الرئيسية", Icon: Home },
  { name: "store", label: "المتجر", Icon: Store },
  { name: "library", label: "مكتبتي", Icon: BookOpen },
  { name: "insights", label: "التحليل", Icon: BarChart3 },
  { name: "settings", label: "الإعدادات", Icon: SettingsIcon },
];

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const wide = useIsWide();
  const { settings, update } = useSettings();
  const auth = useAuth();
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("dcl.onboarded") === "1");

  const tabs = cloudEnabled ? BASE_TABS : BASE_TABS.filter((t) => t.name !== "store");

  useEffect(() => {
    const onPop = () =>
      setRoute((r) =>
        r.name === "reader" ? { name: "library" } : r.name === "admin" || r.name === "account" || r.name === "auth" ? { name: "settings" } : { name: "home" },
      );
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((r: Route) => {
    if (r.name === "reader" || r.name === "admin" || r.name === "account" || r.name === "auth") history.pushState(null, "");
    setRoute(r);
  }, []);

  /** Open a store book, re-checking entitlement so the preview limit is right. */
  const openCloudBook = useCallback(
    async (bookId: string) => {
      const book = await getBook(bookId);
      if (!book) return;
      navigate({
        name: "reader",
        target: {
          kind: "cloud",
          bookId: book.id,
          pages: book.page_count,
          title: book.title,
          author: book.author ?? "",
          previewPages: book.preview_pages,
          readable: isReadable(book, auth.entitlements),
        },
      });
    },
    [auth.entitlements, navigate],
  );

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

  if (route.name === "auth") {
    return <AuthScreen onDone={() => navigate({ name: "store" })} onSkip={() => navigate({ name: "home" })} />;
  }

  const isReader = route.name === "reader";
  const screen =
    route.name === "home" ? (
      <HomeScreen settings={settings} navigate={navigate} />
    ) : route.name === "store" ? (
      <StoreScreen auth={auth} nav={{ openReader: (id) => void openCloudBook(id), openAuth: () => navigate({ name: "auth" }) }} />
    ) : route.name === "library" ? (
      <LibraryScreen navigate={navigate} />
    ) : route.name === "reader" ? (
      <ReaderScreen
        target={route.target}
        settings={settings}
        update={update}
        wide={wide}
        userId={auth.session?.user.id ?? null}
        watermark={auth.session?.user.email ?? ""}
        onBack={() => navigate({ name: route.target.kind === "cloud" ? "store" : "library" })}
        onBuy={() => navigate({ name: "store" })}
      />
    ) : route.name === "insights" ? (
      <InsightsScreen navigate={navigate} />
    ) : route.name === "account" ? (
      <AccountScreen auth={auth} onBack={() => navigate({ name: "settings" })} onNeedAuth={() => navigate({ name: "auth" })} />
    ) : route.name === "settings" ? (
      <SettingsScreen settings={settings} update={update} navigate={navigate} auth={auth} />
    ) : (
      <AdminScreen settings={settings} update={update} auth={auth} onBack={() => navigate({ name: "settings" })} />
    );

  if (wide) {
    return (
      <div className="flex h-full" style={{ paddingTop: "var(--safe-top)" }}>
        {!isReader && (
          <nav className="flex w-24 shrink-0 flex-col items-center gap-2 py-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-lg font-bold text-accent">‹›</div>
            {tabs.map(({ name, label, Icon }) => (
              <button
                key={name}
                onClick={() => navigate({ name } as Route)}
                className={cn("flex w-20 flex-col items-center gap-1 rounded-2xl py-3 text-xs transition", route.name === name ? "bg-ink text-cream" : "text-ink hover:bg-black/5")}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
            {cloudEnabled && (
              <button onClick={() => navigate({ name: auth.session ? "account" : "auth" })} className="mt-auto flex w-20 flex-col items-center gap-1 rounded-2xl py-3 text-xs text-ink hover:bg-black/5">
                <User size={20} />
                {auth.session ? "حسابي" : "دخول"}
              </button>
            )}
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
        <nav className="flex shrink-0 items-center justify-around border-t border-black/5 bg-cream px-1 pt-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}>
          {tabs.map(({ name, label, Icon }) => {
            const active = route.name === name || (name === "settings" && (route.name === "admin" || route.name === "account"));
            return (
              <button key={name} onClick={() => navigate({ name } as Route)} className={cn("flex flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-[10px] transition", active ? "text-accent" : "text-ink-muted")}>
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", active && "bg-ink text-accent")}>
                  <Icon size={18} />
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
