import { useEffect, useMemo, useState } from "react";
import { AudioWaveform, Check, Clapperboard, Loader2, Scissors, Sparkles, Volume2, Wand2 } from "lucide-react";
import { DirectorTimeline, type Clip } from "@/components/studio/DirectorTimeline";
import { Meter } from "@/components/ui/Meter";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

const BASE_CLIPS: Clip[] = [
  { id: "c1", label: "وصول", seconds: 6, colors: ["#243a86", "#4a63cc", "#8fb2ff"] },
  { id: "c2", label: "حوار", seconds: 9, colors: ["#3d2c7a", "#7b5bd0", "#c9a6ff"] },
  { id: "c3", label: "مطر", seconds: 7, colors: ["#12204f", "#2f4ea8", "#7fd5ff"] },
  { id: "c4", label: "خاتمة", seconds: 5, colors: ["#7a2f63", "#d75fa0", "#ffc4e1"] },
];

const GAP_CLIP: Clip = {
  id: "gen",
  label: "B-Roll مولّد",
  seconds: 2,
  colors: ["#8a4f2a", "#e0913f", "#ffd9a0"],
  generated: true,
};

const STAGES = [
  { id: "scan", label: "تحليل السياق البيئي", detail: "زوايا التصوير، حركة الظلال، تعابير الوجوه", Icon: Wand2 },
  { id: "cut", label: "إيقاع القص", detail: "تقطيع على نبض المشهد لا على قالب جاهز", Icon: Scissors },
  { id: "color", label: "التصحيح اللوني", detail: "مرجع سينمائي مطابق لدرجة حرارة الضوء", Icon: Sparkles },
  { id: "audio", label: "إعادة بناء الصوت المكاني", detail: "عزل الضجيج وإعادة توزيع المحيط ثلاثي الأبعاد", Icon: Volume2 },
  { id: "broll", label: "ملء الفراغ الزمني", detail: "توليد لقطة انتقالية واحدة وتوثيقها في سجل الأصل", Icon: Clapperboard },
] as const;

const MOODS = [
  { id: "calm", label: "هادئ", cut: "لقطات أطول، قطع ناعم" },
  { id: "epic", label: "ملحمي", cut: "قطع على الإيقاع، حركة أوسع" },
  { id: "doc", label: "وثائقي", cut: "احترام الزمن الحقيقي للمشهد" },
] as const;

export function StudioScreen({
  running,
  onRun,
  onDone,
}: {
  running: boolean;
  onRun: () => void;
  onDone: () => void;
}) {
  const [mood, setMood] = useState<(typeof MOODS)[number]["id"]>("calm");
  const [noise, setNoise] = useState(62);
  const [stage, setStage] = useState(-1);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    setFinished(false);
    setStage(0);
    const id = window.setInterval(() => {
      setStage((s) => {
        if (s >= STAGES.length - 1) {
          window.clearInterval(id);
          setFinished(true);
          onDone();
          return s;
        }
        return s + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [running, onDone]);

  const clips = useMemo(() => {
    if (stage < STAGES.length - 1) return BASE_CLIPS;
    return [BASE_CLIPS[0], BASE_CLIPS[1], GAP_CLIP, BASE_CLIPS[2], BASE_CLIPS[3]];
  }, [stage]);

  const aiShare = finished ? Math.min(48, 18 + Math.round(noise / 6) + (mood === "epic" ? 6 : 0)) : 0;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
      <SectionTitle
        title="استوديو الإخراج المستقل"
        subtitle="المخرج الآلي يقرأ المشهد نفسه: الظل، الإيقاع، الصوت — لا قالباً محفوظاً."
      />

      <div className="card space-y-4 p-4">
        <DirectorTimeline clips={clips} activeIndex={running ? Math.min(stage, clips.length - 1) : -1} />

        <div>
          <p className="mb-2 text-[12px] font-medium">طابع الإخراج</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {MOODS.map((m) => (
              <Pill key={m.id} active={mood === m.id} onClick={() => setMood(m.id)} title={m.cut}>
                {m.label}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">
            {MOODS.find((m) => m.id === mood)?.cut}
          </p>
        </div>

        <div>
          <label className="mb-1.5 flex items-center justify-between text-[12px] font-medium">
            <span className="flex items-center gap-1.5">
              <AudioWaveform size={14} className="text-iris" />
              ضجيج التسجيل الأصلي
            </span>
            <span className="tabular-nums text-muted">{noise}٪</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={noise}
            onChange={(e) => setNoise(Number(e.target.value))}
            className="w-full accent-[rgb(var(--rose))]"
            aria-label="مستوى الضجيج"
          />
          <p className="mt-1 text-[11px] text-muted">
            مولّد، رياح، أو أصوات مجلس — يُعزل ثم يُعاد بناء المحيط بدلاً منه.
          </p>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[.98] disabled:opacity-70"
          style={{ background: "linear-gradient(140deg, rgb(var(--rose)), rgb(var(--iris)))" }}
        >
          {running ? <Loader2 size={17} className="animate-spin" /> : <Clapperboard size={17} />}
          {running ? "جارٍ الإخراج…" : "أخرج المشهد"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {STAGES.map((s, i) => {
          const done = stage > i || finished;
          const active = running && stage === i && !finished;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-start gap-3 rounded-xl2 px-3.5 py-3 transition-all duration-500",
                active ? "bg-surface shadow-lift" : "bg-surface/55",
                !done && !active && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                  done ? "bg-mint/20 text-mint" : active ? "bg-rose/20 text-rose" : "bg-raised text-muted",
                )}
              >
                {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <s.Icon size={14} />}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{s.label}</p>
                <p className="text-[11.5px] leading-relaxed text-muted">{s.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {finished && (
        <div className="depth-enter card mt-4 space-y-3 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold">
            <Check size={15} className="text-mint" />
            جاهز — 29 ثانية، لقطة مولّدة واحدة
          </p>
          <Meter value={100 - noise + 30 > 100 ? 100 : 100 - noise + 30} label="نقاء الصوت بعد إعادة البناء" tone="mint" />
          <Meter
            value={aiShare}
            label="مساهمة الذكاء الاصطناعي في النسخة النهائية"
            tone="rose"
            hint="تُكتب هذه النسبة داخل ملف الفيديو نفسه قبل النشر (C2PA)."
          />
        </div>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted">
        ملاحظة صريحة: هذه الشاشة نموذج واجهة يعمل بمنطق محلي، ولا يوجد خلفها نموذج
        رؤية حاسوبية حقيقي بعد. كل الأرقام مشتقة من مدخلاتك في هذه الشاشة.
      </p>
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 px-1 pt-1">
      <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}
