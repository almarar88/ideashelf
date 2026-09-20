import { useEffect, useState } from "react";
import { Check, ChevronLeft, Eye, EyeOff, Headphones, KeyRound, ShieldCheck, User } from "lucide-react";
import { MODELS, type Effort, type PageEffect, type Settings } from "@/lib/settings";
import { testApiKey } from "@/lib/ai";
import { deviceVoicesAvailable, listVoices, type Voice } from "@/lib/narration";
import { Toggle } from "@/components/ui";
import type { Route } from "@/App";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

import type { AuthState } from "@/hooks/useAuth";
import { cloudEnabled } from "@/lib/supabase";

export function SettingsScreen({ settings, update, navigate, auth }: { settings: Settings; update: (p: Partial<Settings>) => void; navigate: (r: Route) => void; auth: AuthState }) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    if (!cloudEnabled || !auth.session) return;
    listVoices().then(setVoices).catch(() => setVoices([]));
  }, [auth.session]);

  async function test() {
    setTesting(true);
    setTestResult(null);
    const r = await testApiKey(settings.apiKey);
    setTestResult(r.ok ? "✅ المفتاح يعمل بنجاح" : `❌ ${r.error}`);
    setTesting(false);
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <header className="px-5 pt-5">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
      </header>

      <section className="space-y-3 p-4 pb-10">
        {cloudEnabled && (
          <Card tone="dark" onClick={() => navigate({ name: auth.session ? "account" : "auth" })} className="flex w-full items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/10 text-accent">
              <User size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{auth.session ? "حسابي" : "تسجيل الدخول"}</span>
              <span className="block text-[11px] text-cream/60">
                {auth.session ? (auth.entitlements.subscribed ? "اشتراكك ساري · اضغط لإدارته" : auth.session.user.email) : "للوصول إلى مشترياتك واشتراكك من أي جهاز"}
              </span>
            </span>
            <ChevronLeft size={18} className="text-cream/60" />
          </Card>
        )}

        <Card tone="white" className="p-5">
          <label className="mb-2 block text-sm font-semibold">اسمك</label>
          <input value={settings.userName} onChange={(e) => update({ userName: e.target.value })} className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" placeholder="الاسم الظاهر في الترحيب" />
        </Card>

        <Card tone="dark" className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/10 text-accent">
              <KeyRound size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold">مفتاح Anthropic API</p>
              <p className="text-[11px] text-cream/60">يُحفظ على جهازك فقط ويُرسل مباشرة إلى api.anthropic.com</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-cream/10 px-4">
            <input
              type={show ? "text" : "password"}
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value.trim() })}
              placeholder="sk-ant-…"
              dir="ltr"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-cream/30"
              autoComplete="off"
              spellCheck={false}
            />
            <button onClick={() => setShow((v) => !v)} className="text-cream/60" aria-label="إظهار/إخفاء">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button tone="accent" className="h-10 px-4 text-xs" disabled={!settings.apiKey || testing} onClick={test}>
              {testing ? "جارٍ الفحص…" : "فحص المفتاح"}
            </Button>
            {testResult && <span className="text-xs">{testResult}</span>}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-cream/50">
            احصل على مفتاح من console.anthropic.com. يتم احتساب التكلفة على حسابك مباشرة حسب حجم الكتاب والنموذج.
          </p>
        </Card>

        <Card tone="white" className="p-5">
          <p className="mb-3 text-sm font-semibold">النموذج</p>
          <div className="space-y-2">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => update({ model: m.id })} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-start transition", settings.model === m.id ? "bg-ink text-cream" : "bg-cream-soft")}>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className={cn("block text-[11px]", settings.model === m.id ? "text-cream/60" : "text-ink-muted")}>{m.hint}</span>
                </span>
                {settings.model === m.id && <Check size={16} className="text-accent" />}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-sm font-semibold">عمق التفكير</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["low", "سريع"],
                ["medium", "متوازن"],
                ["high", "عميق"],
              ] as [Effort, string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => update({ effort: k })} className={cn("rounded-full py-2 text-xs font-medium", settings.effort === k ? "bg-accent text-white" : "bg-cream-soft")}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">لا ينطبق على Haiku 4.5. العمق الأعلى أدق لكنه أبطأ وأغلى.</p>
        </Card>

        <Card tone="white" className="p-5">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Headphones size={16} className="text-accent" /> الكتاب الصوتي
          </p>
          <p className="mb-3 text-[11px] leading-5 text-ink-muted">
            {cloudEnabled
              ? "كتب المتجر تُقرأ بصوت عربي طبيعي من ElevenLabs. كتبك الخاصة تُقرأ بصوت الجهاز."
              : "تُقرأ الكتب بصوت الجهاز. يحتاج جهازك إلى حزمة نطق عربية مثبّتة."}
          </p>

          {voices.length > 0 && (
            <>
              <label className="mb-1 block text-xs font-semibold">الصوت</label>
              <select
                value={settings.ttsVoiceId}
                onChange={(e) => update({ ttsVoiceId: e.target.value })}
                className="mb-3 h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none"
              >
                <option value="">الصوت الافتراضي للخادم</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <p className="mb-2 text-xs font-semibold">سرعة القراءة</p>
          <div className="grid grid-cols-4 gap-2">
            {[0.9, 1, 1.25, 1.5].map((r) => (
              <button key={r} onClick={() => update({ ttsRate: r })} className={cn("rounded-full py-2 text-xs font-medium", settings.ttsRate === r ? "bg-accent text-white" : "bg-cream-soft")}>
                {r}x
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center justify-between rounded-2xl bg-cream-soft px-4 py-3 text-xs">
            <span>الانتقال تلقائيًا للصفحة التالية</span>
            <Toggle checked={settings.ttsAutoAdvance} onChange={(v) => update({ ttsAutoAdvance: v })} label="انتقال تلقائي" />
          </label>

          {!cloudEnabled && !deviceVoicesAvailable() && (
            <p className="mt-2 text-[11px] text-red-600">هذا الجهاز لا يدعم النطق.</p>
          )}
        </Card>

        <Card tone="white" className="p-5">
          <p className="mb-1 text-sm font-semibold">تأثير تقليب الصفحة</p>
          <p className="mb-3 text-[11px] text-ink-muted">شكل الانتقال بين صفحات الكتاب أثناء القراءة.</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["flip", "كتاب حقيقي"],
                ["slide", "انزلاق"],
                ["none", "بدون"],
              ] as [PageEffect, string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => update({ pageEffect: k })} className={cn("rounded-full py-2 text-xs font-medium", settings.pageEffect === k ? "bg-accent text-white" : "bg-cream-soft")}>
                {l}
              </button>
            ))}
          </div>
        </Card>

        <Card tone="white" className="p-5">
          <p className="mb-3 text-sm font-semibold">المظهر</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["system", "تلقائي"],
                ["light", "فاتح"],
                ["dark", "داكن"],
              ] as [Settings["theme"], string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => update({ theme: k })} className={cn("rounded-full py-2 text-xs font-medium", settings.theme === k ? "bg-ink text-cream" : "bg-cream-soft")}>
                {l}
              </button>
            ))}
          </div>
        </Card>

        <Card tone="accent" onClick={() => navigate({ name: "admin" })} className="flex w-full items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <ShieldCheck size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">لوحة تحكم المشرف</span>
            <span className="block text-[11px] text-white/80">تسجيل دخول المشرف: رفع ونشر الكتب، إدارة المكتبة، النسخ الاحتياطي</span>
          </span>
          <ChevronLeft size={18} />
        </Card>

        <p className="pt-2 text-center text-[11px] text-ink-muted">مكتبة الكود الرقمية · الإصدار 1.0.0</p>
      </section>
    </div>
  );
}
