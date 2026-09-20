import { actions, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon } from "../components/ui";
import { MODELS, type ControlLevel, type Dialect, type Speed, type Vibe } from "../lib/types";
import { detectPlatform } from "../lib/platform";

const platform = detectPlatform();
import { Sheet, Toggle } from "../components/ui";
import { useState } from "react";
import { APP_BUILD, APP_VERSION, HOSTED_ENABLED, PRIVACY_URL, RELEASE_URL, TERMS_URL } from "../config";
import { checkForUpdate } from "../lib/updates";
import { canSpeak } from "../lib/voice";
import { deleteAccount, refreshMe, signOut, useAccount, usageRatio } from "../lib/account";
import Paywall from "./Paywall";
import { billingAvailable, configureBilling, logoutBilling, presentCustomerCenter } from "../lib/billing";

function AccountCard() {
  const lang = useStore((x) => x.settings.lang);
  const { session, me } = useAccount();
  const [pay, setPay] = useState(false);
  if (!session) return null;
  return (
    <div className="card stack">
      <div className="row between"><div><div className="h3">{t(lang, "account")}</div><div className="small muted" dir="ltr">{session.user.email}</div></div><span className="pill orange">{me?.plan.name ?? "…"}</span></div>
      {me && (
        <div>
          <div className="row between small"><span>{t(lang, "usageThisMonth")}</span><span>{Math.round(usageRatio(me) * 100)}%{me.plan.daily_messages ? ` · ${t(lang, "dailyLeft")} ${Math.max(0, me.plan.daily_messages - me.usage.day_messages)}/${me.plan.daily_messages}` : ""}</span></div>
          <div className="score-bar" style={{ marginTop: 6 }}><div style={{ width: `${usageRatio(me) * 100}%` }} /></div>
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn orange grow" onClick={() => setPay(true)}><Icon name="star" size={16} /> {t(lang, "upgrade")}</button>
        <button className="btn light" onClick={() => refreshMe(true)}><Icon name="refresh" size={16} /></button>
        <button className="btn light" onClick={async () => { await logoutBilling(); await signOut(); }}>{t(lang, "signOut")}</button>
      </div>
      {billingAvailable() && <button className="btn light block" onClick={async () => { await configureBilling(session.user.id); if (!(await presentCustomerCenter())) setPay(true); }}><Icon name="settings" size={16} /> {t(lang, "manageSub")}</button>}
      <div className="row between small muted">
        <span><a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t(lang, "legal")}</a></span>
        <button style={{ color: "var(--red)" }} onClick={async () => { if (confirm(t(lang, "confirmDeleteAccount"))) { const e = await deleteAccount(); if (e) alert(e); } }}>{t(lang, "deleteAccount")}</button>
      </div>
      <Sheet open={pay} onClose={() => setPay(false)}><Paywall onClose={() => setPay(false)} /></Sheet>
    </div>
  );
}
void TERMS_URL;
import { filesDB, messagesDB } from "../lib/db";

export default function Settings() {
  const s = useStore((x) => x.settings);
  const lang = s.lang;
  const [upd, setUpd] = useState<string | null>(null);
  const checkNow = async () => {
    setUpd("…");
    const u = await checkForUpdate(true);
    setUpd(u ? `${t(lang, "updateAvailable")}: ${u.version} (build ${u.build})` : t(lang, "upToDate"));
  };
  return (
    <div className="screen">
      <div className="hdr-light"><h1 className="h1" style={{ margin: 0 }}>{t(lang, "settings")}</h1></div>
      <div className="pad stack">
        {HOSTED_ENABLED && <AccountCard />}
        <div className="card stack">
          {HOSTED_ENABLED && (
            <div className="field"><label>{t(lang, "aiSource")}</label>
              <div className="seg"><button className={s.aiMode === "hosted" ? "on" : ""} onClick={() => actions.updateSettings({ aiMode: "hosted" })}>{t(lang, "aiHosted")}</button><button className={s.aiMode === "byok" ? "on" : ""} onClick={() => actions.updateSettings({ aiMode: "byok" })}>{t(lang, "aiByok")}</button></div>
            </div>
          )}
          {(!HOSTED_ENABLED || s.aiMode === "byok") && (
            <div className="field">
              <label>{t(lang, "apiKey")}</label>
              <input className="input" dir="ltr" type="password" value={s.apiKey} onChange={(e) => actions.updateSettings({ apiKey: e.target.value.trim() })} placeholder="sk-ant-..." autoCapitalize="off" />
              <span className="small muted">{t(lang, "apiKeyDesc")} · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">{t(lang, "getKey")}</a></span>
            </div>
          )}
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
          {canSpeak() && <div className="row between"><div><div style={{ fontWeight: 600 }}>🔊 {t(lang, "autoRead")}</div><div className="small muted">{t(lang, "autoReadDesc")}</div></div><Toggle on={s.autoRead} onChange={(v) => actions.updateSettings({ autoRead: v })} /></div>}
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
          <div className="field"><label>⚡ {t(lang, "speed")}</label>
            <div className="stack" style={{ gap: 6 }}>
              {([["fast", "speedFast", "speedFastDesc"], ["balanced", "speedBalanced", "speedBalancedDesc"], ["quality", "speedQuality", "speedQualityDesc"]] as [Speed, "speedFast" | "speedBalanced" | "speedQuality", "speedFastDesc" | "speedBalancedDesc" | "speedQualityDesc"][]).map(([id, k, d]) => (
                <button key={id} className={"chip" + (s.speed === id ? " on" : "")} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "10px 14px" }} onClick={() => actions.updateSettings({ speed: id })}><span style={{ fontWeight: 600 }}>{t(lang, k)}</span><span className="small" style={{ opacity: .75, textAlign: "start" }}>{t(lang, d)}</span></button>
              ))}
            </div>
          </div>
          <div className="field"><label>{t(lang, "defaultModel")} <span className="small muted">({lang === "ar" ? "يُستخدم فقط عند اختياره لوكيل بعينه" : "only for agents that pick it explicitly"})</span></label>
            <div className="stack" style={{ gap: 6 }}>{MODELS.map((m) => <button key={m.id} className={"chip" + (s.defaultModel === m.id ? " on" : "")} style={{ justifyContent: "space-between" }} onClick={() => actions.updateSettings({ defaultModel: m.id })}><span>{m.label}</span><span className="small" style={{ opacity: .7 }}>{m.note[lang]} · ${m.inPrice}/${m.outPrice}</span></button>)}</div>
          </div>
          <div className="row between"><span className="muted">{t(lang, "concurrency")}</span><div className="row"><button className="round-btn" onClick={() => actions.updateSettings({ concurrency: Math.max(1, s.concurrency - 1) })}><Icon name="minus" size={16} /></button><b style={{ minWidth: 24, textAlign: "center" }}>{s.concurrency}</b><button className="round-btn" onClick={() => actions.updateSettings({ concurrency: Math.min(6, s.concurrency + 1) })}><Icon name="plus" size={16} /></button></div></div>
        </div>
        <button className="btn block" style={{ background: "var(--red)" }} onClick={async () => { if (confirm(t(lang, "confirmReset"))) { await messagesDB.clear(); await filesDB.clear(); actions.resetAll(); actions.updateSettings({ onboarded: true }); } }}><Icon name="trash" size={18} /> {t(lang, "resetAll")}</button>
        {!HOSTED_ENABLED && (
          <div className="card stack">
            <div className="row between"><div><div style={{ fontWeight: 600 }}>{t(lang, "checkUpdates")}</div><div className="small muted">{t(lang, "checkUpdatesDesc")}</div></div><Toggle on={s.checkUpdates} onChange={(v) => actions.updateSettings({ checkUpdates: v })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn light grow" onClick={checkNow}><Icon name="refresh" size={16} /> {t(lang, "checkUpdates")}</button>
              <a className="btn light" href={RELEASE_URL} target="_blank" rel="noreferrer"><Icon name="globe" size={16} /></a>
            </div>
            {upd && <div className="small muted">{upd}</div>}
          </div>
        )}
        <div className="small muted" style={{ textAlign: "center" }}>LiwaBot · {t(lang, "version")} {APP_VERSION} ({APP_BUILD})</div>
      </div>
    </div>
  );
}
