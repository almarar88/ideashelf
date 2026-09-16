import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { makeT } from "./i18n";
import type { PartnerType, PartnerStatus, DealStage, AgreementType, AgreementStatus, Priority } from "@/types";
import type { TKey } from "./i18n";

export function useT() {
  const lang = useStore((s) => s.settings.lang);
  const t = useMemo(() => makeT(lang), [lang]);
  return { t, lang, dir: lang === "ar" ? "rtl" : "ltr" as "rtl" | "ltr" };
}

export const partnerTypeKey = (v: PartnerType): TKey => `t_${v}` as TKey;
export const partnerStatusKey = (v: PartnerStatus): TKey => `s_${v}` as TKey;
export const stageKey = (v: DealStage): TKey => `st_${v}` as TKey;
export const agreementTypeKey = (v: AgreementType): TKey => `a_${v}` as TKey;
export const agreementStatusKey = (v: AgreementStatus): TKey => `as_${v}` as TKey;
export const priorityKey = (v: Priority): TKey => v as TKey;

export const PARTNER_TYPES: PartnerType[] = ["strategic", "sponsor", "supplier", "government", "ngo", "academic", "media", "technology"];
export const PARTNER_STATUSES: PartnerStatus[] = ["prospect", "active", "paused", "ended"];
export const STAGES: DealStage[] = ["lead", "contact", "proposal", "negotiation", "signed", "active", "renewal", "lost"];
export const AGREEMENT_TYPES: AgreementType[] = ["mou", "contract", "sponsorship", "nda", "sla"];
export const AGREEMENT_STATUSES: AgreementStatus[] = ["draft", "review", "signed", "expired", "terminated"];
export const PRIORITIES: Priority[] = ["urgent", "medium", "normal"];

