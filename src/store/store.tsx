import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { seedState, type State } from "./initial";
import type {
  Comment,
  Message,
  Notification,
  Post,
  Profile,
  Settings,
} from "@/lib/types";

const KEY = "chrono.state.v1";

/* ── الأفعال ─────────────────────────────────────────────────────────────── */

export type Action =
  | { type: "profile/update"; patch: Partial<Profile> }
  | { type: "post/create"; post: Post }
  | { type: "post/delete"; id: string }
  | { type: "post/like"; id: string }
  | { type: "post/save"; id: string }
  | { type: "comment/add"; postId: string; comment: Comment }
  | { type: "comment/delete"; postId: string; commentId: string }
  | { type: "person/follow"; id: string }
  | { type: "person/mute"; id: string }
  | { type: "person/block"; id: string }
  | { type: "notif/read"; id: string }
  | { type: "notif/readAll" }
  | { type: "notif/push"; notification: Notification }
  | { type: "dm/send"; conversationId: string; message: Message }
  | { type: "dm/read"; conversationId: string }
  | { type: "settings/update"; patch: Partial<Settings> }
  | { type: "data/replace"; state: State }
  | { type: "data/merge"; patch: Partial<State> }
  | { type: "data/reset" };

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "profile/update":
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case "post/create":
      return { ...state, posts: [action.post, ...state.posts] };

    case "post/delete":
      return {
        ...state,
        posts: state.posts.filter((p) => p.id !== action.id),
        liked: state.liked.filter((x) => x !== action.id),
        saved: state.saved.filter((x) => x !== action.id),
      };

    case "post/like":
      return { ...state, liked: toggle(state.liked, action.id) };

    case "post/save":
      return { ...state, saved: toggle(state.saved, action.id) };

    case "comment/add":
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId ? { ...p, comments: [action.comment, ...p.comments] } : p,
        ),
      };

    case "comment/delete":
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? { ...p, comments: p.comments.filter((c) => c.id !== action.commentId) }
            : p,
        ),
      };

    case "person/follow":
      return { ...state, following: toggle(state.following, action.id) };

    case "person/mute":
      return { ...state, muted: toggle(state.muted, action.id) };

    case "person/block": {
      const blocked = toggle(state.blocked, action.id);
      return {
        ...state,
        blocked,
        // حظر شخص يوقف متابعته أيضاً
        following: blocked.includes(action.id)
          ? state.following.filter((x) => x !== action.id)
          : state.following,
      };
    }

    case "notif/read":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n,
        ),
      };

    case "notif/readAll":
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };

    case "notif/push":
      return { ...state, notifications: [action.notification, ...state.notifications] };

    case "dm/send":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? { ...c, messages: [...c.messages, action.message] }
            : c,
        ),
      };

    case "dm/read":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, unread: 0 } : c,
        ),
      };

    case "settings/update":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case "data/replace":
      return action.state;

    case "data/merge":
      return { ...state, ...action.patch };

    case "data/reset":
      return seedState();
  }
}

/* ── التخزين المحلي ──────────────────────────────────────────────────────── */

function load(): State {
  const seed = seedState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const saved = JSON.parse(raw) as Partial<State>;
    // دمج سطحي فوق البذرة: الحقول التي تُضاف لاحقاً تظهر بقيمها الافتراضية
    return {
      ...seed,
      ...saved,
      profile: { ...seed.profile, ...saved.profile },
      settings: { ...seed.settings, ...saved.settings },
    };
  } catch {
    return seed;
  }
}

export type SaveStatus = "ok" | "full" | "off";

/* ── السياق ──────────────────────────────────────────────────────────────── */

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  saveStatus: React.MutableRefObject<SaveStatus>;
  /** يضعه جسر المزامنة ليعكس كل فعل محلي إلى الخادم بعد وقوعه */
  mirrorRef: React.MutableRefObject<((action: Action) => void) | null>;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, load);
  const saveStatus = useRef<SaveStatus>("ok");
  const timer = useRef<number | null>(null);
  const mirrorRef = useRef<((action: Action) => void) | null>(null);

  // الواجهة تتحدّث محلياً أولاً، ثم يُعكس الفعل إلى الخادم إن وُجدت جلسة
  const dispatch = useCallback((action: Action) => {
    rawDispatch(action);
    mirrorRef.current?.(action);
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        saveStatus.current = "ok";
      } catch (err) {
        // الحصة الممتلئة أشيع سبب، وتحدث غالباً بعد إضافة صور كبيرة
        saveStatus.current =
          err instanceof DOMException && err.name === "QuotaExceededError" ? "full" : "off";
      }
    }, 350);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state]);

  const value = useMemo(
    () => ({ state, dispatch, saveStatus, mirrorRef }),
    [state, dispatch],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore يجب أن يُستعمل داخل StoreProvider");
  return ctx;
}

/* ── مشتقّات جاهزة ───────────────────────────────────────────────────────── */

export function useMe() {
  const { state } = useStore();
  return useMemo(
    () => ({
      id: "me",
      name: state.profile.name,
      handle: state.profile.handle,
      hue: state.profile.hue,
      avatar: state.profile.avatar,
    }),
    [state.profile],
  );
}

export function useUnread() {
  const { state } = useStore();
  return useMemo(
    () => ({
      notifications: state.notifications.filter((n) => !n.read).length,
      messages: state.conversations.reduce((s, c) => s + c.unread, 0),
    }),
    [state.notifications, state.conversations],
  );
}

/**
 * المنشورات بعد تحديث بيانات صاحب الحساب:
 * كل منشور لي يحمل اسم الملف وصورته الحاليين، لا نسخة قديمة وقت النشر.
 */
export function usePosts() {
  const { state } = useStore();
  const { profile } = state;
  return useMemo(
    () =>
      state.posts.map((p) =>
        p.author.id === "me"
          ? {
              ...p,
              author: {
                ...p.author,
                name: profile.name,
                handle: profile.handle,
                hue: profile.hue,
                avatar: profile.avatar,
              },
            }
          : p,
      ),
    [state.posts, profile],
  );
}

/** منشورات المجرى بعد استبعاد المحظورين والمكتومين */
export function useVisiblePosts() {
  const { state } = useStore();
  const posts = usePosts();
  return useMemo(
    () =>
      posts.filter(
        (p) => !state.blocked.includes(p.author.id) && !state.muted.includes(p.author.id),
      ),
    [posts, state.blocked, state.muted],
  );
}

export function usePerson(id: string | undefined) {
  const { state } = useStore();
  return state.people.find((p) => p.id === id);
}

export function useActions() {
  const { dispatch } = useStore();
  return useMemo(
    () => ({
      like: (id: string) => dispatch({ type: "post/like", id }),
      save: (id: string) => dispatch({ type: "post/save", id }),
      follow: (id: string) => dispatch({ type: "person/follow", id }),
      mute: (id: string) => dispatch({ type: "person/mute", id }),
      block: (id: string) => dispatch({ type: "person/block", id }),
      removePost: (id: string) => dispatch({ type: "post/delete", id }),
    }),
    [dispatch],
  );
}

/** وقت نسبي عربي مختصر */
export function since(at: number): string {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "الآن";
  const m = Math.round(s / 60);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${d} ي`;
  return new Date(at).toLocaleDateString("ar", { day: "numeric", month: "long" });
}

export const useDispatch = () => useStore().dispatch;

export function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newComment(
  author: Comment["author"],
  text: string,
  signal: number,
  kind: Comment["kind"],
): Comment {
  return { id: nextId("c"), author, text, signal, kind, at: "الآن" };
}
