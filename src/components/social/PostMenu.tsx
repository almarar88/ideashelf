import { Bookmark, BookmarkCheck, Copy, EyeOff, Flag, Share2, Trash2, UserX } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useActions, useStore } from "@/store/store";
import type { Post } from "@/lib/types";

export function PostMenu({
  post,
  onClose,
  onNotice,
}: {
  post: Post | null;
  onClose: () => void;
  onNotice: (msg: string) => void;
}) {
  const { state } = useStore();
  const actions = useActions();
  if (!post) return null;

  const mine = post.author.id === "me";
  const isSaved = state.saved.includes(post.id);
  const isMuted = state.muted.includes(post.id ? post.author.id : "");
  const link = `chrono.ai/p/${post.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onNotice("نُسخ الرابط.");
    } catch {
      onNotice(link);
    }
    onClose();
  };

  const share = async () => {
    const data = { title: post.title, text: post.lede, url: link };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(`${post.title} — ${link}`);
      onNotice("تمت المشاركة.");
    } catch {
      /* ألغى المستخدم المشاركة */
    }
    onClose();
  };

  const Item = ({
    Icon,
    label,
    onClick,
    tone,
  }: {
    Icon: typeof Copy;
    label: string;
    onClick: () => void;
    tone?: "rose";
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl2 px-3 py-3 text-right text-[13.5px] transition hover:bg-raised ${
        tone === "rose" ? "text-rose" : ""
      }`}
    >
      <Icon size={17} className={tone === "rose" ? "text-rose" : "text-iris"} />
      {label}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title={post.title} subtitle={post.author.name}>
      <div className="pb-3">
        <Item
          Icon={isSaved ? BookmarkCheck : Bookmark}
          label={isSaved ? "إزالة من المحفوظات" : "حفظ"}
          onClick={() => {
            actions.save(post.id);
            onNotice(isSaved ? "أُزيل من المحفوظات." : "حُفظ.");
            onClose();
          }}
        />
        <Item Icon={Share2} label="مشاركة" onClick={share} />
        <Item Icon={Copy} label="نسخ الرابط" onClick={copy} />

        {!mine && (
          <>
            <Item
              Icon={EyeOff}
              label={isMuted ? "إلغاء كتم الحساب" : "كتم هذا الحساب"}
              onClick={() => {
                actions.mute(post.author.id);
                onNotice(isMuted ? "أُلغي الكتم." : "كُتم الحساب — لن تظهر منشوراته.");
                onClose();
              }}
            />
            <Item
              Icon={UserX}
              label="حظر الحساب"
              tone="rose"
              onClick={() => {
                actions.block(post.author.id);
                onNotice("حُظر الحساب.");
                onClose();
              }}
            />
            <Item
              Icon={Flag}
              label="إبلاغ"
              tone="rose"
              onClick={() => {
                onNotice("سُجّل البلاغ محلياً — لا خادم يستقبله في هذا النموذج.");
                onClose();
              }}
            />
          </>
        )}

        {mine && (
          <Item
            Icon={Trash2}
            label="حذف المنشور"
            tone="rose"
            onClick={() => {
              actions.removePost(post.id);
              onNotice("حُذف المنشور.");
              onClose();
            }}
          />
        )}
      </div>
    </Sheet>
  );
}
