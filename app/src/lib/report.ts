// Export a chat as a self-contained, styled HTML report (RTL-aware, printable).
import type { Lang, Message } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function inlineMd(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/(^|[^"'>])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
}

/** Tiny markdown → HTML: headings, bullets, numbered lists, code fences, paragraphs. */
export function mdToHtml(md: string): string {
  const out: string[] = []; const lines = md.split("\n");
  let list: "ul" | "ol" | null = null; let code = false; let buf: string[] = [];
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) { if (code) { out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); buf = []; code = false; } else { closeList(); code = true; } continue; }
    if (code) { buf.push(raw); continue; }
    const h = /^(#{1,4})\s+(.*)/.exec(raw);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${inlineMd(h[2])}</h${h[1].length + 1}>`); continue; }
    const ul = /^\s*[-*•]\s+(.*)/.exec(raw); const ol = /^\s*\d+[.)]\s+(.*)/.exec(raw);
    if (ul || ol) { const kind = ul ? "ul" : "ol"; if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inlineMd((ul ?? ol)![1])}</li>`); continue; }
    closeList();
    if (raw.trim()) out.push(`<p>${inlineMd(raw)}</p>`);
  }
  if (code) out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
  closeList();
  return out.join("\n");
}

export interface ReportInput {
  title: string; emoji: string; lang: Lang; userName: string; msgs: Message[];
  nameFor: (m: Message) => string; colorFor: (m: Message) => string; isJudge: (m: Message) => boolean;
}

export function buildChatHtml(r: ReportInput): string {
  const ar = r.lang === "ar";
  const date = new Date().toLocaleString(ar ? "ar-AE" : "en-GB");
  const decisions = r.msgs.filter((m) => m.verdict);
  const rows = r.msgs.filter((m) => m.status !== "error" && (m.text || m.files.length || m.verdict)).map((m) => {
    const when = new Date(m.createdAt).toLocaleTimeString(ar ? "ar-AE" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    const files = m.files.length ? `<div class="files">📎 ${m.files.map((f) => esc(f.name)).join(" · ")}</div>` : "";
    if (m.role === "user") return `<div class="msg me"><div class="bubble"><div class="who">${esc(r.userName || (ar ? "أنا" : "Me"))} <span class="t">${when}</span></div>${mdToHtml(m.text)}${files}</div></div>`;
    const v = m.verdict;
    const verdict = v ? `<div class="verdict"><div class="dec">⚖️ ${esc(v.decision)}</div><p>${inlineMd(v.summary)}</p><div class="conf">${ar ? "الثقة" : "Confidence"}: ${v.confidence}%</div>${v.actionPlan.length ? `<h4>${ar ? "خطة العمل" : "Action plan"}</h4><ol>${v.actionPlan.map((s) => `<li>${inlineMd(s)}</li>`).join("")}</ol>` : ""}${v.risks.length ? `<h4>${ar ? "المخاطر" : "Risks"}</h4><ul>${v.risks.map((s) => `<li>${inlineMd(s)}</li>`).join("")}</ul>` : ""}${v.dissent ? `<p class="dis">${ar ? "الرأي المخالف" : "Dissent"}: ${inlineMd(v.dissent)}</p>` : ""}</div>` : "";
    const sources = m.sources.length ? `<div class="src">${m.sources.slice(0, 6).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title || s.url)}</a>`).join(" · ")}</div>` : "";
    return `<div class="msg${r.isJudge(m) ? " judge" : ""}"><div class="bubble" style="--c:${esc(r.colorFor(m))}"><div class="who">${esc(r.nameFor(m))}${r.isJudge(m) ? ` <span class="badge">${ar ? "القاضي" : "Judge"}</span>` : ""} <span class="t">${when}</span></div>${mdToHtml(m.text)}${verdict}${files}${sources}</div></div>`;
  }).join("\n");
  const summary = decisions.length ? `<section class="sum"><h2>${ar ? "القرارات" : "Decisions"}</h2><ol>${decisions.map((m) => `<li><b>${esc(m.verdict!.decision)}</b> <span class="t">${new Date(m.createdAt).toLocaleDateString(ar ? "ar-AE" : "en-GB")}</span></li>`).join("")}</ol></section>` : "";
  return `<!doctype html><html lang="${r.lang}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title)} — LiwaBot</title>
<style>
:root{--orange:#F2703C;--dark:#2b2724;--cream:#efece7;--line:#e2ddd5}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--dark);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif}
header{background:var(--dark);color:#fff;padding:28px 20px 22px}header h1{margin:0 0 4px;font-size:24px}header .meta{opacity:.7;font-size:13px}
main{max-width:820px;margin:0 auto;padding:20px 14px 60px}
.msg{display:flex;margin:10px 0}.msg.me{justify-content:flex-end}
.bubble{background:#fff;border:1px solid var(--line);border-radius:18px;padding:10px 14px;max-width:88%;border-inline-start:4px solid var(--c,var(--line))}
.me .bubble{background:var(--orange);color:#fff;border-color:var(--orange)}.me .bubble a{color:#fff}
.judge .bubble{background:var(--dark);color:#fff;border-color:var(--dark)}.judge .bubble a{color:#ffb38a}
.who{font-weight:600;font-size:13px;margin-bottom:4px}.t{font-weight:400;opacity:.6;font-size:11px;margin-inline-start:6px}
.badge{background:var(--orange);color:#fff;border-radius:999px;padding:1px 8px;font-size:10px}
.bubble p{margin:6px 0}.bubble h2,.bubble h3,.bubble h4,.bubble h5{margin:10px 0 4px}pre{background:#f4f1ec;color:#222;padding:10px;border-radius:10px;overflow:auto;direction:ltr;text-align:left}code{font-family:ui-monospace,Menlo,monospace;font-size:13px}
.files,.src{font-size:12px;opacity:.75;margin-top:6px}.src a{margin-inline-end:4px}
.verdict{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 12px;margin-top:8px}.verdict .dec{font-weight:700;font-size:16px}.verdict .conf{font-size:12px;opacity:.8}.verdict .dis{opacity:.8;font-size:13px}
.sum{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px 18px;margin-bottom:14px}.sum h2{margin:0 0 8px;font-size:18px}
footer{text-align:center;font-size:12px;opacity:.6;padding:20px}
@media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.bubble{max-width:100%}}
</style></head><body>
<header><h1>${esc(r.emoji)} ${esc(r.title)}</h1><div class="meta">LiwaBot · ${date} · ${r.msgs.length} ${ar ? "رسالة" : "messages"}</div></header>
<main>${summary}${rows}</main>
<footer>${ar ? "تقرير مُصدَّر من تطبيق ليوا بوت" : "Exported from LiwaBot"}</footer>
</body></html>`;
}
