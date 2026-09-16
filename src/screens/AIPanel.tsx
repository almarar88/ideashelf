import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight, Copy, Send, Square, Trash2 } from "lucide-react";
import { db, uid, type Analysis, type Book } from "@/lib/db";
import { looksScanned } from "@/lib/pdf";
import { chatWithBook, describeError, runTask, scopeLabel, type Scope, type TaskKind } from "@/lib/ai";
import type { Settings } from "@/lib/settings";
import { Markdown } from "@/components/Markdown";
import { Button, IconButton, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Mode = TaskKind | "chat";

const MODE_META: Record<Mode, { title: string; hint: string }> = {
  summary: { title: "تلخيص", hint: "ملخص منظم بالأفكار الرئيسية وأهم ما يُستفاد" },
  analysis: { title: "تحليل عميق", hint: "الأطروحة، الحجج، المفاهيم، نقاط القوة والضعف" },
  explain: { title: "شرح مبسط", hint: "شرح للمبتدئين خطوة بخطوة" },
  quiz: { title: "اختبار", hint: "8 أسئلة لقياس الفهم مع الإجابات" },
  chat: { title: "اسأل الكتاب", hint: "محادثة مبنية على نص الكتاب مع ذكر الصفحات" },
};

export function AIPanel({
  book,
  page,
  mode,
  setMode,
  settings,
  onClose,
}: {
  book: Book;
  page: number;
  mode: Mode;
  setMode: (m: Mode) => void;
  settings: Settings;
  onClose?: () => void;
}) {
  const [scopeKind, setScopeKind] = useState<Scope["kind"]>("page");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(book.pages, 10));
  const scope: Scope = scopeKind === "page" ? { kind: "page", page } : scopeKind === "range" ? { kind: "range", from, to } : { kind: "book" };

  const analyses = useLiveQuery(() => db.analyses.where("bookId").equals(book.id).reverse().sortBy("createdAt"), [book.id]) ?? [];
  const bookText = useLiveQuery(async () => {
    const rows = await db.pageTexts.where("bookId").equals(book.id).toArray();
    return rows.map((r) => r.text).join("");
  }, [book.id]);
  const scanned = book.textExtracted && bookText !== undefined && looksScanned(bookText, book.pages);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extra, setExtra] = useState("");
  const [showSaved, setShowSaved] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    if (mode === "chat" || busy) return;
    setBusy(true);
    setError("");
    setOutput("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const text = await runTask(book, scope, mode, { signal: ac.signal, onDelta: (_, full) => setOutput(full) }, extra.trim() || undefined);
      const a: Analysis = {
        id: uid(),
        bookId: book.id,
        kind: mode,
        title: MODE_META[mode].title,
        scope: scopeLabel(scope),
        content: text,
        createdAt: Date.now(),
        model: settings.model,
      };
      await db.analyses.add(a);
      setOutput("");
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) setError(describeError(err));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const scopeChips = (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          ["page", `هذه الصفحة (${page})`],
          ["range", "نطاق صفحات"],
          ["book", "الكتاب كاملاً"],
        ] as [Scope["kind"], string][]
      ).map(([k, label]) => (
        <button key={k} onClick={() => setScopeKind(k)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition", scopeKind === k ? "bg-ink text-cream" : "bg-white text-ink")}>
          {label}
        </button>
      ))}
      {scopeKind === "range" && (
        <span className="flex items-center gap-1 text-xs">
          من
          <input type="number" min={1} max={book.pages} value={from} onChange={(e) => setFrom(Math.max(1, Math.min(book.pages, +e.target.value || 1)))} className="h-8 w-16 rounded-full bg-white px-2 text-center outline-none" />
          إلى
          <input type="number" min={1} max={book.pages} value={to} onChange={(e) => setTo(Math.max(from, Math.min(book.pages, +e.target.value || from)))} className="h-8 w-16 rounded-full bg-white px-2 text-center outline-none" />
        </span>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-cream text-ink">
      <header className="flex items-center gap-3 px-4 pb-2" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        {onClose && (
          <IconButton tone="light" onClick={onClose} aria-label="العودة للقراءة">
            <ChevronRight size={20} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="text-[11px] text-ink-muted">{MODE_META[mode].hint}</p>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 no-scrollbar">
        {(Object.keys(MODE_META) as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition", mode === m ? "bg-accent text-white" : "bg-white text-ink")}>
            {MODE_META[m].title}
          </button>
        ))}
      </div>

      {scanned && (
        <div className="mx-4 mb-3 rounded-2xl bg-amber-100 px-4 py-3 text-xs leading-6 text-amber-900">
          هذا الملف يبدو مصورًا (صفحات ممسوحة ضوئيًا بلا نص قابل للقراءة)، لذلك لن يتمكن الذكاء الاصطناعي من تحليله. يحتاج الملف إلى معالجة OCR أولاً.
        </div>
      )}

      {!settings.apiKey && (
        <div className="mx-4 mb-3 rounded-2xl bg-accent/15 px-4 py-3 text-xs leading-6 text-ink">
          لم يتم إعداد مفتاح Anthropic API بعد. افتح <b>الإعدادات</b> وأضف المفتاح لتفعيل التلخيص والتحليل.
        </div>
      )}

      {mode === "chat" ? (
        <ChatView book={book} scope={scope} scopeChips={scopeChips} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 px-4">
            {scopeChips}
            <div className="flex gap-2">
              <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="توجيه اختياري: ركّز على… / اجعله أقصر…" className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm outline-none" />
              {busy ? (
                <Button tone="dark" onClick={() => abortRef.current?.abort()} className="px-4">
                  <Square size={14} /> إيقاف
                </Button>
              ) : (
                <Button tone="accent" onClick={generate} className="px-5">
                  توليد
                </Button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 no-scrollbar">
            {error && <div className="mb-3 rounded-2xl bg-red-100 px-4 py-3 text-xs text-red-800">{error}</div>}
            {(busy || output) && (
              <div className="rise mb-3 rounded-3xl bg-white p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 text-[11px] text-ink-muted">
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent-deep">{MODE_META[mode].title}</span>
                  <span>{scopeLabel(scope)}</span>
                  {busy && <Spinner className="ms-auto text-accent" />}
                </div>
                {output ? <Markdown text={output} /> : <p className="text-xs text-ink-muted">يقرأ النموذج النص…</p>}
              </div>
            )}

            <button onClick={() => setShowSaved((v) => !v)} className="mb-2 flex w-full items-center justify-between text-xs font-semibold text-ink-muted">
              <span>النتائج المحفوظة ({analyses.length})</span>
              <ChevronDown size={14} className={cn("transition", !showSaved && "-rotate-90")} />
            </button>
            {showSaved && analyses.length === 0 && !busy && !output && (
              <div className="rounded-3xl bg-white p-6 text-center text-xs leading-6 text-ink-muted">
                اختر النطاق ثم اضغط <b>توليد</b> لإنشاء {MODE_META[mode].title} بالذكاء الاصطناعي. تُحفظ النتائج هنا تلقائيًا لتعود إليها بلا إنترنت.
              </div>
            )}
            {showSaved && analyses.map((a) => <SavedCard key={a.id} a={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SavedCard({ a }: { a: Analysis }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rise mb-2 overflow-hidden rounded-3xl bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-start">
        <span className="rounded-full bg-cream-soft px-2 py-0.5 text-[11px] font-semibold">{a.title}</span>
        <span className="text-[11px] text-ink-muted">{a.scope}</span>
        <span className="ms-auto text-[10px] text-ink-muted">{new Date(a.createdAt).toLocaleDateString("ar")}</span>
        <ChevronDown size={14} className={cn("transition", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="border-t border-black/5 px-4 pb-4 pt-2 text-sm">
          <Markdown text={a.content} />
          <div className="mt-3 flex gap-2">
            <button onClick={() => navigator.clipboard?.writeText(a.content)} className="flex items-center gap-1 rounded-full bg-cream-soft px-3 py-1.5 text-xs">
              <Copy size={12} /> نسخ
            </button>
            <button
              onClick={() => {
                if (confirm("حذف هذه النتيجة؟")) void db.analyses.delete(a.id);
              }}
              className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs text-red-700"
            >
              <Trash2 size={12} /> حذف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatView({ book, scope, scopeChips }: { book: Book; scope: Scope; scopeChips: React.ReactNode }) {
  const messages = useLiveQuery(() => db.chats.where("bookId").equals(book.id).sortBy("createdAt"), [book.id]) ?? [];
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, draft]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setError("");
    setBusy(true);
    await db.chats.add({ id: uid(), bookId: book.id, role: "user", content: question, createdAt: Date.now() });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const answer = await chatWithBook(book, scope, history, question, { signal: ac.signal, onDelta: (_, full) => setDraft(full) });
      await db.chats.add({ id: uid(), bookId: book.id, role: "assistant", content: answer, createdAt: Date.now() });
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) setError(describeError(err));
    } finally {
      setDraft("");
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4">
        <div className="flex-1">{scopeChips}</div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              if (confirm("مسح المحادثة؟")) void db.chats.where("bookId").equals(book.id).delete();
            }}
            className="shrink-0 rounded-full bg-white p-2 text-ink-muted"
            aria-label="مسح المحادثة"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
        {messages.length === 0 && !draft && (
          <div className="rounded-3xl bg-white p-6 text-center text-xs leading-6 text-ink-muted">
            اسأل أي شيء عن هذا الكتاب: "ما الفكرة الرئيسية في الفصل الثالث؟"، "اشرح المصطلح X"، "قارن بين…".
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("rise mb-2 max-w-[92%] rounded-3xl px-4 py-3 text-sm", m.role === "user" ? "ms-auto bg-ink text-cream" : "bg-white")}>
            {m.role === "user" ? <p className="whitespace-pre-wrap leading-7">{m.content}</p> : <Markdown text={m.content} />}
          </div>
        ))}
        {(busy || draft) && (
          <div className="rise mb-2 max-w-[92%] rounded-3xl bg-white px-4 py-3 text-sm">
            {draft ? <Markdown text={draft} /> : <Spinner className="text-accent" />}
          </div>
        )}
        {error && <div className="rounded-2xl bg-red-100 px-4 py-3 text-xs text-red-800">{error}</div>}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 px-4 pb-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="اكتب سؤالك…"
          className="h-12 min-w-0 flex-1 rounded-full bg-white px-5 text-sm outline-none"
        />
        {busy ? (
          <IconButton tone="dark" size="lg" onClick={() => abortRef.current?.abort()} aria-label="إيقاف">
            <Square size={16} />
          </IconButton>
        ) : (
          <IconButton tone="accent" size="lg" onClick={send} disabled={!q.trim()} aria-label="إرسال">
            <Send size={18} className="-scale-x-100" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
