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

export type ScreenId = "feed" | "studio" | "prose" | "atlas" | "vault";
