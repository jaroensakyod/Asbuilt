// Pure tender calculations (no React, no "@/"): BOQ totals, Factor F and ราคากลาง,
// ค่า K price escalation with the ±threshold rule, daily liquidated damages, win rate.
// Unit-tested in tests/tender. Legal numbers come in as parameters (settings record).

import type { BoqLine, FactorRow, KFormula, Tender } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;
/** cut (not round) to n decimals — used for ค่า K */
export const trunc = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.trunc(n * f + (n >= 0 ? 1e-9 : -1e-9)) / f;
};

// ---------- BOQ ----------

export const lineCost = (l: Pick<BoqLine, "qty" | "material" | "labour">) => l.qty * (l.material + l.labour);
export function boqTotals(lines: BoqLine[]) {
  let material = 0;
  let labour = 0;
  let noF = 0;
  for (const l of lines) {
    if (l.noF) noF += lineCost(l);
    else {
      material += l.qty * l.material;
      labour += l.qty * l.labour;
    }
  }
  return { material: r2(material), labour: r2(labour), direct: r2(material + labour), noF: r2(noF), total: r2(material + labour + noF) };
}
export function groupTotals(lines: BoqLine[]) {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.group, (m.get(l.group) ?? 0) + lineCost(l));
  return [...m.entries()].map(([group, cost]) => ({ group, cost: r2(cost) }));
}

// ---------- Factor F ----------

/** Factor F for a direct cost, linear interpolation between table rows (clamped at both ends) */
export function factorF(table: FactorRow[], cost: number): number {
  const t = [...table].sort((a, b) => a.cost - b.cost);
  if (!t.length) return 1;
  if (cost <= t[0].cost) return t[0].factor;
  const last = t[t.length - 1];
  if (cost >= last.cost) return last.factor;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1];
    const b = t[i];
    if (cost <= b.cost) return trunc(a.factor + ((cost - a.cost) * (b.factor - a.factor)) / (b.cost - a.cost), 4);
  }
  return last.factor;
}

/** government estimate: direct cost × Factor F, plus items outside F with VAT only */
export function medianPrice(lines: BoqLine[], table: FactorRow[], vatPct: number, override?: number) {
  const t = boqTotals(lines);
  const f = override ?? factorF(table, t.direct);
  const withF = r2(t.direct * f);
  const outside = r2(t.noF * (1 + vatPct / 100));
  return { direct: t.direct, factor: f, withF, outside, total: r2(withF + outside) };
}

/** our price: cost × (1 + markup) + VAT */
export function bidFromMarkup(lines: BoqLine[], markupPct: number, vatPct: number) {
  const cost = boqTotals(lines).total;
  const beforeVat = r2(cost * (1 + markupPct / 100));
  return { cost, beforeVat, vat: r2(beforeVat * (vatPct / 100)), total: r2(beforeVat * (1 + vatPct / 100)) };
}
export const bidPriceOf = (t: Pick<Tender, "lines" | "markupPct" | "vatPct" | "bidPrice">) => t.bidPrice ?? bidFromMarkup(t.lines, t.markupPct, t.vatPct).total;

/** % of bid above (+) or below (−) the reference price */
export const vsPct = (bid: number, ref: number) => (ref ? r2(((bid - ref) / ref) * 100) : 0);

// ---------- ค่า K ----------

export type KResult = { k: number; ratios: { sym: string; coef: number; ratio: number; part: number }[]; missing: string[] };
/** K = constant + Σ coef × (index_t / index_0); ratios and K cut to `decimals` */
export function kValue(f: KFormula, idxT: Record<string, number> | undefined, idx0: Record<string, number> | undefined, decimals = 3): KResult {
  const ratios: KResult["ratios"] = [];
  const missing: string[] = [];
  let k = f.constant;
  for (const t of f.terms) {
    const a = idxT?.[t.sym];
    const b = idx0?.[t.sym];
    if (!a || !b) {
      missing.push(t.sym);
      continue;
    }
    const ratio = trunc(a / b, decimals);
    const part = trunc(t.coef * ratio, decimals);
    ratios.push({ sym: t.sym, coef: t.coef, ratio, part });
    k += part;
  }
  return { k: trunc(k, decimals), ratios, missing };
}

/**
 * Escalation payable (+) or deductible (−) for an installment amount: only the part of K beyond
 * 1 ± threshold counts. Returns 0 inside the band.
 */
export function kAdjustment(k: number, amount: number, thresholdPct: number) {
  const th = thresholdPct / 100;
  const upper = 1 + th;
  const lower = 1 - th;
  if (k > upper) return { applies: true, kNet: trunc(k - upper, 4), amount: r2(amount * (k - upper)) };
  if (k < lower) return { applies: true, kNet: trunc(k - lower, 4), amount: r2(amount * (k - lower)) };
  return { applies: false, kNet: 0, amount: 0 };
}

/** formula-sum sanity check: constant + coefficients should equal 1.00 */
export const formulaWeight = (f: KFormula) => r2(f.constant + f.terms.reduce((s, t) => s + t.coef, 0));

// ---------- liquidated damages ----------

const DAY = 86400000;
export const daysLate = (finish: string, actualOrToday: string) => Math.max(0, Math.round((Date.parse(actualOrToday) - Date.parse(finish)) / DAY));
/** daily penalty = max(value × rate%, minimum); flags when the total reaches 10% of the contract */
export function penalty(value: number, ratePct: number, days: number, minPerDay = 0) {
  const perDay = r2(Math.max((value * ratePct) / 100, minPerDay));
  const total = r2(perDay * Math.max(0, days));
  const pct = value ? r2((total / value) * 100) : 0;
  return { perDay, total, pct, overTen: pct >= 10 };
}

/** bond amount as % of a base (bid bond on budget/ราคากลาง, performance bond on contract value) */
export const bondAmount = (base: number, pct: number) => Math.round((base * pct) / 100);

// ---------- pipeline stats ----------

export function winStats(list: Pick<Tender, "status" | "bidPrice" | "award" | "source">[]) {
  const decided = list.filter((t) => t.status === "won" || t.status === "lost");
  const won = decided.filter((t) => t.status === "won");
  return {
    decided: decided.length,
    won: won.length,
    rate: decided.length ? r2((won.length / decided.length) * 100) : 0,
    valueWon: won.reduce((s, t) => s + (t.award?.value ?? t.bidPrice ?? 0), 0),
    bySource: (["private", "egp"] as const).map((src) => {
      const d = decided.filter((t) => t.source === src);
      const w = d.filter((t) => t.status === "won").length;
      return { source: src, decided: d.length, won: w, rate: d.length ? r2((w / d.length) * 100) : 0 };
    }),
  };
}

/** last day to file the K claim: claimDays after the final installment was paid */
export const kClaimDeadline = (finalPaid: string, claimDays: number) => new Date(Date.parse(finalPaid) + claimDays * DAY).toISOString().slice(0, 10);
