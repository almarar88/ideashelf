import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { cn } from "@/lib/cn";
import { useStore } from "@/store/store";
import type { Person } from "@/lib/types";

const DURATION = 4200;

/** عارض القصص: شرائط تقدّم، تنقّل باللمس، وتقدّم تلقائي. */
export function StoryViewer({
  people,
  startIndex,
  onClose,
}: {
  people: Person[];
  startIndex: number;
  onClose: () => void;
}) {
  const { state } = useStore();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const person = people[index];
  const post = state.posts.find((p) => p.author.id === person?.id);

  useEffect(() => {
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused) return;
    const step = 60;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = p + step / DURATION;
        if (next >= 1) {
          setIndex((i) => {
            if (i + 1 >= people.length) {
              onClose();
              return i;
            }
            return i + 1;
          });
          return 0;
        }
        return next;
      });
    }, step);
    return () => window.clearInterval(id);
  }, [paused, people.length, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.min(people.length - 1, i + 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, people.length]);

  if (!person) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[rgb(var(--scrim))]" role="dialog" aria-modal>
      <div className="flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+10px)]">
        {people.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-75"
              style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 px-4 py-3">
        <Avatar person={person} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">{person.name}</p>
          <p className="truncate text-[11px] text-white/70" dir="ltr">
            {person.handle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white"
        >
          <X size={17} />
        </button>
      </div>

      <div className="relative flex-1">
        <MediaCanvas
          colors={post?.media ?? ["#2b3f8f", "#6d5bd0", "#f06ab0"]}
          photo={post?.photo}
          className="absolute inset-3 rounded-xl3"
          label={post?.title}
        />
        <div className="absolute inset-x-6 bottom-8 text-center">
          <p className="text-[17px] font-semibold text-white drop-shadow">
            {post?.title ?? "لا قصة بعد"}
          </p>
          {post && (
            <p className="mx-auto mt-1.5 max-w-[80%] text-[12.5px] leading-relaxed text-white/85 drop-shadow">
              {post.lede}
            </p>
          )}
        </div>

        {/* مناطق التنقّل: يمين للسابق ويسار للتالي، كما هو متوقع في واجهة عربية */}
        <button
          type="button"
          aria-label="السابق"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => {
            setPaused(false);
            setIndex((i) => Math.max(0, i - 1));
          }}
          className={cn("absolute inset-y-0 right-0 w-1/3")}
        />
        <button
          type="button"
          aria-label="التالي"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => {
            setPaused(false);
            if (index + 1 >= people.length) onClose();
            else setIndex(index + 1);
          }}
          className={cn("absolute inset-y-0 left-0 w-1/3")}
        />
      </div>
    </div>
  );
}
