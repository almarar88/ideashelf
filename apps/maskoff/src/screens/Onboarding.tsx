import { useState } from "react";
import type { Lang } from "@/types/game";
import { DEMO_PLAYERS } from "@/backend/local/seed";
import { t } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/AuthContext";
import { Avatar } from "@/components/ui/Primitives";
import { IconMask } from "@/components/ui/Icons";

/**
 * Identity picker. With the local backend this is the whole "auth" surface —
 * pick which member of the demo squad you are. Against Supabase the real OTP
 * / OAuth flow replaces the list, and the rest of the app is unchanged.
 */
export function Onboarding({ lang, onLang }: { lang: Lang; onLang: (lang: Lang) => void }) {
  const { signInAs } = useAuth();
  const [selected, setSelected] = useState<string>(DEMO_PLAYERS[0].id);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-tile bg-grape text-white shadow-grape">
          <IconMask className="h-8 w-8" />
        </span>
        <h1 className="font-display text-[34px] font-extrabold leading-tight">{t(lang, "app_name")}</h1>
        <p className="mt-2 text-sm text-muted">{t(lang, "app_tagline")}</p>
      </div>

      <div className="surface p-5">
        <h2 className="font-display text-lg font-extrabold">{t(lang, "onb_title")}</h2>
        <p className="mt-1 text-xs text-muted">{t(lang, "onb_sub")}</p>

        <div className="mt-4 space-y-2">
          {DEMO_PLAYERS.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => {
                haptic("tap");
                setSelected(player.id);
              }}
              aria-pressed={selected === player.id}
              className={cn(
                "surface-2 flex w-full items-center gap-3 p-3 text-start transition-all",
                selected === player.id && "ring-1 ring-neon",
              )}
            >
              <Avatar player={player} size={40} />
              <span className="flex-1 truncate text-sm font-bold">{player.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">{t(lang, "onb_lang")}</span>
          <div className="flex gap-1.5">
            {(["ar", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onLang(option)}
                aria-pressed={lang === option}
                className={cn(
                  "chip transition-colors",
                  lang === option ? "bg-white text-ink-900" : "bg-white/[.06] text-muted",
                )}
              >
                {option === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void signInAs(selected)}
          className="btn-coral btn-lg mt-5 w-full"
        >
          {t(lang, "onb_start")}
        </button>
      </div>
    </div>
  );
}
