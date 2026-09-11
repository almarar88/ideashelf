import { countdown } from "@/lib/time";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useGame } from "@/state/GameContext";
import { useGroup } from "@/state/GroupContext";
import { CountdownRing } from "@/components/CountdownRing";
import { Avatar, IconBadge, IconButton, SectionTitle, Tile } from "@/components/ui/Primitives";
import { IconBell, IconPin, IconFlame, IconArrow, IconCheck } from "@/components/ui/Icons";
import type { Screen } from "@/components/PillNav";

/**
 * The Vault — pre-drop home. Mirrors the reference's home screen: location
 * row + avatar, an oversized display heading, then the stacked accent tiles.
 */
export function Vault({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { group, me, lang } = useGroup();
  const { now, round, phase, submittedIds, loadingQuestion } = useGame();

  if (!group) return null;

  const target = phase === "locked" ? round?.dropAt ?? now : round?.revealAt ?? now;
  const span = phase === "locked" ? 12 * 3600_000 : (round ? round.revealAt - round.dropAt : 3600_000);
  const c = countdown(target, now);

  const title =
    phase === "locked" ? "vault_locked_title" : phase === "open" ? "vault_open_title" : "vault_revealed_title";

  const ready = submittedIds.length;
  const total = group.members.length;

  return (
    <div className="space-y-6">
      {/* Top row — reference: location + bell + avatar */}
      <header className="flex items-center gap-3">
        <IconBadge className="text-muted">
          <IconPin />
        </IconBadge>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-muted">{t(lang, "vault_eyebrow")}</div>
          <div className="truncate text-[15px] font-bold">{group.name}</div>
        </div>
        <IconButton label="notifications" className="text-muted">
          <IconBell />
        </IconButton>
        {me && <Avatar player={me} size={48} />}
      </header>

      <h1 className="text-balance font-display text-[34px] font-extrabold leading-[1.2]">
        {t(lang, title)}
      </h1>

      <CountdownRing
        countdown={c}
        totalMs={span}
        label={phase === "locked" ? t(lang, "vault_next_drop") : t(lang, "vault_reveal_at")}
        accent={phase === "open" ? "#EAB308" : "#8B5CF6"}
        sound={phase === "open"}
      />

      {/* Stacked accent tiles — reference: the overlapping service cards */}
      <div className="space-y-3">
        <Tile accent="grape" onClick={() => onNavigate(phase === "revealed" ? "showdown" : "play")}>
          <div className="flex items-center gap-4">
            <IconBadge className="border-white/25 text-white">
              <IconFlame />
            </IconBadge>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-extrabold">
                {phase === "revealed" ? t(lang, "vault_see_results") : t(lang, "vault_enter")}
              </div>
              <div className="text-xs font-medium opacity-70">
                {loadingQuestion ? t(lang, "ai_thinking") : round?.question.question_text.slice(0, 58) ?? ""}
              </div>
            </div>
            <span className="btn-arrow shrink-0">
              <IconArrow className="flip-rtl h-[18px] w-[18px]" />
            </span>
          </div>
        </Tile>

        <Tile accent="butter">
          <div className="flex items-center gap-4">
            <IconBadge onInk className="text-ink-900">
              <IconFlame />
            </IconBadge>
            <div className="flex-1">
              <div className="text-xs font-semibold opacity-65">{t(lang, "vault_streak")}</div>
              <div className="font-display text-[26px] font-extrabold leading-tight">
                <span className="tnum">{group.streak}</span>{" "}
                <span className="text-sm font-bold opacity-65">{t(lang, "vault_days")}</span>
              </div>
            </div>
            <div className="text-end">
              <div className="tnum font-display text-[22px] font-extrabold">
                {ready}/{total}
              </div>
              <div className="text-[11px] font-semibold opacity-65">{t(lang, "vault_done")}</div>
            </div>
          </div>
        </Tile>
      </div>

      {/* Squad status */}
      <section>
        <SectionTitle>{t(lang, "vault_members")}</SectionTitle>
        <div className="surface space-y-1 p-3">
          {group.members.map((member) => {
            const done = submittedIds.includes(member.id);
            return (
              <div key={member.id} className="flex items-center gap-3 rounded-tile px-2 py-2.5">
                <Avatar player={member} size={40} dim={!done} />
                <span className={cn("min-w-0 flex-1 truncate text-sm font-bold", !done && "text-muted")}>
                  {member.name}
                </span>
                {done ? (
                  <span className="grid h-7 w-7 place-items-center rounded-pill bg-pistachio text-ink-900">
                    <IconCheck className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="chip bg-white/[.06] text-[11px] text-muted">{t(lang, "vault_waiting")}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
