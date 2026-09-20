import { useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { useStore, actions } from "../lib/store";
import { t } from "../lib/i18n";
import { resetPassword, signIn, signInWithGoogle, signUp, useAccount } from "../lib/account";
import { Spinner } from "../components/ui";
import { PRIVACY_URL, TERMS_URL } from "../config";

export default function Auth({ onSkipToKey }: { onSkipToKey?: () => void }) {
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState(settings.userName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { error: authError } = useAccount();

  const google = async () => {
    setBusy(true); setMsg(null);
    try { const err = await signInWithGoogle(); if (err) setMsg(err); }
    finally { setBusy(false); }
  };

  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      const err = mode === "in" ? await signIn(email.trim(), pw) : await signUp(email.trim(), pw, name.trim());
      if (err) setMsg(err);
      else if (name.trim()) actions.updateSettings({ userName: name.trim() });
      if (!err && mode === "up") setMsg(lang === "ar" ? "تم إنشاء الحساب. إذا طُلب تأكيد البريد افتح الرابط ثم سجّل الدخول." : "Account created. If email confirmation is required, open the link then sign in.");
    } finally { setBusy(false); }
  };

  return (
    <div className="screen" style={{ paddingBottom: 24 }}>
      <div className="hdr-dark" style={{ borderRadius: 0, minHeight: "38vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div className="row" style={{ marginBottom: 14 }}>
          {[0, 3, 6, 11].map((v, i) => <span key={i} style={{ marginInlineStart: i ? -16 : 0 }}><RobotAvatar variant={v} color={["#f47a4b", "#4f8ef7", "#ef6aa0", "#e35d5d"][i]} size={64} mood="happy" /></span>)}
        </div>
        <div className="pill orange" style={{ alignSelf: "flex-start" }}>LiwaBot</div>
        <h1 className="h1" style={{ fontSize: 30 }}>{t(lang, "welcomeSignIn")}</h1>
        <div className="sub">{t(lang, "welcome2")}</div>
      </div>
      <div className="pad stack" style={{ marginTop: 16 }}>
        <button className="btn block" style={{ padding: 16, background: "var(--white)", color: "var(--text)", border: "1px solid var(--line)", gap: 10 }} disabled={busy} onClick={google}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.5-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
          {t(lang, "signInGoogle")}
        </button>
        <div className="row small muted" style={{ gap: 10 }}><span className="divider grow" /> {t(lang, "orSep")} <span className="divider grow" /></div>
        <div className="seg"><button className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>{t(lang, "signUp")}</button><button className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>{t(lang, "signIn")}</button></div>
        {mode === "up" && <div className="field"><label>{t(lang, "yourName")}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>}
        <div className="field"><label>{t(lang, "email")}</label><input className="input" dir="ltr" type="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div className="field"><label>{t(lang, "password")}</label><input className="input" dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} /></div>
        {(msg || authError) && <div className="card soft small">{msg ?? authError}</div>}
        <button className="btn orange block" style={{ padding: 18 }} disabled={busy || !email || pw.length < 6} onClick={go}>{busy ? <Spinner /> : t(lang, mode === "in" ? "signIn" : "signUp")}</button>
        {mode === "in" && <button className="small muted" onClick={async () => { const e = await resetPassword(email.trim()); setMsg(e ?? t(lang, "resetSent")); }}>{t(lang, "forgot")}</button>}
        <div className="small muted" style={{ textAlign: "center" }}>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{lang === "ar" ? "سياسة الخصوصية" : "Privacy"}</a> · <a href={TERMS_URL} target="_blank" rel="noreferrer">{lang === "ar" ? "الشروط" : "Terms"}</a>
        </div>
        {onSkipToKey && <button className="small muted" style={{ textAlign: "center" }} onClick={onSkipToKey}>{t(lang, "aiByok")} →</button>}
      </div>
    </div>
  );
}
