import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { TopBar } from "@/components/shell/TopBar";
import { TabBar } from "@/components/shell/TabBar";
import { PulseButton } from "@/components/shell/PulseButton";
import { FloatingDeck } from "@/components/shell/FloatingDeck";
import { FeedScreen } from "@/components/screens/FeedScreen";
import { StudioScreen } from "@/components/screens/StudioScreen";
import { ProseScreen } from "@/components/screens/ProseScreen";
import { AtlasScreen } from "@/components/screens/AtlasScreen";
import { VaultScreen } from "@/components/screens/VaultScreen";
import { Sheet } from "@/components/ui/Sheet";
import { useHourLight, useTheme } from "@/hooks/useTheme";
import { pulseFor } from "@/lib/pulse";
import { posts } from "@/lib/data";
import type { ScreenId } from "@/lib/types";

export default function App() {
  const { theme, toggle } = useTheme();
  const light = useHourLight();

  const [screen, setScreen] = useState<ScreenId>("feed");
  const [busy, setBusy] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [seals, setSeals] = useState(0);
  const [focusSearch, setFocusSearch] = useState(0);
  const [digest, setDigest] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);

  const mode = useMemo(() => pulseFor(screen, busy), [screen, busy]);

  // تلميح النبض يظهر لحظة تغيّر وظيفته ثم ينسحب
  useEffect(() => {
    setHintOpen(true);
    const id = window.setTimeout(() => setHintOpen(false), 3200);
    return () => window.clearTimeout(id);
  }, [mode.id]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const onPulse = useCallback(() => {
    if (busy) return;
    switch (screen) {
      case "feed":
        setDigest(true);
        break;
      case "studio":
        setBusy(true);
        break;
      case "prose":
        setDictating(true);
        break;
      case "atlas":
        setFocusSearch((n) => n + 1);
        notify("اكتب وصف اليوم الذي تبحث عنه، لا كلمة مفتاحية.");
        break;
      case "vault":
        setSeals((n) => n + 1);
        notify("خُتم العمل بسجل أصل رقمي يوضح نسبة مساهمة الآلة.");
        break;
    }
  }, [busy, screen, notify]);

  return (
    <div className="relative z-10 flex min-h-[100dvh] items-center justify-center lg:py-10">
      <Brand />
      <FloatingDeck screen={screen} busy={busy} seals={seals} />

      <PhoneFrame>
        <TopBar
          theme={theme}
          onToggleTheme={toggle}
          light={light}
          onSearch={() => {
            setScreen("atlas");
            setFocusSearch((n) => n + 1);
          }}
        />

        {screen === "feed" && <FeedScreen onNotice={notify} />}
        {screen === "studio" && (
          <StudioScreen
            running={busy}
            onRun={() => setBusy(true)}
            onDone={() => {
              setBusy(false);
              notify("اكتمل الإخراج — النسخة النهائية موسومة بسجل الأصل.");
            }}
          />
        )}
        {screen === "prose" && (
          <ProseScreen
            dictating={dictating}
            onDictationEnd={() => {
              setDictating(false);
              notify("انتهى التفريغ — اضغط «صُغ المقال ببصمتي».");
            }}
          />
        )}
        {screen === "atlas" && <AtlasScreen focusSearch={focusSearch} />}
        {screen === "vault" && <VaultScreen sealCount={seals} />}

        <PulseButton mode={mode} busy={busy || dictating} onPress={onPulse} expanded={hintOpen} />
        <TabBar screen={screen} onChange={setScreen} />

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

        {toast && (
          <div className="depth-enter pointer-events-none absolute inset-x-6 bottom-36 z-40 rounded-xl2 glass px-4 py-3 text-center text-[12.5px] shadow-float">
            {toast}
          </div>
        )}
      </PhoneFrame>
    </div>
  );
}

function Brand() {
  return (
    <>
      <div className="pointer-events-none absolute right-8 top-7 hidden lg:block">
        <p className="text-[13px] font-semibold tracking-tight">Chrono AI · أَثَـر</p>
        <p className="mt-0.5 text-[11.5px] text-muted">منصة توثيق الحياة الفائقة</p>
      </div>
      <div className="pointer-events-none absolute bottom-8 right-8 hidden max-w-[240px] lg:block">
        <p className="text-[11.5px] leading-relaxed text-muted">
          نموذج واجهة تفاعلي — كل المحرّكات تعمل محلياً داخل المتصفح.
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-8 left-8 hidden lg:block" aria-hidden>
        <svg width="54" height="30" viewBox="0 0 54 30" fill="none">
          <path d="M8 26 L20 4" stroke="rgb(var(--ink))" strokeWidth="5" strokeLinecap="round" />
          <path d="M22 26 L34 4" stroke="rgb(var(--ink))" strokeWidth="5" strokeLinecap="round" />
          <circle cx="44" cy="9" r="5" fill="rgb(var(--rose))" />
        </svg>
      </div>
    </>
  );
}
