import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpLeft, ChevronLeft, FileText, MessageSquare, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import type { Route } from "@/App";
import { Card } from "@/components/ui";
import { UploadButton } from "@/components/UploadButton";
import { formatDuration, greeting, relativeTime } from "@/lib/utils";

export function HomeScreen({ settings, navigate }: { settings: Settings; navigate: (r: Route) => void }) {
  const books = useLiveQuery(() => db.books.orderBy("lastOpenedAt").reverse().toArray(), []) ?? [];
  const analyses = useLiveQuery(() => db.analyses.toArray(), []) ?? [];
  const chats = useLiveQuery(() => db.chats.filter((c) => c.role === "user").count(), []) ?? 0;
  const recent = books.filter((b) => b.lastOpenedAt > 0).slice(0, 3);
  const totalSeconds = books.reduce((a, b) => a + b.readingSeconds, 0);
  const pagesRead = books.reduce((a, b) => a + (b.lastPage > 1 ? b.lastPage - 1 : 0), 0);
  const summaries = analyses.filter((a) => a.kind === "summary").length;
  const deepAnalyses = analyses.filter((a) => a.kind === "analysis").length;
  const quizzes = analyses.filter((a) => a.kind === "quiz").length;
  const initial = (settings.userName || "م").slice(0, 1);

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      {/* Dark header */}
      <section className="relative overflow-hidden bg-ink px-6 pb-8 pt-6 text-cream md:rounded-t-4xl">
        <div className="absolute -end-10 top-10 h-52 w-52 rotate-12 rounded-[2.5rem] bg-cream/5" />
        <div className="relative flex items-start justify-between">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream text-xl font-bold text-ink">{initial}</div>
            <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Pro</span>
          </div>
          <button onClick={() => navigate({ name: "settings" })} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <Sparkles size={18} />
            {!settings.apiKey && <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink bg-accent" />}
          </button>
        </div>
        <h1 className="relative mt-6 text-3xl font-bold">
          {greeting()}{settings.userName ? `، ${settings.userName}` : ""}
        </h1>
        <p className="relative mt-1 text-sm text-cream/60">اقرأ وحلّل مكتبتك بالذكاء الاصطناعي</p>

        {/* Continue reading */}
        <div className="relative mt-6 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6">
          {recent.length === 0 ? (
            <Card tone="light" className="w-full p-5">
              <p className="mb-3 text-sm font-medium text-ink">مكتبتك فارغة. ابدأ برفع أول كتاب.</p>
              <UploadButton onDone={() => navigate({ name: "library" })} className="w-full" />
            </Card>
          ) : (
            recent.map((b) => {
              const pct = Math.round(((b.lastPage - 1) / Math.max(1, b.pages - 1)) * 100);
              return (
                <button
                  key={b.id}
                  onClick={() => navigate({ name: "reader", bookId: b.id })}
                  className="relative h-56 w-[80%] shrink-0 overflow-hidden rounded-3xl bg-cream-deep text-start sm:w-72"
                >
                  {b.cover && <img src={b.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
                  <div className="absolute inset-x-4 top-4 flex items-start justify-between">
                    <div className="flex flex-col gap-1.5">
                      <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] backdrop-blur">
                        <FileText size={11} className="inline me-1" />
                        {b.pages} صفحة
                      </span>
                      <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] backdrop-blur">
                        <Zap size={11} className="inline me-1" />
                        {pct}%
                      </span>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink">
                      <ArrowUpLeft size={16} />
                    </span>
                  </div>
                  <div className="absolute inset-x-4 bottom-4">
                    <p className="line-clamp-1 text-lg font-semibold text-cream">{b.title}</p>
                    <p className="text-xs text-cream/60">{relativeTime(b.lastOpenedAt)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="space-y-3 p-4 pb-8">
        <Card tone="dark" onClick={() => navigate({ name: "insights" })} className="flex w-full items-center gap-4 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-accent">
            <Zap size={18} />
          </span>
          <div className="flex-1">
            <p className="text-2xl font-bold leading-none">
              {pagesRead}
              <span className="ms-1 text-xs font-normal text-cream/60">صفحة مقروءة</span>
            </p>
            <p className="mt-1 text-xs text-cream/50">وقت القراءة الإجمالي {formatDuration(totalSeconds)}</p>
          </div>
          <ChevronLeft size={18} className="text-cream/60" />
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Tile n={books.length} label="الكتب" sub="المكتبة" onClick={() => navigate({ name: "library" })} icon={<FileText size={16} />} />
          <Tile n={summaries} label="تلخيص" sub="بالذكاء الاصطناعي" icon={<Sparkles size={16} />} onClick={() => navigate({ name: "library" })} />
          <Tile n={deepAnalyses} label="تحليل" sub="عميق" icon={<Zap size={16} />} onClick={() => navigate({ name: "library" })} />
          <Tile n={chats + quizzes} label="سؤال واختبار" sub="محادثات مع الكتب" icon={<MessageSquare size={16} />} onClick={() => navigate({ name: "library" })} />
        </div>
      </section>
    </div>
  );
}

function Tile({ n, label, sub, icon, onClick }: { n: number; label: string; sub: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <Card tone="white" onClick={onClick} className="flex h-36 flex-col justify-between p-4">
      <div>
        <p className="text-3xl font-bold leading-none">
          {n} <span className="text-xs font-normal text-ink-muted">{label}</span>
        </p>
        <p className="mt-1 text-xs text-ink-muted">{sub}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-soft text-ink">{icon}</span>
        <span className="relative h-6 w-11 rounded-full bg-cream-soft">
          <span className="absolute end-1 top-1 h-4 w-4 rounded-full bg-accent" />
        </span>
      </div>
    </Card>
  );
}
