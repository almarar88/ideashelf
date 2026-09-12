import { useMemo, useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { Pill } from "@/components/ui/Pill";
import { PersonRow } from "@/components/social/PersonRow";
import { Empty } from "./ProfileScreen";
import { useStore, useVisiblePosts } from "@/store/store";
import type { Post } from "@/lib/types";

type Scope = "all" | "posts" | "people";

export function ExploreScreen({
  onOpenPost,
  focusSearch,
}: {
  onOpenPost: (post: Post, tab: "text" | "ask") => void;
  focusSearch: number;
}) {
  const { state } = useStore();
  const posts = useVisiblePosts();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");

  // تركيز الحقل حين يُطلب البحث من مكان آخر في التطبيق
  const [seen, setSeen] = useState(focusSearch);
  if (focusSearch !== seen) {
    setSeen(focusSearch);
    queueMicrotask(() => document.getElementById("explore-input")?.focus());
  }

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of state.atlas) {
      for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [state.atlas]);

  const term = q.trim();
  const matchedPosts = useMemo(
    () =>
      term
        ? posts.filter((p) =>
            `${p.title} ${p.lede} ${p.place} ${p.body.join(" ")}`.includes(term),
          )
        : posts,
    [posts, term],
  );
  const matchedPeople = useMemo(
    () =>
      term
        ? state.people.filter((p) => `${p.name} ${p.handle}`.includes(term))
        : state.people.filter((p) => !state.following.includes(p.id)),
    [state.people, state.following, term],
  );

  const showPosts = scope !== "people";
  const showPeople = scope !== "posts";
  const nothing = matchedPosts.length === 0 && matchedPeople.length === 0;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
      <div className="sticky top-0 z-10 -mx-4 bg-[rgb(var(--surface))] px-4 pb-3 pt-1">
        <div className="flex items-center gap-2 rounded-full bg-raised px-3.5 py-2.5">
          <Search size={16} className="shrink-0 text-iris" />
          <input
            id="explore-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن منشور أو شخص أو مكان…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Pill active={scope === "all"} onClick={() => setScope("all")}>
            الكل
          </Pill>
          <Pill active={scope === "posts"} onClick={() => setScope("posts")}>
            منشورات
          </Pill>
          <Pill active={scope === "people"} onClick={() => setScope("people")}>
            أشخاص
          </Pill>
        </div>
      </div>

      {!term && (
        <section className="mb-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <TrendingUp size={14} className="text-rose" />
            وسوم متكررة في أرشيفك
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map(([t, n]) => (
              <Pill key={t} onClick={() => setQ(t)}>
                #{t}
                <span className="tabular-nums text-muted">{n}</span>
              </Pill>
            ))}
          </div>
        </section>
      )}

      {showPeople && matchedPeople.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 text-[13px] font-semibold">
            {term ? "أشخاص" : "قد تعرفهم"}
          </h2>
          <div className="space-y-1">
            {matchedPeople.slice(0, term ? 20 : 4).map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </div>
        </section>
      )}

      {showPosts && matchedPosts.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">
            {term ? `منشورات · ${matchedPosts.length}` : "استكشف"}
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {matchedPosts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenPost(p, "text")}
                className="group relative overflow-hidden rounded-xl2 text-right"
              >
                <MediaCanvas
                  colors={p.media}
                  photo={p.photo}
                  className="h-36 w-full"
                  label={p.title}
                />
                <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgb(var(--scrim)/.75),transparent)] p-2.5">
                  <span className="block truncate text-[12.5px] font-semibold text-white">
                    {p.title}
                  </span>
                  <span className="block truncate text-[10.5px] text-white/75">
                    {p.author.name} · {p.place}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {nothing && (
        <Empty title="لا نتائج" hint={`لا شيء يطابق «${term}» في أرشيفك المحلي.`} />
      )}
    </div>
  );
}
