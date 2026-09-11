import type { ScreenId } from "./types";

export type PulseMode = {
  id: string;
  label: string;
  hint: string;
  icon: "director" | "mic" | "lens" | "map" | "shield";
};

/** زر النبض الذكي: يستشعر الشاشة والحالة فيغيّر وظيفته بدل أن يكون زر "+" ثابتاً. */
export function pulseFor(screen: ScreenId, busy: boolean): PulseMode {
  if (busy) {
    return {
      id: "working",
      label: "جارٍ العمل",
      hint: "المحرك يعالج ما بين يديك الآن",
      icon: "director",
    };
  }
  switch (screen) {
    case "studio":
      return {
        id: "direct",
        label: "وجّه الإخراج",
        hint: "الكاميرا مفتوحة — النبض يتحول إلى موجّه إخراجي",
        icon: "director",
      };
    case "prose":
      return {
        id: "dictate",
        label: "سجّل واصغِ",
        hint: "أنت تتحدث — النبض يتحول إلى مسجّل تفريغ وصياغة",
        icon: "mic",
      };
    case "feed":
      return {
        id: "lens",
        label: "عدسة التلخيص",
        hint: "أنت تقرأ — النبض يتحول إلى عدسة تلخيص واستخراج هوامش",
        icon: "lens",
      };
    case "atlas":
      return {
        id: "recall",
        label: "استرجاع سياقي",
        hint: "أنت في الأطلس — النبض يفتح البحث بالوصف لا بالكلمات",
        icon: "map",
      };
    case "vault":
      return {
        id: "seal",
        label: "ختم الأصل",
        hint: "أنت في الخزنة — النبض يوقّع سجل الأصل الرقمي",
        icon: "shield",
      };
  }
}
