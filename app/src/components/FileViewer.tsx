import { useEffect, useState } from "react";
import { Icon, Spinner } from "./ui";
import { Markdown } from "./markdown";
import { fileDataUrl, fileText, fmtSize, shareFile } from "../lib/files";
import { isImageMime, type FileRef } from "../lib/types";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";

export function FileViewer({ file, onClose }: { file: FileRef; onClose: () => void }) {
  const lang = useStore((s) => s.settings.lang);
  const [text, setText] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const tx = await fileText(file);
      const u = isImageMime(file.mime) ? await fileDataUrl(file) : null;
      if (!alive) return;
      setText(tx); setUrl(u); setLoading(false);
    })();
    return () => { alive = false; };
  }, [file]);

  const isMd = /\.md$/i.test(file.name) || file.mime === "text/markdown";
  const isHtml = /\.html?$/i.test(file.name);
  const isCsv = /\.csv$/i.test(file.name);

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--cream)", zIndex: 60, display: "flex", flexDirection: "column" }} className="fade-in">
      <div className="row between" style={{ padding: "calc(10px + var(--safe-top)) 12px 10px", background: "var(--white)", borderBottom: "1px solid var(--line)" }}>
        <button className="icon-btn" onClick={onClose}><Icon name="back" /></button>
        <div className="grow" style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
          <div className="small muted">{fmtSize(file.size)}</div>
        </div>
        <button className="icon-btn" style={{ background: "var(--orange)", color: "#fff" }} onClick={() => shareFile(file)}><Icon name="share" /></button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16, paddingBottom: "calc(24px + var(--safe-bottom))" }}>
        {loading && <div className="empty"><Spinner /></div>}
        {!loading && url && <img src={url} alt={file.name} style={{ width: "100%", borderRadius: 16 }} />}
        {!loading && text !== null && isHtml && <iframe title={file.name} srcDoc={text} sandbox="" style={{ width: "100%", height: "80vh", border: 0, borderRadius: 16, background: "#fff" }} />}
        {!loading && text !== null && isCsv && (
          <div className="card" style={{ overflowX: "auto", padding: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>{text.trim().split("\n").map((r, i) => <tr key={i}>{r.split(",").map((c, j) => i === 0 ? <th key={j} style={{ padding: "8px 10px", textAlign: "start", borderBottom: "1px solid var(--line)" }}>{c}</th> : <td key={j} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {!loading && text !== null && !isHtml && !isCsv && (
          <div className="card">{isMd ? <Markdown text={text} /> : <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0 }}>{text}</pre>}</div>
        )}
        {!loading && text === null && !url && (
          <div className="empty">
            <Icon name="file" size={48} />
            <p>{file.mime}</p>
            <button className="btn orange" onClick={() => shareFile(file)}><Icon name="share" size={18} /> {t(lang, "open")} / {t(lang, "share")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FileChip({ file, onOpen, light }: { file: FileRef; onOpen: (f: FileRef) => void; light?: boolean }) {
  const img = isImageMime(file.mime);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (img) fileDataUrl(file).then(setUrl); }, [file, img]);
  if (img && url) return <img src={url} alt={file.name} onClick={() => onOpen(file)} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 14, display: "block", cursor: "pointer" }} />;
  return (
    <button className="row" onClick={() => onOpen(file)} style={{ background: light ? "rgba(255,255,255,.18)" : "var(--cream-2)", color: "inherit", padding: "10px 12px", borderRadius: 14, gap: 10, textAlign: "start", maxWidth: 260 }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: light ? "rgba(255,255,255,.25)" : "var(--orange-soft)", color: light ? "#fff" : "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="file" size={18} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
        <span className="small" style={{ opacity: .7 }}>{fmtSize(file.size)}{file.description ? " · " + file.description : ""}</span>
      </span>
    </button>
  );
}
