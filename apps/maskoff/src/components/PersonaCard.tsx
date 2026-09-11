import { useCallback, useRef, useState } from "react";
import type { Lang, Persona, Player } from "@/types/game";
import { t } from "@/lib/i18n";
import { pct } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { saveImage, shareImage } from "@/lib/share";
import { ACCENT_HEX } from "./ui/Primitives";
import { IconShare, IconDownload, IconStar } from "./ui/Icons";

const ARCHETYPE_ACCENT: Record<Persona["archetype"], string> = {
  mind_reader: ACCENT_HEX.pistachio,
  wildcard: ACCENT_HEX.grape,
  open_book: ACCENT_HEX.ice,
  chameleon: ACCENT_HEX.butter,
  loyalist: ACCENT_HEX.neon,
  ghost: "#4A4458",
};

const ARCHETYPE_EMOJI: Record<Persona["archetype"], string> = {
  mind_reader: "🔮",
  wildcard: "🃏",
  open_book: "📖",
  chameleon: "🦎",
  loyalist: "🛡️",
  ghost: "👻",
};

/**
 * Weekly persona card + 1-click story export.
 *
 * The share image is drawn to an offscreen 1080x1920 canvas — the native story
 * aspect — and handed to the Web Share API as a File. On Android Chrome that
 * opens the system sheet with Instagram Stories and WhatsApp Status in it.
 * Where file sharing isn't available (most desktop browsers, iOS Safari in
 * some versions) it falls back to a PNG download, so the button is never dead.
 */
