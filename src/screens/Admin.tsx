import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, CloudUpload, Database, Download, Eye, EyeOff, FileText, Globe, Heart, Lock, LogOut, Pencil, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { db, deleteBook, type Book } from "@/lib/db";
import { TEXT_VERSION, extractBookText, openPdf } from "@/lib/pdf";
import { publishBookToStore, type PublishProgress } from "@/lib/publish";
import { cloudEnabled } from "@/lib/supabase";
import type { Settings } from "@/lib/settings";
import { downloadCatalogBook, exportBackup, fetchCatalog, importBackup, isLoggedIn, loadTarget, login, logout, publishBook, saveTarget, storageEstimate, wipeAll, type CatalogEntry, type PublishTarget } from "@/lib/admin";
import { UploadButton, type UploadState } from "@/components/UploadButton";
import { Button, Card, IconButton, Toggle } from "@/components/ui";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

import type { AuthState } from "@/hooks/useAuth";

export function AdminScreen({ settings, update, auth, onBack }: { settings: Settings; update: (p: Partial<Settings>) => void; auth: AuthState; onBack: () => void }) {
  const [unlocked, setUnlocked] = useState(isLoggedIn);
  if (!unlocked) return <LoginGate onUnlock={() => setUnlocked(true)} onBack={onBack} />;
  return (
    <Dashboard
      settings={settings}
      update={update}
      auth={auth}
      onBack={onBack}
      onLogout={() => {
        logout();
        setUnlocked(false);
      }}
    />
  );
}

