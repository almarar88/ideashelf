import { useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { actions, getState, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { defaultAgents, defaultJudge } from "../lib/presets";
import { HOSTED_ENABLED } from "../config";

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  const [name, setName] = useState(settings.userName);
  const [key, setKey] = useState(settings.apiKey);

  const finish = () => {
    actions.updateSettings({ userName: name.trim(), apiKey: key.trim(), onboarded: true });
    onDone();
  };
  const setLang = (l: "ar" | "en") => {
    actions.updateSettings({ lang: l });
    actions.setJudge(defaultJudge(l));
    // Replace default agents only if user hasn't customized them
    if (getState().groups.length === 0) actions.setAgents(defaultAgents(l));
  };

  return (
    <div className="screen" style={{ paddingBottom: 24 }}>
      <div className="hdr-dark" style={{ borderRadius: 0, minHeight: "48vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div className="seg" style={{ background: "rgba(255,255,255,.1)", width: 150, position: "absolute", top: "calc(14px + var(--safe-top))", insetInlineEnd: 16 }}>
          <button className={lang === "ar" ? "on" : ""} style={lang === "ar" ? {} : { color: "#fff" }} onClick={() => setLang("ar")}>عربي</button>
          <button className={lang === "en" ? "on" : ""} style={lang === "en" ? {} : { color: "#fff" }} onClick={() => setLang("en")}>EN</button>
        </div>
        <div className="row" style={{ marginBottom: 18 }}>
          {[0, 3, 6, 11, 1].map((v, i) => <span key={i} style={{ marginInlineStart: i ? -16 : 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,.35))" }}><RobotAvatar variant={v} color={["#f47a4b", "#4f8ef7", "#ef6aa0", "#e35d5d", "#3aa7a3"][i]} size={72} mood="happy" /></span>)}
        </div>
        <div className="pill orange" style={{ alignSelf: "flex-start" }}>Majlis AI</div>
        <h1 className="h1" style={{ fontSize: 34 }}>{t(lang, "welcome1")}</h1>
        <p className="sub" style={{ fontSize: 15, lineHeight: 1.6 }}>{t(lang, "welcome2")}</p>
      </div>
      <div className="pad stack" style={{ marginTop: 18 }}>
        <div className="field"><label>{t(lang, "yourName")}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "ar" ? "مثال: أحمد" : "e.g. Ahmed"} /></div>
        {!HOSTED_ENABLED && <div className="field">
          <label>{t(lang, "apiKey")}</label>
          <input className="input" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoCapitalize="off" autoCorrect="off" />
          <span className="small muted">{t(lang, "apiKeyDesc")} · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">{t(lang, "getKey")}</a></span>
        </div>}
        <button className="btn block" style={{ marginTop: 8, padding: 18 }} onClick={finish}>{t(lang, "getStarted")}</button>
      </div>
    </div>
  );
}
