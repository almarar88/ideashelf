import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { actions, getState, useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { Dots, Gauge, Icon, Sheet, Toggle, fmtTime } from "../components/ui";
import { Markdown } from "../components/markdown";
import { FileChip, FileViewer } from "../components/FileViewer";
import { messagesDB } from "../lib/db";
import { ingestUpload, pickCamera, pickFiles, saveGeneratedFile, shareFile, shareText } from "../lib/files";
import { buildChatHtml } from "../lib/report";
import { speakText, stopSpeaking } from "../lib/voice";
import { handleUserMessage, regenerateReply } from "../lib/chat";
import { keepAlive, notifyDone } from "../lib/background";
import { hasAI } from "../lib/ai";
import { refreshMe } from "../lib/account";
import { listenOnce, stopListening, voiceAvailable } from "../lib/voice";
import Paywall from "./Paywall";
import VoiceCall from "./VoiceCall";
import { JUDGE_ID, uid, type Agent, type FileRef, type JudgeConfig, type Message, type Verdict } from "../lib/types";
import { SESSION_EXAMPLES } from "../lib/presets";

export default function Chat({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { settings, agents, judge, groups } = useStore((s) => s);
  const group = groups.find((g) => g.id === groupId);
  const lang = settings.lang;
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<FileRef[]>([]);
  const [council, setCouncil] = useState(false);
  const [mention, setMention] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [running, setRunning] = useState(false);
  const [viewing, setViewing] = useState<FileRef | null>(null);
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachMenu, setAttachMenu] = useState(false);
  const [permReq, setPermReq] = useState<{ agent: string; desc: string; resolve: (ok: boolean) => void } | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [voiceCall, setVoiceCall] = useState(false);
  const voiceCallRef = useRef(false);
  useEffect(() => { voiceCallRef.current = voiceCall; }, [voiceCall]);
  useEffect(() => { voiceAvailable().then(setVoiceOk); }, []);
  useEffect(() => {
    const h = (e: Event) => { setPaywall((e as CustomEvent<string>).detail || "quota"); refreshMe(); };
    window.addEventListener("majlis:quota", h);
    return () => window.removeEventListener("majlis:quota", h);
  }, []);
  const speakToType = async () => {
    if (listening) { await stopListening(); setListening(false); return; }
    setListening(true);
    try { const txt = await listenOnce(lang, (p) => setText(p)); if (txt) setText(txt); }
    catch (e) { console.warn(e); }
    finally { setListening(false); }
  };
  const allowAllRef = useRef(false);
  const askPermission = useCallback((agent: string, desc: string) => new Promise<boolean>((resolve) => {
    if (allowAllRef.current) { resolve(true); return; }
    setPermReq({ agent, desc, resolve });
  }), []);
  const answerPerm = (ok: boolean, all = false) => { if (all) allowAllRef.current = true; permReq?.resolve(ok); setPermReq(null); };
  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef<Message[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => { messagesDB.get(groupId).then((m) => { msgsRef.current = m; setMsgs(m); setLoaded(true); }); return () => stopSpeaking(); }, [groupId]);

  const persist = useCallback((list: Message[]) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { messagesDB.put(groupId, list); }, 250);
  }, [groupId]);

  const upsert = useCallback((m: Message) => {
    const cur = msgsRef.current;
    const idx = cur.findIndex((x) => x.id === m.id);
    const next = idx >= 0 ? cur.map((x) => (x.id === m.id ? m : x)) : [...cur, m];
    msgsRef.current = next; setMsgs(next); persist(next);
    if (idx >= 0 && cur[idx].status === "streaming" && m.status === "done" && m.role !== "user" && !m.reaction && getState().settings.autoRead && !voiceCallRef.current) {
      speakText(m.verdict ? m.verdict.decision + ". " + m.verdict.summary : m.text, getState().settings.lang);
    }
    if (m.status !== "streaming") {
      const who = m.role === "user" ? "user" : m.agentId ?? "";
      actions.patchGroup(groupId, { updatedAt: Date.now(), lastPreview: (m.text || (m.files[0]?.name ?? "")).slice(0, 80), lastSender: who, msgCount: next.length });
    }
  }, [groupId, persist]);

  const remove = useCallback((id: string) => {
    const next = msgsRef.current.filter((x) => x.id !== id);
    msgsRef.current = next; setMsgs(next); persist(next);
  }, [persist]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, msgs[msgs.length - 1]?.text.length]);

  const members = useMemo(() => agents.filter((a) => group?.memberIds.includes(a.id)), [agents, group]);
  const agentOf = useCallback((id?: string): Agent | null => (id ? agents.find((a) => a.id === id) ?? null : null), [agents]);

  if (!group) return <div className="empty">…</div>;

  const sendMessage = async (body: string, files: FileRef[], opts: { voice?: boolean } = {}) => {
    if (!body && !files.length) return;
    if (!hasAI()) { alert(t(lang, "needKey")); return; }
    if (abortRef.current) return;
    const m: Message = { id: uid(), groupId, role: "user", text: body, files, sources: [], status: "done", createdAt: Date.now(), mentions: mention ? [mention] : undefined, replyTo: replyTo?.id, council, voice: opts.voice };
    upsert(m);
    setText(""); setPending([]); setReplyTo(null);
    const ac = new AbortController(); abortRef.current = ac; setRunning(true);
    await keepAlive.start(t(lang, "workingBg"), group.name);
    try {
      await handleUserMessage({ group: getState().groups.find((g) => g.id === groupId)!, getMessages: () => msgsRef.current, upsert, remove, askPermission, signal: ac.signal, voice: opts.voice }, m, council);
      const last = msgsRef.current[msgsRef.current.length - 1];
      if (last && last.role !== "user" && !opts.voice) notifyDone(`${group.emoji} ${group.name}`, `${nameFor(last)}: ${(last.text || last.files[0]?.name || "").slice(0, 90)}`);
    } finally { setRunning(false); abortRef.current = null; keepAlive.stop(); }
  };
  const send = () => sendMessage(text.trim(), pending);

  // Auto-resume replies that were cut by a network drop (e.g. app was sent to background).
  const resumeBroken = useCallback(async () => {
    if (abortRef.current || !hasAI()) return;
    const broken = msgsRef.current.filter((m) => m.role === "agent" && m.status === "error" && m.replyTo && /Connection error|network|fetch|Stopped/i.test(m.error ?? "") && Date.now() - m.createdAt < 60 * 60 * 1000);
    if (!broken.length) return;
    const ac = new AbortController(); abortRef.current = ac; setRunning(true);
    await keepAlive.start(t(lang, "workingBg"), group?.name ?? "");
    try {
      for (const m of broken) {
        if (ac.signal.aborted) break;
        await regenerateReply({ group: getState().groups.find((g) => g.id === groupId)!, getMessages: () => msgsRef.current, upsert, remove, askPermission, signal: ac.signal }, m);
      }
    } finally { setRunning(false); abortRef.current = null; keepAlive.stop(); }
  }, [groupId, group?.name, lang, upsert, remove, askPermission]);

  useEffect(() => {
    const h = () => { if (document.visibilityState === "visible") resumeBroken(); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [resumeBroken]);

  const attach = async (kind: "camera" | "gallery" | "file") => {
    setAttachMenu(false);
    const files = kind === "camera" ? await pickCamera() : await pickFiles(kind === "gallery" ? "image/*" : "application/pdf,text/*,.md,.csv,.json,.html,.txt", true);
    if (!files.length) return;
    setUploading(true);
    try { const refs = await Promise.all(files.map((f) => ingestUpload(f, groupId))); setPending((p) => [...p, ...refs]); }
    catch (e) { alert(String(e)); }
    finally { setUploading(false); }
  };

  const deleteMsg = (m: Message) => { remove(m.id); setMenuMsg(null); };
  const reactTo = (m: Message, emoji: string) => {
    const cur = m.reactions ?? [];
    upsert({ ...m, reactions: cur.includes(emoji) ? cur.filter((e) => e !== emoji) : [...cur, emoji] });
    setMenuMsg(null);
  };
  const regen = useCallback(async (m: Message) => {
    setMenuMsg(null);
    if (!hasAI()) { alert(t(lang, "needKey")); return; }
    if (abortRef.current) return;
    const ac = new AbortController(); abortRef.current = ac; setRunning(true);
    await keepAlive.start(t(lang, "workingBg"), getState().groups.find((g) => g.id === groupId)?.name ?? "");
    try { await regenerateReply({ group: getState().groups.find((g) => g.id === groupId)!, getMessages: () => msgsRef.current, upsert, remove, askPermission, signal: ac.signal }, m); }
    finally { setRunning(false); abortRef.current = null; keepAlive.stop(); }
  }, [groupId, lang, upsert, remove, askPermission]);
  const speak = (m: Message) => {
    setMenuMsg(null);
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance((m.verdict ? m.verdict.decision + ". " + m.verdict.summary : m.text).replace(/[*#`_]/g, ""));
    u.lang = lang === "ar" ? "ar-AE" : "en-US";
    window.speechSynthesis.speak(u);
  };
  const canSpeak = "speechSynthesis" in window;
  const exportChat = () => {
    const lines = msgs.map((m) => `[${m.role === "user" ? settings.userName || "Me" : m.agentId === JUDGE_ID ? judge.name : agentOf(m.agentId)?.name ?? "?"}] ${m.verdict ? m.verdict.decision + "\n" + m.verdict.summary : m.text}${m.files.length ? "\n(files: " + m.files.map((f) => f.name).join(", ") + ")" : ""}`);
    shareText(group.name, lines.join("\n\n"));
  };
  const exportHtml = async () => {
    const html = buildChatHtml({ title: group.name, emoji: group.emoji, lang, userName: settings.userName, msgs, nameFor: (m) => nameFor(m), colorFor: (m) => m.agentId === JUDGE_ID ? judge.color : agentOf(m.agentId)?.color ?? "#999", isJudge: (m) => m.agentId === JUDGE_ID });
    const ref = await saveGeneratedFile(groupId, "user", `${group.name.replace(/[\\/:*?"<>|]/g, "-")} - ${new Date().toISOString().slice(0, 10)}.html`, html, "report");
    setShowSettings(false);
    await shareFile(ref, group.name);
  };

  const nameFor = useCallback((m: Message) => m.agentId === JUDGE_ID ? judge.name : agentOf(m.agentId)?.name ?? "?", [judge.name, agentOf]);
  const typingNow = msgs.filter((m) => m.status === "streaming");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="hdr-dark" style={{ padding: "calc(10px + var(--safe-top)) 12px 14px", borderRadius: "0 0 24px 24px", flexShrink: 0 }}>
        <div className="row between">
          <button className="icon-btn" onClick={onBack}><Icon name="back" /></button>
          <div className="grow" style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{group.emoji} {group.name}</div>
            <div className="small" style={{ color: "rgba(255,255,255,.6)" }}>
              {typingNow.length ? typingNow.map((m) => nameFor(m)).join("، ") + " " + t(lang, "typing") : running ? t(lang, "teamReading") : `${members.length} ${t(lang, "agentsCount")}${group.judgeEnabled ? " + " + judge.name : ""}`}
            </div>
          </div>
          <button className="icon-btn" onClick={() => setVoiceCall(true)} title={t(lang, "voiceCall")}>📞</button>
          <button className="icon-btn" onClick={() => setShowSettings(true)}><Icon name="more" /></button>
        </div>
        <div className="row" style={{ gap: 0, marginTop: 10, justifyContent: "center" }}>
          {members.map((a, i) => <span key={a.id} style={{ marginInlineStart: i ? -8 : 0 }}><RobotAvatar variant={a.avatar} color={a.color} size={34} mood={typingNow.some((m) => m.agentId === a.id) ? "busy" : "idle"} /></span>)}
          {group.judgeEnabled && <span style={{ marginInlineStart: -8 }}><RobotAvatar variant={judge.avatar} color={judge.color} size={34} mood={typingNow.some((m) => m.agentId === JUDGE_ID) ? "busy" : "idle"} /></span>}
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "14px 12px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loaded && msgs.length === 0 && (
          <div className="card soft fade-in" style={{ marginTop: 10 }}>
            <p className="muted" style={{ marginTop: 0 }}>{t(lang, "emptyChat")}</p>
            <div className="small muted" style={{ marginBottom: 6 }}>{t(lang, "quickStart")}</div>
            <div className="stack" style={{ gap: 6 }}>
              {SESSION_EXAMPLES[lang].map((ex) => <button key={ex} className="chip" style={{ justifyContent: "flex-start", textAlign: "start", whiteSpace: "normal" }} onClick={() => setText(ex)}>{ex}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <MessageRow key={m.id} m={m} replyTarget={m.replyTo ? msgs.find((x) => x.id === m.replyTo) ?? null : null}
            agent={agentOf(m.agentId)} mentionName={m.mentions?.[0] === JUDGE_ID ? judge.name : m.mentions?.[0] === "__all__" ? t(lang, "allMembers") : agentOf(m.mentions?.[0])?.name}
            judge={judge} lang={lang} members={members} canRetry={!!m.replyTo && !running}
            onMenu={setMenuMsg} onOpenFile={setViewing} onRetry={regen} nameFor={nameFor} />
        ))}
      </div>

      <div style={{ flexShrink: 0, padding: "8px 12px calc(10px + var(--safe-bottom))", background: "var(--cream)", borderTop: "1px solid var(--line)" }}>
        {replyTo && <div className="row between small" style={{ background: "var(--cream-2)", padding: "8px 12px", borderRadius: 12, marginBottom: 6 }}><span><Icon name="reply" size={13} /> {t(lang, "replyingTo")} {nameFor(replyTo)}: {replyTo.text.slice(0, 50)}</span><button onClick={() => setReplyTo(null)}><Icon name="x" size={16} /></button></div>}
        {pending.length > 0 && <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 6 }}>{pending.map((f) => <span key={f.id} className="chip orange">{f.name.slice(0, 22)} <button className="x" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>✕</button></span>)}</div>}
        <div className="row" style={{ overflowX: "auto", gap: 6, marginBottom: 8, paddingBottom: 2 }}>
          <button className={"chip" + (council ? " on" : "")} style={{ flexShrink: 0 }} onClick={() => { setCouncil(!council); setMention(null); }}>🏛 {t(lang, "council")}</button>
          <button className={"chip" + (!mention && !council ? " on" : "")} style={{ flexShrink: 0 }} onClick={() => { setMention(null); setCouncil(false); }}>{t(lang, "everyone")}</button>
          <button className={"chip" + (mention === "__all__" ? " on" : "")} style={{ flexShrink: 0 }} onClick={() => { setMention("__all__"); setCouncil(false); }}>👥 {t(lang, "allMembers")}</button>
          {members.map((a) => <button key={a.id} className={"chip" + (mention === a.id ? " on" : "")} style={{ flexShrink: 0 }} onClick={() => { setMention(a.id); setCouncil(false); }}><RobotAvatar variant={a.avatar} color={a.color} size={18} /> {a.name}</button>)}
          {group.judgeEnabled && <button className={"chip" + (mention === JUDGE_ID ? " on" : "")} style={{ flexShrink: 0 }} onClick={() => { setMention(JUDGE_ID); setCouncil(false); }}><Icon name="gavel" size={14} /> {judge.name}</button>}
        </div>
        <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
          <button className="icon-btn" onClick={() => setAttachMenu(true)} disabled={uploading} title={t(lang, "attachHint")}>{uploading ? <Dots /> : <Icon name="clip" />}</button>
          {voiceOk && <button className="icon-btn" style={listening ? { background: "var(--red)", color: "#fff" } : {}} onClick={speakToType} title={t(lang, "voice")}>{listening ? <Dots /> : "🎙️"}</button>}
          <textarea className="input" rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={t(lang, "chatPlaceholder")} style={{ borderRadius: 24, minHeight: 48, maxHeight: 140, padding: "13px 16px", background: "var(--white)" }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(140, el.scrollHeight) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }} />
          {running
            ? <button className="icon-btn" style={{ background: "var(--red)", color: "#fff" }} onClick={() => abortRef.current?.abort()}><Icon name="stop" /></button>
            : <button className="icon-btn" style={{ background: "var(--orange)", color: "#fff" }} onClick={send} disabled={!text.trim() && !pending.length}><span style={{ transform: lang === "ar" ? "scaleX(-1)" : "none", display: "inline-flex" }}><Icon name="send" /></span></button>}
        </div>
      </div>

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
      {voiceCall && <VoiceCall group={group} members={members} judge={judge} lang={lang} userName={settings.userName} msgs={msgs} running={running}
        onSend={(txt) => sendMessage(txt, [], { voice: true })} onStop={() => abortRef.current?.abort()} onClose={() => setVoiceCall(false)} />}

      <Sheet open={!!menuMsg} onClose={() => setMenuMsg(null)}>
        {menuMsg && (
          <div className="stack">
            {menuMsg.role !== "user" && <div className="row" style={{ justifyContent: "space-around", background: "var(--white)", borderRadius: 999, padding: 8 }}>{["👍", "❤️", "😂", "🔥", "👏", "🤔", "👎"].map((e) => <button key={e} style={{ fontSize: 26, opacity: menuMsg.reactions?.includes(e) ? 1 : .8, transform: menuMsg.reactions?.includes(e) ? "scale(1.25)" : "none" }} onClick={() => reactTo(menuMsg, e)}>{e}</button>)}</div>}
            {menuMsg.role !== "user" && <button className="list-item" onClick={() => { setReplyTo(menuMsg); setMenuMsg(null); }}><Icon name="reply" /> {t(lang, "reply") }</button>}
            {menuMsg.role === "agent" && menuMsg.replyTo && !running && <button className="list-item" onClick={() => regen(menuMsg)}><Icon name="refresh" /> {t(lang, "regenerate")}</button>}
            {menuMsg.role !== "user" && canSpeak && <button className="list-item" onClick={() => speak(menuMsg)}>🔊 {t(lang, "speak")}</button>}
            <button className="list-item" onClick={() => { navigator.clipboard.writeText(menuMsg.verdict ? menuMsg.verdict.decision + "\n\n" + menuMsg.verdict.summary : menuMsg.text); setMenuMsg(null); }}><Icon name="copy" /> {t(lang, "copy")}</button>
            <button className="list-item" onClick={() => { shareText(nameFor(menuMsg), menuMsg.text); setMenuMsg(null); }}><Icon name="share" /> {t(lang, "share")}</button>
            <button className="list-item" style={{ color: "var(--red)" }} onClick={() => deleteMsg(menuMsg)}><Icon name="trash" /> {t(lang, "delete")}</button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!paywall} onClose={() => setPaywall(null)}>
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      </Sheet>

      <Sheet open={!!permReq} onClose={() => answerPerm(false)} title={t(lang, "approveTitle")}>
        {permReq && (
          <div className="stack">
            <div className="card soft"><b>{permReq.agent}</b> {t(lang, "wantsTo")}:<div dir="ltr" style={{ marginTop: 6, fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>{permReq.desc}</div></div>
            <button className="btn orange block" onClick={() => answerPerm(true)}><Icon name="check" size={18} /> {t(lang, "approve")}</button>
            <button className="btn light block" onClick={() => answerPerm(true, true)}>{t(lang, "approveAll")}</button>
            <button className="btn block" style={{ background: "var(--red)" }} onClick={() => answerPerm(false)}><Icon name="x" size={18} /> {t(lang, "deny")}</button>
          </div>
        )}
      </Sheet>

      <Sheet open={attachMenu} onClose={() => setAttachMenu(false)}>
        <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <button className="card soft" style={{ textAlign: "center" }} onClick={() => attach("camera")}><div style={{ fontSize: 30 }}>📷</div><div className="small">{t(lang, "camera")}</div></button>
          <button className="card soft" style={{ textAlign: "center" }} onClick={() => attach("gallery")}><div style={{ fontSize: 30 }}>🖼️</div><div className="small">{t(lang, "gallery")}</div></button>
          <button className="card soft" style={{ textAlign: "center" }} onClick={() => attach("file")}><div style={{ fontSize: 30 }}>📄</div><div className="small">{t(lang, "document")}</div></button>
        </div>
        <div className="small muted" style={{ textAlign: "center", marginTop: 10 }}>{t(lang, "attachHint")}</div>
      </Sheet>

      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title={t(lang, "groupSettings")}>
        <div className="stack">
          <div className="field"><label>{t(lang, "groupName")}</label><input className="input" value={group.name} onChange={(e) => actions.patchGroup(groupId, { name: e.target.value })} /></div>
          <div className="field"><label>📌 {t(lang, "groupContext")}</label>
            <textarea className="input" value={group.context ?? ""} onChange={(e) => actions.patchGroup(groupId, { context: e.target.value })} placeholder={t(lang, "groupContextPh")} style={{ minHeight: 90 }} maxLength={2000} />
            <span className="small muted">{t(lang, "groupContextDesc")}</span>
          </div>
          <div className="field"><label>{t(lang, "members")}</label>
            <div className="chips">{agents.map((a) => <button key={a.id} className={"chip" + (group.memberIds.includes(a.id) ? " on" : "")} onClick={() => actions.patchGroup(groupId, { memberIds: group.memberIds.includes(a.id) ? group.memberIds.filter((x) => x !== a.id) : [...group.memberIds, a.id] })}><RobotAvatar variant={a.avatar} color={a.color} size={20} /> {a.name}</button>)}</div>
          </div>
          <div className="row between card soft" style={{ padding: "12px 16px" }}><div><div style={{ fontWeight: 600 }}>{t(lang, "judgeEnabled")}</div><div className="small muted">{t(lang, "judgeDesc")}</div></div><Toggle on={group.judgeEnabled} onChange={(v) => actions.patchGroup(groupId, { judgeEnabled: v })} /></div>
          <div className="row between card soft" style={{ padding: "12px 16px" }}><div><div style={{ fontWeight: 600 }}>{t(lang, "banter")}</div><div className="small muted">{t(lang, "banterDesc")}</div></div><Toggle on={group.banter} onChange={(v) => actions.patchGroup(groupId, { banter: v })} /></div>
          <div className="row between card soft" style={{ padding: "12px 16px" }}><div><div style={{ fontWeight: 600 }}>{t(lang, "debateRound")}</div><div className="small muted">{t(lang, "debateDesc")}</div></div><Toggle on={group.debate} onChange={(v) => actions.patchGroup(groupId, { debate: v })} /></div>
          <button className="btn light block" onClick={() => actions.patchGroup(groupId, { pinned: !group.pinned })}>📌 {t(lang, group.pinned ? "unpinChat" : "pinChat")}</button>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn light grow" onClick={exportChat}><Icon name="share" size={18} /> {t(lang, "exportChat")}</button>
            <button className="btn light grow" onClick={exportHtml}><Icon name="file" size={18} /> {t(lang, "exportHtml")}</button>
          </div>
          <button className="btn block" style={{ background: "var(--red)" }} onClick={() => { if (confirm(t(lang, "confirmDeleteGroup"))) { messagesDB.del(groupId); actions.deleteGroup(groupId); onBack(); } }}><Icon name="trash" size={18} /> {t(lang, "deleteGroup")}</button>
        </div>
      </Sheet>
    </div>
  );
}

interface RowProps {
  m: Message; replyTarget: Message | null; agent: Agent | null; mentionName?: string; judge: JudgeConfig; lang: "ar" | "en"; members: Agent[]; canRetry: boolean;
  onMenu: (m: Message) => void; onOpenFile: (f: FileRef) => void; onRetry: (m: Message) => void; nameFor: (m: Message) => string;
}

/** One chat bubble. Memoized so streaming one message does not re-render the whole list. */
const MessageRow = memo(function MessageRow({ m, replyTarget, agent, mentionName, judge, lang, members, canRetry, onMenu, onOpenFile, onRetry, nameFor }: RowProps) {
  const phaseLabel = (x: Message) => x.phase === "searching" ? t(lang, "statusSearching") : x.phase === "working" ? t(lang, "working") : x.phase === "computer" ? t(lang, "statusComputer") : x.phase === "device" ? t(lang, "statusDevice") : x.phase === "retrying" ? t(lang, "statusRetrying") : x.phase === "writing" ? t(lang, "typing") : t(lang, "statusThinking");
  if (m.role === "user") {
    return (
      <div className="fade-in" style={{ alignSelf: "flex-end", maxWidth: "82%" }} onContextMenu={(e) => { e.preventDefault(); onMenu(m); }}>
        <div style={{ background: "var(--orange)", color: "#fff", borderRadius: "20px 20px 6px 20px", padding: "10px 14px" }} onClick={() => onMenu(m)}>
          {replyTarget && <div className="small" style={{ opacity: .8, borderInlineStart: "2px solid rgba(255,255,255,.6)", paddingInlineStart: 8, marginBottom: 6 }}>{nameFor(replyTarget)}: {replyTarget.text.slice(0, 60)}</div>}
          {mentionName ? <div className="small" style={{ opacity: .85, marginBottom: 4 }}>@{mentionName}</div> : null}
          {m.council && <div className="small" style={{ opacity: .85, marginBottom: 4 }}>🏛 {t(lang, "council")}</div>}
          {m.voice && <div className="small" style={{ opacity: .85, marginBottom: 4 }}>🎙️ {t(lang, "voiceCall")}</div>}
          {m.files.length > 0 && <div className="stack" style={{ gap: 6, marginBottom: m.text ? 8 : 0 }}>{m.files.map((f) => <FileChip key={f.id} file={f} onOpen={onOpenFile} light />)}</div>}
          {m.text && <div className="prose" style={{ margin: 0 }}>{m.text}</div>}
          <div className="small" style={{ opacity: .7, textAlign: "end", marginTop: 4 }}>{fmtTime(m.createdAt, lang)}</div>
        </div>
      </div>
    );
  }
  const isJudge = m.agentId === JUDGE_ID;
  const color = isJudge ? judge.color : agent?.color ?? "#999";
  const avatar = isJudge ? judge.avatar : agent?.avatar ?? 0;
  const busy = m.status === "streaming";
  return (
    <div className="row fade-in" style={{ alignItems: "flex-start", alignSelf: "flex-start", maxWidth: "92%", gap: 8 }}>
      <RobotAvatar variant={avatar} color={color} size={36} mood={busy ? "busy" : m.status === "error" ? "error" : "idle"} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="row" style={{ gap: 6, marginBottom: 3 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: isJudge ? "var(--text)" : color }}>{nameFor(m)}</span>
          {m.reaction && <span className="small muted">💬</span>}
          {isJudge && <span className="pill dark" style={{ padding: "2px 8px", fontSize: 10 }}><Icon name="gavel" size={11} /> {t(lang, "judge")}</span>}
          <span className="small muted">{agent?.title}</span>
        </div>
        <div className={"card" + (isJudge ? " dark" : "")} style={{ padding: "10px 14px", borderRadius: "6px 20px 20px 20px" }} onClick={() => !busy && onMenu(m)}>
          {busy && !m.text && <div className="row muted" style={{ gap: 8 }}><Dots /> <span className="small">{phaseLabel(m)}</span></div>}
          {m.text && <Markdown text={m.text} />}
          {busy && m.text && <div className="row muted small" style={{ gap: 6, marginTop: 4 }}><Dots />{m.phase === "writing" || !m.phase ? "" : phaseLabel(m)}</div>}
          {m.status === "error" && <div className="error-box row between" style={{ gap: 8 }}><span className="grow">{m.error}</span>{canRetry && <button className="pill dark" style={{ flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onRetry(m); }}><Icon name="refresh" size={13} /> {t(lang, "retry")}</button>}</div>}
          {m.verdict && <VerdictCard v={m.verdict} members={members} lang={lang} />}
          {m.files.length > 0 && <div className="stack" style={{ gap: 6, marginTop: 8 }}>{m.files.map((f) => <FileChip key={f.id} file={f} onOpen={onOpenFile} light={isJudge} />)}</div>}
          {m.sources.length > 0 && <Sources sources={m.sources} lang={lang} />}
          {m.reactions?.length ? <div style={{ marginTop: 6 }}>{m.reactions.map((e) => <span key={e} className="pill" style={{ padding: "2px 8px", fontSize: 13, marginInlineEnd: 4 }}>{e}</span>)}</div> : null}
          <div className="small" style={{ opacity: .55, textAlign: "end", marginTop: 4 }}>{fmtTime(m.createdAt, lang)}{m.usage ? ` · ${((m.usage.input + m.usage.output) / 1000).toFixed(1)}K` : ""}</div>
        </div>
      </div>
    </div>
  );
});

function Sources({ sources, lang }: { sources: { url: string; title: string }[]; lang: "ar" | "en" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button className="pill" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}><Icon name="globe" size={12} /> {sources.length} {t(lang, "sources")}</button>
      {open && <div className="stack" style={{ gap: 4, marginTop: 6 }}>{sources.slice(0, 8).map((s) => <a key={s.url} className="source" href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Icon name="globe" size={12} /><span>{s.title || s.url}</span></a>)}</div>}
    </div>
  );
}

function VerdictCard({ v, members, lang }: { v: Verdict; members: Agent[]; lang: "ar" | "en" }) {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  return (
    <div className="stack" style={{ marginTop: 10, gap: 10 }}>
      <div className="card" style={{ background: "rgba(255,255,255,.08)", color: "inherit", padding: 14 }}>
        <div className="row between"><span className="pill orange"><Icon name="gavel" size={12} /> {t(lang, "verdict")}</span><span className="small" style={{ opacity: .7 }}>{t(lang, "confidence")} {Math.round(v.confidence)}%</span></div>
        <div style={{ margin: "-4px 0 -8px", color: "#fff" }}><Gauge value={v.confidence} size={200} /></div>
        <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{v.decision}</div>
        <p className="prose" style={{ margin: "8px 0 0", fontSize: 14, opacity: .9 }}>{v.summary}</p>
      </div>
      {v.actionPlan.length > 0 && <div><div className="small" style={{ opacity: .7, marginBottom: 4 }}>{t(lang, "actionPlan")}</div><ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.6 }}>{v.actionPlan.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
      {v.scores.length > 0 && <div><div className="small" style={{ opacity: .7, marginBottom: 6 }}>{t(lang, "scores")}</div>
        <div className="stack" style={{ gap: 8 }}>{v.scores.map((s) => (
          <div key={s.agentId}>
            <div className="row between small"><span style={{ fontWeight: 600 }}>{name(s.agentId)}{s.agentId === v.bestAgentId ? " ⭐" : ""}</span><span>{s.score}/10</span></div>
            <div className="score-bar" style={{ background: "rgba(255,255,255,.15)" }}><div style={{ width: `${s.score * 10}%` }} /></div>
            <div className="small" style={{ opacity: .75, marginTop: 2 }}>{s.strengths}{s.weaknesses ? " · " + s.weaknesses : ""}</div>
          </div>))}</div></div>}
      {v.risks.length > 0 && <div><div className="small" style={{ opacity: .7, marginBottom: 4 }}>{t(lang, "risks")}</div><ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.6 }}>{v.risks.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      {v.dissent && <div className="small" style={{ opacity: .8 }}><b>{t(lang, "dissent")}:</b> {v.dissent}</div>}
    </div>
  );
}
