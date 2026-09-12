import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

type AuthState = {
  session: Session | null;
  /** true حتى تُقرأ الجلسة المحفوظة، فلا تُرسم شاشة دخول خاطئة لحظة الإقلاع */
  loading: boolean;
  userId: string | null;
};

const AuthCtx = createContext<AuthState>({ session: null, loading: true, userId: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ session, loading, userId: session?.user.id ?? null }),
    [session, loading],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

/* ── أفعال المصادقة ──────────────────────────────────────────────────────── */

export type AuthError = { message: string };

/** يرسل رمزاً من ست خانات إلى البريد، وينشئ الحساب إن لم يكن موجوداً */
export async function sendCode(email: string): Promise<AuthError | null> {
  if (!supabase) return { message: "الخادم غير مُعدّ في هذه النسخة." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  return error ? { message: translate(error.message) } : null;
}

export async function verifyCode(email: string, code: string): Promise<AuthError | null> {
  if (!supabase) return { message: "الخادم غير مُعدّ في هذه النسخة." };
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  });
  return error ? { message: translate(error.message) } : null;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** رسائل Supabase إنجليزية؛ نترجم الشائع منها ونُبقي الباقي كما هو للتشخيص */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid") && m.includes("token")) return "الرمز غير صحيح أو انتهت صلاحيته.";
  if (m.includes("expired")) return "انتهت صلاحية الرمز — اطلب رمزاً جديداً.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "طلبات كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة.";
  if (m.includes("invalid email") || m.includes("unable to validate"))
    return "صيغة البريد غير صحيحة.";
  if (m.includes("signups not allowed")) return "التسجيل مغلق في هذا المشروع.";
  if (m.includes("email not confirmed")) return "البريد غير مؤكَّد بعد.";
  return message;
}
