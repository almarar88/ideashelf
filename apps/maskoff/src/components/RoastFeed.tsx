import type { Lang, Player, Roast, RoundResults } from "@/types/game";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar, IconBadge } from "./ui/Primitives";
import { IconSpark, IconEye, IconMask } from "./ui/Icons";

/**
 * The AI Roast Master panel. Headline lands first, commentary types in under
 * it, then the two verdict tiles (sharpest read / biggest surprise).
 */
export function RoastFeed({
  lang,
  roast,
  results,
  members,
  loading,
  isFallback,
}: {
  lang: Lang;
  roast: Roast | null;
  results: RoundResults | null;
  members: Player[];
  loading: boolean;
  isFallback: boolean;
}) {
  const find = (id: string | null | undefined) =>
    id ? members.find((member) => member.id === id) ?? null : null;

  const mvp = find(roast?.mvp_perceptive_user_id || results?.mvpUserId);
  const hypocrite = find(roast?.biggest_hypocrite_user_id || results?.hypocriteUserId);

  if (loading && !roast) {
    return (
      <div className="surface p-6">
        <div className="flex items-center gap-3">
          <IconBadge className="animate-pulse-ring text-neon">
            <IconSpark />
          </IconBadge>
          <span className="text-sm font-semibold text-muted">{t(lang, "ai_roasting")}</span>
        </div>
        <div className="mt-5 space-y-2.5" aria-hidden>
          <div className="h-4 w-3/4 animate-pulse rounded-pill bg-white/10" />
          <div className="h-4 w-full animate-pulse rounded-pill bg-white/[.07]" />
          <div className="h-4 w-2/3 animate-pulse rounded-pill bg-white/[.07]" />
        </div>
      </div>
    );
  }

  if (!roast) return null;

  return (
    <div className="surface animate-slide-up overflow-hidden">
      <div
        className="p-6"
        style={{ background: "linear-gradient(160deg, rgba(180,41,224,.22), transparent 62%)" }}
      >
        <div className="flex items-center gap-3">
          <IconBadge className="text-grape">
            <IconSpark />
          </IconBadge>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              {t(lang, "showdown_roast")}
            </div>
            {isFallback && (
              <div className="text-[11px] font-medium text-cyber">{t(lang, "showdown_fallback_note")}</div>
            )}
          </div>
        </div>

        <h3 className="mt-4 text-balance font-display text-[25px] font-extrabold leading-tight">
          {roast.roast_headline}
        </h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-white/80">{roast.roast_commentary}</p>
      </div>

      {(mvp || hypocrite) && (
        <div className="grid grid-cols-2 gap-2.5 p-4 pt-0">
          <VerdictTile
            player={mvp}
            label={t(lang, "showdown_mvp")}
            color="#C7E89C"
            icon={<IconEye />}
          />
          <VerdictTile
            player={hypocrite}
            label={t(lang, "showdown_hypocrite")}
            color="#F08D7C"
            icon={<IconMask />}
          />
        </div>
      )}
    </div>
  );
}

function VerdictTile({
  player,
  label,
  color,
  icon,
}: {
  player: Player | null;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn("tile flex flex-col gap-2.5 p-4", !player && "opacity-40")}
      style={{ background: color }}
    >
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-900/65">
        <span className="grid h-6 w-6 place-items-center rounded-pill bg-ink-900/10">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-2">
        {player ? (
          <>
            <Avatar player={player} size={34} ring={false} />
            <span className="truncate text-[15px] font-extrabold text-ink-900">{player.name}</span>
          </>
        ) : (
          <span className="text-[15px] font-extrabold text-ink-900">—</span>
        )}
      </span>
    </div>
  );
}
