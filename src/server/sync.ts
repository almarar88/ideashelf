import { supabase } from "./client";
import {
  AUDIENCE_FROM_DB,
  AUDIENCE_TO_DB,
  POLICY_FROM_DB,
  POLICY_TO_DB,
  type DbComment,
  type DbNotification,
  type DbPost,
  type DbProfile,
} from "./types";
import type { State } from "@/store/initial";
import type { Action } from "@/store/store";
import type { Comment, Person, Post, Profile } from "@/lib/types";

/**
 * محرّك المزامنة.
 *
 * البنية محلية أولاً: المخفّض يبقى مصدر الحقيقة للواجهة، فيظل التطبيق يعمل
 * بلا شبكة. هذا الملف يفعل شيئين فقط:
 *   1) hydrate — يملأ المتجر من الخادم بعد الدخول.
 *   2) mirror  — يعكس كل تغيير محلي إلى الخادم بعد وقوعه.
 * فشل المرآة لا يُسقط الواجهة؛ يُعاد بلاغه ليظهر للمستخدم.
 */

const noCloud = () => !supabase;

/* ── تحويل الصفوف إلى أنواع الواجهة ─────────────────────────────────────── */

function personFrom(p: DbProfile): Person & { avatar?: string } {
  return {
    id: p.id,
    name: p.name || p.handle,
    handle: `@${p.handle}`,
    hue: p.hue,
    avatar: p.avatar_url ?? undefined,
    ring: false,
  };
}

function profileFrom(p: DbProfile): Profile {
  const cover = (p.cover.length === 3 ? p.cover : ["#2b3f8f", "#6d5bd0", "#f06ab0"]) as [
    string,
    string,
    string,
  ];
  return {
    name: p.name,
    handle: `@${p.handle}`,
    bio: p.bio,
    place: p.place,
    link: p.link,
    hue: p.hue,
    avatar: p.avatar_url ?? undefined,
    cover,
    private: p.is_private,
    joined: new Date(p.created_at).getFullYear().toString(),
  };
}

function commentFrom(c: DbComment, people: Map<string, Person>, meId: string): Comment {
  const author =
    c.author_id === meId
      ? people.get("me") ?? { id: "me", name: "أنا", handle: "@me", hue: 44 }
      : people.get(c.author_id) ?? { id: c.author_id, name: "حساب", handle: "@", hue: 200 };
  return {
    id: c.id,
    author: { ...author, id: c.author_id === meId ? "me" : c.author_id },
    text: c.text,
    signal: c.signal,
    kind: (c.kind as Comment["kind"]) ?? "نقد",
    at: relative(c.created_at),
  };
}

