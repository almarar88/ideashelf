import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "@/lib/settings";

export function useSettings() {
  const [settings, setState] = useState<Settings>(loadSettings);
  const update = useCallback((patch: Partial<Settings>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  return { settings, update };
}
