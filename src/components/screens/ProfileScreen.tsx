import { useMemo, useState } from "react";
import { Bookmark, Cloud, CloudOff, Link2, MapPin, Pencil, Settings, Shield } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { Pill } from "@/components/ui/Pill";
import { PostCard } from "@/components/feed/PostCard";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { PeopleSheet } from "@/components/social/PeopleSheet";
import { useActions, useMe, usePosts, useStore } from "@/store/store";
import { useAuth } from "@/server/auth";
import { useSync } from "@/server/SyncBridge";
import type { Post } from "@/lib/types";

type Tab = "posts" | "saved" | "about";

export function ProfileScreen({
  onOpenPost,
  onOpenSettings,
}: {
  onOpenPost: (post: Post, tab: "text" | "ask") => void;
  onOpenSettings: () => void;
}) {
  const { state } = useStore();
  const me = useMe();
  const actions = useActions();
  const [tab, setTab] = useState<Tab>("posts");
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<"following" | "followers" | null>(null);
  const { session } = useAuth();
  const sync = useSync();

  const { profile, saved, liked, following, followers } = state;
  const posts = usePosts();
  const mine = useMemo(() => posts.filter((p) => p.author.id === "me"), [posts]);
  const savedPosts = useMemo(() => posts.filter((p) => saved.includes(p.id)), [posts, saved]);
  const shown = tab === "posts" ? mine : tab === "saved" ? savedPosts : [];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
      <div className="relative">
        <MediaCanvas colors={profile.cover} className="h-32 w-full rounded-none" label="غلاف" />
        <div className="absolute inset-x-4 -bottom-8 flex items-end justify-between">
          <Avatar person={me} size="xl" ring className="ring-4 ring-[rgb(var(--surface))]" />
          <div className="mb-1 flex gap-2">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="الإعدادات"
              className="grid h-9 w-9 place-items-center rounded-full bg-surface text-muted shadow-lift transition active:scale-95"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[12.5px] font-semibold shadow-lift transition active:scale-95"
            >
              <Pencil size={14} />
              تعديل الملف
            </button>
          </div>
        </div>
      </div>

      <div className="mt-11 px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-[19px] font-semibold">{profile.name}</h1>
          {profile.private && (
            <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-muted">
              <Shield size={11} /> خاص
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-muted" dir="ltr">
          {profile.handle}
        </p>

        {profile.bio && (
          <p className="mt-2 text-[13px] leading-relaxed">{profile.bio}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
          {profile.place && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {profile.place}
            </span>
          )}
          {profile.link && (
            <span className="inline-flex items-center gap-1 text-iris" dir="ltr">
              <Link2 size={12} />
              {profile.link}
            </span>
          )}
          <span>انضم {profile.joined}</span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] ${
            session ? "bg-mint/12 text-mint" : "bg-raised text-muted"
          }`}
        >
          {session ? <Cloud size={13} /> : <CloudOff size={13} />}
          {session
            ? sync.status === "syncing"
              ? "جارٍ المزامنة…"
              : sync.status === "error"
                ? "المزامنة متعطّلة"
                : "متزامن مع الخادم"
            : "محلي — سجّل الدخول للمزامنة"}
        </button>

        <div className="mt-3 flex gap-5 text-[13px]">
          <Stat n={mine.length} label="منشور" />
          <button type="button" onClick={() => setList("followers")} className="text-right">
            <Stat n={followers.length} label="متابِع" />
          </button>
          <button type="button" onClick={() => setList("following")} className="text-right">
            <Stat n={following.length} label="يتابع" />
          </button>
          <Stat n={liked.length} label="إعجاب" />
        </div>

        <div className="mt-4 flex gap-2">
          <Pill active={tab === "posts"} onClick={() => setTab("posts")}>
            منشوراتي
          </Pill>
          <Pill active={tab === "saved"} onClick={() => setTab("saved")}>
            <Bookmark size={13} />
            المحفوظات
          </Pill>
          <Pill active={tab === "about"} onClick={() => setTab("about")}>
            عنّي
          </Pill>
        </div>
      </div>

      <div className="mt-4 px-4">
        {tab === "about" ? (
          <div className="card space-y-3 p-4 text-[12.5px] leading-relaxed">
            <Row k="الاسم" v={profile.name} />
            <Row k="المعرّف" v={profile.handle} />
            <Row k="النبذة" v={profile.bio || "—"} />
            <Row k="المكان" v={profile.place || "—"} />
            <Row k="الرابط" v={profile.link || "—"} />
            <Row k="نوع الحساب" v={profile.private ? "خاص" : "عام"} />
            <Row k="حفظ البيانات" v="محلي على هذا الجهاز" />
          </div>
        ) : shown.length === 0 ? (
          <Empty
            title={tab === "posts" ? "لم تنشر شيئاً بعد" : "لا محفوظات بعد"}
            hint={
              tab === "posts"
                ? "اضغط زر النبض في المجرى لتكتب أول أثر."
                : "احفظ منشوراً من قائمة خياراته ليظهر هنا."
            }
          />
        ) : (
          shown.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              liked={liked.includes(post.id)}
              onLike={() => actions.like(post.id)}
              onOpen={() => onOpenPost(post, "text")}
              onAsk={() => onOpenPost(post, "ask")}
            />
          ))
        )}
      </div>

      <EditProfileSheet open={editing} onClose={() => setEditing(false)} />
      <PeopleSheet
        open={list !== null}
        kind={list ?? "following"}
        onClose={() => setList(null)}
      />
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-[11.5px] text-muted">{label}</span>
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b hairline pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="text-left">{v}</span>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-10 text-center">
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[280px] text-[12.5px] leading-relaxed text-muted">
        {hint}
      </p>
    </div>
  );
}
