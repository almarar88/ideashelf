import { useState } from "react";
import { ArrowLeft, Cloud, KeyRound, Loader2, Mail } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { sendCode, verifyCode } from "./auth";

/**
 * الدخول برمز من ست خانات يُرسل إلى البريد.
 * اختير على كلمة المرور لأنه لا يحتاج تخزين كلمات ولا روابط عودة للتطبيق،
 * ويؤكّد البريد في الخطوة نفسها.
 */
export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const submitEmail = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const err = await sendCode(email);
    setBusy(false);
    if (err) setError(err.message);
    else setStep("code");
  };

  const submitCode = async () => {
    if (code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(email, code);
    setBusy(false);
    if (err) setError(err.message);
    else {
      setStep("email");
      setCode("");
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="الدخول والمزامنة"
      subtitle="حسابك يربط أجهزتك ويجعل ما تنشره حقيقياً"
    >
      <div className="space-y-4 pb-4">
        <div className="flex items-start gap-3 rounded-xl2 bg-raised p-3.5">
          <Cloud size={17} className="mt-0.5 shrink-0 text-iris" />
          <p className="text-[12px] leading-relaxed text-muted">
            بلا حساب يعمل التطبيق كاملاً على جهازك وحده. مع حساب تُرفع منشوراتك
            وصورك وملفك، ويصير لما تنشره وجود خارج هذا الجهاز.
          </p>
        </div>

        {step === "email" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitEmail();
            }}
            className="space-y-3"
          >
            <label htmlFor="auth-email" className="block text-[12px] font-medium">
              البريد الإلكتروني
            </label>
            <div className="flex items-center gap-2 rounded-xl2 bg-raised px-3.5 py-3">
              <Mail size={16} className="shrink-0 text-muted" />
              <input
                id="auth-email"
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={!valid || busy}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[.98] disabled:opacity-50 disabled:shadow-none"
              style={{ background: "linear-gradient(140deg, rgb(var(--rose)), rgb(var(--iris)))" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              أرسل رمز الدخول
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
            className="space-y-3"
          >
            <button
              type="button"
              onClick={() => setStep("email")}
              className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5 text-[12px] text-muted"
            >
              <ArrowLeft size={14} className="rotate-180" />
              تغيير البريد
            </button>
            <p className="text-[12.5px] leading-relaxed text-muted">
              أُرسل رمز من ست خانات إلى <span dir="ltr">{email}</span>. تحقّق من مجلد
              الرسائل غير المرغوبة إن لم يصل.
            </p>
            <div className="flex items-center gap-2 rounded-xl2 bg-raised px-3.5 py-3">
              <KeyRound size={16} className="shrink-0 text-muted" />
              <input
                id="auth-code"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="flex-1 bg-transparent text-[18px] font-semibold tracking-[0.4em] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={code.length < 6 || busy}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[.98] disabled:opacity-50 disabled:shadow-none"
              style={{ background: "linear-gradient(140deg, rgb(var(--iris)), rgb(var(--rose)))" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              تأكيد الدخول
            </button>
          </form>
        )}

        {error && (
          <p className="rounded-xl2 bg-rose/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-rose">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
