import type { Agreement, Deal, Lang, Meeting, Partner, Study, Task } from "@/types";
import { currencySymbol, fmtDate } from "./ids";
import { overallScore, project } from "./finance";
import type { Sheet } from "./export";

const L = (lang: Lang) => (a: string, e: string) => (lang === "ar" ? a : e);

export function studyToMarkdown(s: Study, lang: Lang): string {
  const r = s.result!; const p = project(r.financial); const t = L(lang); const c = currencySymbol(s.input.currency);
  return [
    `## ${t("الملخص التنفيذي", "Executive summary")}`, r.executiveSummary,
    ``, `## ${t("التوصية", "Verdict")}: ${r.verdict.toUpperCase()} (${overallScore(r.scores)}/100)`, r.verdictReason,
    ``, `## ${t("التقييم", "Scores")}`, `| ${t("البعد", "Dimension")} | ${t("الدرجة", "Score")} |`, `|---|---|`, `| ${t("السوق", "Market")} | ${r.scores.market} |`, `| ${t("الفني", "Technical")} | ${r.scores.technical} |`, `| ${t("المالي", "Financial")} | ${r.scores.financial} |`, `| ${t("القانوني", "Legal")} | ${r.scores.legal} |`, `| ${t("الاستراتيجي", "Strategic")} | ${r.scores.strategic} |`,
    ``, `## ${t("دراسة السوق", "Market study")}`, `- ${t("الحجم", "Size")}: ${r.market.size}`, `- ${t("النمو", "Growth")}: ${r.market.growth}`, `- ${t("الشرائح", "Segments")}: ${r.market.segments.join("، ")}`, `### ${t("المنافسون", "Competitors")}`, ...r.market.competitors.map((x) => `- **${x.name}**: ${x.note}`), `### ${t("محركات الطلب", "Demand drivers")}`, ...r.market.demandDrivers.map((x) => `- ${x}`),
    ``, `## ${t("الدراسة الفنية", "Technical study")}`, ...r.technical.requirements.map((x) => `- ${x}`), `### ${t("الجدول الزمني", "Timeline")} (${r.technical.timelineMonths} ${t("شهر", "months")})`, ...r.technical.milestones.map((m) => `- ${t("الشهر", "Month")} ${m.month}: ${m.name}`), `### ${t("الموارد", "Resources")}`, ...r.technical.resources.map((x) => `- ${x}`),
    ``, `## ${t("الجوانب القانونية", "Legal & regulatory")}`, ...r.legal.map((x) => `- ${x}`),
    ``, `## ${t("التشغيل", "Operations")}`, ...r.operations.map((x) => `- ${x}`),
    ``, `## ${t("الدراسة المالية", "Financial study")}`,
    `| ${t("المؤشر", "Metric")} | ${t("القيمة", "Value")} |`, `|---|---|`, `| ${t("رأس المال", "CAPEX")} | ${r.financial.capex.toLocaleString("en-US")} ${c} |`, `| ${t("التشغيل الشهري", "Monthly OPEX")} | ${r.financial.opexMonthly.toLocaleString("en-US")} ${c} |`, `| ${t("معدل الخصم", "Discount rate")} | ${r.financial.discountRatePct}% |`, `| NPV | ${Math.round(p.npv).toLocaleString("en-US")} ${c} |`, `| IRR | ${p.irr === null ? "—" : p.irr.toFixed(1) + "%"} |`, `| ${t("فترة الاسترداد", "Payback")} | ${p.paybackYears === null ? "—" : p.paybackYears.toFixed(1) + " " + t("سنة", "yrs")} |`, `| ROI | ${p.roi.toFixed(0)}% |`,
    ``, `| ${t("السنة", "Year")} | ${t("الإيرادات", "Revenue")} | ${t("التكاليف", "Costs")} | ${t("التدفق النقدي", "Cash flow")} | ${t("التراكمي", "Cumulative")} |`, `|---|---|---|---|---|`, ...p.years.map((y) => `| ${y.year} | ${Math.round(y.revenue).toLocaleString("en-US")} | ${Math.round(y.cost).toLocaleString("en-US")} | ${Math.round(y.cashflow).toLocaleString("en-US")} | ${Math.round(y.cumulative).toLocaleString("en-US")} |`),
    ``, `## SWOT`, `- **${t("القوة", "Strengths")}**: ${r.swot.strengths.join("؛ ")}`, `- **${t("الضعف", "Weaknesses")}**: ${r.swot.weaknesses.join("؛ ")}`, `- **${t("الفرص", "Opportunities")}**: ${r.swot.opportunities.join("؛ ")}`, `- **${t("التهديدات", "Threats")}**: ${r.swot.threats.join("؛ ")}`,
    ``, `## ${t("سجل المخاطر", "Risk register")}`, `| ${t("الخطر", "Risk")} | ${t("الاحتمال", "P")} | ${t("الأثر", "I")} | ${t("التخفيف", "Mitigation")} |`, `|---|---|---|---|`, ...r.risks.map((k) => `| ${k.title} | ${k.probability} | ${k.impact} | ${k.mitigation} |`),
    ``, `## ${t("نماذج الشراكة المقترحة", "Partnership models")}`, ...r.partnershipModels.map((m) => `- **${m.name}** (${m.fit}/100): ${m.description}`),
    ``, `## ${t("الخطوات التالية", "Next steps")}`, ...r.nextSteps.map((x, i) => `${i + 1}. ${x}`),
    ``, `## ${t("مؤشرات الأداء", "KPIs")}`, ...r.kpis.map((x) => `- ${x}`),
  ].join("\n");
}

