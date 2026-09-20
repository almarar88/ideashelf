// Procedural robot faces. 12 variants, tinted by color.
interface Props { variant: number; color: string; size?: number; mood?: "idle" | "busy" | "happy" | "error" | "talking"; }

export const AVATAR_COUNT = 12;

export function RobotAvatar({ variant, color, size = 64, mood = "idle" }: Props) {
  const v = ((variant % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const head = v % 4;       // 0 rounded square, 1 circle, 2 dome, 3 hex
  const eyes = v % 6;       // eye style
  const antenna = v % 3;    // 0 single, 1 twin, 2 none/side-lights
  const ears = v % 2;
  const dark = "#2b2724";
  const face = "#f6f4f0";
  const eyeColor = mood === "error" ? "#e35d5d" : dark;
  const busy = mood === "busy";

  const headPath = (() => {
    switch (head) {
      case 0: return <rect x="10" y="14" width="44" height="40" rx="14" fill={color} />;
      case 1: return <circle cx="32" cy="34" r="22" fill={color} />;
      case 2: return <path d="M10 54 V32 a22 22 0 0 1 44 0 V54 a4 4 0 0 1 -4 4 H14 a4 4 0 0 1 -4 -4 Z" fill={color} />;
      default: return <path d="M20 12 H44 L56 34 L44 56 H20 L8 34 Z" fill={color} />;
    }
  })();

  const facePlate = head === 1
    ? <circle cx="32" cy="36" r="15" fill={face} />
    : head === 3
      ? <path d="M22 22 H42 L50 34 L42 46 H22 L14 34 Z" fill={face} />
      : <rect x="16" y="24" width="32" height="24" rx="9" fill={face} />;

  const eyesEl = (() => {
    const cy = 36;
    switch (eyes) {
      case 0: return (<g fill={eyeColor}><circle cx="25" cy={cy} r="3.4" /><circle cx="39" cy={cy} r="3.4" /></g>);
      case 1: return (<g><rect x="20" y={cy - 3} width="24" height="6" rx="3" fill={eyeColor} /><rect x="24" y={cy - 1.4} width="6" height="2.8" rx="1.4" fill={color} /></g>);
      case 2: return (<g stroke={eyeColor} strokeWidth="2.6" fill="none" strokeLinecap="round"><path d="M21 37 q4 -5 8 0" /><path d="M35 37 q4 -5 8 0" /></g>);
      case 3: return (<g fill={eyeColor}><rect x="21" y={cy - 3.5} width="7" height="7" rx="2" /><rect x="36" y={cy - 3.5} width="7" height="7" rx="2" /></g>);
      case 4: return (<g><circle cx="32" cy={cy} r="6" fill={eyeColor} /><circle cx="34" cy={cy - 2} r="1.8" fill={face} /></g>);
      default: return (<g fill={eyeColor}><path d="M21 33 l8 3 l-8 3 z" /><path d="M43 33 l-8 3 l8 3 z" /></g>);
    }
  })();

  const mouth = mood === "talking"
    ? <rect x="27" y="41" width="10" height="4" rx="2" fill={eyeColor}><animate attributeName="height" values="2;7;3;6;2" dur="0.5s" repeatCount="indefinite" /><animate attributeName="y" values="42.5;40;42;40.5;42.5" dur="0.5s" repeatCount="indefinite" /></rect>
    : mood === "happy"
    ? <path d="M27 43 q5 4 10 0" stroke={eyeColor} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    : mood === "error"
      ? <path d="M27 45 q5 -4 10 0" stroke={eyeColor} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      : <rect x="28" y="42.5" width="8" height="2.4" rx="1.2" fill={eyeColor} opacity=".7" />;

  const antennaEl = (() => {
    if (antenna === 0) return (<g><rect x="30.5" y="4" width="3" height="11" rx="1.5" fill={dark} /><circle cx="32" cy="4" r="3.2" fill={busy ? "#f47a4b" : color} stroke={dark} strokeWidth="1.2">{busy && <animate attributeName="opacity" values="1;.3;1" dur="1s" repeatCount="indefinite" />}</circle></g>);
    if (antenna === 1) return (<g><path d="M22 14 L18 6" stroke={dark} strokeWidth="2.5" strokeLinecap="round" /><path d="M42 14 L46 6" stroke={dark} strokeWidth="2.5" strokeLinecap="round" /><circle cx="18" cy="5.5" r="2.6" fill={dark} /><circle cx="46" cy="5.5" r="2.6" fill={dark} /></g>);
    return null;
  })();

  const earsEl = ears === 0
    ? (<g fill={dark}><rect x="4" y="28" width="7" height="14" rx="3" /><rect x="53" y="28" width="7" height="14" rx="3" /></g>)
    : (<g fill={dark} opacity=".85"><circle cx="8" cy="35" r="5" /><circle cx="56" cy="35" r="5" /></g>);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", flexShrink: 0 }}>
      {antennaEl}
      {earsEl}
      {headPath}
      {facePlate}
      {eyesEl}
      {mouth}
      {busy && <circle cx="52" cy="18" r="4" fill="#f47a4b"><animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" /></circle>}
    </svg>
  );
}
