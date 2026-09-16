import { useMemo, useState } from "react";
import { ExportBar } from "@/components/ExportBar";
import { partnersToSheet } from "@/lib/report";
import { useAgentContext, useWide } from "@/lib/app-context";
import { Plus, Search, Sparkles, Phone, Mail, Globe, FileText, Handshake, MessageSquare, Copy, Share2, ClipboardCheck } from "lucide-react";
import { Button, Card, Empty, Field, Header, Input, Pill, Select, Sheet, Spinner, TextArea } from "@/components/ui";
import { Markdown } from "@/lib/markdown";
import { PARTNER_STATUSES, PARTNER_TYPES, partnerStatusKey, partnerTypeKey, useT } from "@/lib/useT";
import { partnerHealth, useStore } from "@/store/useStore";
import { daysBetween, fmtDate, fmtMoney, todayISO, uid } from "@/lib/ids";
import { shareText, useApp, useJob } from "@/lib/app-context";
import { demoText, describeError, emailDraft, hasAI, negotiationPrep, partnerBrief, proposalDraft } from "@/lib/ai";
import type { Partner } from "@/types";

export function Partners({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { t, lang } = useT();
  const { partners, deals, agreements, tasks } = useStore();
  const wide = useWide();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState<{ open: boolean; p?: Partner }>({ open: false });
  const today = todayISO();

  const list = useMemo(() => partners.filter((p) => (filter === "all" || p.type === filter) && (q === "" || (p.name + p.sector + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase()))), [partners, q, filter]);

  const selected = selectedId ? partners.find((x) => x.id === selectedId) : undefined;
  if (selected && !wide) return <PartnerDetail p={selected} onBack={() => onSelect(null)} onEdit={() => setForm({ open: true, p: selected })} form={form} closeForm={() => setForm({ open: false })} />;

  const listView = (
    <div className="pb-32">
      <Header title={t("partners")} right={<Button small onClick={() => setForm({ open: true })}><Plus size={14} />{t("addPartner")}</Button>} />
      <ExportBar className="mb-3" filename={`partners-${todayISO()}`} sheets={() => [partnersToSheet(partners, deals, agreements, lang)]} />
      <div className="relative mb-3">
        <Search size={18} className="absolute top-3.5 start-4 text-white/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPartners")} className="field ps-11" />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4">
        {["all", ...PARTNER_TYPES].map((ty) => (
          <button key={ty} onClick={() => setFilter(ty)} className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${filter === ty ? "bg-white text-ink" : "bg-white/10"}`}>{ty === "all" ? t("all") : t(partnerTypeKey(ty as Partner["type"]))}</button>
        ))}
      </div>
      {list.length === 0 && <Empty>{t("noPartners")}</Empty>}
      <div className="list-grid">
        {list.map((p) => {
          const h = partnerHealth(p, deals, agreements, tasks);
          const value = deals.filter((d) => d.partnerId === p.id && d.stage !== "lost").reduce((s, d) => s + d.value, 0);
          return (
            <Card key={p.id} onClick={() => onSelect(p.id)} className={wide && p.id === selectedId ? "ring-2 ring-white" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[17px] leading-tight">{p.name}</div>
                  <div className="text-[12px] text-muted mt-0.5">{p.sector} · {p.country}</div>
                </div>
                <Pill tone={h >= 70 ? "ok" : h >= 45 ? "medium" : "urgent"}>{h}%</Pill>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Pill>{t(partnerTypeKey(p.type))}</Pill>
                <Pill tone={p.status === "active" ? "ok" : p.status === "prospect" ? "info" : "dark"}>{t(partnerStatusKey(p.status))}</Pill>
                <span className="text-[12px] text-muted ms-auto">{value > 0 ? `${fmtMoney(value, deals.find((d) => d.partnerId === p.id)?.currency)} · ` : ""}{daysBetween(p.lastContactAt, today)} {t("days")}</span>
              </div>
            </Card>
          );
        })}
      </div>
      {form.open && !selected && <PartnerForm initial={form.p} onClose={() => setForm({ open: false })} />}
    </div>
  );
  if (!wide) return listView;
  return (
    <div className="md:grid md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:gap-6">
      <div className="min-w-0">{listView}</div>
      <div className="min-w-0">{selected ? <PartnerDetail p={selected} onBack={() => onSelect(null)} onEdit={() => setForm({ open: true, p: selected })} form={form} closeForm={() => setForm({ open: false })} /> : <div className="text-white/40 text-center pt-24">{t("selectPartner")}</div>}</div>
    </div>
  );
}

function PartnerDetail({ p, onBack, onEdit, form, closeForm }: { p: Partner; onBack: () => void; onEdit: () => void; form: { open: boolean; p?: Partner }; closeForm: () => void }) {
  const { t, lang } = useT();
  const { deals, agreements, tasks, settings, upsertPartner, upsertTask } = useStore();
  const { toast, openAssistant } = useApp();
  const pd = deals.filter((d) => d.partnerId === p.id);
  const pa = agreements.filter((a) => a.partnerId === p.id);
  const h = partnerHealth(p, deals, agreements, tasks);
  const [doc, setDoc] = useState<{ title: string; text: string } | null>(null);
  useAgentContext({ label: `${t("partner")}: ${p.name}`, detail: `${p.type} · ${p.sector} · ${p.country}` });
  const [ask, setAsk] = useState<{ kind: "proposal" | "email"; text: string } | null>(null);
  const job = useJob<string>();

  const runDoc = async (title: string, fn: () => Promise<string>, demo: string) => {
    if (!hasAI(settings)) { setDoc({ title, text: demoText(lang, demo) }); return; }
    setDoc({ title, text: "" });
    const r = await job.run(fn, (e) => describeError(e, lang));
    if (r) setDoc({ title, text: r });
  };

  const brief = () => runDoc(t("aiBrief"), async () => { const r = await partnerBrief(settings, p, pd, pa); upsertPartner({ ...p, aiBrief: r }); return r; }, lang === "ar" ? "ملف الشريك" : "partner brief");

  return (
    <div className="pb-32">
      <Header title={p.name} subtitle={`${p.sector} · ${p.country}`} onBack={onBack} right={<Button small variant="ghost" onClick={onEdit}>{t("edit")}</Button>} />
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Pill tone={h >= 70 ? "ok" : h >= 45 ? "medium" : "urgent"}>{t("health")} {h}%</Pill>
        <Pill tone="ghost">{t(partnerTypeKey(p.type))}</Pill>
        <Pill tone="ghost">{t(partnerStatusKey(p.status))}</Pill>
        <Button small variant="ghost" className="ms-auto" onClick={() => { upsertPartner({ ...p, lastContactAt: todayISO() }); toast("✓"); }}>{t("logContact")}</Button>
        <span className="text-[11px] text-white/50 w-full">{t("lastContact")}: {fmtDate(p.lastContactAt, { weekday: true })}</span>
      </div>

      {/* AI actions */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button variant="light" onClick={brief}><Sparkles size={15} />{p.aiBrief ? t("aiBrief") : t("generateBrief")}</Button>
        <Button variant="light" onClick={() => setAsk({ kind: "proposal", text: "" })}><FileText size={15} />{t("draftProposal")}</Button>
        <Button variant="ghost" onClick={() => setAsk({ kind: "email", text: "" })}><Mail size={15} />{t("draftEmail")}</Button>
        <Button variant="ghost" onClick={() => openAssistant(lang === "ar" ? `ما أفضل خطوة تالية مع ${p.name}؟` : `What's the best next move with ${p.name}?`)}><MessageSquare size={15} />{t("askAI")}</Button>
      </div>

      <Card className="mb-3">
        <div className="text-[14px] leading-relaxed">{p.description || "—"}</div>
        {p.tags.length > 0 && <div className="flex gap-1.5 flex-wrap mt-3">{p.tags.map((tg) => <span key={tg} className="text-[11px] bg-olive-100 text-ink rounded-full px-2 py-0.5">#{tg}</span>)}</div>}
        {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-info mt-2"><Globe size={13} />{p.website}</a>}
        {p.notes && <div className="text-[13px] text-muted mt-3 whitespace-pre-wrap">{p.notes}</div>}
        {p.links && p.links.length > 0 && <div className="mt-3 border-t border-black/5 pt-2 space-y-1">{p.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-info"><Globe size={12} />{l.title || l.url}</a>)}</div>}
      </Card>

      <div className="text-[13px] text-white/60 mb-2">{t("contacts")}</div>
      <div className="space-y-2 mb-4">
        {p.contacts.length === 0 && <Card dark className="text-white/50 text-[13px]">—</Card>}
        {p.contacts.map((c) => (
          <Card key={c.id} dark className="flex items-center justify-between">
            <div><div className="font-semibold">{c.name}</div><div className="text-[12px] text-white/50">{c.role}</div></div>
            <div className="flex gap-2">
              {c.phone && <a href={`tel:${c.phone}`} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center"><Phone size={16} /></a>}
              {c.email && <a href={`mailto:${c.email}`} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center"><Mail size={16} /></a>}
            </div>
          </Card>
        ))}
      </div>

      <div className="text-[13px] text-white/60 mb-2">{t("deals")} ({pd.length})</div>
      <div className="space-y-2 mb-4">
        {pd.map((d) => (
          <Card key={d.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="font-semibold truncate">{d.title}</div><div className="text-[12px] text-muted">{t(`st_${d.stage}` as "st_lead")} · {d.probability}%</div></div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[13px] font-bold">{fmtMoney(d.value, d.currency)}</span>
              {["proposal", "negotiation", "renewal"].includes(d.stage) && <button onClick={() => runDoc(t("negotiationPrep"), () => negotiationPrep(settings, d, p), lang === "ar" ? "ملف التفاوض" : "negotiation brief")} className="h-8 w-8 rounded-full bg-olive-100 flex items-center justify-center"><Handshake size={15} /></button>}
            </div>
          </Card>
        ))}
        {pd.length === 0 && <Card dark className="text-white/50 text-[13px]">—</Card>}
      </div>

      <div className="text-[13px] text-white/60 mb-2">{t("agreements")} ({pa.length})</div>
      <div className="space-y-2">
        {pa.map((a) => (
          <Card key={a.id} className="flex items-center justify-between"><div><div className="font-semibold">{a.title}</div><div className="text-[12px] text-muted">{t(`a_${a.type}` as "a_mou")} · {fmtDate(a.endAt)}</div></div><Pill tone={a.status === "signed" ? "ok" : "dark"}>{t(`as_${a.status}` as "as_draft")}</Pill></Card>
        ))}
        {pa.length === 0 && <Card dark className="text-white/50 text-[13px]">—</Card>}
      </div>

      {/* AI document viewer */}
      <Sheet open={!!doc} onClose={() => setDoc(null)} title={doc?.title} full>
        {job.loading && <Spinner label={t("loading")} />}
        {job.error && <div className="text-urgent text-[13px]">{job.error}</div>}
        {doc?.text && (
          <>
            <div className="flex gap-2 mb-3 flex-wrap">
              <ExportBar filename={`${doc.title}-${p.name}`} title={doc.title} markdown={() => doc.text} meta={p.name} />
              <Button small variant="ghost" onClick={() => { navigator.clipboard?.writeText(doc.text); toast(t("copied")); }}><Copy size={13} />{t("copy")}</Button>
              <Button small variant="ghost" onClick={() => shareText(doc.title, doc.text)}><Share2 size={13} />{t("share")}</Button>
              <Button small variant="ghost" onClick={() => { upsertTask({ id: uid(), title: `${doc.title}: ${p.name}`, priority: "medium", status: "open", dueAt: todayISO(), partnerId: p.id, assignee: settings.userName || "—", createdAt: new Date().toISOString(), source: "ai" }); toast("✓"); }}><ClipboardCheck size={13} />{t("addTask")}</Button>
            </div>
            <div className="card-white p-4"><Markdown text={doc.text} /></div>
          </>
        )}
      </Sheet>

      {/* Objective prompt for proposal / email */}
      <Sheet open={!!ask} onClose={() => setAsk(null)} title={ask?.kind === "proposal" ? t("draftProposal") : t("draftEmail")}>
        <Field label={t("objectives")}><TextArea value={ask?.text ?? ""} onChange={(e) => setAsk((a) => a && { ...a, text: e.target.value })} placeholder={lang === "ar" ? "مثال: رعاية ملتقى الشراكات، برنامج تدريب مشترك..." : "e.g. sponsor our partnerships forum, joint training programme..."} /></Field>
        <Button className="w-full" onClick={() => { const a = ask!; setAsk(null); a.kind === "proposal" ? runDoc(t("draftProposal"), () => proposalDraft(settings, p, a.text), lang === "ar" ? "عرض الشراكة" : "proposal") : runDoc(t("draftEmail"), () => emailDraft(settings, p, a.text), lang === "ar" ? "البريد" : "email"); }}><Sparkles size={15} />{t("generate")}</Button>
      </Sheet>

      {form.open && <PartnerForm initial={form.p} onClose={closeForm} />}
    </div>
  );
}

export function PartnerForm({ initial, onClose }: { initial?: Partner; onClose: () => void }) {
  const { t } = useT();
  const { upsertPartner, removePartner, settings } = useStore();
  const [f, setF] = useState<Partner>(() => initial ?? { id: uid(), name: "", type: "strategic", status: "prospect", sector: "", country: "", description: "", tags: [], contacts: [], ownerName: settings.userName || "", lastContactAt: todayISO(), createdAt: new Date().toISOString(), notes: "" });
  const set = <K extends keyof Partner>(k: K, v: Partner[K]) => setF((s) => ({ ...s, [k]: v }));
  const [tags, setTags] = useState(f.tags.join(", "));
  const links = f.links ?? [];
  const save = () => { if (!f.name.trim()) return; upsertPartner({ ...f, tags: tags.split(",").map((x) => x.trim()).filter(Boolean) }); onClose(); };
  return (
    <Sheet open onClose={onClose} title={initial ? t("editPartner") : t("addPartner")} full>
      <Field label={t("name")}><Input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("type")}><Select value={f.type} onChange={(e) => set("type", e.target.value as Partner["type"])}>{PARTNER_TYPES.map((x) => <option key={x} value={x}>{t(partnerTypeKey(x))}</option>)}</Select></Field>
        <Field label={t("status")}><Select value={f.status} onChange={(e) => set("status", e.target.value as Partner["status"])}>{PARTNER_STATUSES.map((x) => <option key={x} value={x}>{t(partnerStatusKey(x))}</option>)}</Select></Field>
        <Field label={t("sector")}><Input value={f.sector} onChange={(e) => set("sector", e.target.value)} /></Field>
        <Field label={t("country")}><Input value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
      </div>
      <Field label={t("website")}><Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
      <Field label={t("description")}><TextArea value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label={t("tags")}><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="a, b, c" /></Field>
      <Field label={t("lastContact")}><Input type="date" value={f.lastContactAt} onChange={(e) => set("lastContactAt", e.target.value)} /></Field>
      <Field label={t("owner")}><Input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
      <div className="label">{t("contacts")}</div>
      {f.contacts.map((c, i) => (
        <div key={c.id} className="grid grid-cols-2 gap-2 mb-2 bg-white/5 rounded-2xl p-2">
          <Input placeholder={t("name")} value={c.name} onChange={(e) => set("contacts", f.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Input placeholder="Role" value={c.role} onChange={(e) => set("contacts", f.contacts.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
          <Input placeholder="Email" value={c.email ?? ""} onChange={(e) => set("contacts", f.contacts.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
          <Input placeholder="Phone" value={c.phone ?? ""} onChange={(e) => set("contacts", f.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
          <button className="text-[12px] text-urgent col-span-2 text-start" onClick={() => set("contacts", f.contacts.filter((_, j) => j !== i))}>{t("delete")}</button>
        </div>
      ))}
      <Button small variant="ghost" className="mb-3" onClick={() => set("contacts", [...f.contacts, { id: uid(), name: "", role: "" }])}><Plus size={13} />{t("contacts")}</Button>
      <div className="label">{t("attachments")}</div>
      {links.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 mb-2">
          <Input placeholder={t("name")} value={l.title} onChange={(e) => set("links", links.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <Input placeholder="https://" value={l.url} onChange={(e) => set("links", links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <button className="text-urgent text-[12px]" onClick={() => set("links", links.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <Button small variant="ghost" className="mb-3" onClick={() => set("links", [...links, { title: "", url: "" }])}><Plus size={13} />{t("addLink")}</Button>
      <Field label={t("notes")}><TextArea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button onClick={save} className="flex-1">{t("save")}</Button>
        {initial && <Button variant="danger" onClick={() => { if (confirm(t("confirmDelete"))) { removePartner(initial.id); onClose(); } }}>{t("delete")}</Button>}
      </div>
    </Sheet>
  );
}