function postFrom(
  p: DbPost,
  comments: DbComment[],
  people: Map<string, Person>,
  meId: string,
): Post {
  const author =
    p.author_id === meId
      ? { id: "me", name: "أنا", handle: "@me", hue: 44 }
      : people.get(p.author_id) ?? { id: p.author_id, name: "حساب", handle: "@", hue: 200 };
  const media = (p.media.length === 3 ? p.media : ["#2b3f8f", "#6d5bd0", "#f06ab0"]) as [
    string,
    string,
    string,
  ];
  return {
    id: p.id,
    author,
    kind: p.kind,
    title: p.title,
    lede: p.lede,
    body: p.body,
    place: p.place,
    at: relative(p.created_at),
    media,
    photo: p.photo_url ?? undefined,
    duration: p.duration ?? undefined,
    audience: AUDIENCE_FROM_DB[p.audience],
    aiShare: p.ai_share,
    humanShare: 100 - p.ai_share,
    sources: p.sources as Post["sources"],
    meta: p.meta,
    comments: comments.filter((c) => c.post_id === p.id).map((c) => commentFrom(c, people, meId)),
    reactions: p.reactions,
  };
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${d} ي`;
  return new Date(iso).toLocaleDateString("ar", { day: "numeric", month: "long" });
}

/* ── 1) الجلب الأولي ────────────────────────────────────────────────────── */

export type HydrateResult =
  | { ok: true; state: Partial<State> }
  | { ok: false; message: string };

export async function hydrate(meId: string): Promise<HydrateResult> {
  if (!supabase) return { ok: false, message: "الخادم غير مُعدّ." };

  const [profiles, posts, comments, likes, saves, follows, blocks, mutes, notifs] =
    await Promise.all([
      supabase.from("profiles").select("*").limit(200),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("comments").select("*").order("signal", { ascending: false }).limit(500),
      supabase.from("likes").select("post_id").eq("user_id", meId),
      supabase.from("saves").select("post_id").eq("user_id", meId),
      supabase.from("follows").select("follower_id, followee_id"),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", meId),
      supabase.from("mutes").select("muted_id").eq("muter_id", meId),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", meId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

  const failure = [profiles, posts, comments, likes, saves, follows, blocks, mutes, notifs].find(
    (r) => r.error,
  );
  if (failure?.error) {
    return { ok: false, message: describe(failure.error.message) };
  }

  const rows = (profiles.data ?? []) as DbProfile[];
  const mine = rows.find((p) => p.id === meId);
  const others = rows.filter((p) => p.id !== meId);
  const people = new Map<string, Person>(others.map((p) => [p.id, personFrom(p)]));

  const dbComments = (comments.data ?? []) as DbComment[];
  const dbPosts = (posts.data ?? []) as DbPost[];

  const followRows = (follows.data ?? []) as { follower_id: string; followee_id: string }[];

  const state: Partial<State> = {
    people: [...people.values()],
    posts: dbPosts.map((p) => postFrom(p, dbComments, people, meId)),
    liked: (likes.data ?? []).map((r) => (r as { post_id: string }).post_id),
    saved: (saves.data ?? []).map((r) => (r as { post_id: string }).post_id),
    following: followRows.filter((f) => f.follower_id === meId).map((f) => f.followee_id),
    followers: followRows.filter((f) => f.followee_id === meId).map((f) => f.follower_id),
    blocked: (blocks.data ?? []).map((r) => (r as { blocked_id: string }).blocked_id),
    muted: (mutes.data ?? []).map((r) => (r as { muted_id: string }).muted_id),
    notifications: ((notifs.data ?? []) as DbNotification[]).map((n) => ({
      id: n.id,
      kind: n.kind,
      personId: n.actor_id ?? undefined,
      postId: n.post_id ?? undefined,
      text: n.text,
      at: new Date(n.created_at).getTime(),
      read: n.read,
    })),
    conversations: [],
  };

  if (mine) {
    state.profile = profileFrom(mine);
    state.settings = {
      replyPolicy: POLICY_FROM_DB[mine.reply_policy],
      signalFloor: mine.signal_floor,
      showProvenance: true,
      localOnly: false,
    };
  }

  return { ok: true, state };
}

function describe(message: string): string {
  if (message.includes("schema cache") || message.includes("does not exist"))
    return "الجداول غير موجودة بعد — نفّذ supabase/schema.sql في لوحة Supabase.";
  if (message.toLowerCase().includes("jwt")) return "انتهت الجلسة — أعد الدخول.";
  return message;
}

/* ── 2) رفع الصور ───────────────────────────────────────────────────────── */

/** يرفع صورة data URL إلى مجلد المستخدم ويعيد رابطها العام */
export async function uploadImage(
  meId: string,
  dataUrl: string,
  prefix: string,
): Promise<string | null> {
  if (!supabase) return null;
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${meId}/${prefix}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("media")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) return null;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/* ── 3) عكس التغييرات المحلية ───────────────────────────────────────────── */

export type MirrorReport = { message: string } | null;

export async function mirror(
  action: Action,
  meId: string,
  handleOf: (h: string) => string,
): Promise<MirrorReport> {
  if (noCloud() || !supabase) return null;

  try {
    switch (action.type) {
      case "profile/update": {
        const patch = action.patch;
        const row: Record<string, unknown> = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.handle !== undefined) row.handle = handleOf(patch.handle);
        if (patch.bio !== undefined) row.bio = patch.bio;
        if (patch.place !== undefined) row.place = patch.place;
        if (patch.link !== undefined) row.link = patch.link;
        if (patch.hue !== undefined) row.hue = patch.hue;
        if (patch.cover !== undefined) row.cover = patch.cover;
        if (patch.private !== undefined) row.is_private = patch.private;
        if (patch.avatar !== undefined) {
          row.avatar_url = patch.avatar?.startsWith("data:")
            ? await uploadImage(meId, patch.avatar, "avatar")
            : (patch.avatar ?? null);
        }
        if (Object.keys(row).length === 0) return null;
        const { error } = await supabase.from("profiles").update(row).eq("id", meId);
        return error ? { message: fail("حفظ الملف", error.message) } : null;
      }

      case "post/create": {
        const p = action.post;
        const photo_url = p.photo?.startsWith("data:")
          ? await uploadImage(meId, p.photo, "post")
          : (p.photo ?? null);
        const { error } = await supabase.from("posts").insert({
          id: p.id.length === 36 ? p.id : undefined,
          author_id: meId,
          kind: p.kind,
          title: p.title,
          lede: p.lede,
          body: p.body,
          place: p.place,
          media: p.media,
          photo_url,
          duration: p.duration ?? null,
          audience: AUDIENCE_TO_DB[p.audience ?? "عام"],
          ai_share: p.aiShare,
          sources: p.sources,
          meta: p.meta,
        });
        return error ? { message: fail("نشر المنشور", error.message) } : null;
      }

      case "post/delete": {
        const { error } = await supabase.from("posts").delete().eq("id", action.id);
        return error ? { message: fail("حذف المنشور", error.message) } : null;
      }

      case "post/like": {
        // المخفّض قلب الحالة محلياً قبل هذا النداء، فنستعلم عن الحالة الحالية
        const { data } = await supabase
          .from("likes")
          .select("post_id")
          .eq("post_id", action.id)
          .eq("user_id", meId)
          .maybeSingle();
        const { error } = data
          ? await supabase.from("likes").delete().eq("post_id", action.id).eq("user_id", meId)
          : await supabase.from("likes").insert({ post_id: action.id, user_id: meId });
        return error ? { message: fail("الإعجاب", error.message) } : null;
      }

      case "post/save": {
        const { data } = await supabase
          .from("saves")
          .select("post_id")
          .eq("post_id", action.id)
          .eq("user_id", meId)
          .maybeSingle();
        const { error } = data
          ? await supabase.from("saves").delete().eq("post_id", action.id).eq("user_id", meId)
          : await supabase.from("saves").insert({ post_id: action.id, user_id: meId });
        return error ? { message: fail("الحفظ", error.message) } : null;
      }

      case "comment/add": {
        const c = action.comment;
        const { error } = await supabase.from("comments").insert({
          id: c.id.length === 36 ? c.id : undefined,
          post_id: action.postId,
          author_id: meId,
          text: c.text,
          signal: c.signal,
          kind: c.kind,
        });
        return error ? { message: fail("إرسال الرد", error.message) } : null;
      }

      case "comment/delete": {
        const { error } = await supabase.from("comments").delete().eq("id", action.commentId);
        return error ? { message: fail("حذف الرد", error.message) } : null;
      }

      case "person/follow": {
        const { data } = await supabase
          .from("follows")
          .select("followee_id")
          .eq("follower_id", meId)
          .eq("followee_id", action.id)
          .maybeSingle();
        const { error } = data
          ? await supabase
              .from("follows")
              .delete()
              .eq("follower_id", meId)
              .eq("followee_id", action.id)
          : await supabase.from("follows").insert({ follower_id: meId, followee_id: action.id });
        return error ? { message: fail("المتابعة", error.message) } : null;
      }

      case "person/block": {
        const { data } = await supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", meId)
          .eq("blocked_id", action.id)
          .maybeSingle();
        const { error } = data
          ? await supabase.from("blocks").delete().eq("blocker_id", meId).eq("blocked_id", action.id)
          : await supabase.from("blocks").insert({ blocker_id: meId, blocked_id: action.id });
        return error ? { message: fail("الحظر", error.message) } : null;
      }

      case "person/mute": {
        const { data } = await supabase
          .from("mutes")
          .select("muted_id")
          .eq("muter_id", meId)
          .eq("muted_id", action.id)
          .maybeSingle();
        const { error } = data
          ? await supabase.from("mutes").delete().eq("muter_id", meId).eq("muted_id", action.id)
          : await supabase.from("mutes").insert({ muter_id: meId, muted_id: action.id });
        return error ? { message: fail("الكتم", error.message) } : null;
      }

      case "notif/read": {
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", action.id);
        return error ? { message: fail("التنبيه", error.message) } : null;
      }

      case "notif/readAll": {
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", meId)
          .eq("read", false);
        return error ? { message: fail("التنبيهات", error.message) } : null;
      }

      case "settings/update": {
        const row: Record<string, unknown> = {};
        if (action.patch.replyPolicy) row.reply_policy = POLICY_TO_DB[action.patch.replyPolicy];
        if (action.patch.signalFloor !== undefined) row.signal_floor = action.patch.signalFloor;
        if (Object.keys(row).length === 0) return null;
        const { error } = await supabase.from("profiles").update(row).eq("id", meId);
        return error ? { message: fail("الإعدادات", error.message) } : null;
      }

      default:
        return null;
    }
  } catch (err) {
    return { message: `تعذّر الوصول للخادم: ${(err as Error).message}` };
  }
}

function fail(what: string, message: string): string {
  if (message.includes("schema cache") || message.includes("does not exist"))
    return `${what}: الجداول غير موجودة — نفّذ supabase/schema.sql أولاً.`;
  if (message.includes("row-level security") || message.includes("violates"))
    return `${what}: منعته سياسات الوصول.`;
  if (message.includes("duplicate key")) return `${what}: مكرّر.`;
  return `${what}: ${message}`;
}
