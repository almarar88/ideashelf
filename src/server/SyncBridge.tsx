import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { cloudReady } from "./client";
import { hydrate, mirror } from "./sync";
import { useStore } from "@/store/store";

export type SyncStatus = "offline" | "signed-out" | "syncing" | "synced" | "error";

type SyncState = {
  status: SyncStatus;
  message: string | null;
  refresh: () => void;
};

const SyncCtx = createContext<SyncState>({
  status: "offline",
  message: null,
  refresh: () => {},
});

/**
 * يربط المتجر المحلي بالخادم: يجلب عند الدخول، ويعكس كل فعل بعده.
 * وجوده اختياري تماماً — بلا جلسة يعمل التطبيق محلياً كما كان.
 */
export function SyncBridge({ children }: { children: React.ReactNode }) {
  const { userId, loading } = useAuth();
  const { dispatch, mirrorRef, state } = useStore();
  const [status, setStatus] = useState<SyncStatus>(cloudReady ? "signed-out" : "offline");
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // المعرّف الذي تعرفه القاعدة بلا @، ويُستعمل عند عكس تعديل الملف
  const handleOf = useCallback((h: string) => h.replace(/^@/, "").toLowerCase(), []);

  // يُحدَّث المرجع في كل تصيير حتى يرى العاكس أحدث معرّف مستخدم
  const meRef = useRef<string | null>(userId);
  meRef.current = userId;

  useEffect(() => {
    if (!cloudReady) {
      mirrorRef.current = null;
      return;
    }
    mirrorRef.current = (action) => {
      const me = meRef.current;
      if (!me) return; // بلا جلسة لا شيء يُرفع
      void mirror(action, me, handleOf).then((report) => {
        if (report) setMessage(report.message);
      });
    };
    return () => {
      mirrorRef.current = null;
    };
  }, [mirrorRef, handleOf]);

  useEffect(() => {
    if (loading || !cloudReady) return;
    if (!userId) {
      setStatus("signed-out");
      setMessage(null);
      return;
    }
    let cancelled = false;
    setStatus("syncing");
    setMessage(null);
    void hydrate(userId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: "data/merge", patch: result.state });
        setStatus("synced");
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loading, dispatch, tick]);

  const value = useMemo(
    () => ({ status, message, refresh: () => setTick((t) => t + 1) }),
    [status, message],
  );

  // تنبيه صامت: لو امتلأ التخزين المحلي فالخادم هو النسخة الموثوقة
  useEffect(() => {
    if (status === "synced" && state.posts.length === 0) {
      setMessage("لا منشورات على الخادم بعد — انشر أول أثر ليُرفع.");
    }
  }, [status, state.posts.length]);

  return <SyncCtx.Provider value={value}>{children}</SyncCtx.Provider>;
}

export const useSync = () => useContext(SyncCtx);
