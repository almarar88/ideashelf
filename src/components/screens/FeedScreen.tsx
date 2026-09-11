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

export function FeedScreen({
  onNotice,
  openInPane,
  selectedId,
}: {
  onNotice: (msg: string) => void;
  /** على الأجهزة القابلة للطي يُفتح العمق في اللوحة الثانية بدل لوح منزلق */
  openInPane?: (post: Post, tab: "text" | "ask") => void;
  selectedId?: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<{ post: Post; tab: "text" | "ask" } | null>(null);

  const show = (post: Post, tab: "text" | "ask") => {
    if (openInPane) openInPane(post, tab);
    else setOpen({ post, tab });
  };

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
            onOpen={() => show(post, "text")}
            onAsk={() => show(post, "ask")}
            selected={selectedId === post.id}
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
