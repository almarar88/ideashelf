import { useState } from "react";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon, fmtNum } from "../components/ui";
import { RobotAvatar } from "../lib/avatars";
import { JUDGE_ID, costUSD } from "../lib/types";

export default function Analytics() {
  const { settings, usageLog, agents, judge } = useStore((s) => s);
  const lang = settings.lang;
  const [range, setRange] = useState<7 | 30>(7);
  const day = 86_400_000;
  const now = Date.now();
  const from = now - range * day;
  const cur = usageLog.filter((e) => e.ts >= from);
  const prev = usageLog.filter((e) => e.ts >= from - range * day && e.ts < from);
  const tok = (l: typeof usageLog) => l.reduce((n, e) => n + e.input + e.output, 0);
  const cost = (l: typeof usageLog) => l.reduce((n, e) => n + costUSD(e.model, { input: e.input, output: e.output }), 0);
  const curTok = tok(cur), prevTok = tok(prev);
  const delta = prevTok ? Math.round(((curTok - prevTok) / prevTok) * 100) : 0;

  // buckets
  const buckets = range === 7 ? 7 : 6;
  const span = (range * day) / buckets;
  const bars = Array.from({ length: buckets }, (_, i) => {
    const s = from + i * span, e = s + span;
    const list = cur.filter((x) => x.ts >= s && x.ts < e);
    const d = new Date(s);
    const label = range === 7 ? d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { weekday: "short" }) : d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short" });
    return { label, v: tok(list) };
  });
  const max = Math.max(1, ...bars.map((b) => b.v));
  const hot = bars.reduce((bi, b, i) => (b.v > bars[bi].v ? i : bi), 0);

  const perAgent = [...agents.map((a) => ({ id: a.id, name: a.name, title: a.title, avatar: a.avatar, color: a.color })), { id: JUDGE_ID, name: judge.name, title: t(lang, "judge"), avatar: judge.avatar, color: judge.color }]
    .map((a) => { const l = cur.filter((e) => e.agentId === a.id); return { ...a, tok: tok(l), cost: cost(l), n: l.length }; })
    .filter((a) => a.n > 0).sort((a, b) => b.tok - a.tok);

  return (
    <div className="screen">
      <div className="hdr-light row between">
        <h1 className="h1" style={{ margin: 0 }}>{t(lang, "analytics")}</h1>
        <div className="seg" style={{ width: 190 }}>
          <button className={range === 7 ? "on" : ""} onClick={() => setRange(7)}>{t(lang, "thisWeek")}</button>
          <button className={range === 30 ? "on" : ""} onClick={() => setRange(30)}>{t(lang, "thisMonth")}</button>
        </div>
      </div>
      <div className="pad stack">
        <div className="card">
          <div className="row between">
            <div>
              <div className="big-num">{fmtNum(curTok)}<small>{t(lang, "tokens")}</small></div>
              <div className="row small muted" style={{ marginTop: 6 }}>{t(lang, "vsPrev")} <span className={"pill " + (delta > 0 ? "dark" : "")} style={{ padding: "2px 8px" }}>{delta > 0 ? "+" : ""}{delta}%</span></div>
            </div>
            <span className="icon-btn" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}><Icon name="bolt" /></span>
          </div>
          <div className="bar-chart" style={{ marginTop: 16 }}>
            {bars.map((b, i) => <div key={i} className="col"><div className={"bar" + (i === hot && b.v > 0 ? " hot" : "")} style={{ height: `${Math.max(6, (b.v / max) * 100)}%` }} /><span className="lbl" style={i === hot ? { fontWeight: 700, color: "var(--text)" } : {}}>{b.label}</span></div>)}
          </div>
        </div>
        <div className="grid2">
          <div className="card soft"><div className="small muted">{t(lang, "totalCost")}</div><div style={{ fontSize: 26, fontWeight: 600 }}>${cost(cur).toFixed(2)}</div></div>
          <div className="card soft"><div className="small muted">{t(lang, "requests")}</div><div style={{ fontSize: 26, fontWeight: 600 }}>{cur.length}</div></div>
        </div>
        <div className="card">
          <h3 className="h3" style={{ marginBottom: 10 }}>{t(lang, "perAgent")} <span className="muted" style={{ fontWeight: 400 }}>({perAgent.length})</span></h3>
          {perAgent.length === 0 && <div className="muted small">{t(lang, "noSessions")}</div>}
          <div className="stack" style={{ gap: 8 }}>
            {perAgent.map((a) => (
              <div key={a.id} className="row list-item" style={{ background: "var(--cream-2)" }}>
                <RobotAvatar variant={a.avatar} color={a.color} size={40} />
                <div className="grow"><div style={{ fontWeight: 600 }}>{a.name}</div><div className="small muted">{a.n} {t(lang, "requests")} · ${a.cost.toFixed(2)}</div></div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{fmtNum(a.tok)}<span className="small muted"> {t(lang, "tokens")}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
