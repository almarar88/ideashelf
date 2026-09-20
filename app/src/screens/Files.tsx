import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon, fmtDate } from "../components/ui";
import { FileViewer } from "../components/FileViewer";
import { messagesDB } from "../lib/db";
import { fmtSize } from "../lib/files";
import { JUDGE_ID, isImageMime, type FileRef, type Message } from "../lib/types";
import { RobotAvatar } from "../lib/avatars";

export default function Files({ openChat }: { openChat: (id: string) => void }) {
  const { settings, groups, agents, judge } = useStore((s) => s);
  const lang = settings.lang;
  const [files, setFiles] = useState<FileRef[]>([]);
  const [decisions, setDecisions] = useState<Message[]>([]);
  const [tab, setTab] = useState<"files" | "decisions">("files");
  const [viewing, setViewing] = useState<FileRef | null>(null);
  useEffect(() => {
    (async () => {
      const all: FileRef[] = []; const dec: Message[] = [];
      for (const g of groups) { const ms = await messagesDB.get(g.id); for (const m of ms) { all.push(...m.files); if (m.verdict && m.status === "done") dec.push(m); } }
      setFiles(all.sort((a, b) => b.createdAt - a.createdAt));
      setDecisions(dec.sort((a, b) => b.createdAt - a.createdAt));
    })();
  }, [groups]);
  const by = (f: FileRef) => f.by === "user" ? t(lang, "uploaded") : `${t(lang, "generatedBy")} ${f.by === JUDGE_ID ? judge.name : agents.find((a) => a.id === f.by)?.name ?? "?"}`;
  const av = (f: FileRef) => { const a = f.by === JUDGE_ID ? judge : agents.find((x) => x.id === f.by); return a ? <RobotAvatar variant={a.avatar} color={a.color} size={40} /> : <span className="icon-btn" style={{ width: 40, height: 40 }}><Icon name={isImageMime(f.mime) ? "image" : "file"} /></span>; };

  return (
    <div className="screen">
      <div className="hdr-light"><h1 className="h1" style={{ margin: 0 }}>{t(lang, tab === "files" ? "files" : "decisions")}</h1><div className="sub">{tab === "files" ? `${files.length} ${t(lang, "files")}` : `${decisions.length} ${t(lang, "decisions")}`}</div></div>
      <div className="pad stack">
        <div className="seg"><button className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}>📁 {t(lang, "files")}</button><button className={tab === "decisions" ? "on" : ""} onClick={() => setTab("decisions")}>⚖️ {t(lang, "decisions")}</button></div>
        {tab === "decisions" && decisions.length === 0 && <div className="card soft empty">{t(lang, "noDecisions")}</div>}
        {tab === "decisions" && decisions.map((m) => {
          const g = groups.find((x) => x.id === m.groupId); const v = m.verdict!;
          const best = agents.find((a) => a.id === v.bestAgentId);
          return (
            <button key={m.id} className="card dark" style={{ textAlign: "start", padding: "14px 16px" }} onClick={() => g && openChat(g.id)}>
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <RobotAvatar variant={judge.avatar} color={judge.color} size={36} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{v.decision}</div>
                  <div className="small" style={{ opacity: .8, marginTop: 4 }}>{v.summary.slice(0, 160)}{v.summary.length > 160 ? "…" : ""}</div>
                  <div className="row small" style={{ opacity: .65, marginTop: 8, gap: 10, flexWrap: "wrap" }}>
                    <span>{g ? `${g.emoji} ${g.name}` : ""}</span><span>{fmtDate(m.createdAt, lang)}</span><span>{t(lang, "confidence")} {v.confidence}%</span>{best && <span>🏆 {best.name}</span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {tab === "files" && files.length === 0 && <div className="card soft empty">{t(lang, "noFiles")}</div>}
        {tab === "files" && files.map((f) => {
          const g = groups.find((x) => x.id === f.groupId);
          return (
            <div key={f.id} className="list-item">
              <button onClick={() => setViewing(f)}>{av(f)}</button>
              <button className="grow" style={{ textAlign: "start", minWidth: 0 }} onClick={() => setViewing(f)}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div className="small muted">{by(f)} · {fmtSize(f.size)} · {fmtDate(f.createdAt, lang)}</div>
                {g && <div className="small muted">{t(lang, "inGroup")} {g.emoji} {g.name}</div>}
              </button>
              {g && <button className="icon-btn" onClick={() => openChat(g.id)}><Icon name="chat" size={18} /></button>}
            </div>
          );
        })}
      </div>
      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
