import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** Wide layout: tablets, desktops, and unfolded foldables (Galaxy Fold / Pixel Fold inner display ≈ 840dp). */
export const useIsWide = () => useMediaQuery("(min-width: 840px)");
