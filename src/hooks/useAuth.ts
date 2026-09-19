import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloudEnabled } from "@/lib/supabase";
import { EMPTY_ENTITLEMENTS, getProfile, getSession, loadEntitlements, onAuthChange, type Entitlements } from "@/lib/cloud";
import type { ProfileRow } from "@/lib/database.types";

export interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  entitlements: Entitlements;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [ready, setReady] = useState(!cloudEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements>(EMPTY_ENTITLEMENTS);

  const hydrate = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s?.user) {
      setProfile(null);
      setEntitlements(EMPTY_ENTITLEMENTS);
      return;
    }
    try {
      const [p, e] = await Promise.all([getProfile(s.user), loadEntitlements(s.user.id)]);
      setProfile(p);
      setEntitlements(e);
    } catch {
      // offline or a transient failure — keep the session, drop the extras
      setEntitlements(EMPTY_ENTITLEMENTS);
    }
  }, []);

  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    void getSession().then(async (s) => {
      if (!alive) return;
      await hydrate(s);
      setReady(true);
    });
    const off = onAuthChange((s) => {
      if (alive) void hydrate(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, [hydrate]);

  const refresh = useCallback(async () => {
    const s = await getSession();
    await hydrate(s);
  }, [hydrate]);

  return { ready, session, profile, entitlements, isAdmin: profile?.role === "admin", refresh };
}
