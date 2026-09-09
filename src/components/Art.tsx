/**
 * All artwork is inline SVG. Nothing is fetched at runtime, so the app renders
 * identically offline and inside the Android WebView.
 */

export function TrainArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      {/* Bullet nose on the left sweeping up into a flat roof, as in the brief. */}
      <path d="M10 46c0-4 1.6-7.6 4.6-10.6C24 26 38 18 56 16h20a8 8 0 0 1 8 8v20a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5Z" fill="#5FC9C4" />
      <path d="M58 16h18a8 8 0 0 1 8 8v20a5 5 0 0 1-5 5H58V16Z" fill="#3AA9A4" opacity=".45" />
      <path d="M20 34c8-7 18-11 28-12v10H18l2 2Z" fill="#EAFBFA" />
      <rect x="52" y="23" width="12" height="10" rx="3.5" fill="#EAFBFA" />
      <rect x="68" y="23" width="12" height="10" rx="3.5" fill="#EAFBFA" opacity=".8" />
      <rect x="14" y="40" width="68" height="4" rx="2" fill="#2C7C79" opacity=".3" />
      <circle cx="30" cy="54" r="4.5" fill="#26264A" />
      <circle cx="30" cy="54" r="1.8" fill="#B9E7E4" />
      <circle cx="66" cy="54" r="4.5" fill="#26264A" />
      <circle cx="66" cy="54" r="1.8" fill="#B9E7E4" />
      <path d="M6 60h84" stroke="#26264A" strokeWidth="3" strokeLinecap="round" opacity=".2" />
    </svg>
  );
}

export function PlaneArt({ className = "" }: { className?: string }) {
  // A jet silhouette drawn upright, then banked 35° so it climbs to the right.
  const plane = "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <g transform="translate(50 34) rotate(35) scale(2.15) translate(-12 -12)">
        <path d={plane} fill="#B9AEF9" transform="translate(1.4 1.4)" />
        <path d={plane} fill="#6C5CE7" />
      </g>
      <circle cx="20" cy="16" r="2.4" fill="#EDEAFE" />
      <circle cx="30" cy="10" r="1.8" fill="#EDEAFE" opacity=".8" />
    </svg>
  );
}

export function BoatArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <path d="M18 36h60l-6 13a8 8 0 0 1-7.2 4.5H31.2A8 8 0 0 1 24 49L18 36Z" fill="#7C6BF0" />
      <path d="M48 36h30l-6 13a8 8 0 0 1-7.2 4.5H48V36Z" fill="#5B4BD6" opacity=".6" />
      <rect x="30" y="20" width="36" height="14" rx="5" fill="#EDEAFE" />
      <rect x="35" y="24" width="7" height="6" rx="2" fill="#9A8CF4" />
      <rect x="45" y="24" width="7" height="6" rx="2" fill="#9A8CF4" />
      <rect x="55" y="24" width="7" height="6" rx="2" fill="#9A8CF4" />
      <path d="M8 57c5-3 8-3 13 0s8 3 13 0 8-3 13 0 8 3 13 0 8-3 13 0 8 3 13 0" stroke="#9A8CF4" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function BusArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <rect x="14" y="16" width="60" height="32" rx="10" fill="#FF8A5B" />
      <path d="M74 24h6c3.3 0 6 2.7 6 6v10a8 8 0 0 1-8 8h-4V24Z" fill="#F36C36" />
      <rect x="20" y="22" width="20" height="12" rx="4" fill="#FFF1EA" />
      <rect x="44" y="22" width="24" height="12" rx="4" fill="#FFF1EA" opacity=".85" />
      <rect x="18" y="39" width="52" height="4" rx="2" fill="#C4491D" opacity=".25" />
      <circle cx="30" cy="50" r="6" fill="#2A2A4A" />
      <circle cx="30" cy="50" r="2.4" fill="#FFD3BE" />
      <circle cx="64" cy="50" r="6" fill="#2A2A4A" />
      <circle cx="64" cy="50" r="2.4" fill="#FFD3BE" />
    </svg>
  );
}

