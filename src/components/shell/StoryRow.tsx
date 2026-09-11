import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { people } from "@/lib/data";

export function StoryRow({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative z-10 -mx-1 flex gap-4 overflow-x-auto no-scrollbar px-5 pb-4">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-[62px] shrink-0 flex-col items-center gap-1.5"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-surface text-ink shadow-lift transition active:scale-95">
          <Plus size={20} />
        </span>
        <span className="text-[11px] text-muted">أضف أثراً</span>
      </button>
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          className="flex w-[62px] shrink-0 flex-col items-center gap-1.5"
        >
          <Avatar person={p} size="lg" ring={p.ring} />
          <span className="max-w-full truncate text-[11px] text-muted">{p.name}</span>
        </button>
      ))}
    </div>
  );
}
