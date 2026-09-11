import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "chrono.theme";

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* التخزين قد يكون معطّلاً — نتجاهل بهدوء */
  }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* لا شيء */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "light" ? "dark" : "light")),
    [],
  );

  return { theme, toggle };
}

/** ضوء الواجهة يتبع ساعة اليوم — جزء من مبدأ "الحد الأدنى الذكي". */
export function useHourLight() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (hour < 5) return { label: "قبل الفجر", warmth: 0.15 };
  if (hour < 11) return { label: "صباح", warmth: 0.75 };
  if (hour < 16) return { label: "نهار", warmth: 1 };
  if (hour < 19) return { label: "أصيل", warmth: 0.6 };
  return { label: "ليل", warmth: 0.25 };
}
