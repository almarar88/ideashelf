/**
 * محرّك محلي — بالكامل قواعدي (rule-based) ويعمل داخل المتصفح.
 * لا يوجد نموذج لغوي حقيقي هنا: هذه محاكاة صادقة لسلوك الواجهة،
 * وكل مخرجاتها مشتقة حسابياً من نص المستخدم نفسه أو من بيانات محلية.
 */
import { atlas, posts } from "./data";
import type { AtlasMoment, Comment, Post, Source } from "./types";

/* ── 1) بصمة النبرة: تنقية التفريغ الصوتي وإعادة بنائه فقرات ─────────────── */

const FILLERS = [
  "يعني",
  "اممم",
  "امم",
  "اه",
  "ايه",
  "زي كذا",
  "كذا يعني",
  "شفت كيف",
  "والله",
  "طبعاً طبعا",
  "خلاص",
  "المهم",
  "على فكرة",
];

const CONNECTORS = ["ثم", "غير أن", "وفي المقابل", "والحق أن", "ولهذا"];

export type ToneProfile = {
  /** متوسط طول الجملة بالكلمات */
  cadence: number;
  /** نسبة الجمل التي تبدأ بأداة عطف — مؤشر على أسلوب الاسترسال */
  flow: number;
  /** ثراء المفردات: كلمات فريدة / إجمالي */
  lexicon: number;
};

export function readToneProfile(text: string): ToneProfile {
  const sentences = splitSentences(text);
  const words = text.split(/\s+/).filter(Boolean);
  const unique = new Set(words.map((w) => w.replace(/[،.؟!]/g, "")));
  const starters = sentences.filter((s) => /^\s*(و|ثم|لكن|غير)/.test(s)).length;
  return {
    cadence: sentences.length ? Math.round(words.length / sentences.length) : 0,
    flow: sentences.length ? Math.round((starters / sentences.length) * 100) : 0,
    lexicon: words.length ? Math.round((unique.size / words.length) * 100) : 0,
  };
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!؟])\s+|\s*،\s*(?=[^\s]{6,})/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function stripFillers(s: string): string {
  let out = s;
  for (const f of FILLERS) {
    out = out.replace(new RegExp(`(^|\\s)${f}(?=\\s|$|[،.؟!])`, "g"), "$1");
  }
  // حذف الحشو قد يترك علامة ترقيم يتيمة في أول الجملة
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/^[،,.\s]+/, "")
    .trim();
}

export type ProseDraft = {
  title: string;
  paragraphs: string[];
  words: number;
  readMinutes: number;
  removed: number;
};

/** يحوّل استرسالاً صوتياً مفرّغاً إلى مسوّدة مقال منسّقة. */
export function composeProse(raw: string): ProseDraft {
  const sentences = splitSentences(raw);
  const cleaned = sentences.map(stripFillers).filter((s) => s.split(/\s+/).length > 2);
  const removed = sentences.length - cleaned.length;

  const paragraphs: string[] = [];
  const perParagraph = Math.max(2, Math.ceil(cleaned.length / 4));
  for (let i = 0; i < cleaned.length; i += perParagraph) {
    const chunk = cleaned.slice(i, i + perParagraph).map((s, j) => {
      const withStop = /[.!؟]$/.test(s) ? s : `${s}.`;
      // ربط داخلي خفيف بين الجمل، بلا تغيير في معناها،
      // ولا يُضاف رابط إذا كانت الجملة تبدأ أصلاً بأداة عطف
      const startsLinked = /^(و|ثم|لكن|غير|بل|أو|حتى)/.test(withStop);
      return j > 0 && j % 2 === 0 && !startsLinked && withStop.split(/\s+/).length > 5
        ? `${CONNECTORS[(i + j) % CONNECTORS.length]} ${withStop}`
        : withStop;
    });
    paragraphs.push(chunk.join(" "));
  }

  const first = cleaned[0] ?? "";
  const title =
    first.split(/\s+/).slice(0, 6).join(" ").replace(/[.،؟!]$/, "") || "مسوّدة بلا عنوان";
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;

  return {
    title,
    paragraphs: paragraphs.length ? paragraphs : ["لم يُلتقط نص كافٍ بعد."],
    words,
    readMinutes: Math.max(1, Math.round(words / 180)),
    removed,
  };
}

/* ── 2) المحرر المرجعي الحي: كشف الوقائع القابلة للتحقق ──────────────────── */

const PLACE_LEXICON = [
  "النفود",
  "الرياض",
  "العلا",
  "حائل",
  "الجوف",
  "بريدة",
  "جدة",
  "الدرعية",
];

