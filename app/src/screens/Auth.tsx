import { useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { useStore, actions } from "../lib/store";
import { t } from "../lib/i18n";
import { resetPassword, signIn, signUp } from "../lib/account";
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
        <div className="pill orange" style={{ alignSelf: "flex-start" }}>Majlis AI</div>
        <h1 className="h1" style={{ fontSize: 30 }}>{t(lang, "welcomeSignIn")}</h1>
        <div className="sub">{t(lang, "welcome2")}</div>
      </div>
      <div className="pad stack" style={{ marginTop: 16 }}>
        <div className="seg"><button className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>{t(lang, "signUp")}</button><button className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>{t(lang, "signIn")}</button></div>
        {mode === "up" && <div className="field"><label>{t(lang, "yourName")}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>}
        <div className="field"><label>{t(lang, "email")}</label><input className="input" dir="ltr" type="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div className="field"><label>{t(lang, "password")}</label><input className="input" dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} /></div>
        {msg && <div className="card soft small">{msg}</div>}
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
