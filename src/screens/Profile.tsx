import { Bell, ChevronRight, CreditCard, Globe, Heart, HelpCircle, Info, LogOut, Star, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton, Sheet, Toast, cx } from "@/components/ui";
import { CURRENCIES, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { useStore } from "@/state/store";

const TIERS = [
  { name: "Explorer", min: 0 },
  { name: "Voyager", min: 500 },
  { name: "Pioneer", min: 1500 },
  { name: "Elite", min: 4000 },
];

export default function Profile() {
  const navigate = useNavigate();
  const { t, locale, currency, profile, favourites, bookings, dispatch } = useStore();
  const [editOpen, setEditOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [curOpen, setCurOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [toast, setToast] = useState<string | null>(null);

  const tierIndex = Math.max(0, TIERS.filter((tier) => profile.points >= tier.min).length - 1);
  const tier = TIERS[tierIndex];
  const next = TIERS[tierIndex + 1];
  const progress = next ? Math.min(100, ((profile.points - tier.min) / (next.min - tier.min)) * 100) : 100;

  const rows = [
    { key: "savedTravellers", Icon: Users, value: "1", onClick: () => setEditOpen(true) },
    { key: "paymentMethods", Icon: CreditCard, value: "—", onClick: () => setToast(t("paymentMethods")) },
    { key: "currency", Icon: Wallet, value: currency, onClick: () => setCurOpen(true) },
    { key: "language", Icon: Globe, value: locale === "ar" ? "العربية" : "English", onClick: () => setLangOpen(true) },
    { key: "favourites", Icon: Heart, value: String(favourites.length), onClick: () => navigate("/more") },
    { key: "notifications", Icon: Bell, value: "", onClick: () => navigate("/notifications") },
    { key: "help", Icon: HelpCircle, value: "", onClick: () => setToast(t("help")) },
    { key: "about", Icon: Info, value: "v1.0.0", onClick: () => setToast("Alcode Trips v1.0.0") },
  ] as const;

  return (
    <div className="screen pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton onClick={() => navigate("/")} />
        <h1 className="text-[20px] font-extrabold">{t("profile")}</h1>
      </header>

      <div className="mx-5 mt-4 card p-5">
        <div className="flex items-center gap-3.5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-brand text-[22px] font-extrabold text-white">
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-extrabold">{profile.name}</p>
            <p className="truncate text-[12px] text-ink-muted">{profile.email}</p>
            <p className="mt-1 text-[11px] text-ink-faint">
              {t("memberSince")} {formatDate(profile.memberSinceISO, locale, "short")}
            </p>
          </div>
          <button type="button" onClick={() => setEditOpen(true)} className="shrink-0 rounded-full bg-canvas px-3.5 py-2 text-[11px] font-bold">
            {t("editProfile")}
          </button>
        </div>

        <div className="mt-5 rounded-[22px] bg-canvas p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold">
              <Star size={14} className="text-sun" fill="#FF8A29" /> {t("loyaltyTier")}: {tier.name}
            </span>
            <span className="text-[13px] font-extrabold text-brand">
              {profile.points} {t("points")}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
          {next && (
            <p className="mt-2 text-[11px] text-ink-muted">
              {next.min - profile.points} {t("pointsToNext")}
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: t("myTrips"), value: bookings.length },
            { label: t("favourites"), value: favourites.length },
            { label: t("points"), value: profile.points },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-canvas px-2 py-3 text-center">
              <p className="text-[17px] font-extrabold">{s.value}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-4 overflow-hidden rounded-[26px] bg-white shadow-card">
        {rows.map(({ key, Icon, value, onClick }, i) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={cx("flex w-full items-center gap-3 px-4 py-4 text-start", i > 0 && "border-t border-canvas")}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-canvas text-ink-soft">
              <Icon size={17} />
            </span>
            <span className="flex-1 text-[14px] font-semibold">{t(key)}</span>
            {value && <span className="text-[12px] text-ink-muted">{value}</span>}
            <ChevronRight size={16} className="flip-rtl text-ink-faint" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setToast(t("signOut"))}
        className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-[24px] bg-white py-4 text-[14px] font-bold text-rose shadow-soft"
      >
        <LogOut size={17} className="flip-rtl" /> {t("signOut")}
      </button>

      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("editProfile")}
        footer={
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "setProfile", profile: { name, email, phone } });
              setEditOpen(false);
              setToast(t("editProfile"));
            }}
            className="btn-dark w-full py-4"
          >
            {t("apply")}
          </button>
        }
      >
        <div className="space-y-3">
          {[
            { label: t("passengerName"), value: name, set: setName, type: "text" },
            { label: "Email", value: email, set: setEmail, type: "email" },
            { label: "Phone", value: phone, set: setPhone, type: "tel" },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="label-xs">{f.label}</span>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-canvas px-4 py-3 text-[14px] outline-none"
              />
            </label>
          ))}
        </div>
      </Sheet>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t("language")}>
        <div className="space-y-2">
          {(
            [
              ["ar", "العربية"],
              ["en", "English"],
            ] as Array<[Locale, string]>
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                dispatch({ type: "setLocale", locale: code });
                setLangOpen(false);
              }}
              className={cx(
                "w-full rounded-2xl px-4 py-3.5 text-start text-[14px] font-bold transition",
                locale === code ? "bg-ink text-white" : "bg-canvas text-ink-soft",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={curOpen} onClose={() => setCurOpen(false)} title={t("currency")}>
        <div className="grid grid-cols-3 gap-2">
          {Object.keys(CURRENCIES).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                dispatch({ type: "setCurrency", currency: code });
                setCurOpen(false);
              }}
              className={cx(
                "rounded-2xl px-3 py-3.5 text-[13px] font-bold transition",
                currency === code ? "bg-ink text-white" : "bg-canvas text-ink-soft",
              )}
            >
              {CURRENCIES[code].symbol} {code}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          {locale === "ar"
            ? "أسعار الصرف ثابتة في هذه النسخة وتُستبدل بمزوّد أسعار حقيقي عند ربط الشركاء."
            : "Exchange rates are fixed in this build and are replaced by a live rates provider once partners are connected."}
        </p>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
