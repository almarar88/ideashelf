import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBackend } from "@/backend";
import type { Group, Lang, Player } from "@/types/game";
import { useAuth } from "./AuthContext";

interface GroupValue {
  group: Group | null;
  me: Player | null;
  lang: Lang;
  setLang: (lang: Lang) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<GroupValue | null>(null);
const DEFAULT_GROUP_ID = "g_demo";

export function GroupProvider({ children }: { children: ReactNode }) {
  const backend = getBackend();
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);

  const refresh = useCallback(async () => {
    const groups = userId ? await backend.listGroupsForUser(userId) : [];
    setGroup(groups[0] ?? (await backend.getGroup(DEFAULT_GROUP_ID)));
  }, [backend, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Group membership and language can change from another device.
  useEffect(() => {
    if (!group) return;
    return backend.subscribe(group.id, (event) => {
      if (event.type === "group") void refresh();
    });
  }, [backend, group?.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLang = useCallback(
    async (lang: Lang) => {
      if (!group) return;
      setGroup(await backend.setGroupLanguage(group.id, lang));
    },
    [backend, group],
  );

  const me = useMemo(
    () => group?.members.find((member) => member.id === userId) ?? null,
    [group, userId],
  );

  const value = useMemo<GroupValue>(
    () => ({ group, me, lang: group?.lang ?? "ar", setLang, refresh }),
    [group, me, setLang, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroup(): GroupValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useGroup must be used inside <GroupProvider>");
  return value;
}
