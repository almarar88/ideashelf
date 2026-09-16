import React, { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/useT";

export const Card = ({ children, className = "", onClick, dark = false }: { children: React.ReactNode; className?: string; onClick?: () => void; dark?: boolean }) => (
  <div onClick={onClick} className={`${dark ? "card-dark" : "card-white"} p-4 ${onClick ? "active:scale-[0.98] transition-transform cursor-pointer" : ""} ${className}`}>{children}</div>
);

export const priorityColor: Record<string, string> = { urgent: "bg-urgent text-white", medium: "bg-medium text-white", normal: "bg-olive-700 text-white" };

export const Pill = ({ children, className = "", tone = "dark" }: { children: React.ReactNode; className?: string; tone?: "dark" | "light" | "urgent" | "medium" | "ok" | "info" | "ghost" }) => {
  const tones: Record<string, string> = {
    dark: "bg-olive-700 text-white", light: "bg-white text-ink", urgent: "bg-urgent text-white", medium: "bg-medium text-white", ok: "bg-ok text-white", info: "bg-info text-white", ghost: "bg-white/10 text-white border border-white/15",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
};

export const Button = ({ children, onClick, variant = "light", className = "", disabled, type = "button", small }: { children: React.ReactNode; onClick?: () => void; variant?: "light" | "dark" | "ghost" | "danger" | "accent"; className?: string; disabled?: boolean; type?: "button" | "submit"; small?: boolean }) => {
  const v: Record<string, string> = {
    light: "bg-white text-ink", dark: "bg-olive-800 text-white", ghost: "bg-white/10 text-white border border-white/15", danger: "bg-urgent text-white", accent: "bg-medium text-white",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold ${small ? "px-3 py-1.5 text-[12px]" : "px-4 py-2.5 text-[14px]"} ${v[variant]} disabled:opacity-40 active:scale-95 transition ${className}`}>{children}</button>
  );
};

export const SectionTitle = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mt-6 mb-3">
    <h2 className="text-[24px] font-bold tracking-tight">{children}</h2>
    {action}
  </div>
);

export const Header = ({ title, onBack, right, subtitle }: { title: React.ReactNode; onBack?: () => void; right?: React.ReactNode; subtitle?: React.ReactNode }) => {
  const { dir } = useT();
  const Back = dir === "rtl" ? ChevronRight : ChevronLeft;
  return (
    <div className="flex items-center gap-3 pt-2 pb-3">
      {onBack && <button onClick={onBack} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><Back size={20} /></button>}
      <div className="flex-1 min-w-0">
        <h1 className="text-[26px] font-bold leading-tight truncate">{title}</h1>
        {subtitle && <div className="text-white/60 text-[13px]">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
};

export const Sheet = ({ open, onClose, title, children, full = false }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; full?: boolean }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-[520px] md:max-w-[720px] bg-olive-600 text-white rounded-t-[28px] md:rounded-[28px] slide-up ${full ? "h-[94%] md:h-[90%]" : "max-h-[90%]"} flex flex-col`} style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="text-[18px] font-bold">{title}</div>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 flex-1">{children}</div>
      </div>
    </div>
  );
};

export const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block mb-3">
    <span className="label">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-white/50 mt-1 block">{hint}</span>}
  </label>
);

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`field ${p.className ?? ""}`} />;
export const TextArea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`field min-h-[90px] ${p.className ?? ""}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`field ${p.className ?? ""}`} />;

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="text-center text-white/50 py-10 text-[14px]">{children}</div>;

export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex items-center gap-2 text-white/80 text-[13px] py-2"><span className="h-2 w-2 rounded-full bg-white pulse-soft" /><span className="h-2 w-2 rounded-full bg-white pulse-soft [animation-delay:.2s]" /><span className="h-2 w-2 rounded-full bg-white pulse-soft [animation-delay:.4s]" />{label && <span className="ms-2">{label}</span>}</div>
);

export const Score = ({ value, label, size = 56 }: { value: number; label?: string; size?: number }) => {
  const r = (size - 8) / 2; const c = 2 * Math.PI * r;
  const tone = value >= 70 ? "#5E9C5A" : value >= 45 ? "#C4901D" : "#F26B2B";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={6} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={6} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold">{value}</div>
      </div>
      {label && <div className="text-[11px] text-white/60">{label}</div>}
    </div>
  );
};

export const Toast = ({ msg }: { msg: string | null }) => (msg ? <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] bg-white text-ink px-4 py-2 rounded-full text-[13px] font-semibold shadow-card slide-up">{msg}</div> : null);
