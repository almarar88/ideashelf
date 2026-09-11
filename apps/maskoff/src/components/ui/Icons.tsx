/**
 * Thin-stroke glyph set matching the reference's ringed icon buttons.
 * Inline SVG keeps the bundle free of an icon dependency and lets every glyph
 * inherit `currentColor` so the same icon works on pastel tiles and dark cards.
 */
type Props = { className?: string };

const base = "h-[18px] w-[18px]";
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconBell = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </svg>
);

export const IconPin = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const IconArrow = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

export const IconChevron = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconBack = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconClose = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M6 6 18 18M18 6 6 18" />
  </svg>
);

export const IconGrid = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </svg>
);

export const IconRows = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="4" y="5" width="16" height="6" rx="2" />
    <rect x="4" y="13" width="16" height="6" rx="2" />
  </svg>
);

export const IconVault = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 5.5v2M12 16.5v2M18.5 12h-2M7.5 12h-2" />
  </svg>
);

export const IconMask = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M3 8c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6 3 3 0 0 1-2.6-1.5.5.5 0 0 0-.8 0A3 3 0 0 1 9 16a6 6 0 0 1-6-6Z" />
    <circle cx="8.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconFlame = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-2 1-3 1-3s1 1.4 1 2.6C9 8.5 12 3 12 3Z" />
  </svg>
);

export const IconStar = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9L12 2.6Z" />
  </svg>
);

export const IconEye = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconShare = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 15V3" />
    <path d="m8 6.5 4-3.5 4 3.5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export const IconDownload = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3v12" />
    <path d="m8 11.5 4 3.5 4-3.5" />
    <path d="M5 19h14" />
  </svg>
);

export const IconCheck = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconSpark = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6 8.4 8.4M15.6 15.6l2.8 2.8M18.4 5.6 15.6 8.4M8.4 15.6 5.6 18.4" />
  </svg>
);
