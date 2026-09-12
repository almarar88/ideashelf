import { useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Cloud,
  CloudOff,
  LogOut,
  Download,
  Eye,
  Filter,
  Lock,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  UserX,
} from "lucide-react";
import { VaultScreen } from "./VaultScreen";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { useStore } from "@/store/store";
import { AuthSheet } from "@/server/AuthSheet";
import { useAuth, signOut } from "@/server/auth";
import { useSync } from "@/server/SyncBridge";
import type { State } from "@/store/initial";
import type { ReplyPolicy } from "@/lib/types";
import type { Theme } from "@/hooks/useTheme";

const POLICIES: ReplyPolicy[] = ["الجميع", "من أتابعهم", "لا أحد"];

export function SettingsScreen({
  theme,
  onToggleTheme,
  seals,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  seals: number;
}) {
  const { state, dispatch, saveStatus } = useStore();
  const { session } = useAuth();
  const sync = useSync();
  const [page, setPage] = useState<"root" | "vault" | "blocked">("root");
  const [confirmReset, setConfirmReset] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (page === "vault") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Back onClick={() => setPage("root")} label="الخزنة والسيادة" />
        <VaultScreen sealCount={seals} />
      </div>
    );
  }

  if (page === "blocked") {
    const blocked = state.people.filter((p) => state.blocked.includes(p.id));
    const muted = state.people.filter((p) => state.muted.includes(p.id));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Back onClick={() => setPage("root")} label="المحظورون والمكتومون" />
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
          <Group title={`محظورون · ${blocked.length}`}>
            {blocked.length === 0 && <Note>لا أحد محظور.</Note>}
            {blocked.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <Avatar person={p} size="sm" />
                <span className="flex-1 text-[13px]">{p.name}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "person/block", id: p.id })}
                  className="rounded-full bg-raised px-3 py-1.5 text-[12px] text-muted"
                >
                  رفع الحظر
                </button>
              </div>
            ))}
          </Group>
          <Group title={`مكتومون · ${muted.length}`}>
            {muted.length === 0 && <Note>لا أحد مكتوم.</Note>}
            {muted.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <Avatar person={p} size="sm" />
                <span className="flex-1 text-[13px]">{p.name}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "person/mute", id: p.id })}
                  className="rounded-full bg-raised px-3 py-1.5 text-[12px] text-muted"
                >
                  إلغاء الكتم
                </button>
              </div>
            ))}
          </Group>
        </div>
      </div>
    );
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chrono-ai-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as State;
        if (!parsed || typeof parsed !== "object" || !parsed.profile) throw new Error();
        dispatch({ type: "data/replace", state: parsed });
      } catch {
        window.alert("الملف غير صالح — لم يُغيَّر شيء.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40 pt-1">
      <h1 className="mb-3 px-1 text-[19px] font-semibold">الإعدادات</h1>

      <Group title="الحساب والمزامنة">
        {session ? (
          <>
            <div className="flex items-start gap-3 py-2.5">
              <Cloud size={16} className="mt-0.5 shrink-0 text-mint" />
              <span className="flex-1">
                <span className="block text-[13.5px]" dir="ltr">
                  {session.user.email}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                  {sync.status === "syncing" && "جارٍ الجلب من الخادم…"}
                  {sync.status === "synced" && "متزامن — ما تنشره محفوظ على الخادم"}
                  {sync.status === "error" && (sync.message ?? "تعذّرت المزامنة")}
                </span>
              </span>
              {sync.status === "synced" && <Check size={15} className="mt-1 text-mint" />}
            </div>
            <Link Icon={RotateCcw} label="إعادة الجلب من الخادم" onClick={sync.refresh} />
            <Link
              Icon={LogOut}
              label="خروج"
              tone="rose"
              onClick={() => void signOut()}
            />
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 py-2.5">
              <CloudOff size={16} className="mt-0.5 shrink-0 text-muted" />
              <span className="flex-1 text-[11.5px] leading-relaxed text-muted">
                غير مسجّل. كل شيء يعمل على هذا الجهاز وحده، ولا يراه أحد غيرك.
              </span>
            </div>
            <Link Icon={Cloud} label="تسجيل الدخول والمزامنة" onClick={() => setAuthOpen(true)} />
          </>
        )}
        {sync.message && sync.status !== "synced" && (
          <p className="pb-3 text-[11.5px] leading-relaxed text-amber">{sync.message}</p>
        )}
      </Group>

      <Group title="المظهر">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex w-full items-center gap-3 py-2.5 text-right"
        >
          {theme === "light" ? <Moon size={16} className="text-iris" /> : <Sun size={16} className="text-amber" />}
          <span className="flex-1 text-[13.5px]">
            {theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
          </span>
          <span className="text-[12px] text-muted">
            {theme === "light" ? "نهاري الآن" : "ليلي الآن"}
          </span>
        </button>
      </Group>

      <Group title="الخصوصية">
        <Toggle
          Icon={Lock}
          label="حساب خاص"
          hint="لا يرى منشوراتك إلا من تقبله."
          value={state.profile.private}
          onChange={(v) => dispatch({ type: "profile/update", patch: { private: v } })}
        />
        <Toggle
          Icon={Eye}
          label="إظهار سجل الأصل"
          hint="عرض نسبة مساهمة الآلة على كل منشور."
          value={state.settings.showProvenance}
          onChange={(v) => dispatch({ type: "settings/update", patch: { showProvenance: v } })}
        />
        <div className="py-2.5">
          <p className="text-[13.5px]">من يستطيع الرد عليك</p>
          <div className="mt-2 flex gap-2">
            {POLICIES.map((p) => (
              <Pill
                key={p}
                active={state.settings.replyPolicy === p}
                onClick={() => dispatch({ type: "settings/update", patch: { replyPolicy: p } })}
              >
                {p}
              </Pill>
            ))}
          </div>
        </div>
        <Link Icon={UserX} label="المحظورون والمكتومون" onClick={() => setPage("blocked")} />
      </Group>

      <Group title="غربال الحوار">
        <div className="py-2.5">
          <label className="flex items-center justify-between text-[13.5px]">
            <span className="flex items-center gap-2">
              <Filter size={16} className="text-iris" />
              عتبة الإشارة
            </span>
            <span className="tabular-nums text-muted">{state.settings.signalFloor}</span>
          </label>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={state.settings.signalFloor}
            onChange={(e) =>
              dispatch({ type: "settings/update", patch: { signalFloor: Number(e.target.value) } })
            }
            className="mt-2 w-full"
            aria-label="عتبة الإشارة"
          />
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            الردود التي تقل عن هذه الدرجة تذهب إلى الصندوق المعزول بدل أن تُحذف.
          </p>
        </div>
      </Group>

      <Group title="البيانات">
        <Link Icon={Lock} label="الخزنة والسيادة" onClick={() => setPage("vault")} />
        <Link Icon={Download} label="تصدير بياناتي (JSON)" onClick={exportData} />
        <Link Icon={Upload} label="استيراد نسخة" onClick={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = "";
          }}
        />
        {!confirmReset ? (
          <Link
            Icon={RotateCcw}
            label="إعادة ضبط التطبيق"
            tone="rose"
            onClick={() => setConfirmReset(true)}
          />
        ) : (
          <div className="rounded-xl2 bg-rose/10 p-3">
            <p className="text-[12.5px] leading-relaxed">
              سيُمحى كل ما أضفته على هذا الجهاز: ملفك، منشوراتك، رسائلك. لا يمكن
              التراجع.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "data/reset" });
                  setConfirmReset(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                <Trash2 size={14} />
                امحُ كل شيء
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-full bg-raised px-4 py-2 text-[12.5px] text-muted"
              >
                تراجع
              </button>
            </div>
          </div>
        )}
      </Group>

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />

      <p className="px-1 pb-4 text-[11px] leading-relaxed text-muted">
        Chrono AI · نسخة 1.1 — كل ما سبق يُحفظ في مساحة هذا الجهاز وحده.
        {saveStatus.current === "full" && " ⚠️ مساحة التخزين ممتلئة: احذف صوراً أو صدّر نسخة."}
        {saveStatus.current === "off" && " ⚠️ تعذّر الحفظ المحلي في هذا المتصفح."}
      </p>
    </div>
  );
}

function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-4 mb-1 mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-raised px-3 py-1.5 text-[12.5px] font-medium"
    >
      <ChevronLeft size={15} className="rotate-180" />
      {label}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 px-1 text-[12px] font-semibold text-muted">{title}</h2>
      <div className="card divide-y divide-[rgb(var(--line)/.6)] px-3.5 py-1">{children}</div>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[12.5px] text-muted">{children}</p>;
}

function Link({
  Icon,
  label,
  onClick,
  tone,
}: {
  Icon: typeof Lock;
  label: string;
  onClick: () => void;
  tone?: "rose";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 py-2.5 text-right text-[13.5px]",
        tone === "rose" && "text-rose",
      )}
    >
      <Icon size={16} className={tone === "rose" ? "text-rose" : "text-iris"} />
      <span className="flex-1">{label}</span>
      <ChevronLeft size={15} className="text-muted" />
    </button>
  );
}

function Toggle({
  Icon,
  label,
  hint,
  value,
  onChange,
}: {
  Icon: typeof Lock;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-iris" />
      <span className="flex-1">
        <span className="block text-[13.5px]">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--rose))]"
      />
    </label>
  );
}