export function HotelArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <rect x="20" y="12" width="34" height="42" rx="6" fill="#5FC9C4" />
      <rect x="54" y="24" width="24" height="30" rx="6" fill="#3AA9A4" opacity=".75" />
      <rect x="26" y="19" width="8" height="8" rx="2.5" fill="#EAFBFA" />
      <rect x="40" y="19" width="8" height="8" rx="2.5" fill="#EAFBFA" />
      <rect x="26" y="32" width="8" height="8" rx="2.5" fill="#EAFBFA" opacity=".8" />
      <rect x="40" y="32" width="8" height="8" rx="2.5" fill="#EAFBFA" opacity=".8" />
      <rect x="60" y="31" width="6" height="7" rx="2" fill="#EAFBFA" opacity=".75" />
      <rect x="68" y="31" width="6" height="7" rx="2" fill="#EAFBFA" opacity=".75" />
      <rect x="33" y="44" width="10" height="10" rx="3" fill="#12122B" opacity=".22" />
      <path d="M10 54h76" stroke="#2A2A4A" strokeWidth="3" strokeLinecap="round" opacity=".18" />
    </svg>
  );
}

export function CarArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <path d="M14 44v-6c0-3 2-5.6 5-6.4l6-1.6 6.4-8A9 9 0 0 1 38.4 18h17.8a9 9 0 0 1 6.6 2.9l7.4 8.1 6.4 2A7 7 0 0 1 82 37.7V44a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4Z" fill="#6C5CE7" />
      <path d="M48 18h8.2a9 9 0 0 1 6.6 2.9l7.4 8.1 6.4 2A7 7 0 0 1 82 37.7V44a4 4 0 0 1-4 4H48V18Z" fill="#5B4BD6" opacity=".65" />
      <path d="M33 29.5 38 23a4 4 0 0 1 3-1.4h12.4a4 4 0 0 1 3 1.3l5.8 6.6H33Z" fill="#EDEAFE" />
      <circle cx="30" cy="48" r="7" fill="#2A2A4A" />
      <circle cx="30" cy="48" r="2.8" fill="#CFC8FB" />
      <circle cx="68" cy="48" r="7" fill="#2A2A4A" />
      <circle cx="68" cy="48" r="2.8" fill="#CFC8FB" />
    </svg>
  );
}

export function SimArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <path d="M28 8h27l17 17v28a7 7 0 0 1-7 7H28a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7Z" fill="#FF8A29" />
      <path d="M55 8l17 17H60a5 5 0 0 1-5-5V8Z" fill="#FFC77F" />
      <rect x="31" y="30" width="30" height="22" rx="5" fill="#FFF3E2" />
      <path d="M31 38h30M46 30v22M38 30v8M54 44v8" stroke="#FF8A29" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PackageArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" aria-hidden>
      <rect x="22" y="22" width="52" height="32" rx="8" fill="#FF4D6D" />
      <rect x="22" y="22" width="52" height="12" rx="6" fill="#FF7A93" />
      <rect x="44" y="22" width="8" height="32" fill="#FFD5DE" />
      <path d="M36 22c-4-6 2-11 6-7l6 7M60 22c4-6-2-11-6-7l-6 7" stroke="#FFD5DE" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 54h68" stroke="#2A2A4A" strokeWidth="3" strokeLinecap="round" opacity=".18" />
    </svg>
  );
}

/* -------- hero: the wide train scene from the top of the search screen ------- */

