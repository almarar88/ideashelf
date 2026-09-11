import { Sparkles } from "lucide-react";
import { DeckCard, deckItems } from "./deck";
import { PostDepth } from "@/components/feed/PostDepth";
import type { Post, ScreenId } from "@/lib/types";

/**
 * اللوحة الثانية على الأجهزة القابلة للطي: تعرض عمق المنشور المفتوح،
 * وإلا فالبطاقات الحيّة الخاصة بالشاشة الحالية.
 */
export function CompanionPane({
  screen,
  busy,
  seals,
  post,
  postTab,
}: {
  screen: ScreenId;
  busy: boolean;
  seals: number;
  post: Post | null;
  postTab: "text" | "ask";
}) {
  const items = deckItems(screen, busy, seals);
  const ordered = [...items].sort((a, b) => Number(b.active) - Number(a.active));

  if (screen === "feed" && post) {
    return (
      <section
        className="flex-1 overflow-y-auto no-scrollbar px-5 py-5"
        aria-label="تفاصيل المنشور"
      >
        <header className="mb-3">
          <h2 className="text-[18px] font-semibold leading-snug">{post.title}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {post.author.name} · <bdi>{post.place}</bdi>
          </p>
        </header>
        <PostDepth key={post.id + postTab} post={post} initialTab={postTab} />
      </section>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto no-scrollbar px-5 py-5" aria-label="لوحة السياق">
      {screen === "feed" && (
        <div className="card mb-4 p-4">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <Sparkles size={15} className="text-rose" />
            الشاشة مفتوحة على اتساعها
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            افتح أي منشور من اليمين ليظهر عمقه هنا: النص الكامل، الهوامش الموثّقة،
            محاورة المنشور، والنقاش المغربل — بلا مغادرة القائمة.
          </p>
        </div>
      )}
      {/* عمود واحد دائماً: عرض اللوحة الثانية أضيق من نقاط توقف الشاشة */}
      <div className="grid gap-4">
        {ordered.map((item) => (
          <DeckCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}
