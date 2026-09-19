import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { refreshMe, useAccount, usageRatio } from "../lib/account";
import { billingAvailable, configureBilling, getOffers, purchase, restore, type Offer } from "../lib/billing";
import { Icon, Spinner } from "../components/ui";

const PLAN_COLORS: Record<string, string> = { free: "var(--cream-2)", pro: "var(--orange)", ultra: "var(--dark)" };

export default function Paywall({ reason, onClose }: { reason?: string | null; onClose: () => void }) {
  const lang = useStore((s) => s.settings.lang);
  const { me } = useAccount();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const available = billingAvailable();

  useEffect(() => {
    if (!available || !me) return;
    configureBilling(me.user.id).then(getOffers).then(setOffers).catch((e) => setErr(String(e)));
  }, [available, me]);

  const buy = async (planId: "pro" | "ultra") => {
    const o = offers.find((x) => x.planId === planId);
    if (!o) { setErr(t(lang, "billingUnavailable")); return; }
    setBusy(planId); setErr(null);
    try { if (await purchase(o)) { await refreshMe(true); onClose(); } }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const doRestore = async () => {
    setBusy("restore"); setErr(null);
    try { await restore(); await refreshMe(true); } catch (e) { setErr(String(e)); } finally { setBusy(null); }
  };

  const plans = me?.plans ?? [];
  const feat = (id: string) => t(lang, id === "free" ? "featFree" : id === "pro" ? "featPro" : "featUltra");
  const priceOf = (id: string) => offers.find((o) => o.planId === id)?.priceString ?? (plans.find((p) => p.id === id)?.price_usd ? `$${plans.find((p) => p.id === id)!.price_usd}` : "");

  return (
    <div className="stack">
      <div><h3 className="h3">{t(lang, "paywallTitle")}</h3><div className="small muted">{t(lang, "paywallSub")}</div></div>
      {reason && <div className="error-box">{t(lang, reason === "daily_messages" ? "quotaDaily" : "quotaMonthly")}</div>}
      {me && <div className="card soft small"><div className="row between"><span>{t(lang, "currentPlan")}: <b>{me.plan.name}</b></span><span>{t(lang, "usageThisMonth")}: {Math.round(usageRatio(me) * 100)}%</span></div><div className="score-bar" style={{ marginTop: 6 }}><div style={{ width: `${usageRatio(me) * 100}%` }} /></div></div>}
      {plans.filter((p) => p.id !== "free").map((p) => (
        <div key={p.id} className="card" style={{ background: PLAN_COLORS[p.id], color: p.id === "free" ? "var(--text)" : "#fff" }}>
          <div className="row between"><span style={{ fontSize: 20, fontWeight: 700 }}>{p.name}</span><span style={{ fontSize: 22, fontWeight: 700 }}>{priceOf(p.id)}<span className="small" style={{ opacity: .8 }}>{t(lang, "perMonth")}</span></span></div>
          <div className="small" style={{ opacity: .9, marginTop: 6, lineHeight: 1.5 }}>{feat(p.id)}</div>
          {me?.plan.id === p.id
            ? <div className="pill ghost" style={{ marginTop: 10 }}><Icon name="check" size={14} /> {t(lang, "currentPlan")}</div>
            : <button className="btn block" style={{ marginTop: 12, background: "#fff", color: "var(--text)" }} disabled={busy !== null} onClick={() => buy(p.id as "pro" | "ultra")}>{busy === p.id ? <Spinner /> : t(lang, "subscribe")}</button>}
        </div>
      ))}
      {!available && <div className="card soft small muted">{t(lang, "billingUnavailable")}</div>}
      {err && <div className="error-box">{err}</div>}
      <div className="small muted" style={{ textAlign: "center" }}>{t(lang, "fairUse")}</div>
      {available && <button className="btn light block" disabled={busy !== null} onClick={doRestore}>{t(lang, "restore")}</button>}
    </div>
  );
}