export function HeroTrainScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 240" className={className} preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C7E9E8" />
          <stop offset="1" stopColor="#A9DEDD" />
        </linearGradient>
        <linearGradient id="heroBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FD6D2" />
          <stop offset="1" stopColor="#4FBDB8" />
        </linearGradient>
      </defs>
      <rect width="420" height="240" fill="url(#heroSky)" />
      <circle cx="60" cy="46" r="46" fill="#fff" opacity=".16" />
      <circle cx="330" cy="30" r="70" fill="#fff" opacity=".12" />
      <path d="M120 26c48-16 92 6 118 34" stroke="#2C4E5E" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 9" opacity=".55" />
      <path d="M238 60c22 26 44 30 70 22" stroke="#2C4E5E" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 9" opacity=".35" />
      <g>
        <path d="M150 196c0-38 32-70 74-70h150c26 0 46 20 46 44v40c0 8-6 14-14 14H166c-9 0-16-7-16-16v-12Z" fill="url(#heroBody)" />
        <path d="M300 126h74c26 0 46 20 46 44v40c0 8-6 14-14 14h-106V126Z" fill="#3FAEAA" opacity=".45" />
        <path d="M176 158c8-14 22-22 38-22h44v30h-88l6-8Z" fill="#EAFBFA" />
        <rect x="274" y="136" width="52" height="30" rx="9" fill="#EAFBFA" opacity=".92" />
        <rect x="340" y="136" width="46" height="30" rx="9" fill="#EAFBFA" opacity=".8" />
        <rect x="160" y="176" width="248" height="7" rx="3.5" fill="#2C7C79" opacity=".3" />
        <rect x="196" y="188" width="34" height="9" rx="4.5" fill="#5B4BD6" opacity=".5" />
        <rect x="300" y="188" width="34" height="9" rx="4.5" fill="#5B4BD6" opacity=".5" />
        <circle cx="212" cy="222" r="13" fill="#26264A" />
        <circle cx="212" cy="222" r="5" fill="#A9DEDD" />
        <circle cx="324" cy="222" r="13" fill="#26264A" />
        <circle cx="324" cy="222" r="5" fill="#A9DEDD" />
      </g>
      <path d="M0 236h420" stroke="#26264A" strokeWidth="5" strokeLinecap="round" opacity=".2" />
    </svg>
  );
}

/* ------------------------------ destinations ------------------------------ */

const SCENES: Record<string, { sky: [string, string]; land: string; accent: string; kind: "mountain" | "city" | "beach" | "desert" }> = {
  bali: { sky: ["#FFD9A8", "#FF9E7A"], land: "#2E7D6E", accent: "#12463F", kind: "beach" },
  dubai: { sky: ["#FFC48A", "#F98F6B"], land: "#C97A4E", accent: "#7A3F2A", kind: "desert" },
  istanbul: { sky: ["#B9D9F5", "#7EA8DE"], land: "#3C4C7A", accent: "#212C52", kind: "city" },
  cairo: { sky: ["#FFE0A3", "#F0A868"], land: "#D9A566", accent: "#8A5F32", kind: "desert" },
  paris: { sky: ["#CFD9F7", "#9FB2EA"], land: "#4A5688", accent: "#2A3160", kind: "city" },
  london: { sky: ["#D5DCE9", "#A9B6CC"], land: "#4B566B", accent: "#2B3342", kind: "city" },
  kualalumpur: { sky: ["#CBE7F5", "#8FC6E3"], land: "#2F6480", accent: "#1B3D50", kind: "city" },
  jakarta: { sky: ["#D8E6F7", "#A6BEE0"], land: "#3B5C7A", accent: "#22364A", kind: "city" },
  bandung: { sky: ["#CFEFE4", "#8FD5BE"], land: "#357A63", accent: "#1C4B3C", kind: "mountain" },
  riyadh: { sky: ["#FFE4B5", "#F5B27A"], land: "#C98F5C", accent: "#7E5433", kind: "desert" },
  jeddah: { sky: ["#BEE7F0", "#7FC6D9"], land: "#2C6E82", accent: "#194351", kind: "beach" },
  doha: { sky: ["#FFDCB0", "#EFA97F"], land: "#A9765A", accent: "#6B4433", kind: "city" },
  default: { sky: ["#CFE4F7", "#9CC0E4"], land: "#3F6285", accent: "#243C52", kind: "mountain" },
};

