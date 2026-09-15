import { Fragment, type ReactNode } from "react";

function inline(s: string, key: number): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[([^\]]+)\]\((https?:[^)]+)\)|https?:\/\/[^\s)]+)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) parts.push(<a key={i++} href={m[3]} target="_blank" rel="noreferrer">{m[2]}</a>);
    else parts.push(<a key={i++} href={tok} target="_blank" rel="noreferrer">{tok.length > 40 ? tok.slice(0, 40) + "…" : tok}</a>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return <Fragment key={key}>{parts}</Fragment>;
}

/** Tiny markdown renderer: headings, bullets, numbered lists, code fences, bold, code, links, tables (as pre). */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let i = 0; let k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(<pre key={k++} style={{ background: "rgba(0,0,0,.06)", padding: 10, borderRadius: 10, overflowX: "auto", fontSize: 12.5 }}>{buf.join("\n")}</pre>);
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) buf.push(lines[i++]);
      const rows = buf.filter((r) => !/^\s*\|\s*:?-+/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      out.push(<div key={k++} style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: "100%" }}><tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => ri === 0 ? <th key={ci} style={{ textAlign: "start", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.15)" }}>{inline(c, ci)}</th> : <td key={ci} style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.07)" }}>{inline(c, ci)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)/.exec(l);
    if (h) { out.push(<div key={k++} style={{ fontWeight: 700, marginTop: 8, marginBottom: 2, fontSize: h[1].length <= 2 ? 16 : 15 }}>{inline(h[2], 0)}</div>); i++; continue; }
    if (/^\s*[-*•]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""));
      out.push(<ul key={k++}>{items.map((it, j) => <li key={j}>{inline(it, j)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push(<ol key={k++} style={{ paddingInlineStart: 20, margin: "4px 0" }}>{items.map((it, j) => <li key={j}>{inline(it, j)}</li>)}</ol>);
      continue;
    }
    if (l.trim() === "") { i++; continue; }
    if (l.trim() === "---") { out.push(<div key={k++} className="divider" />); i++; continue; }
    out.push(<p key={k++}>{inline(l, 0)}</p>);
    i++;
  }
  return <div className="prose" style={{ whiteSpace: "normal" }}>{out}</div>;
}
