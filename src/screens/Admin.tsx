import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Database, Download, Globe, Heart, Lock, Pencil, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { db, deleteBook, type Book } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import { clearPin, downloadCatalogBook, exportBackup, fetchCatalog, hasPin, importBackup, setPin, storageEstimate, verifyPin, wipeAll, type CatalogEntry } from "@/lib/admin";
import { UploadButton, type UploadState } from "@/components/UploadButton";
import { Button, Card, IconButton } from "@/components/ui";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

export function AdminScreen({ settings, update, onBack }: { settings: Settings; update: (p: Partial<Settings>) => void; onBack: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} onBack={onBack} />;
  return <Dashboard settings={settings} update={update} onBack={onBack} />;
}

/* ---------------- PIN gate ---------------- */
function PinGate({ onUnlock, onBack }: { onUnlock: () => void; onBack: () => void }) {
  const setup = !hasPin();
  const [pin, setPinVal] = useState("");
  const [confirmPin, setConfirm] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    if (pin.length < 4) return setErr("الرمز يجب أن يكون 4 أرقام على الأقل");
    if (setup) {
      if (pin !== confirmPin) return setErr("الرمزان غير متطابقين");
      await setPin(pin);
      onUnlock();
      return;
    }
    if (await verifyPin(pin)) onUnlock();
    else setErr("رمز غير صحيح");
  }

  return (
    <div className="flex h-full flex-col bg-ink text-cream">
      <header className="flex items-center px-4 pt-4">
        <IconButton tone="ghost" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white">
          <Lock size={26} />
        </span>
        <h1 className="text-2xl font-bold">{setup ? "أنشئ رمز المشرف" : "لوحة تحكم المشرف"}</h1>
        <p className="mt-2 text-xs text-cream/60">{setup ? "هذا الرمز يحمي لوحة الإدارة على هذا الجهاز." : "أدخل رمز المشرف للمتابعة."}</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPinVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••"
          className="mt-6 h-14 w-full max-w-xs rounded-full bg-cream/10 text-center text-2xl tracking-[0.5em] text-cream outline-none"
        />
        {setup && (
          <input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="تأكيد الرمز" className="mt-3 h-14 w-full max-w-xs rounded-full bg-cream/10 text-center text-lg text-cream outline-none" />
        )}
        {err && <p className="mt-3 text-xs text-accent">{err}</p>}
        <Button tone="accent" className="mt-6 w-full max-w-xs" onClick={submit}>
          {setup ? "حفظ ودخول" : "دخول"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
type Tab = "overview" | "books" | "catalog" | "backup";

function Dashboard({ settings, update, onBack }: { settings: Settings; update: (p: Partial<Settings>) => void; onBack: () => void }) {
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
      <header className="flex items-center gap-3 px-4 pt-4">
        <IconButton tone="light" onClick={onBack} aria-label="رجوع">
          <ChevronRight size={20} />
        </IconButton>
        <div className="flex-1">
          <h1 className="text-xl font-bold">لوحة تحكم المشرف</h1>
          <p className="text-[11px] text-ink-muted">إدارة التطبيق والمكتبة</p>
        </div>
        <button
          onClick={() => {
            if (confirm("إزالة رمز المشرف؟ سيُطلب إنشاء رمز جديد عند الدخول التالي.")) {
              clearPin();
              onBack();
            }
          }}
          className="rounded-full bg-white px-3 py-1.5 text-[11px]"
        >
          تغيير الرمز
        </button>
      </header>

      <div className="flex gap-1.5 overflow-x-auto px-4 pt-4 no-scrollbar">
        {(
          [
            ["overview", "نظرة عامة"],
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

/* ---------------- Books manager ---------------- */
function BooksManager({ books }: { books: Book[] }) {
  const [editing, setEditing] = useState<Book | null>(null);
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