export type Marginal = {
  id: string;
  claim: string;
  type: "رقم" | "تاريخ" | "مكان" | "نسبة";
  note: string;
  confidence: Source["confidence"];
};

/** يفحص النص ويستخرج ما يحتاج توثيقاً. الكشف حقيقي؛ نص الهامش قالبي. */
export function scanForClaims(text: string): Marginal[] {
  const found: Marginal[] = [];
  const push = (m: Omit<Marginal, "id">) =>
    found.push({ ...m, id: `${m.type}-${m.claim}-${found.length}` });

  const years: string[] = text.match(/\b(1[3-4]\d{2}|19\d{2}|20\d{2})\b/g) ?? [];
  for (const y of new Set(years)) {
    push({
      claim: y,
      type: "تاريخ",
      note: "سنة مذكورة في النص — تحتاج مصدراً يثبت الحدث المرتبط بها.",
      confidence: "غير مؤكد",
    });
  }

  const percents: string[] = text.match(/\d+\s?%|\d+\s?بالمئة|\d+\s?٪/g) ?? [];
  for (const p of new Set(percents)) {
    push({
      claim: p.trim(),
      type: "نسبة",
      note: "نسبة مئوية — يجب ذكر مصدرها وسنة القياس قبل النشر.",
      confidence: "غير مؤكد",
    });
  }

  const numbers: string[] = text.match(/\b\d{3,}\b/g) ?? [];
  for (const n of new Set(numbers)) {
    if (years.includes(n)) continue;
    push({
      claim: n,
      type: "رقم",
      note: "رقم كبير غير موثّق — أضف المرجع أو حوّله إلى تقدير صريح.",
      confidence: "غير مؤكد",
    });
  }

  for (const place of PLACE_LEXICON) {
    if (text.includes(place)) {
      push({
        claim: place,
        type: "مكان",
        note: "موقع معروف — يمكن ربطه تلقائياً بإحداثيات الأطلس وبتاريخ الزيارة.",
        confidence: "مؤكد",
      });
    }
  }

  return found.slice(0, 8);
}

/* ── 3) التحويل العنقودي: شكل واحد → أربعة قوالب ─────────────────────────── */

export type MorphKind = "article" | "cards" | "script" | "audio";

export type Morph = {
  kind: MorphKind;
  label: string;
  hint: string;
  blocks: { head: string; body: string }[];
};

export function morph(draft: ProseDraft, kind: MorphKind): Morph {
  const ps = draft.paragraphs;
  switch (kind) {
    case "article":
      return {
        kind,
        label: "مقال منسّق",
        hint: `${draft.words} كلمة · ${draft.readMinutes} دقيقة قراءة`,
        blocks: ps.map((p, i) => ({ head: i === 0 ? draft.title : "", body: p })),
      };
    case "cards":
      return {
        kind,
        label: "بطاقات مرئية",
        hint: `${ps.length} بطاقة للعرض السريع`,
        blocks: ps.map((p, i) => ({
          head: `بطاقة ${i + 1}`,
          body: p.split(/(?<=[.!؟])\s+/)[0] ?? p,
        })),
      };
    case "script":
      return {
        kind,
        label: "سيناريو وثائقي",
        hint: `${ps.length} مشهد · تقدير ${ps.length * 25} ثانية`,
        blocks: ps.map((p, i) => ({
          head: `مشهد ${i + 1} — ${i === 0 ? "لقطة افتتاحية" : "لقطة وسطى"}`,
          body: `تعليق صوتي: ${p.slice(0, 150)}${p.length > 150 ? "…" : ""}`,
        })),
      };
    case "audio":
      return {
        kind,
        label: "حلقة صوتية",
        hint: `تقدير ${Math.max(1, Math.round(draft.words / 140))} دقيقة سرد`,
        blocks: [
          { head: "مقدمة", body: ps[0] ?? "" },
          { head: "المتن", body: ps.slice(1, -1).join(" ") || ps[0] || "" },
          { head: "خاتمة", body: ps[ps.length - 1] ?? "" },
        ],
      };
  }
}

/* ── 4) الاسترجاع السياقي: مطابقة لغوية على الأطلس والمنشورات ────────────── */

const STOP = new Set([
  "اليوم","الذي","في","و","كان","الجو","وتكلمنا","عن","مع","من","على","اللي","ما","أول","مرة","فيها","إلى",
]);

export type RecallHit = {
  moment: AtlasMoment;
  score: number;
  matched: string[];
};