export const studyMeta = (s: Study, lang: Lang) => `${s.input.sector} · ${s.input.country} · ${s.input.horizonYears} ${lang === "ar" ? "سنوات" : "years"} · ${s.generatedBy === "ai" ? (lang === "ar" ? "مولّد بالذكاء الاصطناعي" : "AI generated") : (lang === "ar" ? "نموذج تجريبي" : "Demo sample")} · ${fmtDate(s.updatedAt)}`;

export function studyToSheets(s: Study, lang: Lang): Sheet[] {
  const r = s.result!; const p = project(r.financial); const t = L(lang);
  return [
    { name: t("الافتراضات", "Assumptions"), rows: [[t("البند", "Item"), t("القيمة", "Value")], [t("رأس المال", "CAPEX"), r.financial.capex], [t("التشغيل الشهري", "Monthly OPEX"), r.financial.opexMonthly], [t("نمو التكاليف %", "Cost growth %"), r.financial.costGrowthPct], [t("معدل الخصم %", "Discount rate %"), r.financial.discountRatePct], [t("الضريبة %", "Tax %"), r.financial.taxPct], [t("سعر الوحدة", "Unit price"), r.financial.unitPrice ?? ""], [t("تكلفة الوحدة", "Unit cost"), r.financial.unitCost ?? ""], [], ["NPV", Math.round(p.npv)], ["IRR %", p.irr === null ? "" : Number(p.irr.toFixed(2))], [t("فترة الاسترداد (سنوات)", "Payback (years)"), p.paybackYears === null ? "" : Number(p.paybackYears.toFixed(2))], ["ROI %", Number(p.roi.toFixed(1))], [t("نقطة التعادل (وحدة/شهر)", "Break-even (units/mo)"), p.breakEvenUnitsMonthly === null ? "" : Math.ceil(p.breakEvenUnitsMonthly)]] },
    { name: t("التوقعات", "Projection"), rows: [[t("السنة", "Year"), t("الإيرادات", "Revenue"), t("التكاليف", "Costs"), "EBIT", t("الضريبة", "Tax"), t("التدفق النقدي", "Cash flow"), t("التراكمي", "Cumulative")], ...p.years.map((y) => [y.year, Math.round(y.revenue), Math.round(y.cost), Math.round(y.ebit), Math.round(y.tax), Math.round(y.cashflow), Math.round(y.cumulative)])] },
    { name: t("التقييم", "Scores"), rows: [[t("البعد", "Dimension"), t("الدرجة", "Score")], [t("السوق", "Market"), r.scores.market], [t("الفني", "Technical"), r.scores.technical], [t("المالي", "Financial"), r.scores.financial], [t("القانوني", "Legal"), r.scores.legal], [t("الاستراتيجي", "Strategic"), r.scores.strategic], [t("الإجمالي", "Overall"), overallScore(r.scores)], [t("التوصية", "Verdict"), r.verdict]] },
    { name: t("المخاطر", "Risks"), rows: [[t("الخطر", "Risk"), t("الاحتمال", "Probability"), t("الأثر", "Impact"), t("الدرجة", "Score"), t("التخفيف", "Mitigation")], ...r.risks.map((k) => [k.title, k.probability, k.impact, k.probability * k.impact, k.mitigation])] },
    { name: t("الخطوات", "Next steps"), rows: [["#", t("الخطوة", "Step")], ...r.nextSteps.map((x, i) => [i + 1, x])] },
  ];
}

