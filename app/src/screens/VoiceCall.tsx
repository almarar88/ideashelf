// Live voice call with the team: the boss talks, agents answer out loud with their own voices,
// sentence by sentence while the reply is still streaming, and the mic re-opens automatically.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RobotAvatar } from "../lib/avatars";
import { Icon } from "../components/ui";
import { t } from "../lib/i18n";
import { Speaker, cleanForSpeech, listenOnce, stopListening, voiceAvailable, voiceIndexes, voiceProfileFor, type VoiceProfile } from "../lib/voice";
import { JUDGE_ID, type Agent, type Group, type JudgeConfig, type Lang, type Message } from "../lib/types";

interface Props {
  group: Group; members: Agent[]; judge: JudgeConfig; lang: Lang; userName: string;
  msgs: Message[]; running: boolean;
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
  onClose: () => void;
}

type Phase = "idle" | "listening" | "thinking" | "speaking";
const BOUNDARY = /[.!?؟…\n]|[،,;؛](?=\s)/g;

export default function VoiceCall({ group, members, judge, lang, userName, msgs, running, onSend, onStop, onClose }: Props) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const [handsFree, setHandsFree] = useState(true);
  const [partial, setPartial] = useState("");
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [caption, setCaption] = useState<{ who: string; text: string; me?: boolean } | null>(null);
  const [voiceOk, setVoiceOk] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const startAt = useRef(Date.now());
  const spoken = useRef(new Map<string, number>());
  const speaker = useRef(new Speaker());
  const voices = useRef<number[]>([]);
  const handsFreeRef = useRef(true);
  const runningRef = useRef(running);
  const closed = useRef(false);
  const silentRounds = useRef(0);
  const onSendRef = useRef(onSend); onSendRef.current = onSend;
  const userNameRef = useRef(userName); userNameRef.current = userName;
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const nameFor = useCallback((id?: string) => (id === JUDGE_ID ? judge.name : members.find((m) => m.id === id)?.name ?? "?"), [judge.name, members]);
  const profiles = useMemo(() => {
    const map = new Map<string, VoiceProfile>();
    members.forEach((m, i) => map.set(m.id, voiceProfileFor(m.avatar + i, m.humor, false, voices.current)));
    map.set(JUDGE_ID, voiceProfileFor(judge.avatar, 50, true, voices.current));
    return map;
  }, [members, judge.avatar]);

  const listen = useCallback(async () => {
    if (closed.current || phaseRef.current === "listening") return;
    speaker.current.stop();
    setPhase("listening"); setPartial(""); setErr(null);
    try {
      const text = (await listenOnce(lang, setPartial)).trim();
      if (closed.current) return;
      setPartial("");
      if (!text) {
        // Heard nothing: in hands-free mode keep the mic open for a couple more rounds, then wait for a tap.
        setPhase("idle");
        if (handsFreeRef.current && silentRounds.current < 2) { silentRounds.current++; setTimeout(() => { if (!closed.current && phaseRef.current === "idle") void listen(); }, 300); }
        return;
      }
      silentRounds.current = 0;
      setCaption({ who: userNameRef.current || t(lang, "youSaid"), text, me: true });
      setPhase("thinking");
      await onSendRef.current(text);
      if (closed.current) return;
      // Replies finished. The last chunk is enqueued by the msgs effect on the next commit, so check after a short delay.
      setTimeout(() => {
        if (closed.current || phaseRef.current !== "thinking" || speaker.current.speaking || speaker.current.pending) return;
        setPhase("idle"); if (handsFreeRef.current) void listen();
      }, 400);
    } catch (e) {
      if (closed.current) return;
      setErr(/permission/i.test(String(e)) ? t(lang, "micDenied") : String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }, [lang]);

  // Engine setup + speaker callbacks (once per call)
  useEffect(() => {
    closed.current = false;
    const sp = speaker.current;
    sp.onStart = (tag) => { setSpeakerId(tag); setPhase("speaking"); };
    sp.onIdle = () => {
      if (closed.current) return;
      setSpeakerId(null);
      if (runningRef.current) { setPhase("thinking"); return; }
      setPhase("idle");
      if (handsFreeRef.current) setTimeout(() => { if (!closed.current && phaseRef.current === "idle" && !runningRef.current) void listen(); }, 350);
    };
    voiceAvailable().then((ok) => { setVoiceOk(ok); if (ok) setTimeout(() => void listen(), 400); });
    voiceIndexes(lang).then((ids) => { voices.current = ids; });
    return () => { closed.current = true; sp.stop(); void stopListening(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Speak new reply text as it streams: complete sentences first, the remainder once the message is done.
  useEffect(() => {
    for (const m of msgs) {
      if (m.role === "user" || m.createdAt < startAt.current || m.status === "error") continue;
      const full = m.verdict ? `${m.verdict.decision}. ${m.verdict.summary}` : m.text;
      if (!full || /^\s*\[skip\]/.test(full)) continue;
      const done = spoken.current.get(m.id) ?? 0;
      if (done >= full.length) continue;
      const rest = full.slice(done);
      let chunk = "";
      if (m.status === "done") chunk = rest;
      else {
        let cut = -1; let hit: RegExpExecArray | null;
        BOUNDARY.lastIndex = 0;
        while ((hit = BOUNDARY.exec(rest))) cut = hit.index + hit[0].length;
        if (cut >= 40) chunk = rest.slice(0, cut);
      }
      if (!chunk.trim()) continue;
      spoken.current.set(m.id, done + chunk.length);
      const id = m.agentId ?? JUDGE_ID;
      setCaption({ who: nameFor(id), text: cleanForSpeech(full.slice(0, done + chunk.length)) });
      speaker.current.enqueue(chunk, lang, profiles.get(id) ?? { pitch: 1, rate: 1 }, id);
    }
  }, [msgs, lang, profiles, nameFor]);

  // The team is thinking (no speech yet) → show it.
  useEffect(() => { if (running && phaseRef.current === "idle") setPhase("thinking"); }, [running]);

  const micTap = async () => {
    if (phase === "listening") { await stopListening(); return; }
    if (phase === "speaking") speaker.current.stop();
    if (running) onStop();
    silentRounds.current = 0;
    void listen();
  };
  const end = () => { closed.current = true; speaker.current.stop(); void stopListening(); if (running) onStop(); onClose(); };

  const current = speakerId === JUDGE_ID ? { avatar: judge.avatar, color: judge.color, name: judge.name } : members.find((m) => m.id === speakerId);
  const statusText = phase === "listening" ? t(lang, "listening") : phase === "thinking" ? t(lang, "thinking") : phase === "speaking" && current ? `${current.name} ${t(lang, "speaking")}` : handsFree ? t(lang, "handsFreeDesc") : t(lang, "tapToTalk");

  return (
    <div className="voice-call fade-in">
      <div className="row between">
        <button className="icon-btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }} onClick={end}><Icon name="x" /></button>
        <div style={{ textAlign: "center" }}><div style={{ fontWeight: 600 }}>{group.emoji} {group.name}</div><div className="small" style={{ opacity: .6 }}>{t(lang, "voiceCall")}</div></div>
        <span style={{ width: 44 }} />
      </div>

      <div className="voice-stage">
        <div className={"voice-speaker" + (phase === "speaking" ? " on" : "")}>
          <span className="voice-ring" /><span className="voice-ring r2" />
          {current
            ? <RobotAvatar variant={current.avatar} color={current.color} size={150} mood={phase === "speaking" ? "talking" : "happy"} />
            : <div className="row" style={{ gap: 0 }}>{members.slice(0, 4).map((m, i) => <span key={m.id} style={{ marginInlineStart: i ? -22 : 0 }}><RobotAvatar variant={m.avatar} color={m.color} size={96} mood={phase === "thinking" ? "busy" : phase === "listening" ? "happy" : "idle"} /></span>)}{group.judgeEnabled && <span style={{ marginInlineStart: -22 }}><RobotAvatar variant={judge.avatar} color={judge.color} size={96} mood={phase === "thinking" ? "busy" : "idle"} /></span>}</div>}
          {current && <div style={{ fontWeight: 600, fontSize: 18 }}>{current.name}</div>}
        </div>
        <div className="voice-others">
          {members.map((m) => <button key={m.id} className={speakerId === m.id ? "on" : ""}><RobotAvatar variant={m.avatar} color={m.color} size={40} mood={speakerId === m.id ? "talking" : "idle"} /></button>)}
          {group.judgeEnabled && <button className={speakerId === JUDGE_ID ? "on" : ""}><RobotAvatar variant={judge.avatar} color={judge.color} size={40} mood={speakerId === JUDGE_ID ? "talking" : "idle"} /></button>}
        </div>
        {(partial || caption) && (
          <div className={"voice-caption" + (partial || caption?.me ? " me" : "")}>
            <div className="who">{partial ? (userName || t(lang, "youSaid")) : caption?.who}</div>
            {partial || caption?.text}
          </div>
        )}
        {voiceOk === false && <div className="card soft small" style={{ color: "var(--text)" }}>{t(lang, "voiceUnavailable")}</div>}
        {err && <div className="error-box">{err}</div>}
      </div>

      <div className="voice-status">{statusText}</div>
      <div className="voice-bar">
        <button className={"ctl" + (handsFree ? " on" : "")} onClick={() => setHandsFree((v) => !v)} title={t(lang, "handsFree")}><span style={{ fontSize: 11, fontWeight: 700 }}>{t(lang, "handsFree")}</span></button>
        <button className={"voice-mic " + phase} onClick={micTap} disabled={voiceOk === false}>{phase === "listening" ? <Icon name="stop" size={32} /> : phase === "speaking" ? "🎙️" : phase === "thinking" ? <span className="spin" style={{ display: "inline-block", width: 28, height: 28, border: "3px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> : "🎙️"}</button>
        <button className="ctl" style={{ background: "var(--red)" }} onClick={end} title={t(lang, "endCall")}><Icon name="x" /></button>
      </div>
    </div>
  );
}
