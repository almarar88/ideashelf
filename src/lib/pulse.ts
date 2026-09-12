import type { ScreenId } from "./types";

export type PulseMode = {
  id: string;
  label: string;
  hint: string;
  icon: "compose" | "director" | "mic" | "lens" | "map" | "shield";
};

/** زر النبض الذكي: يستشعر الشاشة والحالة فيغيّر وظيفته بدل أن يكون زر "+" ثابتاً. */
export function pulseFor(screen: ScreenId, busy: boolean, createTab: "film" | "essay"): PulseMode {
  if (busy) {
    return {
      id: "working",
      label: "جارٍ العمل",
      hint: "المحرك يعالج ما بين يديك الآن",
      icon: "director",
    };
  }
  switch (screen) {
    case "feed":
      return {
        id: "compose",
        label: "أثر جديد",
        hint: "أنت في المجرى — النبض يفتح النشر",
        icon: "compose",
      };
    case "create":
      return createTab === "film"
        ? {
            id: "direct",
            label: "وجّه الإخراج",
            hint: "الكاميرا مفتوحة — النبض يتحول إلى موجّه إخراجي",
            icon: "director",
          }
        : {
            id: "dictate",
            label: "سجّل واصغِ",
            hint: "أنت تكتب — النبض يتحول إلى مسجّل تفريغ وصياغة",
            icon: "mic",
          };
    case "explore":
      return {
        id: "lens",
        label: "عدسة التلخيص",
        hint: "أنت تستكشف — النبض يلخّص ما في المجرى",
        icon: "lens",
      };
    case "atlas":
      return {
        id: "recall",
        label: "استرجاع سياقي",
        hint: "أنت في الأطلس — النبض يفتح البحث بالوصف لا بالكلمات",
        icon: "map",
      };
    case "profile":
    case "settings":
      return {
        id: "seal",
        label: "ختم الأصل",
        hint: "النبض يوقّع سجل الأصل الرقمي لآخر عمل",
        icon: "shield",
      };
  }
}
