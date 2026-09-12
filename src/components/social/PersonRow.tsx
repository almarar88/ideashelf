import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useActions, useStore } from "@/store/store";
import type { Person } from "@/lib/types";

export function PersonRow({
  person,
  subtitle,
  onOpen,
}: {
  person: Person;
  subtitle?: string;
  onOpen?: () => void;
}) {
  const { state } = useStore();
  const actions = useActions();
  const isFollowing = state.following.includes(person.id);
  const isBlocked = state.blocked.includes(person.id);

  return (
    <div className="flex items-center gap-3 rounded-xl2 px-1 py-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-right">
        <Avatar person={person} size="md" ring={isFollowing} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{person.name}</span>
          <span className="block truncate text-[11.5px] text-muted" dir="ltr">
            {subtitle ?? person.handle}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => actions.follow(person.id)}
        disabled={isBlocked}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition active:scale-95 disabled:opacity-50",
          isFollowing ? "bg-raised text-muted" : "text-white shadow-glow",
        )}
        style={
          isFollowing
            ? undefined
            : { background: "linear-gradient(140deg, rgb(var(--rose)), rgb(var(--iris)))" }
        }
      >
        {isBlocked ? "محظور" : isFollowing ? "يتابع" : "متابعة"}
      </button>
    </div>
  );
}
