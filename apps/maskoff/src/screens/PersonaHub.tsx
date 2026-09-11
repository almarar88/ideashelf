import { useEffect, useState } from "react";
import { getBackend } from "@/backend";
import type { Persona, Round } from "@/types/game";
import { computePersonaStats, derivePersona } from "@/lib/scoring";
import { t } from "@/lib/i18n";
import { useGroup } from "@/state/GroupContext";
import { useAuth } from "@/state/AuthContext";
import { useGame } from "@/state/GameContext";
import { PersonaCard } from "@/components/PersonaCard";
import { IconBadge, SectionTitle, Avatar } from "@/components/ui/Primitives";
import { IconStar } from "@/components/ui/Icons";

/** Persona & Streak Hub — the weekly, shareable summary. */
export function PersonaHub() {
  const backend = getBackend();
  const { group, lang } = useGroup();
  const { userId } = useAuth();
  const { round } = useGame();
  const [rounds, setRounds] = useState<Round[]>([]);

  useEffect(() => {
    if (!group) return;
    // Last 7 rounds = "this week" for a once-a-day game.
    void backend.listRecentRounds(group.id, 7).then(setRounds);
  }, [backend, group, round]);

  if (!group || !userId) return null;

  const me = group.members.find((member) => member.id === userId);
  if (!me) return null;

  const stats = computePersonaStats(userId, rounds, group);
  const persona: Persona = derivePersona(stats);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <IconBadge className="text-butter">
          <IconStar />
        </IconBadge>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold">{t(lang, "persona_title")}</h1>
          <p className="text-xs text-muted">{t(lang, "persona_sub")}</p>
        </div>
      </header>

      {stats.rounds === 0 ? (
        <div className="surface p-8 text-center">
          <p className="text-sm font-semibold text-muted">{t(lang, "persona_nodata")}</p>
        </div>
      ) : (
        <PersonaCard lang={lang} persona={persona} player={me} groupName={group.name} />
      )}

      <section>
        <SectionTitle>{t(lang, "vault_members")}</SectionTitle>
        <div className="surface space-y-1 p-3">
          {group.members.map((member) => {
            const memberStats = computePersonaStats(member.id, rounds, group);
            const memberPersona = derivePersona(memberStats);
            return (
              <div key={member.id} className="flex items-center gap-3 rounded-tile px-2 py-2.5">
                <Avatar player={member} size={40} dim={memberStats.rounds === 0} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{member.name}</span>
                  <span className="block text-[11px] font-medium text-muted">
                    {t(lang, `p_${memberPersona.archetype}` as never)}
                  </span>
                </span>
                <span className="tnum font-display text-sm font-extrabold text-pistachio">
                  {memberStats.points}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
