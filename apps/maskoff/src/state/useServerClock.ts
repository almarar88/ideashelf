import { useEffect, useState } from "react";
import { getBackend } from "@/backend";
import { estimateOffset, serverNow, setClockOffset } from "@/lib/time";

/**
 * Ticks once a second on a clock aligned to the server.
 *
 * The reveal is a shared moment — everyone's countdown has to hit zero on the
 * same second. Device clocks drift, so the offset is measured on mount and
 * re-measured periodically, and every screen reads time through this hook.
 */
export function useServerClock(tickMs = 1000): number {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    const backend = getBackend();
    let cancelled = false;

    const sync = async () => {
      try {
        const sentAt = Date.now();
        const serverTime = await backend.serverTime();
        const receivedAt = Date.now();
        if (cancelled) return;
        setClockOffset(estimateOffset(sentAt, serverTime, receivedAt));
      } catch {
        // Keep the last known offset rather than snapping back to the device
        // clock — a stale offset is closer than no offset.
      }
    };

    void sync();
    const resync = setInterval(() => void sync(), 5 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(resync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    // Align the tick to the top of the next second so the displayed countdown
    // changes when the second actually changes.
    let interval: ReturnType<typeof setInterval>;
    const align = setTimeout(() => {
      setNow(serverNow());
      interval = setInterval(() => setNow(serverNow()), tickMs);
    }, 1000 - (serverNow() % 1000));

    return () => {
      clearTimeout(align);
      clearInterval(interval);
    };
  }, [tickMs]);

  return now;
}
