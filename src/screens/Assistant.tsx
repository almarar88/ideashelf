import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton, cx } from "@/components/ui";
import { aiIsLive, askAssistant } from "@/lib/ai";
import type { AssistantReply } from "@/lib/ai";
import { useStore } from "@/state/store";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  source?: AssistantReply["source"];
  actions?: AssistantReply["actions"];
}

export default function Assistant() {
  const navigate = useNavigate();
  const { t, locale } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    { id: "greet", role: "bot", text: t("assistantGreeting"), source: aiIsLive() ? "ai" : "local" },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const suggestions =
    locale === "ar"
      ? ["أرخص رحلة إلى دبي", "خطة ٤ أيام في إسطنبول", "أفضل باقة إنترنت للسعودية", "فندق قريب من وسط باريس"]
      : ["Cheapest flight to Dubai", "4-day Istanbul plan", "Best data plan for Saudi Arabia", "Hotel near central Paris"];

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setDraft("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text: question }]);
    setBusy(true);
    try {
      const reply = await askAssistant(question, locale);
      setMessages((m) => [
        ...m,
        { id: `b-${Date.now()}`, role: "bot", text: reply.text, source: reply.source, actions: reply.actions },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-[18px] font-extrabold leading-tight">{t("assistant")}</h1>
          <p className="text-[11px] text-ink-muted">{aiIsLive() ? t("liveModel") : t("onDevice")}</p>
        </div>
      </header>

      <div className="screen px-5 pt-4">
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[86%] rounded-[22px] px-4 py-3 text-[13.5px] leading-relaxed shadow-soft",
                  m.role === "user" ? "bg-ink text-white" : "bg-white text-ink",
                )}
              >
                {m.role === "bot" && (
                  <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-brand">
                    <Sparkles size={11} /> {m.source === "ai" ? t("liveModel") : t("onDevice")}
                  </span>
                )}
                <p>{m.text}</p>
                {m.actions && m.actions.length > 0 && (
                  <span className="mt-2.5 flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <button
                        key={a.to}
                        type="button"
                        onClick={() => navigate(a.to)}
                        className="chip bg-brand-50 py-2 text-[11px] text-brand"
                      >
                        {locale === "ar" ? a.labelAr : a.label}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-[22px] bg-white px-4 py-4 shadow-soft">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 animate-bounce rounded-full bg-brand"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-5 pb-safe">
        <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} className="chip shrink-0 bg-white py-2.5 text-[11px] text-ink-soft shadow-soft">
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="mb-3 flex items-center gap-2 rounded-full bg-white p-1.5 shadow-card"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("askAnything")}
            aria-label={t("askAnything")}
            className="min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none"
          />
          <button type="submit" aria-label={t("send")} disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white transition active:scale-90 disabled:opacity-50">
            <Send size={17} className="flip-rtl" />
          </button>
        </form>
      </div>
    </div>
  );
}
