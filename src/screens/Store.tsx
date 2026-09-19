import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, CreditCard, Lock, Search, Sparkles, X } from "lucide-react";
import type { BookRow } from "@/lib/database.types";
import { formatPrice, isReadable, listBooks, redeemReceipt, type Entitlements } from "@/lib/cloud";
import type { AuthState } from "@/hooks/useAuth";
import { Button, Card, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface StoreNav {
  openReader: (bookId: string, pages: number, title: string) => void;
  openAuth: () => void;
}

export function StoreScreen({ auth, nav }: { auth: AuthState; nav: StoreNav }) {
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<BookRow | null>(null);

  useEffect(() => {
    let alive = true;
    listBooks()
      .then((b) => alive && setBooks(b))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "تعذر جلب الكتب"));
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!books) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((b) => `${b.title} ${b.author ?? ""} ${b.tags.join(" ")}`.toLowerCase().includes(needle));
  }, [books, q]);

  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pt-5">
        <h1 className="text-2xl font-bold">المتجر</h1>
        <p className="mt-0.5 text-xs text-ink-muted">اشترِ كتابًا، أو اشترك واقرأ كل الكتب</p>
        <div className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-4">
          <Search size={16} className="text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في المتجر…" className="h-full flex-1 bg-transparent text-sm outline-none" />
        </div>
      </header>

      {auth.entitlements.subscribed && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl bg-accent/15 px-4 py-2.5 text-xs text-ink">
          <Sparkles size={14} className="text-accent" />
          اشتراكك ساري حتى {new Date(auth.entitlements.subscription!.current_period_end).toLocaleDateString("ar")} — كل الكتب متاحة لك.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-5 no-scrollbar">
        {error && <div className="rounded-2xl bg-red-100 px-4 py-3 text-xs text-red-800">{error}</div>}
        {!books && !error && <p className="py-10 text-center text-xs text-ink-muted">جارٍ تحميل المتجر…</p>}
        {books && list.length === 0 && <p className="py-10 text-center text-xs text-ink-muted">{books.length === 0 ? "لا توجد كتب منشورة بعد." : "لا نتائج مطابقة."}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((b) => {
            const readable = isReadable(b, auth.entitlements);
            return (
              <button key={b.id} onClick={() => setSelected(b)} className="rise overflow-hidden rounded-3xl bg-white p-3 text-start">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-cream-soft">
                  {b.cover_url ? <img src={b.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl">📕</div>}
                  <span className={cn("absolute bottom-2 start-2 rounded-full px-2 py-0.5 text-[10px] font-semibold", readable ? "bg-green-600 text-white" : "bg-ink/80 text-cream")}>
                    {readable ? "متاح لك" : formatPrice(b)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{b.title}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">{b.author || `${b.page_count} صفحة`}</p>
              </button>
            );
          })}
        </div>
      </div>

      {selected && <BookSheet book={selected} auth={auth} nav={nav} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BookSheet({ book, auth, nav, onClose }: { book: BookRow; auth: AuthState; nav: StoreNav; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const readable = isReadable(book, auth.entitlements);
  const ent: Entitlements = auth.entitlements;
  const owned = ent.purchasedBookIds.has(book.id);

  async function buy() {
    if (!auth.session) return nav.openAuth();
    setBusy(true);
    setMsg("");
    try {
      // On Android this receipt comes from Google Play Billing; on the web from Stripe.
      // Either way the server verifies it before granting access — see verify-purchase.
      await redeemReceipt({ provider: "google_play", token: "", productId: `book_${book.slug}`, bookId: book.id });
      await auth.refresh();
    } catch {
      setMsg("الدفع غير مفعّل بعد على هذا الإصدار. راجع خطوات ربط Google Play في docs/PLATFORM-AR.md");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div className="max-h-[92%] w-full max-w-lg overflow-y-auto rounded-t-4xl bg-cream p-5 no-scrollbar sm:rounded-4xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "calc(var(--safe-bottom) + 20px)" }}>
        <div className="mb-4 flex items-start gap-4">
          <span className="h-32 w-24 shrink-0 overflow-hidden rounded-2xl bg-cream-soft">
            {book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-3xl">📕</span>}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-6">{book.title}</h2>
            <p className="mt-1 text-xs text-ink-muted">{book.author}</p>
            <p className="mt-2 text-xs text-ink-muted">
              {book.page_count} صفحة · معاينة مجانية {book.preview_pages} صفحات
            </p>
            <p className="mt-2 text-xl font-bold text-accent">{formatPrice(book)}</p>
          </div>
          <IconButton tone="light" size="sm" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </IconButton>
        </div>

        {book.description && <p className="mb-4 text-sm leading-7 text-ink-soft">{book.description}</p>}

        {readable ? (
          <Button tone="dark" className="w-full" onClick={() => nav.openReader(book.id, book.page_count, book.title)}>
            <BookOpen size={16} /> {owned ? "اقرأ الكتاب" : ent.subscribed ? "اقرأ ضمن اشتراكك" : "اقرأ مجانًا"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button tone="accent" className="w-full" onClick={buy} disabled={busy}>
              <CreditCard size={16} /> {busy ? "لحظة…" : `شراء بـ ${formatPrice(book)}`}
            </Button>
            <Button tone="light" className="w-full" onClick={() => nav.openReader(book.id, book.page_count, book.title)}>
              <BookOpen size={16} /> اقرأ المعاينة ({book.preview_pages} صفحات)
            </Button>
            {book.in_subscription && (
              <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-ink-muted">
                <Sparkles size={12} className="text-accent" /> هذا الكتاب مشمول بالاشتراك الشهري
              </p>
            )}
          </div>
        )}

        {msg && <p className="mt-3 rounded-2xl bg-amber-100 px-4 py-3 text-xs leading-6 text-amber-900">{msg}</p>}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-muted">
          <Lock size={11} /> الكتاب يُقرأ داخل التطبيق ولا يمكن تنزيله كملف
        </p>
      </div>
    </div>
  );
}

export function PlanCard({ title, price, features, active, onPick }: { title: string; price: string; features: string[]; active?: boolean; onPick: () => void }) {
  return (
    <Card tone={active ? "dark" : "white"} className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-base font-bold">{title}</p>
        <p className="text-lg font-bold text-accent">{price}</p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs leading-6">
            <Check size={13} className="mt-1 shrink-0 text-accent" />
            {f}
          </li>
        ))}
      </ul>
      <Button tone={active ? "light" : "accent"} className="mt-4 w-full" onClick={onPick}>
        {active ? "اشتراكك الحالي" : "اشترك"}
      </Button>
    </Card>
  );
}
