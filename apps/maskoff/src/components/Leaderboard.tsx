import type { Lang, Player, RoundResults } from "@/types/game";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui/Primitives";
import { IconCheck } from "./ui/Icons";

export function Leaderboard({
  lang,
  results,
  members,
  meId,
}: {
  lang: Lang;
  results: RoundResults;
  members: Player[];
  meId: string | null;
}) {
  const rows = [...results.perPlayer].sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-2.5">
      {rows.map((row, index) => {
        const player = members.find((member) => member.id === row.userId);
        if (!player) return null;
        const isMe = player.id === meId;
        const missed = row.choice === null;

        return (
          <div
            key={row.userId}
            className={cn(
              "surface-2 flex items-center gap-3 p-3.5 transition-colors",
              isMe && "ring-1 ring-neon/60",
              missed && "opacity-45",
            )}
          >
            <span className="tnum w-5 shrink-0 text-center font-display text-sm font-extrabold text-muted">
              {index + 1}
            </span>
            <Avatar player={player} size={40} dim={missed} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{player.name}</span>
              <span className="block text-[11px] font-medium text-muted">
                {missed ? (
                  t(lang, "showdown_missed")
                ) : (
                  <>
                    <span className="tnum">
                      {row.correctStakes}/{row.totalStakes}
                    </span>
                    {row.perfectRead ? ` · ${t(lang, "showdown_perfect")}` : ""}
                  </>
                )}
              </span>
            </span>

            {row.choice && (
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-pill font-display text-xs font-extrabold text-ink-900"
                style={{ background: row.choice === "A" ? "#B9C9F2" : "#F08D7C" }}
              >
                {row.choice}
              </span>
            )}

            <span className="tnum shrink-0 font-display text-base font-extrabold text-pistachio">
              {row.points}
            </span>

            {row.perfectRead && (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-pistachio text-ink-900">
                <IconCheck className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