export function DestinationArt({ name, className = "" }: { name: string; className?: string }) {
  const s = SCENES[name] ?? SCENES.default;
  const id = `sc-${name}`;
  // These cards are cropped to very different aspects — a wide banner on the
  // hotel and package lists, a tall tile on the recommendation row — so the
  // horizon sits near the vertical middle of the viewBox and every feature is
  // drawn around it. That keeps the scene readable under a centred slice.
  return (
    <svg viewBox="0 0 200 260" className={className} preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="260" fill={`url(#${id})`} />
      <circle cx="152" cy="74" r="20" fill="#fff" opacity=".38" />
      <path d="M18 62c12-9 27-9 39 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".4" />

      {s.kind === "mountain" && (
        <>
          <path d="M-10 158 46 92l34 44 26-32 104 62v104H-10Z" fill={s.land} />
          <path d="M46 92 26 118h40L46 92Z" fill="#fff" opacity=".72" />
          <path d="M-10 172c38-12 66 8 102-1 28-7 56 4 108-5v94H-10Z" fill={s.accent} />
        </>
      )}

      {s.kind === "city" && (
        <>
          <rect x="8" y="126" width="28" height="134" rx="4" fill={s.land} />
          <rect x="42" y="96" width="24" height="164" rx="4" fill={s.accent} />
          <rect x="72" y="140" width="32" height="120" rx="4" fill={s.land} />
          <rect x="110" y="76" width="22" height="184" rx="4" fill={s.accent} />
          <rect x="138" y="116" width="30" height="144" rx="4" fill={s.land} />
          <rect x="174" y="150" width="26" height="110" rx="4" fill={s.accent} />
          {Array.from({ length: 24 }).map((_, i) => (
            <rect
              key={i}
              x={14 + (i % 6) * 32}
              y={158 + Math.floor(i / 6) * 22}
              width="7"
              height="9"
              rx="1.5"
              fill="#FFE9B8"
              opacity=".85"
            />
          ))}
        </>
      )}

      {s.kind === "beach" && (
        <>
          <path d="M-10 150c48-16 88 10 134-4 26-8 50 2 86-6v120H-10Z" fill={s.land} />
          <path d="M-10 190c58-10 96 10 146 0 20-4 42 0 74-4v74H-10Z" fill={s.accent} />
          <path d="M52 152c0-32 8-56 8-56s10 22 10 56" stroke="#1F5F52" strokeWidth="5" strokeLinecap="round" />
          <path d="M60 96c-16-8-30-2-34 8 12-6 24-4 34-8Zm0 0c16-8 30-2 34 8-12-6-24-4-34-8Z" fill="#2E7D6E" />
          <path d="M-10 214c46-8 84 10 130 2 22-4 46 2 80-4v48H-10Z" fill={s.land} opacity=".5" />
        </>
      )}

      {s.kind === "desert" && (
        <>
          <path d="M92 156 128 84l38 72H92Z" fill={s.accent} opacity=".9" />
          <path d="M28 156 52 108l26 48H28Z" fill={s.accent} opacity=".55" />
          <path d="M-10 160c38-26 66 4 100-12 26-13 58 6 110-8v120H-10Z" fill={s.land} />
          <path d="M-10 198c48-16 86 8 134-4 22-6 44 0 76-6v72H-10Z" fill={s.accent} />
        </>
      )}
    </svg>
  );
}

/* ------------------------------ carrier marks ----------------------------- */

export function CarrierMark({ id, className = "" }: { id: string; className?: string }) {
  switch (id) {
    case "garuda":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
          <path d="M4 20c6-8 14-11 24-12-4 7-9 11-15 13-3 1-6 1-9-1Z" fill="#0B6BA8" />
          <path d="M9 24c5-5 11-8 19-9-3 5-8 8-13 10-2 .8-4 .6-6-1Z" fill="#1B8CD0" opacity=".8" />
        </svg>
      );
    case "whoosh":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
          <path d="M3 18h16l6-6-3 9H6l-3-3Z" fill="#E0356F" />
          <path d="M6 23h14" stroke="#E0356F" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "kai":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
          <rect x="4" y="9" width="24" height="14" rx="5" fill="#0F5FA8" />
          <rect x="8" y="13" width="7" height="6" rx="2" fill="#fff" />
          <rect x="17" y="13" width="7" height="6" rx="2" fill="#fff" opacity=".8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
          <circle cx="16" cy="16" r="11" fill="currentColor" opacity=".18" />
          <path d="M9 18l14-6-4 9-3-3-7 .5Z" fill="currentColor" />
        </svg>
      );
  }
}
