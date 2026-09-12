import { useEffect, useRef, useState } from "react";
import { ChevronRight, Info, Send } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { nextId, since, useStore } from "@/store/store";

export function MessagesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = state.conversations.find((c) => c.id === openId);
  const person = state.people.find((p) => p.id === conversation?.personId);
  const unreadTotal = state.conversations.reduce((s, c) => s + c.unread, 0);

  useEffect(() => {
    if (conversation) endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation]);

  const send = () => {
    const text = draft.trim();
    if (!text || !conversation) return;
    dispatch({
      type: "dm/send",
      conversationId: conversation.id,
      message: { id: nextId("m"), from: "me", text, at: Date.now() },
    });
    setDraft("");
  };

  const openThread = (id: string) => {
    setOpenId(id);
    dispatch({ type: "dm/read", conversationId: id });
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setOpenId(null);
        onClose();
      }}
      title={conversation && person ? person.name : "الرسائل"}
      subtitle={
        conversation && person
          ? person.handle
          : unreadTotal
            ? `${unreadTotal} غير مقروء`
            : "محادثاتك"
      }
    >
      {!conversation ? (
        <div className="space-y-1 pb-3">
          {state.conversations.map((c) => {
            const who = state.people.find((p) => p.id === c.personId);
            const last = c.messages[c.messages.length - 1];
            if (!who) return null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openThread(c.id)}
                className="flex w-full items-center gap-3 rounded-xl2 p-2.5 text-right transition hover:bg-raised"
              >
                <Avatar person={who} size="md" ring={c.unread > 0} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[13.5px] font-semibold">{who.name}</span>
                    <span className="mr-auto shrink-0 text-[10.5px] text-muted">
                      {last ? since(last.at) : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-[12px]",
                      c.unread > 0 ? "font-medium text-ink" : "text-muted",
                    )}
                  >
                    {last?.from === "me" ? "أنت: " : ""}
                    {last?.text}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rose px-1.5 text-[10.5px] font-semibold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            );
          })}
          <p className="flex items-start gap-1.5 px-1 pt-3 text-[11px] leading-relaxed text-muted">
            <Info size={13} className="mt-0.5 shrink-0" />
            المحادثات هنا بيانات تجريبية داخل جهازك. رسائلك تُحفظ فعلاً، لكن لا طرف
            آخر يستقبلها — لا يوجد خادم في هذا النموذج.
          </p>
        </div>
      ) : (
        <div className="flex flex-col pb-2">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-raised px-3 py-1.5 text-[12px] text-muted"
          >
            <ChevronRight size={14} />
            كل المحادثات
          </button>

          <div className="space-y-2">
            {conversation.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[82%] rounded-xl2 px-3.5 py-2.5",
                  m.from === "me"
                    ? "ms-auto bg-iris/15"
                    : "me-auto bg-raised",
                )}
              >
                <p className="text-[13px] leading-relaxed">{m.text}</p>
                <p className="mt-1 text-[10px] text-muted">{since(m.at)}</p>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="sticky bottom-0 mt-3 flex items-center gap-2 rounded-full bg-raised px-3 py-1.5"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب رسالة…"
              className="flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="إرسال"
              disabled={!draft.trim()}
              className="grid h-8 w-8 place-items-center rounded-full bg-surface text-iris disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </Sheet>
  );
}
