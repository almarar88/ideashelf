import type { FinancialModel } from "@/types";

export interface Projection {
  years: { year: number; revenue: number; cost: number; ebit: number; tax: number; cashflow: number; cumulative: number }[];
  npv: number;
  irr: number | null; // percent
  paybackYears: number | null;
  breakEvenUnitsMonthly: number | null;
  roi: number; // percent, total net / capex
  totalRevenue: number;
  totalProfit: number;
}

/** Deterministic financial engine. AI proposes assumptions; this function does the math. */
export function project(m: FinancialModel): Projection {
  const years = m.revenueByYear.length;
  const flows: number[] = [-m.capex];
  const rows: Projection["years"] = [];
  let cumulative = -m.capex;
  let cost = m.opexMonthly * 12;
  let totalRevenue = 0;
  let totalProfit = 0;
  for (let i = 0; i < years; i++) {
    const revenue = m.revenueByYear[i] ?? 0;
    if (i > 0) cost = cost * (1 + m.costGrowthPct / 100);
    const ebit = revenue - cost;
    const tax = ebit > 0 ? ebit * (m.taxPct / 100) : 0;
    const cashflow = ebit - tax;
    cumulative += cashflow;
    flows.push(cashflow);
    totalRevenue += revenue;
    totalProfit += cashflow;
    rows.push({ year: i + 1, revenue, cost, ebit, tax, cashflow, cumulative });
  }
  const r = m.discountRatePct / 100;
  const npv = flows.reduce((acc, f, t) => acc + f / Math.pow(1 + r, t), 0);
  const irr = computeIRR(flows);
  let paybackYears: number | null = null;
  let cum = -m.capex;
  for (let i = 0; i < rows.length; i++) {
    const prev = cum;
    cum += rows[i].cashflow;
    if (cum >= 0 && rows[i].cashflow > 0) {
      paybackYears = i + (-prev / rows[i].cashflow);
      break;
    }
  }
  let breakEvenUnitsMonthly: number | null = null;
  if (m.unitPrice && m.unitCost !== undefined && m.unitPrice > m.unitCost) {
    const fixed = m.fixedCostsMonthly ?? m.opexMonthly;
    breakEvenUnitsMonthly = fixed / (m.unitPrice - m.unitCost);
  }
  const roi = m.capex > 0 ? (totalProfit / m.capex) * 100 : 0;
  return { years: rows, npv, irr, paybackYears, breakEvenUnitsMonthly, roi, totalRevenue, totalProfit };
}

export function computeIRR(flows: number[]): number | null {
  const npvAt = (rate: number) => flows.reduce((acc, f, t) => acc + f / Math.pow(1 + rate, t), 0);
  let lo = -0.99, hi = 10;
  if (npvAt(lo) * npvAt(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = npvAt(mid);
    if (Math.abs(v) < 1e-6) return mid * 100;
    if (npvAt(lo) * v < 0) hi = mid; else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/** Apply sensitivity multipliers to a model without mutating it. */
export function applySensitivity(m: FinancialModel, s: { revenue: number; cost: number; capex: number; discount: number }): FinancialModel {
  return {
    ...m,
    capex: m.capex * (1 + s.capex / 100),
    opexMonthly: m.opexMonthly * (1 + s.cost / 100),
    revenueByYear: m.revenueByYear.map((v) => v * (1 + s.revenue / 100)),
    discountRatePct: m.discountRatePct + s.discount,
  };
}

/** Overall study score 0-100 from dimension scores. */
export function overallScore(s: { market: number; technical: number; financial: number; legal: number; strategic: number }): number {
  const w = { market: 0.25, technical: 0.15, financial: 0.3, legal: 0.1, strategic: 0.2 };
  return Math.round(s.market * w.market + s.technical * w.technical + s.financial * w.financial + s.legal * w.legal + s.strategic * w.strategic);
}
