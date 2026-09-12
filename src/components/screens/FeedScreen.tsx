import { useMemo, useState } from "react";
import { StoryRow } from "@/components/shell/StoryRow";
import { PostCard } from "@/components/feed/PostCard";
import { Pill } from "@/components/ui/Pill";
import { Empty } from "./ProfileScreen";
import { useActions, useStore, useVisiblePosts } from "@/store/store";
import type { Post, PostKind } from "@/lib/types";

type Filter = "all" | PostKind | "mine" | "following";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "following", label: "من أتابع" },
  { id: "film", label: "أفلام" },
  { id: "essay", label: "مقالات" },
  { id: "moment", label: "لحظات" },
  { id: "mine", label: "أثري" },
];

export function FeedScreen({
  onOpenPost,
  selectedId,
  onCompose,
  onMenu,
  onStory,
}: {
  /** يفتح العمق في لوح منزلق على الهاتف، وفي اللوحة الثانية على الأجهزة المطوية */
  onOpenPost: (post: Post, tab: "text" | "ask") => void;
  selectedId?: string | null;
  onCompose: () => void;
  onMenu: (post: Post) => void;
  onStory: (index: number) => void;
}) {
  const { state } = useStore();
  const posts = useVisiblePosts();
  const actions = useActions();
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => {
    switch (filter) {
      case "all":
        return posts;
      case "mine":
        return posts.filter((p) => p.author.id === "me");
      case "following":
        return posts.filter(
          (p) => p.author.id === "me" || state.following.includes(p.author.id),
        );
      default:
        return posts.filter((p) => p.kind === filter);
    }
  }, [posts, filter, state.following]);

  return (
    <>
      <StoryRow onAdd={onCompose} onOpen={onStory} />

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
            liked={state.liked.includes(post.id)}
            saved={state.saved.includes(post.id)}
            onLike={() => actions.like(post.id)}
            onOpen={() => onOpenPost(post, "text")}
            onAsk={() => onOpenPost(post, "ask")}
            onMenu={() => onMenu(post)}
            selected={selectedId === post.id}
          />
        ))}
        {visible.length === 0 && (
          <Empty
            title="لا شيء هنا بعد"
            hint={
              filter === "mine"
                ? "اضغط زر النبض لتنشر أول أثر لك."
                : "جرّب مرشّحاً آخر، أو تابع حسابات جديدة من الاستكشاف."
            }
          />
        )}
      </div>

    </>
  );
}
