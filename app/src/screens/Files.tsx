import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Icon, fmtDate } from "../components/ui";
import { FileViewer } from "../components/FileViewer";
import { messagesDB } from "../lib/db";
import { fmtSize } from "../lib/files";
import { JUDGE_ID, isImageMime, type FileRef } from "../lib/types";
import { RobotAvatar } from "../lib/avatars";

export default function Files({ openChat }: { openChat: (id: string) => void }) {
  const { settings, groups, agents, judge } = useStore((s) => s);
  const lang = settings.lang;
  const [files, setFiles] = useState<FileRef[]>([]);
  const [viewing, setViewing] = useState<FileRef | null>(null);
  useEffect(() => {
    (async () => {
      const all: FileRef[] = [];
      for (const g of groups) { const ms = await messagesDB.get(g.id); for (const m of ms) all.push(...m.files); }
      setFiles(all.sort((a, b) => b.createdAt - a.createdAt));
    })();
  }, [groups]);
  const by = (f: FileRef) => f.by === "user" ? t(lang, "uploaded") : `${t(lang, "generatedBy")} ${f.by === JUDGE_ID ? judge.name : agents.find((a) => a.id === f.by)?.name ?? "?"}`;
  const av = (f: FileRef) => { const a = f.by === JUDGE_ID ? judge : agents.find((x) => x.id === f.by); return a ? <RobotAvatar variant={a.avatar} color={a.color} size={40} /> : <span className="icon-btn" style={{ width: 40, height: 40 }}><Icon name={isImageMime(f.mime) ? "image" : "file"} /></span>; };

  return (
    <div className="screen">
      <div className="hdr-light"><h1 className="h1" style={{ margin: 0 }}>{t(lang, "files")}</h1><div className="sub">{files.length} {t(lang, "files")}</div></div>
      <div className="pad stack">
        {files.length === 0 && <div className="card soft empty">{t(lang, "noFiles")}</div>}
        {files.map((f) => {
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
