import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { TopBar } from "@/components/shell/TopBar";
import { TabBar } from "@/components/shell/TabBar";
import { PulseButton } from "@/components/shell/PulseButton";
import { FloatingDeck } from "@/components/shell/FloatingDeck";
import { DualShell } from "@/components/shell/DualShell";
import { NavRail } from "@/components/shell/NavRail";
import { CompanionPane } from "@/components/shell/CompanionPane";
import { FeedScreen } from "@/components/screens/FeedScreen";
import { PostDepth } from "@/components/feed/PostDepth";
import { ExploreScreen } from "@/components/screens/ExploreScreen";
import { CreateScreen, type CreateTab } from "@/components/screens/CreateScreen";
import { AtlasScreen } from "@/components/screens/AtlasScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { ComposerSheet } from "@/components/social/ComposerSheet";
import { NotificationsSheet } from "@/components/social/NotificationsSheet";
import { MessagesSheet } from "@/components/social/MessagesSheet";
import { PostMenu } from "@/components/social/PostMenu";
import { StoryViewer } from "@/components/social/StoryViewer";
import { Sheet } from "@/components/ui/Sheet";
import { Logo, Wordmark } from "@/components/ui/Logo";
import { useHourLight, useTheme } from "@/hooks/useTheme";
import { useWindowLayout } from "@/hooks/useWindowLayout";
import { pulseFor } from "@/lib/pulse";
import { useStore, useVisiblePosts } from "@/store/store";
import type { Post, ScreenId } from "@/lib/types";

