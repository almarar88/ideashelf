import { useEffect, useState } from "react";
import { ChevronRight, LogOut, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import { deleteAccount, myPurchases, redeemReceipt, signOut } from "@/lib/cloud";
import type { PurchaseRow } from "@/lib/database.types";
import { Button, Card, IconButton } from "@/components/ui";
import { PlanCard } from "@/screens/Store";

export const PLANS = [
  { id: "monthly", title: "اشتراك شهري", price: "٢٩ درهم / شهر", features: ["قراءة كل كتب المكتبة", "تلخيص وتحليل بالذكاء الاصطناعي", "مزامنة القراءة بين أجهزتك", "إلغاء في أي وقت"] },
  { id: "yearly", title: "اشتراك سنوي", price: "٢٩٠ درهم / سنة", features: ["كل مزايا الشهري", "بسعر شهرين مجانًا", "أولوية في الكتب الجديدة"] },
];

export function AccountScreen({ auth, onBack, onNeedAuth }: { auth: AuthState; onBack: () => void; onNeedAuth: () => void }) {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.session?.user) return;
    myPurchases(auth.session.user.id).then(setPurchases).catch(() => setPurchases([]));
  }, [auth.session]);

  if (!auth.session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-3xl">👤</span>
        <p className="text-sm text-ink-muted">سجّل الدخول للوصول إلى كتبك واشتراكك من أي جهاز.</p>
        <Button tone="accent" onClick={onNeedAuth}>
          تسجيل الدخول أو إنشاء حساب
        </Button>
      </div>
    );
  }

  const ent = auth.entitlements;

  async function subscribe(planId: string) {
    setBusy(true);
    setMsg("");
    try {
      await redeemReceipt({ provider: "google_play", token: "", productId: `sub_${planId}` });
      await auth.refresh();
    } catch {
      setMsg("الاشتراك غير مفعّل بعد على هذا الإصدار. يتطلب ربط Google Play Billing أولاً.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!confirm("حذف حسابك نهائيًا؟ ستفقد مشترياتك واشتراكك وسجل قراءتك ولا يمكن التراجع.")) return;
    if (!confirm("تأكيد أخير: سيُحذف الحساب وكل بياناته.")) return;
    setBusy(true);
    try {
      await deleteAccount();
      onBack();
    } catch {
      setMsg("تعذر حذف الحساب الآن. تتطلب هذه الميزة نشر دالة delete-account على الخادم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <header className="flex items-center gap-3 px-4 pt-5">
        <IconButton tone="light" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
        <h1 className="text-xl font-bold">حسابي</h1>
      </header>

      <section className="space-y-3 p-4 pb-10">
        <Card tone="dark" className="p-5">
          <p className="text-sm font-semibold">{auth.profile?.display_name ?? auth.session.user.email}</p>
          <p dir="ltr" className="mt-0.5 text-start text-xs text-cream/60">{auth.session.user.email}</p>
          {auth.isAdmin && <span className="mt-2 inline-block rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold text-white">مشرف</span>}
        </Card>

        <Card tone={ent.subscribed ? "accent" : "white"} className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} /> الاشتراك
          </div>
          <p className={`mt-1 text-xs ${ent.subscribed ? "text-white/80" : "text-ink-muted"}`}>
            {ent.subscribed
              ? `ساري حتى ${new Date(ent.subscription!.current_period_end).toLocaleDateString("ar")} · باقة ${ent.subscription!.plan}`
              : "لا يوجد اشتراك نشط. اشترك لتقرأ كل الكتب."}
          </p>
        </Card>

        {!ent.subscribed && (
          <div className="space-y-3">
            {PLANS.map((p) => (
              <PlanCard key={p.id} title={p.title} price={p.price} features={p.features} onPick={() => void subscribe(p.id)} />
            ))}
          </div>
        )}

        <Card tone="white" className="p-5">
          <p className="mb-2 text-sm font-semibold">كتبي المشتراة ({purchases.length})</p>
          {purchases.length === 0 ? (
            <p className="text-xs text-ink-muted">لم تشترِ أي كتاب بعد.</p>
          ) : (
            <ul className="space-y-1.5">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-2xl bg-cream-soft px-3 py-2 text-xs">
                  <span className="truncate">{p.book_id.slice(0, 8)}…</span>
                  <span className="text-ink-muted">{new Date(p.created_at).toLocaleDateString("ar")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {msg && <p className="rounded-2xl bg-amber-100 px-4 py-3 text-xs leading-6 text-amber-900">{msg}</p>}

        <Button
          tone="light"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            await signOut();
            await auth.refresh();
            onBack();
          }}
        >
          <LogOut size={16} /> تسجيل الخروج
        </Button>

        <Card tone="white" className="border border-red-200 p-5">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-700">
            <ShieldAlert size={16} /> حذف الحساب
          </p>
          <p className="mb-3 text-[11px] leading-5 text-ink-muted">
            يحذف حسابك وكل بياناتك نهائيًا: المشتريات والاشتراك وسجل القراءة. Google Play تشترط توفّر هذا الخيار داخل التطبيق.
          </p>
          <Button tone="outline" className="w-full border-red-300 text-red-700" disabled={busy} onClick={removeAccount}>
            <Trash2 size={16} /> حذف حسابي نهائيًا
          </Button>
        </Card>
      </section>
    </div>
  );
}
