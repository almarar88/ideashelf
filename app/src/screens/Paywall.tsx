import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { refreshMe, useAccount, usageRatio } from "../lib/account";
import { billingAvailable, configureBilling, getOffers, presentNativePaywall, purchase, restore, type Offer } from "../lib/billing";
import { Icon, Spinner } from "../components/ui";

export default function Paywall({ reason, onClose }: { reason?: string | null; onClose: () => void }) {
  const lang = useStore((s) => s.settings.lang);
  const { me, session } = useAccount();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const available = billingAvailable();
  const userId = me?.user.id ?? session?.user.id;

  useEffect(() => {
    if (!available || !userId) { setLoading(false); return; }
    configureBilling(userId).then(getOffers).then(setOffers).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [available, userId]);

  const finish = async () => { await refreshMe(true); onClose(); };
  const buy = async (o: Offer) => {
    setBusy(o.id); setErr(null);
    try { if (await purchase(o)) await finish(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const native = async () => {
    setBusy("native"); setErr(null);
    try { const ok = await presentNativePaywall(); if (ok) await finish(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const doRestore = async () => {
    setBusy("restore"); setErr(null);
    try { if (await restore()) await finish(); else setErr(lang === "ar" ? "لا توجد مشتريات سابقة لهذا الحساب" : "No previous purchases for this account"); }
    catch (e) { setErr(String(e)); } finally { setBusy(null); }
  };

  const termLabel = (term: Offer["term"]) => t(lang, term === "monthly" ? "termMonthly" : term === "yearly" ? "termYearly" : term === "lifetime" ? "termLifetime" : "subscribe");
  const isPro = me?.plan.id === "pro" || me?.plan.id === "ultra";

  return (
    <div className="stack">
      <div><h3 className="h3">{t(lang, "paywallTitle")}</h3><div className="small muted">{t(lang, "paywallSub")}</div></div>
      {reason && <div className="error-box">{t(lang, reason === "daily_messages" ? "quotaDaily" : "quotaMonthly")}</div>}
      {me && <div className="card soft small"><div className="row between"><span>{t(lang, "currentPlan")}: <b>{me.plan.name}</b></span><span>{t(lang, "usageThisMonth")}: {Math.round(usageRatio(me) * 100)}%</span></div><div className="score-bar" style={{ marginTop: 6 }}><div style={{ width: `${usageRatio(me) * 100}%` }} /></div></div>}

      <div className="card" style={{ background: "var(--orange)", color: "#fff" }}>
        <div className="row between"><span style={{ fontSize: 22, fontWeight: 700 }}>LiwaBot Pro</span>{isPro && <span className="pill ghost"><Icon name="check" size={14} /> {t(lang, "currentPlan")}</span>}</div>
        <div className="small" style={{ opacity: .92, marginTop: 6, lineHeight: 1.6 }}>{t(lang, "featPro")}</div>
        {loading && <div style={{ marginTop: 12 }}><Spinner /></div>}
        {!loading && !isPro && offers.length > 0 && (
          <div className="stack" style={{ marginTop: 12, gap: 8 }}>
            {offers.map((o) => (
              <button key={o.id} className="btn block" style={{ background: "#fff", color: "var(--text)", justifyContent: "space-between" }} disabled={busy !== null} onClick={() => buy(o)}>
                <span>{termLabel(o.term)}{o.term === "yearly" ? <span className="pill orange" style={{ marginInlineStart: 8, padding: "2px 8px", fontSize: 10 }}>{t(lang, "bestValue")}</span> : null}</span>
                <span>{busy === o.id ? <Spinner size={16} /> : o.priceString}</span>
              </button>
            ))}
          </div>
        )}
        {!loading && !isPro && available && offers.length === 0 && !err && <div className="small" style={{ marginTop: 10, opacity: .9 }}>{t(lang, "noOffers")}</div>}
      </div>

      {!available && <div className="card soft small muted">{t(lang, "billingUnavailable")}</div>}
      {err && <div className="error-box">{err}</div>}
      <div className="small muted" style={{ textAlign: "center" }}>{t(lang, "fairUse")}</div>
      {available && !isPro && <button className="btn light block" disabled={busy !== null} onClick={native}>{busy === "native" ? <Spinner /> : t(lang, "seeAllPlans")}</button>}
      {available && <button className="btn light block" disabled={busy !== null} onClick={doRestore}>{busy === "restore" ? <Spinner /> : t(lang, "restore")}</button>}
    </div>
  );
}