export function partnersToSheet(partners: Partner[], deals: Deal[], agreements: Agreement[], lang: Lang): Sheet {
  const t = L(lang);
  return { name: t("الشركاء", "Partners"), rows: [[t("الاسم", "Name"), t("النوع", "Type"), t("الحالة", "Status"), t("القطاع", "Sector"), t("الدولة", "Country"), t("آخر تواصل", "Last contact"), t("المسؤول", "Owner"), t("جهة الاتصال", "Contact"), t("البريد", "Email"), t("الهاتف", "Phone"), t("الفرص", "Deals"), t("قيمة الفرص", "Deal value"), t("الاتفاقيات", "Agreements"), t("الوسوم", "Tags"), t("ملاحظات", "Notes")], ...partners.map((p) => [p.name, p.type, p.status, p.sector, p.country, p.lastContactAt, p.ownerName, p.contacts[0]?.name ?? "", p.contacts[0]?.email ?? "", p.contacts[0]?.phone ?? "", deals.filter((d) => d.partnerId === p.id).length, deals.filter((d) => d.partnerId === p.id && d.stage !== "lost").reduce((a, d) => a + d.value, 0), agreements.filter((a) => a.partnerId === p.id).length, p.tags.join(", "), p.notes])] };
}
export function dealsToSheet(deals: Deal[], partners: Partner[], lang: Lang): Sheet {
  const t = L(lang);
  return { name: t("المسار", "Pipeline"), rows: [[t("الفرصة", "Deal"), t("الشريك", "Partner"), t("المرحلة", "Stage"), t("القيمة", "Value"), t("العملة", "Currency"), t("الاحتمالية %", "Probability %"), t("القيمة المرجحة", "Weighted"), t("الإغلاق المتوقع", "Expected close"), t("الخطوة التالية", "Next step"), t("آخر تحديث", "Updated")], ...deals.map((d) => [d.title, partners.find((p) => p.id === d.partnerId)?.name ?? "", d.stage, d.value, d.currency, d.probability, Math.round(d.value * d.probability / 100), d.expectedCloseAt, d.nextStep, d.updatedAt])] };
}
export function tasksToSheet(tasks: Task[], partners: Partner[], lang: Lang): Sheet {
  const t = L(lang);
  return { name: t("المهام", "Tasks"), rows: [[t("المهمة", "Task"), t("الأولوية", "Priority"), t("الحالة", "Status"), t("الاستحقاق", "Due"), t("من", "From"), t("إلى", "To"), t("المكلف", "Assignee"), t("الشريك", "Partner")], ...tasks.map((x) => [x.title, x.priority, x.status, x.dueAt, x.startTime ?? "", x.endTime ?? "", x.assignee, partners.find((p) => p.id === x.partnerId)?.name ?? ""])] };
}
export function agreementsToSheet(agreements: Agreement[], partners: Partner[], lang: Lang): Sheet {
  const t = L(lang);
  return { name: t("الاتفاقيات", "Agreements"), rows: [[t("الاتفاقية", "Agreement"), t("الشريك", "Partner"), t("النوع", "Type"), t("الحالة", "Status"), t("البداية", "Start"), t("النهاية", "End"), t("القيمة", "Value"), t("تجديد تلقائي", "Auto-renew"), t("مهلة الإشعار", "Notice days"), t("التزامات مفتوحة", "Open obligations")], ...agreements.map((a) => [a.title, partners.find((p) => p.id === a.partnerId)?.name ?? "", a.type, a.status, a.startAt, a.endAt, a.value, a.autoRenew ? "✓" : "", a.noticeDays, a.obligations.filter((o) => !o.done).map((o) => o.text).join(" | ")])] };
}
export function meetingsToSheet(meetings: Meeting[], partners: Partner[], lang: Lang): Sheet {
  const t = L(lang);
  return { name: t("الاجتماعات", "Meetings"), rows: [[t("الاجتماع", "Meeting"), t("التاريخ", "Date"), t("الشريك", "Partner"), t("الحضور", "Attendees"), t("الملخص", "Summary"), t("بنود العمل", "Action items")], ...meetings.map((m) => [m.title, m.at, partners.find((p) => p.id === m.partnerId)?.name ?? "", m.attendees.join(", "), m.summary ?? "", (m.actionItems ?? []).map((a) => a.text).join(" | ")])] };
}
