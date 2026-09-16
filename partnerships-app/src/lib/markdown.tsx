import React from "react";

/** Tiny, dependency-free Markdown renderer for headings, lists, bold, tables, and paragraphs. */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flush = () => {
    if (list) { out.push(React.createElement(list.type, { key: out.length }, list.items.map((it, i) => <li key={i}>{inline(it)}</li>))); list = null; }
    if (table) {
      const [head, ...rows] = table;
      out.push(
        <table key={out.length}><thead><tr>{head.map((h, i) => <th key={i}>{inline(h)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table>,
      );
      table = null;
    }
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) { flush(); const Tag = (`h${h[1].length}` as "h1" | "h2" | "h3"); out.push(<Tag key={out.length}>{inline(h[2])}</Tag>); continue; }
    if (/^\|.*\|$/.test(l.trim())) {
      const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!table) { if (list) flush(); table = []; }
      table.push(cells); continue;
    }
    const ul = /^[-*•]\s+(.*)$/.exec(l.trim());
    const ol = /^\d+[.)]\s+(.*)$/.exec(l.trim());
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (table) flush();
      if (!list || list.type !== type) { if (list) flush(); list = { type, items: [] }; }
      list.items.push((ul ?? ol)![1]); continue;
    }
    flush();
    out.push(<p key={out.length}>{inline(l)}</p>);
  }
  flush();
  return <div className={`prose-app ${className}`}>{out}</div>;
}

function inline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else parts.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
