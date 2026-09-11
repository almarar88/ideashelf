import { Heart, MessageCircleQuestion, Play, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { cn } from "@/lib/cn";
import type { Post } from "@/lib/types";

const KIND_LABEL: Record<Post["kind"], string> = {
  film: "فيلم قصير",
  essay: "مقال",
  moment: "لحظة",
};

export function PostCard({
  post,
  liked,
  onLike,
  onOpen,
  onAsk,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
  onOpen: () => void;
  onAsk: () => void;
}) {
  return (
    <article className="card relative mb-4 overflow-visible px-3.5 pb-3.5 pt-3.5">
      <header className="flex items-start gap-2.5">
        <Avatar person={post.author} size="md" ring />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{post.author.name}</span>
            <span className="truncate text-[12px] text-muted">{post.author.handle}</span>
          </div>
          <p className="text-[11px] text-muted">
            {KIND_LABEL[post.kind]} · <bdi>{post.place}</bdi> · <bdi>{post.at}</bdi>
          </p>
        </div>
        <button
          type="button"
          onClick={onLike}
          aria-label="إعجاب"
          aria-pressed={liked}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised transition active:scale-90",
            liked ? "text-rose" : "text-muted",
          )}
        >
          <Heart size={19} fill={liked ? "currentColor" : "none"} />
        </button>
      </header>

      <button type="button" onClick={onOpen} className="mt-2.5 block w-full text-right">
        <h2 className="text-[15px] font-semibold leading-snug">{post.title}</h2>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
          {post.lede}{" "}
          <span className="font-medium text-iris underline underline-offset-4">اقرأ</span>
        </p>
      </button>

      <button type="button" onClick={onOpen} className="mt-3 block w-full">
        <MediaCanvas
          colors={post.media}
          className="h-56 w-full"
          label={`وسيط بصري لمنشور: ${post.title}`}
        />
      </button>

      <div className="pointer-events-none -mt-11 mb-1 flex items-end justify-between px-2.5">
        <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--scrim)/.5)] px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          <Sparkles size={12} />
          ذكاء {post.aiShare}٪ · إنسان {post.humanShare}٪
        </span>
        {post.duration && (
          <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-[rgb(var(--scrim)/.5)] px-2.5 py-1 text-[11px] text-white backdrop-blur">
            <Play size={11} fill="currentColor" />
            {post.duration}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onAsk}
          className="flex flex-1 items-center gap-2 rounded-full bg-raised px-3.5 py-2.5 text-right text-[12.5px] text-muted transition hover:text-ink"
        >
          <MessageCircleQuestion size={16} className="shrink-0 text-iris" />
          اسأل المنشور نفسه…
        </button>
        <span className="shrink-0 rounded-full bg-raised px-3 py-2.5 text-[11.5px] tabular-nums text-muted">
          {post.comments.length} نقاش
        </span>
      </div>
    </article>
  );
}
