import { useEffect, type ReactNode } from "react";

export function Toggle({ on, onChange, sm }: { on: boolean; onChange: (v: boolean) => void; sm?: boolean }) {
  return <button type="button" className={"toggle" + (on ? " on" : "") + (sm ? " sm" : "")} onClick={(e) => { e.stopPropagation(); onChange(!on); }} aria-pressed={on} />;
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        {title && <h3 className="h3" style={{ marginBottom: 12 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...p}><path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
    case "chat": return <svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>;
    case "users": return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15.5a5 5 0 0 1 5.5 4.5" /></svg>;
    case "folder": return <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
    case "chart": return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "minus": return <svg {...p}><path d="M5 12h14" /></svg>;
    case "back": return <svg {...p}><path d="m15 18-6-6 6-6" /></svg>;
    case "fwd": return <svg {...p}><path d="m9 18 6-6-6-6" /></svg>;
    case "send": return <svg {...p}><path d="m3 11 18-8-8 18-2-8z" /></svg>;
    case "clip": return <svg {...p}><path d="m21 11.5-8.5 8.5a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8-8" /></svg>;
    case "more": return <svg {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></svg>;
    case "bolt": return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
    case "search": return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case "share": return <svg {...p}><path d="M4 12v8h16v-8M12 3v13M8 7l4-4 4 4" /></svg>;
    case "trash": return <svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
    case "file": return <svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
    case "image": return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-9 9" /></svg>;
    case "stop": return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>;
    case "check": return <svg {...p}><path d="m5 12 5 5L20 7" /></svg>;
    case "x": return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    case "gavel": return <svg {...p}><path d="m14 4 6 6M9 9l6 6M2 21h9M4 15l5-5 4 4-5 5zM15 3l6 6-2 2-6-6z" /></svg>;
    case "copy": return <svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
    case "refresh": return <svg {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>;
    case "star": return <svg {...p}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" /></svg>;
    case "globe": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
    case "edit": return <svg {...p}><path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4" /></svg>;
    case "reply": return <svg {...p}><path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 7 7v4" /></svg>;
    default: return null;
  }
}

/** Arc gauge with ticks (AC-dial style). value 0..100 */
export function Gauge({ value, color = "#f47a4b", label, size = 260 }: { value: number; color?: string; label?: string; size?: number }) {
  const ticks = 48; const r = 100; const cx = 120; const cy = 120;
  const els = [];
  for (let i = 0; i < ticks; i++) {
    const a = Math.PI * (1 + i / (ticks - 1)); // from 180° to 360°
    const on = i / (ticks - 1) <= value / 100;
    const len = i % 6 === 0 ? 22 : 16;
    const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
    const x2 = cx + Math.cos(a) * (r - len), y2 = cy + Math.sin(a) * (r - len);
    els.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? color : "currentColor"} strokeOpacity={on ? 1 : 0.18} strokeWidth={3.2} strokeLinecap="round" />);
  }
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 240 132" style={{ display: "block" }}>
      {els}
      {label && <text x="120" y="88" textAnchor="middle" fontSize="12" fill="currentColor" opacity=".6">{label}</text>}
    </svg>
  );
}

export function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", height: 18 }}>
      {[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 4, background: "currentColor", opacity: .5, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}
    </span>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
}

export function fmtTime(ts: number, lang: string): string {
  return new Date(ts).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(ts: number, lang: string): string {
  const d = new Date(ts); const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(ts, lang);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" });
}
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return String(n);
}
