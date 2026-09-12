export type Person = {
  id: string;
  name: string;
  handle: string;
  hue: number;
  ring?: boolean;
};

export type Source = {
  label: string;
  detail: string;
  confidence: "مؤكد" | "مرجّح" | "غير مؤكد";
};

export type Comment = {
  id: string;
  author: Person;
  text: string;
  /** درجة الإثراء المعرفي التي يحسبها غربال الحوار */
  signal: number;
  kind: "سؤال" | "إضافة" | "نقد" | "ضجيج";
  at: string;
};

export type PostKind = "film" | "essay" | "moment";

export type Post = {
  id: string;
  author: Person;
  kind: PostKind;
  title: string;
  lede: string;
  body: string[];
  place: string;
  at: string;
  /** تدرّج يمثّل الوسيط البصري — لا صور خارجية، حتى يبقى المشروع خالياً من حقوق الغير */
  media: [string, string, string];
  /** صورة يلتقطها المستخدم، مخزّنة على جهازه وحده */
  photo?: string;
  /** خصوصية المنشور */
  audience?: "عام" | "المتابِعون" | "أنا فقط";
  duration?: string;
  aiShare: number;
  humanShare: number;
  sources: Source[];
  meta: Record<string, string>;
  comments: Comment[];
  reactions: number;
  saved?: boolean;
};

export type AtlasMoment = {
  id: string;
  title: string;
  place: string;
  date: string;
  year: number;
  season: "شتاء" | "ربيع" | "صيف" | "خريف";
  kind: "رحلة" | "كتابة" | "لقاء" | "محطة";
  /** إحداثيات نسبية داخل لوحة الأطلس (0..100) */
  x: number;
  y: number;
  depth: number;
  note: string;
  tags: string[];
};

export type ScreenId = "feed" | "explore" | "create" | "atlas" | "profile" | "settings";

/* ── الحساب والملف الشخصي ────────────────────────────────────────────────── */

export type Profile = {
  name: string;
  handle: string;
  bio: string;
  place: string;
  link: string;
  /** درجة لون الصورة الرمزية المولّدة، تُستعمل حين لا توجد صورة */
  hue: number;
  /** صورة شخصية اختيارية يختارها المستخدم — تُخزّن كـ data URL على الجهاز */
  avatar?: string;
  cover: [string, string, string];
  private: boolean;
  joined: string;
};

export type Notification = {
  id: string;
  kind: "like" | "comment" | "follow" | "mention" | "system";
  personId?: string;
  postId?: string;
  text: string;
  at: number;
  read: boolean;
};

export type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  at: number;
};

export type Conversation = {
  id: string;
  personId: string;
  messages: Message[];
  unread: number;
};

export type ReplyPolicy = "الجميع" | "من أتابعهم" | "لا أحد";

export type Settings = {
  replyPolicy: ReplyPolicy;
  /** عتبة غربال الحوار: ما دونها يذهب إلى الصندوق المعزول */
  signalFloor: number;
  showProvenance: boolean;
  localOnly: boolean;
};
