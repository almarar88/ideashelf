import { Bell, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { useMe, useUnread } from "@/store/store";

export function TopBar({
  light,
  onProfile,
  onNotifications,
  onMessages,
}: {
  light: { label: string; warmth: number };
  onProfile: () => void;
  onNotifications: () => void;
  onMessages: () => void;
}) {
  const me = useMe();
  const unread = useUnread();

  return (
    <header className="relative z-20 flex items-center gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
      <button type="button" onClick={onProfile} aria-label="حسابي">
        <Avatar person={me} size="lg" ring />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-1.5" dir="ltr">
          <Logo size={20} />
          <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">Chrono AI</p>
        </div>
        <p className="mt-0.5 text-center text-[11px] text-muted">
          {me.handle} · {light.label}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton label="التنبيهات" count={unread.notifications} onClick={onNotifications}>
          <Bell size={17} />
        </IconButton>
        <IconButton label="الرسائل" count={unread.messages} onClick={onMessages}>
          <MessageSquare size={17} />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  label,
  count,
  onClick,
  children,
}: {
  label: string;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count ? `${label}: ${count} غير مقروء` : label}
      className="relative grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-lift transition active:scale-95"
    >
      {children}
      {count > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 left-0 grid h-[18px] min-w-[18px] place-items-center rounded-full",
            "bg-rose px-1 text-[10px] font-semibold text-white",
          )}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
