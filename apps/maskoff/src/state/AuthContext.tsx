import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBackend } from "@/backend";

interface AuthValue {
  userId: string | null;
  ready: boolean;
  signInAs: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = getBackend();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void backend.getSession().then((session) => {
      if (cancelled) return;
      setUserId(session?.userId ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const signInAs = useCallback(
    async (id: string) => {
      const session = await backend.signInAs(id);
      setUserId(session.userId);
    },
    [backend],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    setUserId(null);
  }, [backend]);

  const value = useMemo<AuthValue>(() => ({ userId, ready, signInAs, signOut }), [userId, ready, signInAs, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