export function PersonaCard({
  lang,
  persona,
  player,
  groupName,
}: {
  lang: Lang;
  persona: Persona;
  player: Player;
  groupName: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const busy = useRef(false);

  const accent = ARCHETYPE_ACCENT[persona.archetype];
  const emoji = ARCHETYPE_EMOJI[persona.archetype];
  const title = t(lang, `p_${persona.archetype}` as never);
  const description = t(lang, `p_${persona.archetype}_d` as never);

  const render = useCallback(async (): Promise<Blob | null> => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Canvas silently falls back to a default face if the web font has not
    // finished loading, which would ship a story card in the wrong typeface.
    try {
      await document.fonts.ready;
    } catch {
      /* older engines: draw with whatever is available */
    }

    const rtl = lang === "ar";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    const x = rtl ? W - 110 : 110;

    // Ground + accent bloom
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    const bloom = ctx.createRadialGradient(W / 2, 660, 40, W / 2, 660, 760);
    bloom.addColorStop(0, `${accent}44`);
    bloom.addColorStop(1, "#00000000");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);

    // Card
    roundRect(ctx, 70, 240, W - 140, 1220, 64);
    ctx.fillStyle = "#17131F";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.09)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const font = rtl
      ? '"IBM Plex Sans Arabic", system-ui, sans-serif'
      : '"Plus Jakarta Sans", system-ui, sans-serif';

    // Wordmark
    ctx.fillStyle = "#9A93A8";
    ctx.font = `600 34px ${font}`;
    ctx.fillText(`${t(lang, "app_name")} · ${groupName}`, x, 170);

    // Archetype badge
    ctx.font = "160px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(emoji, W / 2, 520);
    ctx.textAlign = rtl ? "right" : "left";

    ctx.fillStyle = accent;
    ctx.font = `800 92px ${font}`;
    ctx.fillText(title, x, 690);

    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = `500 40px ${font}`;
    wrapText(ctx, description, x, 770, W - 260, 56, rtl);

    // Stats
    const stats: [string, string][] = [
      [t(lang, "persona_accuracy"), pct(persona.stats.readAccuracy)],
      [t(lang, "persona_predictability"), pct(persona.stats.predictability)],
      [t(lang, "persona_contrarian"), pct(persona.stats.contrarianRate)],
      [t(lang, "persona_rounds"), String(persona.stats.rounds)],
    ];

    let y = 980;
    for (const [label, value] of stats) {
      roundRect(ctx, 130, y, W - 260, 96, 32);
      ctx.fillStyle = "#221B2D";
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.font = `500 34px ${font}`;
      ctx.fillText(label, rtl ? W - 180 : 180, y + 60);

      ctx.fillStyle = accent;
      ctx.font = `800 40px ${font}`;
      ctx.textAlign = rtl ? "left" : "right";
      ctx.fillText(value, rtl ? 180 : W - 180, y + 60);
      ctx.textAlign = rtl ? "right" : "left";

      y += 116;
    }

    // Points
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 76px ${font}`;
    ctx.fillText(`${persona.stats.points}`, x, 1540);
    ctx.fillStyle = "#9A93A8";
    ctx.font = `600 36px ${font}`;
    ctx.fillText(t(lang, "showdown_points"), x, 1596);

    ctx.fillStyle = "rgba(255,255,255,.38)";
    ctx.font = `500 32px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(t(lang, "app_tagline"), W / 2, 1800);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }, [accent, description, emoji, groupName, lang, persona, title]);

  const share = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    haptic("lock");
    try {
      const blob = await render();
      if (!blob) return;
      const outcome = await shareImage(
        blob,
        `maskoff-${player.id}.png`,
        t(lang, "persona_title"),
        title,
      );
      if (outcome !== "cancelled") {
        setStatus(t(lang, outcome === "shared" ? "persona_shared" : "persona_saved"));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      busy.current = false;
      setTimeout(() => setStatus(null), 2600);
    }
  }, [lang, player.id, render, title]);

  const save = useCallback(async () => {
    try {
      const blob = await render();
      if (!blob) return;
      await saveImage(blob, `maskoff-${player.id}.png`);
      setStatus(t(lang, "persona_saved"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setTimeout(() => setStatus(null), 2600);
    }
  }, [lang, player.id, render]);

  return (
    <div className="space-y-4">
      {/* On-screen preview mirrors the exported image 1:1 in layout. */}
      <div
        className="surface animate-slide-up relative overflow-hidden p-7"
        style={{ background: `linear-gradient(168deg, ${accent}2E, #17131F 58%)` }}
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            {t(lang, "app_name")} · {groupName}
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-pill" style={{ background: accent }}>
            <IconStar className="h-4 w-4 text-ink-900" />
          </span>
        </div>

        <div className="animate-spark mt-6 text-center text-[68px] leading-none" aria-hidden>
          {emoji}
        </div>

        <h2 className="mt-4 text-center font-display text-[30px] font-extrabold" style={{ color: accent }}>
          {title}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/75">{description}</p>

        <dl className="mt-6 space-y-2">
          <Stat label={t(lang, "persona_accuracy")} value={pct(persona.stats.readAccuracy)} accent={accent} />
          <Stat label={t(lang, "persona_predictability")} value={pct(persona.stats.predictability)} accent={accent} />
          <Stat label={t(lang, "persona_contrarian")} value={pct(persona.stats.contrarianRate)} accent={accent} />
          <Stat label={t(lang, "persona_rounds")} value={String(persona.stats.rounds)} accent={accent} />
        </dl>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <div className="tnum font-display text-3xl font-extrabold">{persona.stats.points}</div>
            <div className="text-xs font-medium text-muted">{t(lang, "showdown_points")}</div>
          </div>
          <span className="text-3xl" aria-hidden>{player.emoji}</span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <button type="button" onClick={share} className="btn-coral btn-lg flex-1">
          <IconShare />
          {t(lang, "persona_share")}
        </button>
        <button type="button" onClick={save} className="btn-ghost btn-lg px-5" aria-label={t(lang, "persona_download")}>
          <IconDownload />
        </button>
      </div>

      {status && (
        <p role="status" className="text-center text-xs font-semibold text-pistachio">
          {status}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="surface-2 flex items-center justify-between px-4 py-3">
      <dt className="text-[13px] font-medium text-white/65">{label}</dt>
      <dd className="tnum font-display text-[15px] font-extrabold" style={{ color: accent }}>
        {value}
      </dd>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  rtl: boolean,
): void {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, rtl ? x : x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}
