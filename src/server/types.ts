/** أسماء الحقول كما هي في القاعدة، مقابلة لأنواع الواجهة */
export type DbProfile = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  place: string;
  link: string;
  hue: number;
  avatar_url: string | null;
  cover: string[];
  is_private: boolean;
  reply_policy: "everyone" | "following" | "nobody";
  signal_floor: number;
  created_at: string;
};

export type DbPost = {
  id: string;
  author_id: string;
  kind: "film" | "essay" | "moment";
  title: string;
  lede: string;
  body: string[];
  place: string;
  media: string[];
  photo_url: string | null;
  duration: string | null;
  audience: "public" | "followers" | "private";
  ai_share: number;
  sources: { label: string; detail: string; confidence: string }[];
  meta: Record<string, string>;
  reactions: number;
  created_at: string;
};

export type DbComment = {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  signal: number;
  kind: string;
  created_at: string;
};

export type DbNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: "like" | "comment" | "follow" | "mention" | "system";
  post_id: string | null;
  text: string;
  read: boolean;
  created_at: string;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

/* ── ترجمة المصطلحات بين الواجهة العربية وقيم القاعدة الإنجليزية ─────────── */

export const AUDIENCE_TO_DB = {
  "عام": "public",
  "المتابِعون": "followers",
  "أنا فقط": "private",
} as const;

export const AUDIENCE_FROM_DB = {
  public: "عام",
  followers: "المتابِعون",
  private: "أنا فقط",
} as const;

export const POLICY_TO_DB = {
  "الجميع": "everyone",
  "من أتابعهم": "following",
  "لا أحد": "nobody",
} as const;

export const POLICY_FROM_DB = {
  everyone: "الجميع",
  following: "من أتابعهم",
  nobody: "لا أحد",
} as const;
