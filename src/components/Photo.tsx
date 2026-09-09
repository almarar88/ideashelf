import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiBase } from "@/lib/api";
import { cx } from "@/components/ui";
import type { Photo as PhotoData } from "@/lib/types";

/**
 * A real photograph with the illustrated scene behind it.
 *
 * The artwork paints immediately and stays visible until the photo decodes, so
 * a slow connection shows a designed placeholder rather than a grey box — and
 * if the image fails outright (offline, blocked), the illustration simply
 * remains. That is why the fallback is a node, not a spinner.
 *
 * Commons photos are CC-licensed, so the credit is not optional: `showCredit`
 * only moves it, it never removes the underlying attribution link.
 */
export default function Photo({
  photo,
  fallback,
  alt,
  className = "",
  showCredit = true,
}: {
  photo?: PhotoData | null;
  fallback: ReactNode;
  alt: string;
  className?: string;
  showCredit?: boolean;
}) {
  const [state, setState] = useState<"idle" | "loaded" | "failed">("idle");

  useEffect(() => {
    setState("idle");
  }, [photo?.url]);

  return (
    <span className={cx("relative block overflow-hidden", className)}>
      <span className="absolute inset-0">{fallback}</span>

      {photo?.url && state !== "failed" && (
        <img
          src={photo.url.startsWith("/") ? `${apiBase()}${photo.url}` : photo.url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={cx(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {photo && state === "loaded" && showCredit && (
        <span className="absolute bottom-1 end-1.5 flex items-center gap-1 rounded-full bg-ink/55 px-1.5 py-0.5 text-[8px] font-medium text-white/90 backdrop-blur-sm">
          <Info size={8} />
          <span className="max-w-[110px] truncate">{photo.licence}</span>
        </span>
      )}
    </span>
  );
}

/** Full credit line for detail screens, where there is room for the author. */
export function PhotoCredit({ photo }: { photo?: PhotoData | null }) {
  if (!photo) return null;
  return (
    <p className="px-1 text-[10px] leading-relaxed text-ink-faint">
      {photo.title} — {photo.author} ·{" "}
      <a
        href={photo.descriptionUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-dotted"
      >
        {photo.licence}
      </a>
      {photo.representative === false && (
        <span className="ms-1 opacity-80">(city photo, not this property)</span>
      )}
    </p>
  );
}
