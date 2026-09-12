import { atlas, people, posts } from "@/lib/data";
import type {
  AtlasMoment,
  Conversation,
  Notification,
  Person,
  Post,
  Profile,
  Settings,
} from "@/lib/types";

export type State = {
  profile: Profile;
  people: Person[];
  following: string[];
  followers: string[];
  blocked: string[];
  muted: string[];
  posts: Post[];
  liked: string[];
  saved: string[];
  atlas: AtlasMoment[];
  notifications: Notification[];
  conversations: Conversation[];
  settings: Settings;
  /** يُستعمل للتمييز بين تشغيل أول وتشغيل معاد */
  seenIntro: boolean;
};

const HOUR = 3_600_000;
const now = Date.now();

export const initialProfile: Profile = {
  name: "مطر",
  handle: "@matar",
  bio: "أوثّق ما لا يُعاد: رحلات، مجالس، ونصوص تُكتب من الصوت. كل ما هنا مسنود بمصدر.",
  place: "الرياض",
  link: "chrono.ai/matar",
  hue: 44,
  cover: ["#2b3f8f", "#6d5bd0", "#f06ab0"],
  private: false,
  joined: "2025",
};

export const initialSettings: Settings = {
  replyPolicy: "الجميع",
  signalFloor: 40,
  showProvenance: true,
  localOnly: true,
};

export function seedState(): State {
  return {
    profile: initialProfile,
    people,
    following: ["p1", "p2", "p5"],
    followers: ["p1", "p2", "p3", "p4", "p6"],
    blocked: [],
    muted: [],
    posts,
    liked: [],
    saved: [],
    atlas,
    notifications: [
      {
        id: "n1",
        kind: "comment",
        personId: "p4",
        postId: "post-nafud",
        text: "سأل عن مصدر إعادة بناء الصوت في «ليلة مطر في النفود»",
        at: now - 3 * 60_000,
        read: false,
      },
      {
        id: "n2",
        kind: "like",
        personId: "p2",
        postId: "post-fajr",
        text: "أعجِب بـ «طريق العودة قبل الفجر»",
        at: now - 40 * 60_000,
        read: false,
      },
      {
        id: "n3",
        kind: "follow",
        personId: "p6",
        text: "بدأ متابعتك",
        at: now - 5 * HOUR,
        read: false,
      },
      {
        id: "n4",
        kind: "mention",
        personId: "p1",
        postId: "post-marginalia",
        text: "ذكرك في نقاش «في مديح الهامش»",
        at: now - 26 * HOUR,
        read: true,
      },
      {
        id: "n5",
        kind: "system",
        text: "خُتم منشورك بسجل أصل رقمي يوضح نسبة مساهمة الآلة",
        at: now - 50 * HOUR,
        read: true,
      },
    ],
    conversations: [
      {
        id: "c-p1",
        personId: "p1",
        unread: 2,
        messages: [
          { id: "m1", from: "them", text: "خلصت مونتاج مشهد المطر؟", at: now - 90 * 60_000 },
          { id: "m2", from: "me", text: "باقي الطبقة الصوتية. المولّد كان يغطي كل شيء.", at: now - 80 * 60_000 },
          { id: "m3", from: "them", text: "جرّب تعزله وتعيد بناء المحيط، فرقه كبير.", at: now - 12 * 60_000 },
          { id: "m4", from: "them", text: "وأرسل لي النسخة قبل ما تنشرها 🙏", at: now - 11 * 60_000 },
        ],
      },
      {
        id: "c-p5",
        personId: "p5",
        unread: 0,
        messages: [
          { id: "m5", from: "them", text: "مقال الهامش ذكّرني بمخطوطة عندي، أصوّرها لك؟", at: now - 30 * HOUR },
          { id: "m6", from: "me", text: "أكيد، وأضيفها كهامش موثّق بإذنك.", at: now - 29 * HOUR },
        ],
      },
    ],
    settings: initialSettings,
    seenIntro: false,
  };
}
