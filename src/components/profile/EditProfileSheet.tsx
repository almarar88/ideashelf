import { useState } from "react";
import { Camera, Check, Loader2, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { MediaCanvas } from "@/components/ui/MediaCanvas";
import { cn } from "@/lib/cn";
import { pickImage } from "@/lib/image";
import { useStore } from "@/store/store";
import type { Profile } from "@/lib/types";

const COVERS: [string, string, string][] = [
  ["#2b3f8f", "#6d5bd0", "#f06ab0"],
  ["#0f2f4a", "#2f7d8f", "#9fe3c9"],
  ["#5a1f4a", "#c2456f", "#ffc08a"],
  ["#1b1b2f", "#4b3f8f", "#8fa7ff"],
  ["#6b3a13", "#c9772f", "#ffd9a0"],
];

const LIMITS = { name: 30, bio: 160, place: 40, link: 60 };

export function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState<Profile>(state.profile);
  const [busy, setBusy] = useState<"avatar" | null>(null);

  // إعادة ضبط المسوّدة في كل فتح، حتى لا تبقى تعديلات ملغاة
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(state.profile);
  }

  const handleError =
    draft.handle.length < 3
      ? "المعرّف قصير جداً"
      : !/^@[A-Za-z0-9_]{2,20}$/.test(draft.handle)
        ? "المعرّف يبدأ بـ @ ويقبل الحروف اللاتينية والأرقام والشرطة السفلية فقط"
        : null;
  const nameError = draft.name.trim().length === 0 ? "الاسم مطلوب" : null;
  const invalid = !!handleError || !!nameError;

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const chooseAvatar = async () => {
    setBusy("avatar");
    try {
      const url = await pickImage(320);
      if (url) set("avatar", url);
    } catch {
      /* اختيار ملغى أو صورة غير مقروءة */
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (invalid) return;
    dispatch({
      type: "profile/update",
      patch: {
        ...draft,
        name: draft.name.trim(),
        bio: draft.bio.trim(),
        place: draft.place.trim(),
        link: draft.link.trim(),
      },
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="تعديل الملف" subtitle="يُحفظ على جهازك فقط">
      <div className="space-y-4 pb-4">
        <div>
          <p className="mb-2 text-[12px] font-medium">صورة الغلاف</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {COVERS.map((c) => {
              const active = c.join() === draft.cover.join();
              return (
                <button
                  key={c.join()}
                  type="button"
                  onClick={() => set("cover", c)}
                  aria-label="غلاف"
                  aria-pressed={active}
                  className={cn(
                    "shrink-0 rounded-xl2 p-[2px] transition",
                    active ? "ring-2 ring-rose" : "opacity-70",
                  )}
                >
                  <MediaCanvas colors={c} className="h-12 w-24" grain={false} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Avatar person={{ ...draft, id: "me", ring: false }} size="xl" ring />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={chooseAvatar}
              disabled={busy === "avatar"}
              className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[12.5px] font-medium transition active:scale-95 disabled:opacity-60"
            >
              {busy === "avatar" ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              اختر صورة
            </button>
            {draft.avatar && (
              <button
                type="button"
                onClick={() => set("avatar", undefined)}
                className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[12.5px] text-muted transition active:scale-95"
              >
                <Trash2 size={14} />
                إزالة
              </button>
            )}
          </div>
        </div>

        {!draft.avatar && (
          <div>
            <p className="mb-2 text-[12px] font-medium">لون الصورة المولّدة</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {[44, 214, 338, 128, 268, 188, 12].map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`درجة ${h}`}
                  onClick={() => set("hue", h)}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full transition",
                    draft.hue === h && "ring-2 ring-ink ring-offset-2 ring-offset-[rgb(var(--surface))]",
                  )}
                  style={{
                    background: `linear-gradient(145deg, hsl(${h} 85% 62%), hsl(${(h + 48) % 360} 90% 72%))`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <Field
          label="الاسم"
          value={draft.name}
          onChange={(v) => set("name", v.slice(0, LIMITS.name))}
          max={LIMITS.name}
          error={nameError}
        />
        <Field
          label="المعرّف"
          value={draft.handle}
          onChange={(v) => set("handle", v.startsWith("@") ? v : `@${v}`)}
          max={21}
          dir="ltr"
          error={handleError}
        />
        <Field
          label="النبذة"
          value={draft.bio}
          onChange={(v) => set("bio", v.slice(0, LIMITS.bio))}
          max={LIMITS.bio}
          multiline
        />
        <Field
          label="المكان"
          value={draft.place}
          onChange={(v) => set("place", v.slice(0, LIMITS.place))}
          max={LIMITS.place}
        />
        <Field
          label="رابط"
          value={draft.link}
          onChange={(v) => set("link", v.slice(0, LIMITS.link))}
          max={LIMITS.link}
          dir="ltr"
        />

        <label className="flex items-start justify-between gap-3 rounded-xl2 bg-raised p-3.5">
          <span>
            <span className="block text-[13px] font-medium">حساب خاص</span>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
              لا يرى منشوراتك إلا من تقبله. النموذج محلي، فالإعداد يُحفظ ولا يُرسل.
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.private}
            onChange={(e) => set("private", e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--rose))]"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={invalid}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[.98] disabled:opacity-50 disabled:shadow-none"
            style={{ background: "linear-gradient(140deg, rgb(var(--rose)), rgb(var(--iris)))" }}
          >
            <Check size={16} />
            حفظ
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-raised px-5 text-[13.5px] font-medium text-muted"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  multiline,
  dir,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline?: boolean;
  dir?: "ltr" | "rtl";
  error?: string | null;
}) {
  const id = `f-${label}`;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12px] font-medium">
          {label}
        </label>
        <span className="text-[10.5px] tabular-nums text-muted">
          {value.length}/{max}
        </span>
      </div>
      {multiline ? (
        <textarea
          id={id}
          dir={dir}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-xl2 bg-raised p-3 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-[rgb(var(--iris)/.4)]"
        />
      ) : (
        <input
          id={id}
          dir={dir}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl2 bg-raised px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[rgb(var(--iris)/.4)]"
        />
      )}
      {error && <p className="mt-1 text-[11px] text-rose">{error}</p>}
    </div>
  );
}
