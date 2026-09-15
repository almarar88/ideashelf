import { useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { actions, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon, Sheet, Toggle, fmtDate, fmtNum } from "../components/ui";
import { JUDGE_ID, costUSD, uid, type Group } from "../lib/types";
import { SESSION_EXAMPLES } from "../lib/presets";

const EMOJIS = ["🚀", "💼", "🏪", "📈", "🧠", "🏥", "⚖️", "🎯", "🛠️", "✈️", "🏠", "🎨"];

export default function Home({ openChat, goAgents, goSettings }: { openChat: (id: string) => void; goAgents: () => void; goSettings: () => void }) {
  const { settings, agents, groups, usageLog, judge } = useStore((s) => s);
  const lang = settings.lang;
  const [creating, setCreating] = useState(false);
  const [gName, setGName] = useState("");
  const [gEmoji, setGEmoji] = useState("🚀");
  const [gMembers, setGMembers] = useState<string[]>(agents.filter((a) => a.active).map((a) => a.id));
  const [gJudge, setGJudge] = useState(true);

  const active = agents.filter((a) => a.active);
  const tokens = usageLog.reduce((n, e) => n + e.input + e.output, 0);
  const cost = usageLog.reduce((n, e) => n + costUSD(e.model, { input: e.input, output: e.output }), 0);

  const create = () => {
    const g: Group = { id: uid(), name: gName.trim() || (lang === "ar" ? "مجموعة جديدة" : "New group"), emoji: gEmoji, memberIds: gMembers, judgeEnabled: gJudge, debate: false, createdAt: Date.now(), updatedAt: Date.now(), lastPreview: "", lastSender: "", msgCount: 0 };
    actions.upsertGroup(g); setCreating(false); setGName(""); openChat(g.id);
  };

  return (
    <div className="screen">
      <div className="hdr-dark">
        <div className="row between">
          <div className="row">
            <div style={{ position: "relative" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg,#f47a4b,#e9b43a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, color: "#fff" }}>{(settings.userName || "M").slice(0, 1).toUpperCase()}</div>
              <span className="pill orange" style={{ position: "absolute", bottom: -6, insetInlineStart: 8, padding: "2px 8px", fontSize: 10 }}>Pro</span>
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
        <div className="card row" style={{ padding: "14px 16px" }}>
          <span className="icon-btn" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}><Icon name="bolt" /></span>
          <div className="grow">
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{fmtNum(tokens)}<span className="small muted"> {t(lang, "tokens")}</span></div>
            <div className="small muted">{t(lang, "totalCost")} ≈ ${cost.toFixed(2)} · {usageLog.length} {t(lang, "requests")}</div>
          </div>
        </div>

        <div className="row between" style={{ marginTop: 6 }}>
          <h2 className="h2">{t(lang, "chats")}</h2>
          <button className="pill dark" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> {t(lang, "newGroup")}</button>
        </div>
        {groups.length === 0 && <div className="card soft empty">{t(lang, "noGroups")}</div>}
        {groups.map((g) => {
          const members = agents.filter((a) => g.memberIds.includes(a.id));
          const sender = g.lastSender === JUDGE_ID ? judge.name : g.lastSender === "user" ? (lang === "ar" ? "أنت" : "You") : agents.find((a) => a.id === g.lastSender)?.name ?? "";
          return (
            <button key={g.id} className="list-item" style={{ textAlign: "start" }} onClick={() => openChat(g.id)}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: "var(--cream-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{g.emoji}</div>
              <div className="grow">
                <div className="row between"><span style={{ fontWeight: 600 }}>{g.name}</span><span className="small muted">{g.updatedAt ? fmtDate(g.updatedAt, lang) : ""}</span></div>
                <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70vw" }}>{g.lastPreview ? `${sender}: ${g.lastPreview}` : `${members.length} ${t(lang, "agentsCount")}`}</div>
              </div>
              <div className="row" style={{ gap: 0 }}>{members.slice(0, 3).map((m, i) => <span key={m.id} style={{ marginInlineStart: i ? -10 : 0 }}><RobotAvatar variant={m.avatar} color={m.color} size={28} /></span>)}</div>
            </button>
          );
        })}

        <div className="row between" style={{ marginTop: 10 }}>
          <h2 className="h2">{t(lang, "agents")}</h2>
          <button className="pill" onClick={goAgents}>{t(lang, "more")} <Icon name="fwd" size={13} /></button>
        </div>
        <div className="grid2">
          {agents.slice(0, 4).map((a) => (
            <div key={a.id} className="agent-card">
              <div className="count">{a.skills.length}<small>{t(lang, "skills")}</small></div>
              <div className="name">{a.name}</div>
              <div className="role">{a.title}</div>
              <div className="foot"><Toggle on={a.active} onChange={(v) => actions.upsertAgent({ ...a, active: v })} sm /></div>
              <div className="av"><RobotAvatar variant={a.avatar} color={a.color} size={78} mood={a.active ? "idle" : "error"} /></div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title={t(lang, "newGroup")}>
        <div className="stack">
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