export function recall(query: string): RecallHit[] {
  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/[،.؟!]/g, ""))
    .filter((t) => t.length > 2 && !STOP.has(t));

  return atlas
    .map((m) => {
      const hay = `${m.title} ${m.place} ${m.note} ${m.tags.join(" ")} ${m.season} ${m.kind}`;
      const matched = terms.filter((t) => hay.includes(t) || t.includes(m.place));
      return { moment: m, score: matched.length, matched };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function relatedPosts(m: AtlasMoment): Post[] {
  return posts.filter((p) => p.place.includes(m.place.split(" ")[0]) || p.title === m.title);
}

/* ── 5) غربال الحوار: فرز الإشارة عن الضجيج ─────────────────────────────── */

export const SIGNAL_FLOOR = 40;

export function gate(comments: Comment[], floor: number = SIGNAL_FLOOR) {
  const signal = comments.filter((c) => c.signal >= floor).sort((a, b) => b.signal - a.signal);
  const noise = comments.filter((c) => c.signal < floor);
  return { signal, noise };
}

/* ── 6) محاورة المنشور: إجابات من البيانات الوصفية فقط ───────────────────── */

export type Answer = {
  text: string;
  basis: string;
  grounded: boolean;
};

export function askPost(post: Post, question: string): Answer {
  const q = question.trim();
  const metaHit = Object.entries(post.meta).find(([k]) =>
    q.split(/\s+/).some((w) => w.length > 2 && k.includes(w.replace(/[؟.,]/g, ""))),
  );
  if (metaHit) {
    return {
      text: `${metaHit[0]}: ${metaHit[1]}`,
      basis: "البيانات الوصفية المرفقة بالمنشور",
      grounded: true,
    };
  }

  if (/(دليل|مصدر|مرجع|تحقق)/.test(q)) {
    return {
      text: post.sources.map((s) => `• ${s.label} — ${s.detail} (${s.confidence})`).join("\n"),
      basis: `${post.sources.length} مصدر مرفق`,
      grounded: true,
    };
  }

  if (/(ذكاء|AI|آلي|توليد|نسبة)/i.test(q)) {
    return {
      text: `مساهمة الذكاء الاصطناعي ${post.aiShare}٪ مقابل ${post.humanShare}٪ من المؤلف، وفق سجل الأصل الرقمي المدمج (C2PA).`,
      basis: "سجل الأصل الرقمي",
      grounded: true,
    };
  }

  if (/(أين|مكان|وين|موقع)/.test(q)) {
    return { text: post.place, basis: "الوسم المكاني", grounded: true };
  }

  if (/(متى|وقت|تاريخ)/.test(q)) {
    return { text: post.at, basis: "الوسم الزمني", grounded: true };
  }

  return {
    text:
      "لا توجد بيانات وصفية في هذا المنشور تجيب على السؤال. المحرك لا يخمّن خارج ما وثّقه المؤلف.",
    basis: "لا مصدر",
    grounded: false,
  };
}

/* ── 7) تقدير درجة الإشارة لردٍّ جديد ───────────────────────────────────── */

/**
 * تقدير قواعدي صريح لا نموذج لغوي: يكافئ الطول المعقول، والسؤال المحدّد،
 * والإحالة إلى مصدر أو رقم، ويخصم على الردود الجوفاء والصياح.
 */
export function scoreComment(text: string): { signal: number; kind: Comment["kind"] } {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;

  let score = Math.min(45, words * 3);
  if (/[؟?]/.test(t)) score += 22;
  if (/(مصدر|دليل|مرجع|حسب|وفق|دراسة|كتاب)/.test(t)) score += 20;
  if (/\d/.test(t)) score += 8;
  if (/(لأن|بينما|غير أن|في المقابل|مع ذلك)/.test(t)) score += 10;

  if (words <= 2) score -= 30;
  if (/^[\p{Emoji_Presentation}\s]+$/u.test(t)) score -= 40;
  if (/(!{3,}|\?{3,})/.test(t)) score -= 10;
  if (/(أول|first|🔥{2,})/i.test(t) && words <= 3) score -= 25;

  const signal = Math.max(0, Math.min(99, Math.round(score)));

  const kind: Comment["kind"] = /[؟?]/.test(t)
    ? "سؤال"
    : signal < 40
      ? "ضجيج"
      : /(أضيف|إضافة|كذلك|وأيضاً|يفسّر)/.test(t)
        ? "إضافة"
        : "نقد";

  return { signal, kind };
}
