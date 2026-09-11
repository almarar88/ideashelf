import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileText, Headphones, LayoutGrid, Mic, PenLine, Quote, Video } from "lucide-react";
import { SectionTitle } from "./StudioScreen";
import { Pill } from "@/components/ui/Pill";
import { Meter } from "@/components/ui/Meter";
import { cn } from "@/lib/cn";
import {
  composeProse,
  morph,
  readToneProfile,
  scanForClaims,
  type MorphKind,
} from "@/lib/engine";

const SAMPLE = `طيب يعني أنا أفكر من زمان في موضوع الهامش، اممم، الهامش في الكتب القديمة ما كان زينة، كان القارئ يحاور الكاتب على طرف الصفحة. والله شفت مخطوطة عمرها أكثر من 400 سنة في الرياض، وفيها تعليقات بخط ثلاثة قراء مختلفين. المهم، اللي يهمني أن 70% من قيمة النص القديم كانت في هوامشه لا في متنه، وهذا رقم أنا أقدره تقديراً ما هو مثبت. اليوم صار عندنا محرر يضع الهامش تلقائياً، بس السؤال يعني: هل الهامش الآلي يحمل نفس الأمانة؟ في 2024 صرنا نقرأ نصوصاً كثيرة بلا مصدر واحد، وهذا الفرق الجوهري.`;

const MORPHS: { id: MorphKind; label: string; Icon: typeof FileText }[] = [
  { id: "article", label: "مقال", Icon: FileText },
  { id: "cards", label: "بطاقات", Icon: LayoutGrid },
  { id: "script", label: "سيناريو", Icon: Video },
  { id: "audio", label: "حلقة صوتية", Icon: Headphones },
];

export function ProseScreen({
  dictating,
  onDictationEnd,
}: {
  dictating: boolean;
  onDictationEnd: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [composed, setComposed] = useState(false);
  const [shape, setShape] = useState<MorphKind>("article");
  const timer = useRef<number | null>(null);

  // محاكاة التفريغ الصوتي: النص يُكتب تدريجياً كما لو كان يُملى
  useEffect(() => {
    if (!dictating) return;
    setComposed(false);
    let i = raw.length;
    const base = raw;
    timer.current = window.setInterval(() => {
      i += 3;
      setRaw(base + SAMPLE.slice(base.length, i));
      if (i >= SAMPLE.length) {
        if (timer.current) window.clearInterval(timer.current);
        onDictationEnd();
      }
    }, 28);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictating]);

  const tone = useMemo(() => readToneProfile(raw || SAMPLE), [raw]);
  const draft = useMemo(() => composeProse(raw), [raw]);
  const claims = useMemo(() => scanForClaims(raw), [raw]);
  const shaped = useMemo(() => morph(draft, shape), [draft, shape]);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
      <SectionTitle
        title="محرك المقالات المعرفي"
        subtitle="تتكلم تسع دقائق، فيخرج نص بأسلوبك أنت — منقّى من الحشو، موثّق بالهوامش."
      />

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
            <Mic size={14} className={cn("text-rose", dictating && "animate-pulse")} />
            {dictating ? "يستمع الآن…" : "التفريغ الصوتي الخام"}
          </span>
          <span className="tabular-nums text-[11px] text-muted">
            {raw.split(/\s+/).filter(Boolean).length} كلمة
          </span>
        </div>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setComposed(false);
          }}
          rows={5}
          placeholder="اضغط زر النبض ليتحول إلى مسجّل، أو اكتب هنا مباشرة…"
          className="w-full resize-none rounded-xl2 bg-raised p-3 text-[13px] leading-relaxed outline-none placeholder:text-muted"
        />

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="إيقاع الجملة" value={`${tone.cadence} كلمة`} />
          <Stat label="نزعة الاسترسال" value={`${tone.flow}٪`} />
          <Stat label="ثراء المفردات" value={`${tone.lexicon}٪`} />
        </div>

        <button
          type="button"
          disabled={raw.trim().length < 30}
          onClick={() => setComposed(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[.98] disabled:opacity-50 disabled:shadow-none"
          style={{ background: "linear-gradient(140deg, rgb(var(--iris)), rgb(var(--rose)))" }}
        >
          <PenLine size={16} />
          صُغ المقال ببصمتي
        </button>
      </div>

      {composed && (
        <>
          <div className="depth-enter card mt-4 p-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen size={15} className="text-iris" />
              <h2 className="flex-1 text-[15px] font-semibold">{draft.title}</h2>
            </div>
            <p className="mb-3 text-[11px] text-muted">
              {draft.words} كلمة · {draft.readMinutes} دقيقة قراءة · حُذفت {draft.removed} جملة حشو
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {MORPHS.map((m) => (
                <Pill key={m.id} active={shape === m.id} onClick={() => setShape(m.id)}>
                  <m.Icon size={13} />
                  {m.label}
                </Pill>
              ))}
            </div>
            <p className="mb-2 text-[11px] text-muted">{shaped.hint}</p>
            <div className="space-y-2.5">
              {shaped.blocks.map((b, i) => (
                <div key={i} className="rounded-xl2 bg-raised p-3">
                  {b.head && (
                    <p className="mb-1 text-[11px] font-semibold text-iris">{b.head}</p>
                  )}
                  <p
                    className={cn(
                      "leading-[1.9]",
                      shape === "article" ? "font-serif text-[14.5px]" : "text-[13px]",
                    )}
                  >
                    {b.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="depth-enter card mt-4 p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Quote size={14} className="text-amber" />
              المحرر المرجعي الحي
            </h3>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
              يرصد المحرك ما يحتاج سنداً — أرقاماً وتواريخ ونسباً وأماكن — ولا يخترع
              مصدراً حين لا يجده.
            </p>
            {claims.length === 0 && (
              <p className="text-[12.5px] text-muted">لا توجد وقائع قابلة للتحقق في النص الحالي.</p>
            )}
            <ul className="space-y-2">
              {claims.map((c) => (
                <li key={c.id} className="rounded-xl2 bg-raised p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">«{c.claim}»</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        c.confidence === "مؤكد"
                          ? "bg-mint/20 text-mint"
                          : c.confidence === "مرجّح"
                            ? "bg-amber/20 text-amber"
                            : "bg-rose/20 text-rose",
                      )}
                    >
                      {c.type} · {c.confidence}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{c.note}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Meter
                value={Math.max(0, 100 - claims.filter((c) => c.confidence !== "مؤكد").length * 12)}
                label="جاهزية النص للنشر"
                tone="iris"
                hint="كل واقعة غير موثّقة تخفض الجاهزية حتى تضيف لها مصدراً."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl2 bg-raised px-2 py-2.5">
      <p className="text-[13px] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-muted">{label}</p>
    </div>
  );
}
