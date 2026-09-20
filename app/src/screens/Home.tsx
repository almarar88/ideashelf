import { useEffect, useMemo, useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { actions, getState, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon, Sheet, Toggle, fmtDate, fmtNum } from "../components/ui";
import { JUDGE_ID, costUSD, uid, type Group, type Message } from "../lib/types";
import { SESSION_EXAMPLES, TEAM_PRESETS, materialize, presetAgents } from "../lib/presets";
import { useAccount, usageRatio } from "../lib/account";
import { HOSTED_ENABLED } from "../config";
import { messagesDB } from "../lib/db";
import { checkForUpdate, type UpdateInfo } from "../lib/updates";
import { Capacitor } from "@capacitor/core";

interface Hit { m: Message; g: Group; }

const EMOJIS = ["🚀", "💼", "🏪", "📈", "🧠", "🏥", "⚖️", "🎯", "🛠️", "✈️", "🏠", "🎨"];

export default function Home({ openChat, goAgents, goSettings }: { openChat: (id: string) => void; goAgents: () => void; goSettings: () => void }) {
  const { settings, agents, groups, usageLog, judge } = useStore((s) => s);
  const { me } = useAccount();
  const lang = settings.lang;
  const [creating, setCreating] = useState(false);
  const [gName, setGName] = useState("");
  const [gEmoji, setGEmoji] = useState("🚀");
  const [gMembers, setGMembers] = useState<string[]>(agents.filter((a) => a.active).map((a) => a.id));
  const [gJudge, setGJudge] = useState(true);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!settings.checkUpdates || HOSTED_ENABLED || !(Capacitor.isNativePlatform() || Boolean((window as unknown as { majlisDesktop?: unknown }).majlisDesktop))) return;
    checkForUpdate().then(setUpdate).catch(() => undefined);
  }, [settings.checkUpdates]);

  // Search across every chat (debounced; loads messages lazily from IndexedDB).
  useEffect(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) { setHits(null); return; }
    let live = true;
    const tm = window.setTimeout(async () => {
      const out: Hit[] = [];
      for (const g of groups) {
        const ms = await messagesDB.get(g.id);
        for (const m of ms) if ((m.text + " " + (m.verdict?.decision ?? "") + " " + m.files.map((f) => f.name).join(" ")).toLowerCase().includes(needle)) out.push({ m, g });
        if (!live) return;
      }
      out.sort((a, b) => b.m.createdAt - a.m.createdAt);
      setHits(out.slice(0, 60));
    }, 220);
    return () => { live = false; window.clearTimeout(tm); };
  }, [q, groups]);

  const senderName = (m: Message) => m.role === "user" ? (lang === "ar" ? "أنت" : "You") : m.agentId === JUDGE_ID ? judge.name : agents.find((a) => a.id === m.agentId)?.name ?? "?";
  const snippet = (m: Message) => {
    const text = m.verdict ? m.verdict.decision + " — " + m.verdict.summary : m.text || m.files.map((f) => f.name).join(", ");
    const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
    const start = Math.max(0, i - 40);
    return (start > 0 ? "…" : "") + text.slice(start, start + 120) + (text.length > start + 120 ? "…" : "");
  };
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt || 0) - (a.updatedAt || 0)), [groups]);

  const active = agents.filter((a) => a.active);
  const tokens = usageLog.reduce((n, e) => n + e.input + e.output, 0);
  const cost = usageLog.reduce((n, e) => n + costUSD(e.model, { input: e.input, output: e.output }), 0);

  const create = () => {
    const g: Group = { id: uid(), name: gName.trim() || (lang === "ar" ? "مجموعة جديدة" : "New group"), emoji: gEmoji, memberIds: gMembers, judgeEnabled: gJudge, debate: false, banter: true, createdAt: Date.now(), updatedAt: Date.now(), lastPreview: "", lastSender: "", msgCount: 0 };
    actions.upsertGroup(g); setCreating(false); setGName(""); openChat(g.id);
  };
  /** One-tap team: adds any missing preset agents, then creates the group. */
  const createTeam = (tp: (typeof TEAM_PRESETS)[number]) => {
    const all = presetAgents(lang);
    const ids = tp.agents.map((key) => {
      const preset = all.find((p) => p.id === "preset-" + key)!;
      const existing = getState().agents.find((a) => a.name === preset.name && a.title === preset.title);
      if (existing) return existing.id;
      const a = materialize(preset); actions.upsertAgent(a); return a.id;
    });
    const g: Group = { id: uid(), name: tp.name[lang], emoji: tp.emoji, memberIds: ids, judgeEnabled: true, debate: false, banter: true, createdAt: Date.now(), updatedAt: Date.now(), lastPreview: "", lastSender: "", msgCount: 0 };
    actions.upsertGroup(g); setCreating(false); openChat(g.id);
  };

  return (
    <div className="screen">
      <div className="hdr-dark">
        <div className="row between">
          <div className="row">
            <div style={{ position: "relative" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg,#f47a4b,#e9b43a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, color: "#fff" }}>{(settings.userName || "M").slice(0, 1).toUpperCase()}</div>
              <span className="pill orange" style={{ position: "absolute", bottom: -6, insetInlineStart: 8, padding: "2px 8px", fontSize: 10 }}>{me?.plan.name ?? (HOSTED_ENABLED ? "Free" : "Pro")}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={goSettings}><Icon name="settings" /></button>
        </div>
        <h1 className="h1">{t(lang, "hi")} {settings.userName || (lang === "ar" ? "بك" : "there")}</h1>
        <div className="sub">{t(lang, "tagline")}</div>

        <div className="hero-img" style={{ marginTop: 22 }} onClick={() => setCreating(true)}>
          <div className="tags">
            <span className="pill ghost"><Icon name="users" size={13} /> {active.length} {t(lang, "activeAgents")}</span>
            <span className="pill ghost"><Icon name="gavel" size={13} /> {judge.name}</span>
          </div>
          <button className="icon-btn go" style={{ background: "#fff", color: "#2b2724" }}><Icon name="plus" /></button>
          <div className="title">{t(lang, "newGroup")}</div>
          <div className="robots-row">
            {active.slice(0, 3).map((a) => <RobotAvatar key={a.id} variant={a.avatar} color={a.color} size={44} />)}
            <RobotAvatar variant={judge.avatar} color={judge.color} size={44} />
          </div>
        </div>
      </div>

      <div className="pad stack" style={{ marginTop: 14 }}>
        {update && !dismissed && (
          <div className="card dark row" style={{ padding: "12px 16px" }}>
            <span style={{ fontSize: 24 }}>🎁</span>
            <div className="grow"><div style={{ fontWeight: 600 }}>{t(lang, "updateAvailable")} · {update.version}</div><div className="small" style={{ opacity: .7 }}>LiwaBot {update.version} (build {update.build})</div></div>
            <a className="pill orange" href={update.url} target="_blank" rel="noreferrer">{t(lang, "updateNow")}</a>
            <button className="icon-btn" style={{ background: "transparent", color: "#fff" }} onClick={() => setDismissed(true)}><Icon name="x" size={16} /></button>
          </div>
        )}
        <div className="row input" style={{ padding: "0 14px", gap: 8, background: "var(--white)" }}>
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "searchChats")} style={{ flex: 1, border: 0, background: "transparent", padding: "12px 0", fontSize: 15, color: "inherit", outline: "none" }} />
          {q && <button onClick={() => setQ("")}><Icon name="x" size={16} /></button>}
        </div>
        {hits && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="small muted">{hits.length} {t(lang, "results")}</div>
            {hits.length === 0 && <div className="card soft empty">{t(lang, "noResults")}</div>}
            {hits.map(({ m, g }) => (
              <button key={m.id} className="list-item" style={{ textAlign: "start" }} onClick={() => openChat(g.id)}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--cream-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{g.emoji}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between"><span style={{ fontWeight: 600 }}>{senderName(m)} <span className="small muted">· {g.name}</span></span><span className="small muted">{fmtDate(m.createdAt, lang)}</span></div>
                  <div className="small muted" style={{ whiteSpace: "normal" }}>{snippet(m)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {!hits && <div className="card row" style={{ padding: "14px 16px" }}>
          <span className="icon-btn" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}><Icon name="bolt" /></span>
          <div className="grow">
            {me ? (
              <>
                <div className="row between"><span style={{ fontSize: 16, fontWeight: 600 }}>{t(lang, "usageThisMonth")}</span><span className="small muted">{Math.round(usageRatio(me) * 100)}%</span></div>
                <div className="score-bar" style={{ marginTop: 6 }}><div style={{ width: `${usageRatio(me) * 100}%` }} /></div>
                <div className="small muted" style={{ marginTop: 4 }}>{me.plan.name}{me.plan.daily_messages ? ` · ${t(lang, "dailyLeft")} ${Math.max(0, me.plan.daily_messages - me.usage.day_messages)}/${me.plan.daily_messages}` : ""}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{fmtNum(tokens)}<span className="small muted"> {t(lang, "tokens")}</span></div>
                <div className="small muted">{t(lang, "totalCost")} ≈ ${cost.toFixed(2)} · {usageLog.length} {t(lang, "requests")}</div>
              </>
            )}
          </div>
        </div>}

        {!hits && <div className="row between" style={{ marginTop: 6 }}>
          <h2 className="h2">{t(lang, "chats")}</h2>
          <button className="pill dark" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> {t(lang, "newGroup")}</button>
        </div>}
        {!hits && groups.length === 0 && <div className="card soft empty">{t(lang, "noGroups")}</div>}
        {!hits && sortedGroups.map((g) => {
          const members = agents.filter((a) => g.memberIds.includes(a.id));
          const sender = g.lastSender === JUDGE_ID ? judge.name : g.lastSender === "user" ? (lang === "ar" ? "أنت" : "You") : agents.find((a) => a.id === g.lastSender)?.name ?? "";
          return (
            <button key={g.id} className="list-item" style={{ textAlign: "start" }} onClick={() => openChat(g.id)}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: "var(--cream-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{g.emoji}</div>
              <div className="grow">
                <div className="row between"><span style={{ fontWeight: 600 }}>{g.pinned ? "📌 " : ""}{g.name}</span><span className="small muted">{g.updatedAt ? fmtDate(g.updatedAt, lang) : ""}</span></div>
                <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70vw" }}>{g.lastPreview ? `${sender}: ${g.lastPreview}` : `${members.length} ${t(lang, "agentsCount")}`}</div>
              </div>
              <div className="row" style={{ gap: 0 }}>{members.slice(0, 3).map((m, i) => <span key={m.id} style={{ marginInlineStart: i ? -10 : 0 }}><RobotAvatar variant={m.avatar} color={m.color} size={28} /></span>)}</div>
            </button>
          );
        })}

        {!hits && <div className="row between" style={{ marginTop: 10 }}>
          <h2 className="h2">{t(lang, "agents")}</h2>
          <button className="pill" onClick={goAgents}>{t(lang, "more")} <Icon name="fwd" size={13} /></button>
        </div>}
        {!hits && <div className="grid2">
          {agents.slice(0, 4).map((a) => (
            <div key={a.id} className="agent-card">
              <div className="count">{a.skills.length}<small>{t(lang, "skills")}</small></div>
              <div className="name">{a.name}</div>
              <div className="role">{a.title}</div>
              <div className="foot"><Toggle on={a.active} onChange={(v) => actions.upsertAgent({ ...a, active: v })} sm /></div>
              <div className="av"><RobotAvatar variant={a.avatar} color={a.color} size={78} mood={a.active ? "idle" : "error"} /></div>
            </div>
          ))}
        </div>}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title={t(lang, "newGroup")}>
        <div className="stack">
          <div className="small muted">{t(lang, "teams")}</div>
          <div className="row" style={{ overflowX: "auto", paddingBottom: 4, gap: 8 }}>
            {TEAM_PRESETS.map((tp) => <button key={tp.key} className="chip" style={{ flexShrink: 0 }} onClick={() => createTeam(tp)}>{tp.emoji} {tp.name[lang]}</button>)}
          </div>
          <div className="divider" />
          <div className="row" style={{ overflowX: "auto", paddingBottom: 4 }}>
            {EMOJIS.map((e) => <button key={e} onClick={() => setGEmoji(e)} style={{ fontSize: 24, width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: gEmoji === e ? "var(--orange-soft)" : "var(--white)" }}>{e}</button>)}
          </div>
          <div className="field"><label>{t(lang, "groupName")}</label><input className="input" value={gName} onChange={(e) => setGName(e.target.value)} placeholder={SESSION_EXAMPLES[lang][0].slice(0, 30)} /></div>
          <div className="field">
            <label>{t(lang, "members")}</label>
            <div className="chips">
              {agents.map((a) => <button key={a.id} className={"chip" + (gMembers.includes(a.id) ? " on" : "")} onClick={() => setGMembers((m) => m.includes(a.id) ? m.filter((x) => x !== a.id) : [...m, a.id])}><RobotAvatar variant={a.avatar} color={a.color} size={20} /> {a.name}</button>)}
            </div>
          </div>
          <div className="row between card soft" style={{ padding: "12px 16px" }}>
            <div className="row"><RobotAvatar variant={judge.avatar} color={judge.color} size={32} /><div><div style={{ fontWeight: 600 }}>{judge.name}</div><div className="small muted">{t(lang, "judgeDesc")}</div></div></div>
            <Toggle on={gJudge} onChange={setGJudge} />
          </div>
          <button className="btn block orange" onClick={create}>{t(lang, "startCouncil")}</button>
        </div>
      </Sheet>
    </div>
  );
}
