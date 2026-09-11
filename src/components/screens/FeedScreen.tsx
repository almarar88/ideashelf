import { useMemo, useState } from "react";
import { StoryRow } from "@/components/shell/StoryRow";
import { PostCard } from "@/components/feed/PostCard";
import { PostDepth } from "@/components/feed/PostDepth";
import { Sheet } from "@/components/ui/Sheet";
import { Pill } from "@/components/ui/Pill";
import { posts } from "@/lib/data";
import type { Post, PostKind } from "@/lib/types";

type Filter = "all" | PostKind | "mine";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "المفضلة" },
  { id: "film", label: "أفلام" },
  { id: "essay", label: "مقالات" },
  { id: "moment", label: "لحظات" },
  { id: "mine", label: "أثري" },
];

export function FeedScreen({ onNotice }: { onNotice: (msg: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<{ post: Post; tab: "text" | "ask" } | null>(null);

  const visible = useMemo(() => {
    if (filter === "all") return posts;
    if (filter === "mine") return posts.filter((p) => p.author.id === "me");
    return posts.filter((p) => p.kind === filter);
  }, [filter]);

  return (
    <>
      <StoryRow onAdd={() => onNotice("فتح الالتقاط: النبض يتحول إلى موجّه إخراجي داخل الاستوديو.")} />

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-3">
        {FILTERS.map((f) => (
          <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Pill>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
        {visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={!!liked[post.id]}
            onLike={() => setLiked((s) => ({ ...s, [post.id]: !s[post.id] }))}
            onOpen={() => setOpen({ post, tab: "text" })}
            onAsk={() => setOpen({ post, tab: "ask" })}
          />
        ))}
        {visible.length === 0 && (
          <p className="mt-16 text-center text-[13px] text-muted">
            لا شيء هنا بعد — جرّب مرشّحاً آخر.
          </p>
        )}
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.post.title ?? ""}
        subtitle={open ? `${open.post.author.name} · ${open.post.place}` : undefined}
      >
        {open && <PostDepth post={open.post} initialTab={open.tab} />}
      </Sheet>
    </>
  );
}
