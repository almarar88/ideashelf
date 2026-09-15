import { useState } from "react";
import { AVATAR_COUNT, RobotAvatar } from "../lib/avatars";
import { actions, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Gauge, Icon, Sheet, Toggle } from "../components/ui";
import { AVATAR_COLORS, MODELS, uid, type Agent, type JudgeConfig, type JudgeStyle } from "../lib/types";
import { materialize, presetAgents } from "../lib/presets";

export default function Agents() {
  const { settings, agents, judge } = useStore((s) => s);
  const lang = settings.lang;
  const [editing, setEditing] = useState<Agent | null>(null);
  const [editJudge, setEditJudge] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const blank = (): Agent => ({ id: uid(), name: "", title: "", field: "", skills: [], personality: "", instructions: "", avatar: Math.floor(Math.random() * AVATAR_COUNT), color: AVATAR_COLORS[agents.length % AVATAR_COLORS.length], webSearch: true, maxSearches: 5, creativity: 55, model: "default", active: true, createdAt: Date.now() });

  return (
    <div className="screen">
      <div className="hdr-light row between">
        <h1 className="h1" style={{ margin: 0 }}>{t(lang, "agents")}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="pill" onClick={() => setShowTemplates(true)}>{t(lang, "templates")}</button>
          <button className="icon-btn" style={{ background: "var(--orange)", color: "#fff" }} onClick={() => setEditing(blank())}><Icon name="plus" /></button>
        </div>
      </div>
      <div className="pad stack">
        <button className="card dark row" style={{ textAlign: "start" }} onClick={() => setEditJudge(true)}>
          <RobotAvatar variant={judge.avatar} color={judge.color} size={64} />
          <div className="grow">
            <div className="row" style={{ gap: 6 }}><span className="h3">{judge.name}</span><span className="pill orange" style={{ padding: "2px 8px", fontSize: 10 }}>{t(lang, "judge")}</span></div>
            <div className="sub" style={{ marginTop: 4 }}>{t(lang, "judgeDesc")}</div>
          </div>
          <Icon name="fwd" />
        </button>
        {agents.length === 0 && <div className="card soft empty">{t(lang, "noAgents")}</div>}
        <div className="grid2">
          {agents.map((a) => (
            <div key={a.id} className="agent-card" onClick={() => setEditing(a)}>
              <div className="count">{a.skills.length}<small>{t(lang, "skills")}</small></div>
              <div className="name">{a.name}</div>
              <div className="role">{a.title}</div>
              <div className="foot">
                <Toggle on={a.active} onChange={(v) => actions.upsertAgent({ ...a, active: v })} sm />
                {a.webSearch && <span className="muted"><Icon name="globe" size={14} /></span>}
              </div>
              <div className="av"><RobotAvatar variant={a.avatar} color={a.color} size={78} mood={a.active ? "idle" : "error"} /></div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && <AgentEditor initial={editing} isNew={!agents.some((a) => a.id === editing.id)} onClose={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={editJudge} onClose={() => setEditJudge(false)} title={t(lang, "judgeSettings")}>
        <JudgeEditor initial={judge} onClose={() => setEditJudge(false)} />
      </Sheet>
      <Sheet open={showTemplates} onClose={() => setShowTemplates(false)} title={t(lang, "templates")}>
        <div className="stack">
          {presetAgents(lang).map((p) => (
            <div key={p.id} className="list-item">
              <RobotAvatar variant={p.avatar} color={p.color} size={44} />
              <div className="grow"><div style={{ fontWeight: 600 }}>{p.name} · <span className="muted" style={{ fontWeight: 400 }}>{p.title}</span></div><div className="small muted">{p.skills.join(" · ")}</div></div>
              <button className="round-btn orange" onClick={() => actions.upsertAgent(materialize(p))}><Icon name="plus" size={18} /></button>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function AgentEditor({ initial, isNew, onClose }: { initial: Agent; isNew: boolean; onClose: () => void }) {
  const lang = useStore((s) => s.settings.lang);
  const [a, setA] = useState<Agent>(initial);
  const [skill, setSkill] = useState("");
  const set = (p: Partial<Agent>) => setA((x) => ({ ...x, ...p }));
  const addSkill = () => { const s = skill.trim(); if (s && !a.skills.includes(s)) set({ skills: [...a.skills, s] }); setSkill(""); };
  const save = () => { if (!a.name.trim()) return; addSkillIfPending(); actions.upsertAgent({ ...a, name: a.name.trim(), title: a.title.trim() || a.field.trim() }); onClose(); };
  const addSkillIfPending = () => { const s = skill.trim(); if (s && !a.skills.includes(s)) a.skills = [...a.skills, s]; };
  const effortLabel = a.creativity < 25 ? (lang === "ar" ? "سريع" : "Quick") : a.creativity < 50 ? (lang === "ar" ? "متوسط" : "Medium") : a.creativity < 78 ? (lang === "ar" ? "عميق" : "Deep") : (lang === "ar" ? "أقصى عمق" : "Max depth");

  return (
    <div className="stack">
      <div className="row between"><h3 className="h3">{isNew ? t(lang, "addAgent") : t(lang, "editAgent")}</h3><RobotAvatar variant={a.avatar} color={a.color} size={56} mood="happy" /></div>
      <div className="field"><label>{t(lang, "avatar")}</label>
        <div className="avatar-grid">{Array.from({ length: AVATAR_COUNT }, (_, i) => <button key={i} className={a.avatar === i ? "on" : ""} onClick={() => set({ avatar: i })}><RobotAvatar variant={i} color={a.color} size={54} /></button>)}</div>
      </div>
      <div className="field"><label>{t(lang, "color")}</label><div className="color-row">{AVATAR_COLORS.map((c) => <button key={c} className={a.color === c ? "on" : ""} style={{ background: c }} onClick={() => set({ color: c })} />)}</div></div>
      <div className="grid2">
        <div className="field"><label>{t(lang, "name")}</label><input className="input" value={a.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="field"><label>{t(lang, "title")}</label><input className="input" value={a.title} onChange={(e) => set({ title: e.target.value })} /></div>
      </div>
      <div className="field"><label>{t(lang, "field")}</label><input className="input" value={a.field} onChange={(e) => set({ field: e.target.value })} /></div>
      <div className="field"><label>{t(lang, "skills")}</label>
        <div className="chips" style={{ marginBottom: a.skills.length ? 6 : 0 }}>{a.skills.map((s) => <span key={s} className="chip orange">{s} <button className="x" onClick={() => set({ skills: a.skills.filter((x) => x !== s) })}>✕</button></span>)}</div>
        <input className="input" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder={t(lang, "addSkill")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); } }} onBlur={addSkill} />
      </div>
      <div className="field"><label>{t(lang, "personality")}</label><textarea className="input" value={a.personality} onChange={(e) => set({ personality: e.target.value })} /></div>
      <div className="field"><label>{t(lang, "instructions")}</label><textarea className="input" value={a.instructions} onChange={(e) => set({ instructions: e.target.value })} style={{ minHeight: 70 }} /></div>

      <div className="card dark gauge-wrap">
        <div className="row between" style={{ width: "100%" }}><span className="h3">{t(lang, "creativity")}</span><span className="pill ghost">{effortLabel}</span></div>
        <Gauge value={a.creativity} size={250} />
        <div className="gauge-ctrls">
          <button className="round-btn" onClick={() => set({ creativity: Math.max(0, a.creativity - 10) })}><Icon name="minus" /></button>
          <span className="val">{a.creativity}</span>
          <button className="round-btn orange" onClick={() => set({ creativity: Math.min(100, a.creativity + 10) })}><Icon name="plus" /></button>
        </div>
        <div className="small" style={{ opacity: .6 }}>{t(lang, "creativityDesc")}</div>
      </div>

      <div className="row between card soft" style={{ padding: "12px 16px" }}>
        <div><div style={{ fontWeight: 600 }}><Icon name="globe" size={15} /> {t(lang, "webSearch")}</div><div className="small muted">{t(lang, "webSearchDesc")}</div></div>
        <Toggle on={a.webSearch} onChange={(v) => set({ webSearch: v })} />
      </div>
      {a.webSearch && <div className="row between"><span className="muted">{t(lang, "maxSearches")}</span><div className="row"><button className="round-btn" onClick={() => set({ maxSearches: Math.max(1, a.maxSearches - 1) })}><Icon name="minus" size={16} /></button><b style={{ minWidth: 24, textAlign: "center" }}>{a.maxSearches}</b><button className="round-btn" onClick={() => set({ maxSearches: Math.min(15, a.maxSearches + 1) })}><Icon name="plus" size={16} /></button></div></div>}
      <div className="field"><label>{t(lang, "model")}</label>
        <div className="stack" style={{ gap: 6 }}>
          <button className={"chip" + (a.model === "default" ? " on" : "")} onClick={() => set({ model: "default" })}>{t(lang, "useDefault")}</button>
          {MODELS.map((m) => <button key={m.id} className={"chip" + (a.model === m.id ? " on" : "")} style={{ justifyContent: "space-between" }} onClick={() => set({ model: m.id })}><span>{m.label}</span><span className="small" style={{ opacity: .7 }}>{m.note[lang]}</span></button>)}
        </div>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn orange grow" onClick={save} disabled={!a.name.trim()}>{t(lang, "save")}</button>
        {!isNew && <button className="btn light" onClick={() => { actions.upsertAgent({ ...a, id: uid(), name: a.name + " 2", createdAt: Date.now() }); onClose(); }}>{t(lang, "duplicate")}</button>}
        {!isNew && <button className="icon-btn" style={{ background: "#fde8e8", color: "var(--red)" }} onClick={() => { if (confirm(t(lang, "confirmDelete"))) { actions.deleteAgent(a.id); onClose(); } }}><Icon name="trash" /></button>}
      </div>
    </div>
  );
}

function JudgeEditor({ initial, onClose }: { initial: JudgeConfig; onClose: () => void }) {
  const lang = useStore((s) => s.settings.lang);
  const [j, setJ] = useState<JudgeConfig>(initial);
  const set = (p: Partial<JudgeConfig>) => setJ((x) => ({ ...x, ...p }));
  const styles: { id: JudgeStyle; label: string }[] = [
    { id: "balanced", label: t(lang, "styleBalanced") }, { id: "critical", label: t(lang, "styleCritical") },
    { id: "consensus", label: t(lang, "styleConsensus") }, { id: "bold", label: t(lang, "styleBold") },
  ];
  return (
    <div className="stack">
      <div className="row"><RobotAvatar variant={j.avatar} color={j.color} size={64} mood="happy" /><div className="sub">{t(lang, "judgeDesc")}</div></div>
      <div className="field"><label>{t(lang, "avatar")}</label><div className="avatar-grid">{Array.from({ length: AVATAR_COUNT }, (_, i) => <button key={i} className={j.avatar === i ? "on" : ""} onClick={() => set({ avatar: i })}><RobotAvatar variant={i} color={j.color} size={54} /></button>)}</div></div>
      <div className="field"><label>{t(lang, "color")}</label><div className="color-row">{["#2b2724", ...AVATAR_COLORS].map((c) => <button key={c} className={j.color === c ? "on" : ""} style={{ background: c }} onClick={() => set({ color: c })} />)}</div></div>
      <div className="field"><label>{t(lang, "name")}</label><input className="input" value={j.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="field"><label>{t(lang, "judgeStyle")}</label><div className="chips">{styles.map((s) => <button key={s.id} className={"chip" + (j.style === s.id ? " on" : "")} onClick={() => set({ style: s.id })}>{s.label}</button>)}</div></div>
      <div className="field"><label>{t(lang, "instructions")}</label><textarea className="input" value={j.instructions} onChange={(e) => set({ instructions: e.target.value })} /></div>
      <div className="field"><label>{t(lang, "model")}</label><div className="chips"><button className={"chip" + (j.model === "default" ? " on" : "")} onClick={() => set({ model: "default" })}>{t(lang, "useDefault")}</button>{MODELS.map((m) => <button key={m.id} className={"chip" + (j.model === m.id ? " on" : "")} onClick={() => set({ model: m.id })}>{m.label}</button>)}</div></div>
      <button className="btn orange block" onClick={() => { actions.setJudge({ ...j, name: j.name.trim() || initial.name }); onClose(); }}>{t(lang, "save")}</button>
    </div>
  );
}
