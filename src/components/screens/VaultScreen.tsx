import { useState } from "react";
import { Cpu, Database, Fingerprint, KeyRound, Layers3, Lock, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { SectionTitle } from "./StudioScreen";
import { Meter } from "@/components/ui/Meter";
import { cn } from "@/lib/cn";

const LAYERS = [
  {
    Icon: Layers3,
    title: "طبقة الالتقاط والواجهة",
    detail: "React + TypeScript في هذا النموذج (Flutter / Jetpack Compose في نسخة الجهاز).",
    state: "مطبّقة",
  },
  {
    Icon: Cpu,
    title: "المعالجة المحلية المسرّعة",
    detail: "نموذج صغير على الجهاز لتفريغ الصوت والتنقية قبل أي اتصال بالشبكة.",
    state: "مصمّمة",
  },
  {
    Icon: Database,
    title: "محرك التنسيق المعرفي",
    detail: "تمثيلات متجهية + استرجاع معزّز (RAG) لربط اللحظات بالمصادر.",
    state: "مصمّمة",
  },
  {
    Icon: Lock,
    title: "طبقة السيادة على البيانات",
    detail: "خزنة صفرية المعرفة: المفتاح على عتاد الجهاز، والخادم لا يرى المسودات.",
    state: "مصمّمة",
  },
] as const;

export function VaultScreen({ sealCount }: { sealCount: number }) {
  const [localOnly, setLocalOnly] = useState(true);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
      <SectionTitle
        title="الخزنة والسيادة"
        subtitle="ما لم تنشره لا يغادر جهازك، وما نشرته يحمل سجلّ أصله معه."
      />

      <div className="card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[14px] font-semibold">
              <KeyRound size={15} className="text-mint" />
              معالجة محلية فقط
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              حين تكون مفعّلة، تُنفَّذ الصياغة والتفريغ على الجهاز، وتبقى المسودات
              مشفّرة بمفتاح لا تملك الخوادم نسخة منه.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={localOnly}
            onClick={() => setLocalOnly((v) => !v)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
              localOnly ? "bg-mint" : "bg-line",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300",
                localOnly ? "right-1" : "right-6",
              )}
            />
          </button>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl2 px-3 py-2.5 text-[12px]",
            localOnly ? "bg-mint/12 text-mint" : "bg-amber/12 text-amber",
          )}
        >
          {localOnly ? <WifiOff size={14} /> : <Wifi size={14} />}
          {localOnly
            ? "لا يغادر الجهاز شيء — حتى تضغط «انشر» صراحةً."
            : "الوضع السحابي: ترسل المهام الثقيلة فقط، بعد تجريدها من هوية صاحبها."}
        </div>
      </div>

      <div className="card mt-4 space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-[14px] font-semibold">
          <Fingerprint size={15} className="text-rose" />
          سجل الأصل الرقمي (C2PA)
        </p>
        <p className="text-[11.5px] leading-relaxed text-muted">
          كل مخرج يحمل توقيعاً غير مرئي يوضح نسبة مساهمة الآلة مقابل الإنسان، ويظل
          معه بعد إعادة النشر خارج التطبيق.
        </p>
        <Meter value={sealCount > 0 ? 100 : 0} label={`أعمال مختومة في هذه الجلسة: ${sealCount}`} tone="rose" />
        <p className="text-[11px] text-muted">
          اضغط زر النبض داخل هذه الشاشة ليختم آخر عمل.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {LAYERS.map((l) => (
          <div key={l.title} className="card flex items-start gap-3 p-3.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-iris">
              <l.Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13.5px] font-semibold">{l.title}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    l.state === "مطبّقة" ? "bg-mint/20 text-mint" : "bg-raised text-muted",
                  )}
                >
                  {l.state}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{l.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl2 border border-dashed hairline p-3.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <ShieldCheck size={14} className="text-mint" />
          ما هو حقيقي في هذا النموذج
        </p>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted">
          <li>• لا يوجد خادم ولا حساب ولا تتبّع: التطبيق يعمل كاملاً في المتصفح.</li>
          <li>• لا صور لأشخاص حقيقيين: كل الوسائط مولّدة رياضياً داخل الصفحة.</li>
          <li>• المحرّكات النصية قواعدية وتعمل محلياً، وليست نموذجاً لغوياً.</li>
          <li>• التشفير صفري المعرفة وC2PA معروضان كتصميم معماري، لا كتنفيذ عامل.</li>
        </ul>
      </div>
    </div>
  );
}
