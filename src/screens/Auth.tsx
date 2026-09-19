import { useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { sendPasswordReset, signIn, signUp } from "@/lib/cloud";
import { Button } from "@/components/ui";

type Tab = "in" | "up" | "reset";

function describe(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Invalid login credentials/i.test(m)) return "البريد أو كلمة المرور غير صحيحة.";
  if (/User already registered/i.test(m)) return "هذا البريد مسجّل بالفعل. سجّل الدخول بدلاً من ذلك.";
  if (/Password should be at least/i.test(m)) return "كلمة المرور قصيرة. استخدم ٨ أحرف على الأقل.";
  if (/Unable to validate email/i.test(m) || /invalid format/i.test(m)) return "صيغة البريد غير صحيحة.";
  if (/rate limit|too many/i.test(m)) return "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.";
  if (/fetch|network/i.test(m)) return "تعذر الاتصال بالخادم. تحقق من الإنترنت.";
  return m;
}

export function AuthScreen({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const [tab, setTab] = useState<Tab>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit() {
    setError("");
    setNotice("");
    if (!email.trim()) return setError("أدخل بريدك الإلكتروني.");
    if (tab !== "reset" && password.length < 8) return setError("كلمة المرور يجب أن تكون ٨ أحرف على الأقل.");
    setBusy(true);
    try {
      if (tab === "in") {
        await signIn(email, password);
        onDone();
      } else if (tab === "up") {
        const res = await signUp(email, password, name || email.split("@")[0]);
        if (res.session) onDone();
        else setNotice("أُنشئ حسابك. افتح بريدك وأكّد التسجيل ثم سجّل الدخول.");
      } else {
        await sendPasswordReset(email);
        setNotice("أرسلنا رابط إعادة التعيين إلى بريدك.");
      }
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink text-cream no-scrollbar" style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}>
      <div className="relative shrink-0 px-8 pb-6 pt-10">
        <div className="absolute -end-16 -top-10 h-56 w-56 rounded-full bg-accent/15" />
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">‹›</div>
        <h1 className="relative text-3xl font-bold leading-tight">مكتبة الكود الرقمية</h1>
        <p className="relative mt-2 text-sm text-cream/60">
          {tab === "up" ? "أنشئ حسابًا لتصل إلى مكتبتك من أي جهاز." : tab === "reset" ? "سنرسل لك رابطًا لإعادة تعيين كلمة المرور." : "سجّل الدخول للوصول إلى كتبك واشتراكك."}
        </p>
      </div>

      <div className="flex-1 rounded-t-4xl bg-cream px-6 pb-8 pt-6 text-ink">
        <div className="mb-5 flex gap-2">
          {(
            [
              ["in", "تسجيل الدخول"],
              ["up", "حساب جديد"],
            ] as [Tab, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setError("");
                setNotice("");
              }}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${tab === k ? "bg-ink text-cream" : "bg-white text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "up" && (
          <>
            <label className="mb-1 block text-xs font-semibold">الاسم</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الظاهر" className="mb-3 h-12 w-full rounded-full bg-white px-5 text-sm outline-none" />
          </>
        )}

        <label className="mb-1 block text-xs font-semibold">البريد الإلكتروني</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          dir="ltr"
          placeholder="name@example.com"
          className="mb-3 h-12 w-full rounded-full bg-white px-5 text-start text-sm outline-none"
        />

        {tab !== "reset" && (
          <>
            <label className="mb-1 block text-xs font-semibold">كلمة المرور</label>
            <div className="mb-2 flex h-12 items-center rounded-full bg-white px-5">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                type={show ? "text" : "password"}
                autoComplete={tab === "up" ? "new-password" : "current-password"}
                dir="ltr"
                placeholder="********"
                className="h-full min-w-0 flex-1 bg-transparent text-start text-sm outline-none"
              />
              <button onClick={() => setShow((v) => !v)} className="text-ink-muted" aria-label="إظهار كلمة المرور">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </>
        )}

        {error && <p className="mb-2 rounded-2xl bg-red-100 px-4 py-2.5 text-xs leading-5 text-red-800">{error}</p>}
        {notice && <p className="mb-2 rounded-2xl bg-green-100 px-4 py-2.5 text-xs leading-5 text-green-900">{notice}</p>}

        <Button tone="accent" className="mt-2 w-full" onClick={submit} disabled={busy}>
          {busy ? "لحظة…" : tab === "in" ? "دخول" : tab === "up" ? "إنشاء الحساب" : "إرسال الرابط"}
        </Button>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button onClick={() => setTab(tab === "reset" ? "in" : "reset")} className="flex items-center gap-1 text-ink-muted underline-offset-4 hover:underline">
            <Mail size={12} /> {tab === "reset" ? "العودة لتسجيل الدخول" : "نسيت كلمة المرور؟"}
          </button>
          {onSkip && (
            <button onClick={onSkip} className="text-ink-muted underline-offset-4 hover:underline">
              تصفّح بدون حساب
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-ink-muted">
          بإنشائك حسابًا فأنت توافق على أن نحفظ بريدك وسجل قراءتك، وأن يُرسل نص الكتب إلى خدمة ذكاء اصطناعي لتحليلها.
        </p>
      </div>
    </div>
  );
}