/* ---------------- Login gate ---------------- */
function LoginGate({ onUnlock, onBack }: { onUnlock: () => void; onBack: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user.trim() || !pass) return setErr("أدخل اسم المستخدم وكلمة المرور");
    setBusy(true);
    const ok = await login(user, pass, remember);
    setBusy(false);
    if (ok) onUnlock();
    else setErr("اسم المستخدم أو كلمة المرور غير صحيحة");
  }

  return (
    <div className="flex h-full flex-col bg-ink text-cream">
      <header className="flex items-center px-4 pt-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <IconButton tone="ghost" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white">
          <Lock size={26} />
        </span>
        <h1 className="text-2xl font-bold">لوحة تحكم المشرف</h1>
        <p className="mt-2 text-xs text-cream/60">سجّل الدخول لإدارة التطبيق ورفع الكتب.</p>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="اسم المستخدم"
          autoCapitalize="none"
          autoComplete="username"
          dir="ltr"
          className="mt-6 h-12 w-full max-w-xs rounded-full bg-cream/10 px-5 text-center text-cream outline-none placeholder:text-cream/40"
        />
        <div className="mt-3 flex h-12 w-full max-w-xs items-center rounded-full bg-cream/10 px-4">
          <input
            type={show ? "text" : "password"}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="كلمة المرور"
            autoComplete="current-password"
            dir="ltr"
            className="h-full min-w-0 flex-1 bg-transparent text-center text-cream outline-none placeholder:text-cream/40"
          />
          <button onClick={() => setShow((v) => !v)} className="text-cream/60" aria-label="إظهار كلمة المرور">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-xs text-cream/70">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#ee7a4b]" />
          تذكرني على هذا الجهاز
        </label>
        {err && <p className="mt-3 text-xs text-accent">{err}</p>}
        <Button tone="accent" className="mt-6 w-full max-w-xs" onClick={submit} disabled={busy}>
          {busy ? "جارٍ التحقق…" : "تسجيل الدخول"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
type Tab = "overview" | "publish" | "books" | "catalog" | "backup";

function Dashboard({ settings, update, auth, onBack, onLogout }: { settings: Settings; update: (p: Partial<Settings>) => void; auth: AuthState; onBack: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const books = useLiveQuery(() => db.books.orderBy("addedAt").reverse().toArray(), []) ?? [];
  const analysesCount = useLiveQuery(() => db.analyses.count(), []) ?? 0;
  const chatsCount = useLiveQuery(() => db.chats.count(), []) ?? 0;
  const [storage, setStorage] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => {
    void storageEstimate().then(setStorage);
  }, [books.length, tab]);

  const totalPages = books.reduce((a, b) => a + b.pages, 0);
  const totalSeconds = books.reduce((a, b) => a + b.readingSeconds, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <IconButton tone="light" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
        <div className="flex-1">
          <h1 className="text-xl font-bold">لوحة تحكم المشرف</h1>
          <p className="text-[11px] text-ink-muted">إدارة التطبيق والمكتبة</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px]">
          <LogOut size={12} /> خروج
        </button>
      </header>

      <div className="flex gap-1.5 overflow-x-auto px-4 pt-4 no-scrollbar">
        {(
          [
            ["overview", "نظرة عامة"],
            ["publish", "نشر كتاب"],
            ["books", `الكتب (${books.length})`],
            ["catalog", "الفهرس العام"],
            ["backup", "النسخ الاحتياطي"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-semibold", tab === k ? "bg-ink text-cream" : "bg-white")}>
            {l}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-10 no-scrollbar">
        {tab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat n={books.length} label="كتاب" />
              <Stat n={totalPages} label="صفحة مخزّنة" />
              <Stat n={analysesCount} label="نتيجة ذكاء اصطناعي" />
              <Stat n={chatsCount} label="رسالة محادثة" />
            </div>
            <Card tone="dark" className="p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Database size={16} className="text-accent" /> التخزين على الجهاز
              </div>
              {storage ? (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cream/10">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (storage.used / Math.max(1, storage.quota)) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-cream/60">
                    المستخدم {formatBytes(storage.used)} من {formatBytes(storage.quota)} · إجمالي وقت القراءة {formatDuration(totalSeconds)}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-cream/60">لا تتوفر معلومات التخزين على هذا المتصفح.</p>
              )}
            </Card>
            <BulkUpload />
          </div>
        )}
        {tab === "publish" && <PublishManager auth={auth} />}
        {tab === "books" && <BooksManager books={books} />}
        {tab === "catalog" && <CatalogManager settings={settings} update={update} books={books} />}
        {tab === "backup" && <BackupManager />}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <Card tone="white" className="p-4">
      <p className="text-3xl font-bold leading-none">{n}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </Card>
  );
}

/* ---------------- Bulk upload ---------------- */
function BulkUpload() {
  const [states, setStates] = useState<UploadState[]>([]);
  return (
    <Card tone="white" className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Upload size={16} className="text-accent" /> رفع كتب PDF بالجملة
      </div>
      <p className="mb-3 text-[11px] leading-5 text-ink-muted">اختر عدة ملفات دفعة واحدة. يُستخرج النص من كل كتاب تلقائيًا لتفعيل التلخيص والتحليل.</p>
      <UploadButton multiple label="اختيار ملفات PDF" tone="dark" className="w-full" onState={setStates} />
      {states.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {states.map((s) => {
            const pct = s.progress?.pages ? Math.round((s.progress.page / s.progress.pages) * 100) : 0;
            return (
              <li key={s.file} className="rounded-2xl bg-cream-soft px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="truncate">{s.file}</span>
                  <span className={cn("shrink-0", s.error ? "text-red-600" : s.progress?.stage === "done" ? "text-green-700" : "text-ink-muted")}>
                    {s.error ? "فشل" : s.progress?.stage === "done" ? "تم" : s.progress ? `${pct}%` : "بالانتظار"}
                  </span>
                </div>
                {s.error && <p className="mt-1 text-[10px] text-red-600">{s.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Publish to GitHub ---------------- */
function StorePublisher({ auth }: { auth: AuthState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("25");
  const [preview, setPreview] = useState("5");
  const [inSub, setInSub] = useState(true);
  const [tags, setTags] = useState("");
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const busy = progress !== null && progress.stage !== "done";

  async function run() {
    if (!file) return;
    setResult(null);
    setProgress({ stage: "opening", page: 0, pages: 0 });
    try {
      await publishBookToStore(
        file,
        {
          title: title.trim() || file.name.replace(/\.pdf$/i, ""),
          author: author.trim(),
          description: description.trim(),
          priceMinor: Math.round((parseFloat(price) || 0) * 100),
          currency: "AED",
          previewPages: Math.max(0, parseInt(preview, 10) || 0),
          inSubscription: inSub,
          tags: tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
        },
        setProgress,
      );
      setResult({ ok: true, text: "نُشر الكتاب في المتجر. الملف الأصلي لم يُرفع — الصفحات فقط كصور محمية." });
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "فشل النشر" });
    } finally {
      setProgress(null);
    }
  }

  if (!cloudEnabled) {
    return (
      <Card tone="light" className="p-4 text-[11px] leading-6 text-ink-muted">
        المتجر غير مفعّل على هذا الإصدار. أضف عنوان مشروع Supabase ومفتاحه في ملف <code dir="ltr">.env</code> ثم أعد البناء.
      </Card>
    );
  }
  if (!auth.isAdmin) {
    return (
      <Card tone="light" className="p-4 text-[11px] leading-6 text-ink-muted">
        النشر في المتجر يتطلب تسجيل الدخول بحساب دوره <b>مشرف</b> على الخادم. سجّل الدخول من الإعدادات ← حسابي.
      </Card>
    );
  }

  const pct = progress?.pages ? Math.round((progress.page / progress.pages) * 100) : 0;

  return (
    <Card tone="white" className="p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <CloudUpload size={16} className="text-accent" /> نشر كتاب في المتجر
      </div>
      <p className="mb-3 text-[11px] leading-5 text-ink-muted">
        يحوّل كل صفحة إلى صورة ويستخرج نصها ثم يرفعها إلى تخزين خاص. ملف PDF نفسه لا يُرفع إطلاقًا، فلا يوجد ملف يمكن للقارئ تنزيله.
      </p>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        if (f && !title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
      }} />
      <Button tone="light" className="w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload size={16} /> {file ? `${file.name} (${formatBytes(file.size)})` : "اختيار ملف PDF"}
      </Button>

      <label className="mb-1 mt-4 block text-xs font-semibold">العنوان</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" />
      <label className="mb-1 mt-3 block text-xs font-semibold">المؤلف</label>
      <input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" />
      <label className="mb-1 mt-3 block text-xs font-semibold">الوصف</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-3xl bg-cream-soft px-4 py-3 text-sm outline-none" />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold">السعر بالدرهم</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" dir="ltr" className="h-11 w-full rounded-full bg-cream-soft px-4 text-center text-sm outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">صفحات المعاينة</label>
          <input value={preview} onChange={(e) => setPreview(e.target.value)} inputMode="numeric" dir="ltr" className="h-11 w-full rounded-full bg-cream-soft px-4 text-center text-sm outline-none" />
        </div>
      </div>

      <label className="mb-1 mt-3 block text-xs font-semibold">الوسوم</label>
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="شعر، أدب" className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" />

      <label className="mt-4 flex items-center justify-between rounded-2xl bg-cream-soft px-4 py-3 text-xs">
        <span>مشمول بالاشتراك الشهري</span>
        <Toggle checked={inSub} onChange={setInSub} label="مشمول بالاشتراك" />
      </label>

      <Button tone="accent" className="mt-4 w-full" onClick={run} disabled={!file || busy}>
        <CloudUpload size={16} />
        {busy ? (progress?.stage === "pages" ? `رفع الصفحات ${pct}%` : "جارٍ التحضير…") : "نشر في المتجر"}
      </Button>
      {result && <p className={cn("mt-3 text-xs leading-6", result.ok ? "text-green-700" : "text-red-600")}>{result.text}</p>}
    </Card>
  );
}

function PublishManager({ auth }: { auth: AuthState }) {
  const [target, setTarget] = useState<PublishTarget>(loadTarget);
  const [showTok, setShowTok] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<PublishTarget>) =>
    setTarget((t) => {
      const next = { ...t, ...p };
      saveTarget(next);
      return next;
    });

  async function run() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await publishBook(
        target,
        file,
        {
          title: title.trim() || file.name.replace(/\.pdf$/i, ""),
          author: author.trim(),
          tags: tags
            .split(/[،,]/)
            .map((t) => t.trim())
            .filter(Boolean),
        },
        setStage,
      );
      setResult({ ok: true, text: `تم النشر. سيظهر الكتاب لجميع المستخدمين بعد اكتمال نشر GitHub Pages (دقيقة أو دقيقتين): ${r.url}` });
      setFile(null);
      setTitle("");
      setAuthor("");
      setTags("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "فشل النشر" });
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="space-y-3">
      <StorePublisher auth={auth} />

      <Card tone="dark" className="p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CloudUpload size={16} className="text-accent" /> نشر عبر مستودع GitHub (الطريقة القديمة)
        </div>
        <p className="text-[11px] leading-5 text-cream/60">
          يرفع ملف PDF إلى مجلد <code dir="ltr">public/library/</code> في مستودع GitHub ويضيفه إلى الفهرس العام تلقائيًا. يحتاج رمز وصول (Personal Access Token) بصلاحية <b>Contents: Read and write</b> على المستودع. الرمز يُحفظ على هذا الجهاز فقط.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input value={target.owner} onChange={(e) => patch({ owner: e.target.value.trim() })} dir="ltr" placeholder="owner" className="h-10 min-w-0 rounded-full bg-cream/10 px-3 text-center text-xs text-cream outline-none" />
          <input value={target.repo} onChange={(e) => patch({ repo: e.target.value.trim() })} dir="ltr" placeholder="repo" className="h-10 min-w-0 rounded-full bg-cream/10 px-3 text-center text-xs text-cream outline-none" />
          <input value={target.branch} onChange={(e) => patch({ branch: e.target.value.trim() })} dir="ltr" placeholder="branch" className="h-10 min-w-0 rounded-full bg-cream/10 px-3 text-center text-xs text-cream outline-none" />
        </div>
        <div className="mt-2 flex h-11 items-center rounded-full bg-cream/10 px-4">
          <input type={showTok ? "text" : "password"} value={target.token} onChange={(e) => patch({ token: e.target.value.trim() })} dir="ltr" placeholder="github_pat_… / ghp_…" autoComplete="off" spellCheck={false} className="h-full min-w-0 flex-1 bg-transparent text-xs text-cream outline-none placeholder:text-cream/30" />
          <button onClick={() => setShowTok((v) => !v)} className="text-cream/60" aria-label="إظهار الرمز">
            {showTok ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Card>

      <Card tone="white" className="p-5">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ")); }} />
        <Button tone="light" className="w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={16} /> {file ? `${file.name} (${formatBytes(file.size)})` : "اختيار ملف PDF"}
        </Button>
        <label className="mb-1 mt-4 block text-xs font-semibold">العنوان</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" />
        <label className="mb-1 mt-3 block text-xs font-semibold">المؤلف</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" />
        <label className="mb-1 mt-3 block text-xs font-semibold">الوسوم (مفصولة بفاصلة)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="برمجة، خوارزميات" className="h-11 w-full rounded-full bg-cream-soft px-4 text-sm outline-none" />
        <Button tone="accent" className="mt-4 w-full" onClick={run} disabled={!file || !target.token || busy}>
          <CloudUpload size={16} /> {busy ? stage || "جارٍ النشر…" : "نشر الكتاب"}
        </Button>
        {result && <p className={cn("mt-3 break-all text-xs leading-5", result.ok ? "text-green-700" : "text-red-600")}>{result.text}</p>}
      </Card>

      <Card tone="light" className="p-4 text-[11px] leading-6 text-ink-muted">
        <p className="font-semibold text-ink">كيف تحصل على رمز الوصول؟</p>
        GitHub ← Settings ← Developer settings ← Personal access tokens ← Fine-grained tokens ← Generate. اختر المستودع <code dir="ltr">ideashelf</code> وامنح صلاحية Contents: Read and write.
      </Card>
    </div>
  );
}

/* ---------------- Books manager ---------------- */
function BooksManager({ books }: { books: Book[] }) {
  const [editing, setEditing] = useState<Book | null>(null);
  const [redoing, setRedoing] = useState<string | null>(null);

  async function reextract(b: Book) {
    setRedoing(b.id);
    try {
      const doc = await openPdf(b.file);
      await extractBookText(doc, b.id);
      await doc.destroy();
    } catch {
      /* the book row keeps its old version and can be retried */
    } finally {
      setRedoing(null);
    }
  }

  if (books.length === 0) return <p className="py-10 text-center text-xs text-ink-muted">لا توجد كتب.</p>;
  return (
    <div className="space-y-2">
      {books.map((b) => (
        <Card key={b.id} tone="white" className="flex items-center gap-3 p-3">
          <span className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-cream-soft">{b.cover && <img src={b.cover} alt="" className="h-full w-full object-cover" />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{b.title}</span>
            <span className="block truncate text-[11px] text-ink-muted">
              {b.author || "بدون مؤلف"} · {b.pages} صفحة · {formatBytes(b.size)}
              {b.tags.length > 0 && ` · ${b.tags.join("، ")}`}
            </span>
          </span>
          <IconButton tone="light" size="sm" onClick={() => db.books.update(b.id, { favorite: !b.favorite })} aria-label="مفضلة">
            <Heart size={14} fill={b.favorite ? "currentColor" : "none"} className={b.favorite ? "text-accent" : ""} />
          </IconButton>
          <IconButton
            tone="light"
            size="sm"
            onClick={() => void reextract(b)}
            disabled={redoing === b.id}
            aria-label="إعادة استخراج النص"
            title="إعادة استخراج النص"
            className={b.textVersion === TEXT_VERSION ? "" : "text-accent"}
          >
            <FileText size={14} className={redoing === b.id ? "animate-pulse" : ""} />
          </IconButton>
          <IconButton tone="light" size="sm" onClick={() => setEditing(b)} aria-label="تعديل">
            <Pencil size={14} />
          </IconButton>
          <IconButton
            tone="light"
            size="sm"
            onClick={() => {
              if (confirm(`حذف "${b.title}"؟`)) void deleteBook(b.id);
            }}
            aria-label="حذف"
            className="text-red-600"
          >
            <Trash2 size={14} />
          </IconButton>
        </Card>
      ))}
      {editing && <EditSheet book={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditSheet({ book, onClose }: { book: Book; onClose: () => void }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [tags, setTags] = useState(book.tags.join("، "));
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-4xl bg-cream p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">تعديل الكتاب</h2>
          <IconButton tone="light" size="sm" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </IconButton>
        </div>
        <label className="mb-1 block text-xs font-semibold">العنوان</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-3 h-11 w-full rounded-full bg-white px-4 text-sm outline-none" />
        <label className="mb-1 block text-xs font-semibold">المؤلف</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mb-3 h-11 w-full rounded-full bg-white px-4 text-sm outline-none" />
        <label className="mb-1 block text-xs font-semibold">الوسوم (مفصولة بفاصلة)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className="mb-4 h-11 w-full rounded-full bg-white px-4 text-sm outline-none" placeholder="برمجة، خوارزميات" />
        <Button
          tone="dark"
          className="w-full"
          onClick={async () => {
            await db.books.update(book.id, {
              title: title.trim() || book.title,
              author: author.trim(),
              tags: tags
                .split(/[،,]/)
                .map((t) => t.trim())
                .filter(Boolean),
            });
            onClose();
          }}
        >
          <Save size={16} /> حفظ
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Remote catalog ---------------- */
function CatalogManager({ settings, update, books }: { settings: Settings; update: (p: Partial<Settings>) => void; books: Book[] }) {
  const [url, setUrl] = useState(settings.catalogUrl);
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState<Record<string, number | "done" | "error">>({});

  async function load() {
    setBusy(true);
    setErr("");
    try {
      update({ catalogUrl: url });
      setEntries(await fetchCatalog(url));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل الجلب");
    } finally {
      setBusy(false);
    }
  }

  async function grab(e: CatalogEntry) {
    setDl((d) => ({ ...d, [e.id]: 0 }));
    try {
      await downloadCatalogBook(e, (pct) => setDl((d) => ({ ...d, [e.id]: pct })));
      setDl((d) => ({ ...d, [e.id]: "done" }));
    } catch {
      setDl((d) => ({ ...d, [e.id]: "error" }));
    }
  }

  return (
    <div className="space-y-3">
      <Card tone="white" className="p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Globe size={16} className="text-accent" /> فهرس الكتب العام
        </div>
        <p className="mb-3 text-[11px] leading-5 text-ink-muted">
          ملف JSON يحتوي قائمة كتب بروابط PDF (مثل <code dir="ltr">public/catalog.json</code> في المستودع). يمكن للمستخدمين تنزيل الكتب منه إلى مكتبتهم.
        </p>
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" className="h-11 min-w-0 flex-1 rounded-full bg-cream-soft px-4 text-sm outline-none" />
          <Button tone="dark" className="h-11 px-4" onClick={load} disabled={busy}>
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> جلب
          </Button>
        </div>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </Card>
      {entries && entries.length === 0 && <p className="py-6 text-center text-xs text-ink-muted">الفهرس فارغ. أضف كتبًا إلى ملف catalog.json.</p>}
      {entries?.map((e) => {
        const have = books.some((b) => b.title === e.title);
        const st = dl[e.id];
        return (
          <Card key={e.id} tone="white" className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{e.title}</span>
              <span className="block truncate text-[11px] text-ink-muted">{e.author || e.description || e.url}</span>
            </span>
            {have || st === "done" ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] text-green-800">في المكتبة</span>
            ) : typeof st === "number" ? (
              <span className="text-xs">{st}%</span>
            ) : (
              <Button tone="accent" className="h-9 px-3 text-xs" onClick={() => grab(e)}>
                <Download size={14} /> تنزيل
              </Button>
            )}
            {st === "error" && <span className="text-[11px] text-red-600">فشل</span>}
          </Card>
        );
      })}
      <Card tone="light" className="p-4 text-[11px] leading-6 text-ink-muted">
        <p className="mb-1 font-semibold text-ink">صيغة الفهرس:</p>
        <pre dir="ltr" className="overflow-x-auto rounded-xl bg-ink p-3 text-[10px] text-cream">{`{
  "books": [
    { "id": "clean-code", "title": "Clean Code", "author": "Robert C. Martin",
      "url": "./library/clean-code.pdf", "tags": ["برمجة"] }
  ]
}`}</pre>
        <p className="mt-2">ارفع ملفات PDF إلى مجلد <code dir="ltr">public/library/</code> في المستودع وأضف مدخلاتها هنا، وستظهر لجميع المستخدمين بعد النشر.</p>
      </Card>
    </div>
  );
}

/* ---------------- Backup ---------------- */
function BackupManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  async function doExport() {
    const blob = await exportBackup();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dcl-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function doImport(f: File | undefined) {
    if (!f) return;
    try {
      const r = await importBackup(f);
      setMsg(`تمت الاستعادة: ${r.analyses} نتيجة، ${r.chats} رسالة، ${r.sessions} جلسة قراءة.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "فشل الاستيراد");
    }
  }

  return (
    <div className="space-y-3">
      <Card tone="white" className="p-5">
        <p className="mb-1 text-sm font-semibold">تصدير النسخة الاحتياطية</p>
        <p className="mb-3 text-[11px] leading-5 text-ink-muted">يصدّر بيانات الكتب (بدون ملفات PDF نفسها)، ونتائج الذكاء الاصطناعي، والمحادثات، وسجل القراءة كملف JSON.</p>
        <Button tone="dark" className="w-full" onClick={doExport}>
          <Download size={16} /> تصدير JSON
        </Button>
      </Card>
      <Card tone="white" className="p-5">
        <p className="mb-1 text-sm font-semibold">استعادة نسخة احتياطية</p>
        <p className="mb-3 text-[11px] leading-5 text-ink-muted">يُطابق الكتب بالمعرّف ثم بالعنوان، ويعيد النتائج والمحادثات والإحصاءات إليها.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
        <Button tone="light" className="w-full" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> اختيار ملف JSON
        </Button>
        {msg && <p className="mt-3 text-xs">{msg}</p>}
      </Card>
      <Card tone="white" className="border border-red-200 p-5">
        <p className="mb-1 text-sm font-semibold text-red-700">منطقة الخطر</p>
        <p className="mb-3 text-[11px] leading-5 text-ink-muted">حذف كل الكتب والنتائج والمحادثات من هذا الجهاز. لا يمكن التراجع.</p>
        <Button
          tone="outline"
          className="w-full border-red-300 text-red-700"
          onClick={async () => {
            if (confirm("حذف كل البيانات نهائيًا؟") && confirm("متأكد؟ سيتم مسح المكتبة كاملة.")) {
              await wipeAll();
              setMsg("تم مسح كل البيانات.");
            }
          }}
        >
          <Trash2 size={16} /> مسح كل البيانات
        </Button>
      </Card>
    </div>
  );
}
