import { AtSign, Bell, CheckCheck, Heart, MessageCircle, Sparkles, UserPlus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { since, useStore } from "@/store/store";
import type { Notification } from "@/lib/types";

const ICON: Record<Notification["kind"], { Icon: typeof Bell; tone: string }> = {
  like: { Icon: Heart, tone: "text-rose" },
  comment: { Icon: MessageCircle, tone: "text-iris" },
  follow: { Icon: UserPlus, tone: "text-mint" },
  mention: { Icon: AtSign, tone: "text-amber" },
  system: { Icon: Sparkles, tone: "text-muted" },
};

export function NotificationsSheet({
  open,
  onClose,
  onOpenPost,
}: {
  open: boolean;
  onClose: () => void;
  onOpenPost: (postId: string) => void;
}) {
  const { state, dispatch } = useStore();
  const list = state.notifications;
  const unread = list.filter((n) => !n.read).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="التنبيهات"
      subtitle={unread ? `${unread} غير مقروء` : "كل شيء مقروء"}
    >
      {unread > 0 && (
        <button
          type="button"
          onClick={() => dispatch({ type: "notif/readAll" })}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[12px] font-medium text-muted transition active:scale-95"
        >
          <CheckCheck size={14} />
          تعليم الكل كمقروء
        </button>
      )}

      <div className="space-y-1 pb-3">
        {list.map((n) => {
          const person = state.people.find((p) => p.id === n.personId);
          const { Icon, tone } = ICON[n.kind];
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                dispatch({ type: "notif/read", id: n.id });
                if (n.postId) {
                  onOpenPost(n.postId);
                  onClose();
                }
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl2 p-3 text-right transition",
                n.read ? "bg-transparent" : "bg-raised",
              )}
            >
              <span className="relative shrink-0">
                {person ? (
                  <Avatar person={person} size="md" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-raised">
                    <Sparkles size={16} className="text-muted" />
                  </span>
                )}
                <span
                  className={cn(
                    "absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-surface shadow-lift",
                    tone,
                  )}
                >
                  <Icon size={11} fill={n.kind === "like" ? "currentColor" : "none"} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-relaxed">
                  {person && <span className="font-semibold">{person.name} </span>}
                  {n.text}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">{since(n.at)}</span>
              </span>
              {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose" />}
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="py-10 text-center text-[13px] text-muted">لا تنبيهات بعد.</p>
        )}
      </div>
    </Sheet>
  );
}
