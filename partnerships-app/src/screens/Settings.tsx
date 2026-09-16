import { useState } from "react";
import { Button, Card, Field, Header, Input, Pill, Select, Spinner } from "@/components/ui";
import { useT } from "@/lib/useT";
import { useStore } from "@/store/useStore";
import { useApp, useJob } from "@/lib/app-context";
import { describeError, hasAI, testKey } from "@/lib/ai";

const MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-fable-5-1", "claude-opus-4-8", "claude-haiku-4-5"];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const s = useStore((x) => x.settings);
  const { setSettings, loadDemo, clearAll, importAll } = useStore();
  const { toast } = useApp();
  const [key, setKey] = useState(s.apiKey);
  const test = useJob<boolean>();

  const exportBackup = () => {
    const st = useStore.getState();
    const data = JSON.stringify({ partners: st.partners, deals: st.deals, agreements: st.agreements, tasks: st.tasks, meetings: st.meetings, studies: st.studies, exportedAt: new Date().toISOString() });
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `partnerhub-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const importBackup = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json";
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { importAll(JSON.parse(await f.text())); toast("✓"); } catch { toast(t("error")); } };
    inp.click();
  };

  return (
    <div className="pb-32">
      <Header title={t("settings")} onBack={onBack} />
      <Card dark className="mb-3">
        <div className="flex items-center justify-between mb-3"><div className="font-bold">{t("aiStatus")}</div><Pill tone={hasAI(s) ? "ok" : "medium"}>{hasAI(s) ? t("aiOn") : t("aiDemo")}</Pill></div>
        <Field label={t("apiKey")} hint={t("apiKeyHint")}><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" /></Field>
        <Field label={t("model")}><Select value={s.model} onChange={(e) => setSettings({ model: e.target.value })}>{MODELS.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
        <div className="flex gap-2">
          <Button small onClick={() => { setSettings({ apiKey: key }); toast("✓"); }}>{t("save")}</Button>
          <Button small variant="ghost" disabled={!key.trim()} onClick={() => { setSettings({ apiKey: key }); test.run(() => testKey({ ...s, apiKey: key }), (e) => describeError(e, lang)); }}>{t("testKey")}</Button>
          {test.loading && <Spinner />}
          {test.data === true && <Pill tone="ok">✓</Pill>}
        </div>
        {test.error && <div className="text-urgent text-[12px] mt-2">{test.error}</div>}
      </Card>
      <Card dark className="mb-3">
        <Field label={t("language")}><Select value={s.lang} onChange={(e) => setSettings({ lang: e.target.value as "ar" | "en" })}><option value="ar">العربية</option><option value="en">English</option></Select></Field>
        <Field label={t("yourName")}><Input value={s.userName} onChange={(e) => setSettings({ userName: e.target.value })} /></Field>
        <Field label={t("orgName")}><Input value={s.orgName} onChange={(e) => setSettings({ orgName: e.target.value })} /></Field>
        <Field label={t("defaultCurrency")}><Select value={s.currency} onChange={(e) => setSettings({ currency: e.target.value })}>{["AED", "SAR", "USD", "EUR", "KWD", "QAR", "BHD", "OMR", "EGP", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        <label className="flex items-center gap-2 text-[14px] bg-white/5 rounded-2xl p-3"><input type="checkbox" checked={s.notifications} onChange={async (e) => { const on = e.target.checked; setSettings({ notifications: on }); if (on) { const { enableNotifications } = await import("@/lib/notifications"); const ok = await enableNotifications(); toast(ok ? t("notificationsOn") : t("error")); } }} className="h-5 w-5 accent-white" /><span>🔔 {t("enableNotifications")}</span></label>
      </Card>
      <Card dark>
        <div className="grid grid-cols-2 gap-2">
          <Button small variant="ghost" onClick={exportBackup}>{t("exportBackup")}</Button>
          <Button small variant="ghost" onClick={importBackup}>{t("importBackup")}</Button>
          <Button small variant="ghost" onClick={() => { loadDemo(); toast("✓"); }}>{t("resetDemo")}</Button>
          <Button small variant="danger" onClick={() => { if (confirm(t("confirmClear"))) clearAll(); }}>{t("clearAll")}</Button>
        </div>
        <div className="text-[11px] text-white/40 mt-3">PartnerHub v1.0 · {lang === "ar" ? "البيانات محفوظة محلياً على الجهاز" : "Data is stored locally on this device"}</div>
      </Card>
    </div>
  );
}
