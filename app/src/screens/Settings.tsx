import { actions, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon } from "../components/ui";
import { MODELS, type ControlLevel, type Dialect, type Vibe } from "../lib/types";
import { detectPlatform } from "../lib/platform";

const platform = detectPlatform();
import { Toggle } from "../components/ui";
import { filesDB, messagesDB } from "../lib/db";

export default function Settings() {
  const s = useStore((x) => x.settings);
  const lang = s.lang;
  return (
    <div className="screen">
      <div className="hdr-light"><h1 className="h1" style={{ margin: 0 }}>{t(lang, "settings")}</h1></div>
      <div className="pad stack">
        <div className="card stack">
          <div className="field">
            <label>{t(lang, "apiKey")}</label>
            <input className="input" dir="ltr" type="password" value={s.apiKey} onChange={(e) => actions.updateSettings({ apiKey: e.target.value.trim() })} placeholder="sk-ant-..." autoCapitalize="off" />
            <span className="small muted">{t(lang, "apiKeyDesc")} · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">{t(lang, "getKey")}</a></span>
          </div>
          <div className="field"><label>{t(lang, "yourName")}</label><input className="input" value={s.userName} onChange={(e) => actions.updateSettings({ userName: e.target.value })} /></div>
        </div>
        <div className="card stack">
          <div className="field"><label>{t(lang, "language")}</label><div className="seg"><button className={lang === "ar" ? "on" : ""} onClick={() => actions.updateSettings({ lang: "ar" })}>العربية</button><button className={lang === "en" ? "on" : ""} onClick={() => actions.updateSettings({ lang: "en" })}>English</button></div></div>
          <div className="field"><label>{t(lang, "theme")}</label><div className="seg"><button className={s.theme === "light" ? "on" : ""} onClick={() => actions.updateSettings({ theme: "light" })}>{t(lang, "light")}</button><button className={s.theme === "dark" ? "on" : ""} onClick={() => actions.updateSettings({ theme: "dark" })}>{t(lang, "dark")}</button></div></div>
        </div>
        <div className="card stack">
          <div className="field"><label>{t(lang, "dialect")}</label>
            <div className="chips">{([["emirati", "dEmirati"], ["gulf", "dGulf"], ["saudi", "dSaudi"], ["egyptian", "dEgyptian"], ["levant", "dLevant"], ["msa", "dMsa"], ["auto", "dAuto"]] as [Dialect, "dEmirati" | "dGulf" | "dSaudi" | "dEgyptian" | "dLevant" | "dMsa" | "dAuto"][]).map(([id, k]) => <button key={id} className={"chip" + (s.dialect === id ? " on" : "")} onClick={() => actions.updateSettings({ dialect: id })}>{t(lang, k)}</button>)}</div>
          </div>
          <div className="field"><label>{t(lang, "vibe")}</label>
            <div className="seg">{([["friends", "vFriends"], ["mixed", "vMixed"], ["professional", "vPro"]] as [Vibe, "vFriends" | "vMixed" | "vPro"][]).map(([id, k]) => <button key={id} className={s.vibe === id ? "on" : ""} onClick={() => actions.updateSettings({ vibe: id })}>{t(lang, k)}</button>)}</div>
            <span className="small muted">{t(lang, "vibeDesc")}</span>
          </div>
          <div className="row between"><div><div style={{ fontWeight: 600 }}>{t(lang, "humanDelay")}</div><div className="small muted">{t(lang, "humanDelayDesc")}</div></div><Toggle on={s.humanDelay} onChange={(v) => actions.updateSettings({ humanDelay: v })} /></div>
        </div>
        <div className="card stack">
          <div><div className="h3">🖥️ {t(lang, "controlTitle")}</div><div className="small muted" style={{ marginTop: 4 }}>{t(lang, "controlDesc")}</div></div>
          <div className="small muted">{t(lang, "platformNow")}: <b>{t(lang, platform === "desktop" ? "pDesktop" : platform === "android" ? "pAndroid" : platform === "ios" ? "pIos" : "pWeb")}</b></div>
          <div className="seg">{(["off", "ask", "full"] as ControlLevel[]).map((lv) => <button key={lv} className={s.control.level === lv ? "on" : ""} onClick={() => actions.updateSettings({ control: { ...s.control, level: lv } })}>{t(lang, lv === "off" ? "levelOff" : lv === "ask" ? "levelAsk" : "levelFull")}</button>)}</div>
          {s.control.level === "full" && <div className="error-box">{t(lang, "fullWarning")}</div>}
          {s.control.level !== "off" && (
            <div className="stack" style={{ gap: 8 }}>
              {([["shell", "ctlShell"], ["files", "ctlFiles"], ["screen", "ctlScreen"], ["device", "ctlDevice"], ["webFetch", "ctlWebFetch"]] as [keyof typeof s.control, "ctlShell" | "ctlFiles" | "ctlScreen" | "ctlDevice" | "ctlWebFetch"][]).map(([k, label]) => (
                <div key={k} className="row between"><span className="small" style={{ fontWeight: 500 }}>{t(lang, label)}</span><Toggle sm on={Boolean(s.control[k])} onChange={(v) => actions.updateSettings({ control: { ...s.control, [k]: v } })} /></div>
              ))}
            </div>
          )}
        </div>
        <div className="card stack">
          <div className="field"><label>{t(lang, "defaultModel")}</label>
            <div className="stack" style={{ gap: 6 }}>{MODELS.map((m) => <button key={m.id} className={"chip" + (s.defaultModel === m.id ? " on" : "")} style={{ justifyContent: "space-between" }} onClick={() => actions.updateSettings({ defaultModel: m.id })}><span>{m.label}</span><span className="small" style={{ opacity: .7 }}>{m.note[lang]} · ${m.inPrice}/${m.outPrice}</span></button>)}</div>
          </div>
          <div className="row between"><span className="muted">{t(lang, "concurrency")}</span><div className="row"><button className="round-btn" onClick={() => actions.updateSettings({ concurrency: Math.max(1, s.concurrency - 1) })}><Icon name="minus" size={16} /></button><b style={{ minWidth: 24, textAlign: "center" }}>{s.concurrency}</b><button className="round-btn" onClick={() => actions.updateSettings({ concurrency: Math.min(6, s.concurrency + 1) })}><Icon name="plus" size={16} /></button></div></div>
        </div>
        <button className="btn block" style={{ background: "var(--red)" }} onClick={async () => { if (confirm(t(lang, "confirmReset"))) { await messagesDB.clear(); await filesDB.clear(); actions.resetAll(); actions.updateSettings({ onboarded: true }); } }}><Icon name="trash" size={18} /> {t(lang, "resetAll")}</button>
        <div className="small muted" style={{ textAlign: "center" }}>Majlis AI · {t(lang, "version")} 1.3.2</div>
      </div>
    </div>
  );
}
