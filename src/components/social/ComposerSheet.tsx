import { useState } from "react";
import { Globe, Image as ImageIcon, Loader2, Lock, MapPin, Send, Sparkles, Users, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { gradientFromImage, pickImage } from "@/lib/image";
import { nextId, useMe, useStore } from "@/store/store";
import type { Post, PostKind } from "@/lib/types";

const KINDS: { id: PostKind; label: string }[] = [
  { id: "moment", label: "لحظة" },
  { id: "film", label: "فيلم" },
  { id: "essay", label: "مقال" },
];

const AUDIENCES: { id: NonNullable<Post["audience"]>; label: string; Icon: typeof Globe }[] = [
  { id: "عام", label: "عام", Icon: Globe },
  { id: "المتابِعون", label: "المتابِعون", Icon: Users },
  { id: "أنا فقط", label: "أنا فقط", Icon: Lock },
];

const PALETTES: [string, string, string][] = [
  ["#2b3f8f", "#6d5bd0", "#f06ab0"],
  ["#12204f", "#2f4ea8", "#7fd5ff"],
  ["#7a2f63", "#d75fa0", "#ffc4e1"],
  ["#1b4332", "#40916c", "#b7e4c7"],
  ["#8a4f2a", "#e0913f", "#ffd9a0"],
];

export function ComposerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const me = useMe();

  const [kind, setKind] = useState<PostKind>("moment");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [audience, setAudience] = useState<NonNullable<Post["audience"]>>("عام");
  const [palette, setPalette] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [aiShare, setAiShare] = useState(0);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setKind("moment");
    setTitle("");
    setText("");
    setPlace("");
    setAudience("عام");
    setPalette(0);
    setPhoto(null);
    setAiShare(0);
  };

  const addPhoto = async () => {
    setBusy(true);
    try {
      const url = await pickImage(1280);
      if (url) {
        setPhoto(url);
        const g = await gradientFromImage(url);
        setPalette(-1);
        setDerived(g);
      }
    } catch {
      /* اختيار ملغى */
    } finally {
      setBusy(false);
    }
  };

  const [derived, setDerived] = useState<[string, string, string] | null>(null);
  const media = derived ?? PALETTES[Math.max(0, palette)];
  const ready = title.trim().length > 1 && text.trim().length > 3;

  const publish = () => {
    if (!ready) return;
    const body = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    const post: Post = {
      id: nextId("post"),
      author: { id: "me", name: me.name, handle: me.handle, hue: me.hue },
      kind,
      title: title.trim(),
      lede: body[0] ?? text.trim(),
      body,
      place: place.trim() || "بلا موقع",
      at: "الآن",
      media,
      photo: photo ?? undefined,
      aiShare,
      humanShare: 100 - aiShare,
      audience,
      sources: [
        {
          label: "التقاط مباشر",
          detail: "أنشئ من داخل التطبيق على هذا الجهاز، ولم يمر بأي خادم.",
          confidence: "مؤكد",
        },
      ],
      meta: {
        "النوع": KINDS.find((k) => k.id === kind)?.label ?? "",
        "الخصوصية": audience,
        "الوسيط": photo ? "صورة من الجهاز" : "تدرّج مولّد",
        "إقرار الذكاء الاصطناعي": `${aiShare}٪`,
      },
      comments: [],
      reactions: 0,
    };

    dispatch({ type: "post/create", post });
    dispatch({
      type: "notif/push",
      notification: {
        id: nextId("n"),
        kind: "system",
        postId: post.id,
        text: `نُشر «${post.title}» وخُتم بسجل أصل يوضح ${aiShare}٪ مساهمة آلية`,
        at: Date.now(),
        read: false,
      },
    });
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="أثر جديد" subtitle="يُحفظ على جهازك">
      <div className="space-y-4 pb-4">
        <div className="flex gap-2">
          {KINDS.map((k) => (
            <Pill key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </Pill>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="العنوان"
          className="w-full rounded-xl2 bg-raised px-3.5 py-3 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted focus:ring-2 focus:ring-[rgb(var(--iris)/.4)]"
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          rows={5}
          placeholder="اكتب ما حدث… اترك سطراً فارغاً بين الفقرات."
          className="w-full resize-none rounded-xl2 bg-raised p-3.5 text-[13.5px] leading-relaxed outline-none placeholder:text-muted focus:ring-2 focus:ring-[rgb(var(--iris)/.4)]"
        />

        <div className="relative">
          <MediaCanvas colors={media} photo={photo ?? undefined} className="h-44 w-full" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={addPhoto}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--scrim)/.55)] px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition active:scale-95"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
              {photo ? "تغيير الصورة" : "أضف صورة"}
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setDerived(null);
                  setPalette(0);
                }}
                aria-label="إزالة الصورة"
                className="grid h-8 w-8 place-items-center rounded-full bg-[rgb(var(--scrim)/.55)] text-white backdrop-blur"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {!photo && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {PALETTES.map((c, i) => (
              <button
                key={c.join()}
                type="button"
                aria-label={`تدرّج ${i + 1}`}
                onClick={() => {
                  setPalette(i);
                  setDerived(null);
                }}
                className={cn(
                  "h-9 w-14 shrink-0 rounded-xl transition",
                  palette === i && !derived && "ring-2 ring-rose",
                )}
                style={{ background: `linear-gradient(150deg, ${c[0]}, ${c[1]} 55%, ${c[2]})` }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl2 bg-raised px-3.5 py-2.5">
          <MapPin size={15} className="shrink-0 text-iris" />
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value.slice(0, 48))}
            placeholder="أين؟"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
        </div>

        <div className="flex gap-2">
          {AUDIENCES.map((a) => (
            <Pill key={a.id} active={audience === a.id} onClick={() => setAudience(a.id)}>
              <a.Icon size={13} />
              {a.label}
            </Pill>
          ))}
        </div>

        <div className="rounded-xl2 bg-raised p-3.5">
          <label className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-rose" />
              إقرار مساهمة الذكاء الاصطناعي
            </span>
            <span className="tabular-nums text-muted">{aiShare}٪</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={aiShare}
            onChange={(e) => setAiShare(Number(e.target.value))}
            className="w-full"
            aria-label="نسبة مساهمة الذكاء الاصطناعي"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            تُكتب هذه النسبة في سجل أصل المنشور ويراها من يقرأه. أنت من يقرّها، لا
            التطبيق.
          </p>
        </div>

        <button
          type="button"
          onClick={publish}
          disabled={!ready}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[.98] disabled:opacity-50 disabled:shadow-none"
          style={{ background: "linear-gradient(140deg, rgb(var(--rose)), rgb(var(--iris)))" }}
        >
          <Send size={16} />
          انشر
        </button>
        {!ready && (
          <p className="text-center text-[11.5px] text-muted">
            يحتاج عنواناً ونصاً قبل النشر.
          </p>
        )}
      </div>
    </Sheet>
  );
}