export default function App() {
  const { theme, toggle } = useTheme();
  const light = useHourLight();
  const layout = useWindowLayout();
  const { state } = useStore();
  const posts = useVisiblePosts();

  const [screen, setScreen] = useState<ScreenId>("feed");
  const [createTab, setCreateTab] = useState<CreateTab>("film");
  const [busy, setBusy] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [seals, setSeals] = useState(0);
  const [focusSearch, setFocusSearch] = useState(0);

  const [composing, setComposing] = useState(false);
  const [digest, setDigest] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [messages, setMessages] = useState(false);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [pane, setPane] = useState<{ post: Post; tab: "text" | "ask" } | null>(null);

  const dual = layout.mode === "dual" || layout.mode === "tabletop";
  const mode = useMemo(() => pulseFor(screen, busy, createTab), [screen, busy, createTab]);

  // تلميح النبض يظهر لحظة تغيّر وظيفته ثم ينسحب
  useEffect(() => {
    setHintOpen(true);
    const id = window.setTimeout(() => setHintOpen(false), 3000);
    return () => window.clearTimeout(id);
  }, [mode.id]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const openPost = useCallback(
    (post: Post, tab: "text" | "ask") => setPane({ post, tab }),
    [],
  );

  const onPulse = useCallback(() => {
    if (busy) return;
    switch (screen) {
      case "feed":
        setComposing(true);
        break;
      case "explore":
        setDigest(true);
        break;
      case "create":
        if (createTab === "film") setBusy(true);
        else setDictating(true);
        break;
      case "atlas":
        setFocusSearch((n) => n + 1);
        notify("اكتب وصف اليوم الذي تبحث عنه، لا كلمة مفتاحية.");
        break;
      case "profile":
      case "settings":
        setSeals((n) => n + 1);
        notify("خُتم العمل بسجل أصل رقمي يوضح نسبة مساهمة الآلة.");
        break;
    }
  }, [busy, screen, createTab, notify]);

  // لوحة العمق تتبع أحدث نسخة من المنشور
  const livePane = pane ? posts.find((p) => p.id === pane.post.id) ?? null : null;

  const screenNode = (
    <>
      {screen === "feed" && (
        <FeedScreen
          onOpenPost={openPost}
          selectedId={dual ? pane?.post.id ?? null : null}
          onCompose={() => setComposing(true)}
          onMenu={setMenuPost}
          onStory={setStory}
        />
      )}
      {screen === "explore" && (
        <ExploreScreen onOpenPost={openPost} focusSearch={focusSearch} />
      )}
      {screen === "create" && (
        <CreateScreen
          tab={createTab}
          onTab={setCreateTab}
          running={busy}
          onRun={() => setBusy(true)}
          onDone={() => {
            setBusy(false);
            notify("اكتمل الإخراج — النسخة النهائية موسومة بسجل الأصل.");
          }}
          dictating={dictating}
          onDictationEnd={() => {
            setDictating(false);
            notify("انتهى التفريغ — اضغط «صُغ المقال ببصمتي».");
          }}
        />
      )}
      {screen === "atlas" && <AtlasScreen focusSearch={focusSearch} />}
      {screen === "profile" && (
        <ProfileScreen onOpenPost={openPost} onOpenSettings={() => setScreen("settings")} />
      )}
      {screen === "settings" && (
        <SettingsScreen theme={theme} onToggleTheme={toggle} seals={seals} />
      )}
    </>
  );

  const overlays = (
    <>
      <ComposerSheet open={composing} onClose={() => setComposing(false)} />
      <NotificationsSheet
        open={notifs}
        onClose={() => setNotifs(false)}
        onOpenPost={(id) => {
          const p = state.posts.find((x) => x.id === id);
          if (p) openPost(p, "text");
        }}
      />
      <MessagesSheet open={messages} onClose={() => setMessages(false)} />
      <PostMenu post={menuPost} onClose={() => setMenuPost(null)} onNotice={notify} />

      <Sheet
        open={digest}
        onClose={() => setDigest(false)}
        title="عدسة التلخيص"
        subtitle="خلاصة ما في المجرى الآن، مستخرجة من المنشورات نفسها"
      >
        <ul className="space-y-2.5 pb-2">
          {posts.map((p) => (
            <li key={p.id} className="rounded-xl2 bg-raised p-3.5">
              <p className="text-[13.5px] font-semibold">{p.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {p.lede.split(/(?<=[.!؟])\s+/)[0]}
              </p>
              <p className="mt-1.5 text-[11px] text-iris">
                {p.sources.length} هامش موثّق · ذكاء {p.aiShare}٪ · {p.comments.length} نقاش
              </p>
            </li>
          ))}
        </ul>
        <p className="pb-2 text-[11px] leading-relaxed text-muted">
          الخلاصة مبنية على أول جملة من كل منشور وعلى بياناته الوصفية — بلا إعادة
          صياغة توليدية، حتى لا يُنسب للكاتب ما لم يقله.
        </p>
      </Sheet>

      {story !== null && (
        <StoryViewer
          people={state.people}
          startIndex={story}
          onClose={() => setStory(null)}
        />
      )}

      {toast && (
        <div className="depth-enter pointer-events-none absolute inset-x-6 bottom-24 z-40 mx-auto max-w-sm rounded-xl2 glass px-4 py-3 text-center text-[12.5px] shadow-float">
          {toast}
        </div>
      )}
    </>
  );

  // ── الشاشة الداخلية للأجهزة القابلة للطي، واللوحيات الصغيرة ───────────────
  if (dual) {
    return (
      <DualShell
        layout={layout}
        rail={
          <NavRail
            screen={screen}
            onChange={setScreen}
            theme={theme}
            onToggleTheme={toggle}
            onSettings={() => setScreen("settings")}
            pulse={mode}
            busy={busy || dictating}
            onPulse={onPulse}
          />
        }
        primary={
          <>
            <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-[calc(env(safe-area-inset-top)+16px)]">
              <Wordmark size={26} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotifs(true)}
                  className="rounded-full bg-raised px-3 py-1.5 text-[11.5px] text-muted"
                >
                  تنبيهات
                </button>
                <button
                  type="button"
                  onClick={() => setMessages(true)}
                  className="rounded-full bg-raised px-3 py-1.5 text-[11.5px] text-muted"
                >
                  رسائل
                </button>
              </div>
            </header>
            <div className="relative flex min-h-0 flex-1 flex-col">
              {screenNode}
              {overlays}
            </div>
          </>
        }
        secondary={
          <CompanionPane
            screen={screen}
            busy={busy}
            seals={seals}
            post={livePane}
            postTab={pane?.tab ?? "text"}
          />
        }
      />
    );
  }

  // ── الهاتف، والشاشة الخارجية للجهاز المطوي، وسطح المكتب ───────────────────
  const showcase = layout.mode === "showcase";
  return (
    <div className="relative z-10 flex min-h-[100dvh] items-center justify-center lg:py-10">
      {showcase && (
        <>
          <Brand />
          <FloatingDeck screen={screen} busy={busy} seals={seals} />
        </>
      )}

      <PhoneFrame framed={showcase}>
        <TopBar
          light={light}
          onProfile={() => setScreen("profile")}
          onNotifications={() => setNotifs(true)}
          onMessages={() => setMessages(true)}
        />
        {screenNode}
        <PulseButton mode={mode} busy={busy || dictating} onPress={onPulse} expanded={hintOpen} />
        <TabBar screen={screen} onChange={setScreen} />
        {overlays}

        <Sheet
          open={!!livePane}
          onClose={() => setPane(null)}
          title={livePane?.title ?? ""}
          subtitle={livePane ? `${livePane.author.name} · ${livePane.place}` : undefined}
        >
          {livePane && <PostDepth post={livePane} initialTab={pane?.tab ?? "text"} />}
        </Sheet>
      </PhoneFrame>
    </div>
  );
}

function Brand() {
  return (
    <>
      <div className="pointer-events-none absolute right-8 top-7 hidden lg:block">
        <Wordmark size={30} subtitle="منصة توثيق الحياة الفائقة" />
      </div>
      <div className="pointer-events-none absolute bottom-8 right-8 hidden max-w-[240px] lg:block">
        <p className="text-[11.5px] leading-relaxed text-muted">
          نموذج واجهة تفاعلي — كل المحرّكات والبيانات محلية على هذا الجهاز.
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-8 left-8 hidden opacity-70 lg:block" aria-hidden>
        <Logo size={40} tone="mono" className="text-ink" />
      </div>
    </>
  );
}
