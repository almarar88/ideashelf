import { useMemo, useState } from "react";
import { CornerDownLeft, EyeOff, Info, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { Meter } from "@/components/ui/Meter";
import { Pill } from "@/components/ui/Pill";
import { askPost, gate, type Answer } from "@/lib/engine";
import type { Post } from "@/lib/types";

type Tab = "text" | "sources" | "ask" | "talk";

const TABS: { id: Tab; label: string }[] = [
  { id: "text", label: "النص" },
  { id: "sources", label: "الهوامش" },
  { id: "ask", label: "محاورة" },
  { id: "talk", label: "النقاش" },
];

export function PostDepth({ post, initialTab = "text" }: { post: Post; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: Answer }[]>([]);
  const [showNoise, setShowNoise] = useState(false);
  const { signal, noise } = useMemo(() => gate(post.comments), [post.comments]);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setAnswers((prev) => [...prev, { q: trimmed, a: askPost(post, trimmed) }]);
    setQuestion("");
  };

  return (
    <div className="space-y-4 pb-2">
      <MediaCanvas colors={post.media} className="h-40 w-full" label={post.title} />

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map((t) => (
          <Pill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Pill>
        ))}
      </div>

      {tab === "text" && (
        <div className="depth-enter space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">{post.lede}</p>
          {post.body.map((p, i) => (
            <p key={i} className="font-serif text-[15px] leading-[2] text-ink">
              {p}
            </p>
          ))}
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <ShieldCheck size={15} className="text-mint" />
              سجل الأصل الرقمي · C2PA
            </div>
            <Meter value={post.humanShare} label="مساهمة المؤلف" tone="iris" />
            <Meter
              value={post.aiShare}
              label="مساهمة الذكاء الاصطناعي"
              tone="rose"
              hint="النسبة مدمجة في ملف الوسيط نفسه، وتظل معه عند إعادة النشر خارج التطبيق."
            />
          </div>
          <dl className="card divide-y divide-[rgb(var(--line)/.6)] p-1">
            {Object.entries(post.meta).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <dt className="shrink-0 text-[12px] text-muted">{k}</dt>
                <dd className="text-left text-[12.5px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === "sources" && (
        <div className="depth-enter space-y-2.5">
          {post.sources.map((s, i) => (
            <div key={i} className="card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold">{s.label}</span>
                <span className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-muted">
                  {s.confidence}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{s.detail}</p>
            </div>
          ))}
          <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted">
            <Info size={13} className="mt-0.5 shrink-0" />
            الهوامش يكتبها المؤلف ويثبّتها المحرر المرجعي؛ ما لا مصدر له يُعرض كتقدير صريح لا كحقيقة.
          </p>
        </div>
      )}

      {tab === "ask" && (
        <div className="depth-enter space-y-3">
          <p className="text-[12.5px] leading-relaxed text-muted">
            هذا المنشور كيان معرفي مستقل. يجيب من بياناته الوصفية ومصادره فقط، ويقول
            «لا أعرف» حين لا يجد سنداً.
          </p>
          <div className="flex flex-wrap gap-2">
            {["ما الدليل؟", "أي كاميرا؟", "نسبة الذكاء الاصطناعي؟", "أين صُوّر؟"].map((q) => (
              <Pill key={q} onClick={() => ask(q)}>
                {q}
              </Pill>
            ))}
          </div>
          <div className="space-y-2.5">
            {answers.map((item, i) => (
              <div key={i} className="space-y-1.5">
                <p className="mr-auto w-fit max-w-[85%] rounded-xl2 bg-iris/15 px-3.5 py-2 text-[13px]">
                  {item.q}
                </p>
                <div className="w-fit max-w-[92%] rounded-xl2 bg-raised px-3.5 py-2.5">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed">
                    {item.a.text}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted">
                    <Sparkles size={11} />
                    السند: {item.a.basis}
                    {!item.a.grounded && " — لم يُخمّن المحرك"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="flex items-center gap-2 rounded-full bg-raised px-3 py-1.5"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اسأل عن أي تفصيلة في هذا المنشور…"
              className="flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="إرسال"
              className="grid h-8 w-8 place-items-center rounded-full bg-surface text-iris"
            >
              <CornerDownLeft size={15} />
            </button>
          </form>
        </div>
      )}

      {tab === "talk" && (
        <div className="depth-enter space-y-3">
          <p className="text-[12px] leading-relaxed text-muted">
            غربال الحوار يرتّب النقاش بدرجة الإثراء المعرفي لا بزمن النشر. الردود
            العابرة لا تُحذف، بل تُعزل.
          </p>
          {signal.map((c) => (
            <div key={c.id} className="card p-3.5">
              <div className="flex items-center gap-2">
                <Avatar person={c.author} size="sm" />
                <span className="text-[13px] font-semibold">{c.author.name}</span>
                <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] text-muted">
                  {c.kind}
                </span>
                <span className="mr-auto text-[10.5px] tabular-nums text-mint">
                  إشارة {c.signal}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed">{c.text}</p>
              <p className="mt-1.5 text-[10.5px] text-muted">{c.at}</p>
            </div>
          ))}

          {noise.length > 0 && (
            <div className="rounded-xl2 border border-dashed hairline p-3">
              <button
                type="button"
                onClick={() => setShowNoise((v) => !v)}
                className="flex w-full items-center gap-2 text-[12px] text-muted"
              >
                <EyeOff size={14} />
                صندوق معزول — {noise.length} رد لا يضيف إلى النقاش
                <span className="mr-auto text-iris">{showNoise ? "إخفاء" : "عرض"}</span>
              </button>
              {showNoise && (
                <div className="mt-2.5 space-y-2">
                  {noise.map((c) => (
                    <p key={c.id} className="text-[12px] text-muted">
                      <span className="font-medium">{c.author.name}:</span> {c.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
