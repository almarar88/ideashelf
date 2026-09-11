import { useEffect, useState } from "react";

export type LayoutMode =
  /** شاشة ضيقة: هاتف عادي أو الشاشة الخارجية للجهاز المطوي */
  | "compact"
  /** شاشة عريضة: الشاشة الداخلية للجهاز المفتوح أو لوح صغير — لوحتان جنباً إلى جنب */
  | "dual"
  /** وضع الطاولة: المفصلة أفقية والجهاز نصف مطوي — لوحة فوق ولوحة تحت */
  | "tabletop"
  /** سطح مكتب واسع: عرض الجهاز داخل لوحة العرض */
  | "showcase";

export type WindowLayout = {
  mode: LayoutMode;
  /** هل الشاشة ممتدة فعلاً عبر مفصلة؟ */
  spanned: boolean;
  width: number;
  height: number;
};

const mq = (q: string) => {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
};

/** المفصلة الرأسية: جزآن جنباً إلى جنب (الجهاز مفتوح بالطول) */
const SPANNED_V_HINGE =
  "(horizontal-viewport-segments: 2), (screen-spanning: single-fold-vertical)";
/** المفصلة الأفقية: جزء فوق وجزء تحت (وضع الطاولة) */
const SPANNED_H_HINGE =
  "(vertical-viewport-segments: 2), (screen-spanning: single-fold-horizontal)";

/** عتبة الانتقال إلى لوحتين — تقارب عرض الشاشة الداخلية لأجهزة الطي */
export const DUAL_MIN = 600;
/** عتبة عرض الجهاز داخل لوحة عرض على الشاشات الكبيرة */
export const SHOWCASE_MIN = 1180;

function compute(): WindowLayout {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (mq(SPANNED_H_HINGE)) {
    return { mode: "tabletop", spanned: true, width, height };
  }
  if (mq(SPANNED_V_HINGE)) {
    return { mode: "dual", spanned: true, width, height };
  }
  if (width >= SHOWCASE_MIN) {
    return { mode: "showcase", spanned: false, width, height };
  }
  if (width >= DUAL_MIN) {
    return { mode: "dual", spanned: false, width, height };
  }
  return { mode: "compact", spanned: false, width, height };
}

/**
 * يتتبّع شكل النافذة وحالة الطي.
 * على أجهزة الطي يتغيّر هذا أثناء التشغيل (فتح/غلق/وضع الطاولة) بلا إعادة تشغيل.
 */
export function useWindowLayout(): WindowLayout {
  const [layout, setLayout] = useState<WindowLayout>(() => {
    if (typeof window === "undefined") {
      return { mode: "compact", spanned: false, width: 390, height: 844 };
    }
    return compute();
  });

  useEffect(() => {
    const update = () => setLayout(compute());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    const queries = [SPANNED_V_HINGE, SPANNED_H_HINGE].map((q) => window.matchMedia(q));
    for (const q of queries) q.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      for (const q of queries) q.removeEventListener?.("change", update);
    };
  }, []);

  return layout;
}
