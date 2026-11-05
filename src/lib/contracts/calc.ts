// Contract money math: payment certificates (client IPC and subcontract), retention with a cap,
// pro-rata advance recovery, variation totals, progress weighting and cash-flow bucketing.
// Pure: no React, no "@/" imports (tested with node --test).
import { addMonths, r2, sum } from "../accounting/money";

// ---------- retention and advance ----------

/**
 * Retention deducted on this certificate: pct of the work this period, never more than the cap
 * still available and never releasing more than was held (a negative period re-measures down).
 */
export function retentionFor(thisPeriod: number, pct: number, cap: number, heldBefore: number) {
  const raw = r2((thisPeriod * (Number(pct) || 0)) / 100);
  const room = Math.max(0, r2(cap - heldBefore));
  return r2(Math.min(room, Math.max(-heldBefore, raw)));
}

/** Advance recovered pro rata to the work certified: advance × gross / contract value, less what was recovered before. */
export function advanceRecoveryFor(advance: number, grossToDate: number, contractValue: number, recoveredBefore: number) {
  if (!(advance > 0) || !(contractValue > 0)) return 0;
  const target = Math.min(advance, r2((advance * Math.max(0, grossToDate)) / contractValue));
  return Math.max(0, r2(target - recoveredBefore));
}

export type CertInput = {
  grossToDate: number;
  previous: number;
  contractValue: number;
  retentionPct: number;
  /** retention cap as % of the contract value */
  retentionCapPct: number;
  retentionBefore: number;
  advance: number;
  advanceBefore: number;
  backCharges?: number;
  vatRate: number;
  whtRate: number;
  /**
   * true: withholding on the whole base (subcontract bills — withheld when we pay);
   * false: on the base less retention (the customer withholds on what it pays now).
   */
  whtOnRetention?: boolean;
};
export type CertCalc = {
  thisPeriod: number;
  retention: number;
  retentionCap: number;
  retentionToDate: number;
  advanceRecovery: number;
  advanceToDate: number;
  backCharges: number;
  /** amount invoiced before VAT: this period − advance recovery − back-charges */
  base: number;
  vat: number;
  wht: number;
  /** payable now: base + VAT − retention − withholding */
  net: number;
};

export function certCalc(i: CertInput): CertCalc {
  const thisPeriod = r2(i.grossToDate - i.previous);
  const retentionCap = r2((i.contractValue * (Number(i.retentionCapPct) || 0)) / 100);
  const retention = retentionFor(thisPeriod, i.retentionPct, retentionCap, i.retentionBefore);
  const advanceRecovery = advanceRecoveryFor(i.advance, i.grossToDate, i.contractValue, i.advanceBefore);
  const backCharges = r2(i.backCharges ?? 0);
  const base = r2(thisPeriod - advanceRecovery - backCharges);
  const vat = r2((base * (Number(i.vatRate) || 0)) / 100);
  const whtBase = i.whtOnRetention ? base : r2(base - retention);
  const wht = Math.max(0, r2((whtBase * (Number(i.whtRate) || 0)) / 100));
  const net = r2(base + vat - retention - wht);
  return { thisPeriod, retention, retentionCap, retentionToDate: r2(i.retentionBefore + retention), advanceRecovery, advanceToDate: r2(i.advanceBefore + advanceRecovery), backCharges, base, vat, wht, net };
}

/** Running totals of a chain of certificates (oldest first) before certificate `no`. */
export function priorTotals(certs: { no: number; grossToDate: number; retention: number; advanceRecovery: number; backCharges: number; status: string }[], no: number) {
  const prior = certs.filter((c) => c.no < no).sort((a, b) => a.no - b.no);
  const last = prior.at(-1);
  return {
    previous: last?.grossToDate ?? 0,
    retention: sum(prior.map((c) => c.retention)),
    advance: sum(prior.map((c) => c.advanceRecovery)),
    backCharges: sum(prior.map((c) => c.backCharges)),
  };
}

// ---------- variations and contract value ----------

export const lineAmount = (l: { qty: number; unitPrice: number }) => r2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0));
export const lineCost = (l: { qty: number; unitCost: number }) => r2((Number(l.qty) || 0) * (Number(l.unitCost) || 0));
export function voTotals(lines: { qty: number; unitPrice: number; unitCost: number }[]) {
  return { amount: sum(lines.map(lineAmount)), cost: sum(lines.map(lineCost)) };
}
/** Original contract value plus approved variations of the project (optionally those approved by `asOf`). */
export function contractValueOf(base: number, vos: { projectId: string; status: string; amount: number; approvedAt?: string }[], projectId: string, asOf?: string) {
  return r2(base + sum(vos.filter((v) => v.projectId === projectId && v.status === "approved" && (!asOf || (v.approvedAt ?? "") <= asOf)).map((v) => v.amount)));
}

/** Budget lines after adding a variation's cost per cost code (merging into existing codes). */
export function mergeBudgetLines<C extends string>(lines: { costCode: C; amount: number }[], add: { costCode: C; amount: number }[], sign = 1) {
  const out = lines.map((l) => ({ ...l }));
  for (const a of add) {
    const x = out.find((l) => l.costCode === a.costCode);
    if (x) x.amount = r2(x.amount + sign * a.amount);
    else out.push({ costCode: a.costCode, amount: r2(sign * a.amount) });
  }
  return out;
}
/** Cost of variation lines per cost code (lines without a code go to "90"). */
export function costByCode<C extends string>(lines: { qty: number; unitCost: number; costCode?: C }[], fallback: C) {
  const m = new Map<C, number>();
  for (const l of lines) m.set(l.costCode ?? fallback, r2((m.get(l.costCode ?? fallback) ?? 0) + lineCost(l)));
  return [...m.entries()].filter(([, v]) => v).map(([costCode, amount]) => ({ costCode, amount }));
}

/**
 * Spread an omission (negative amount) over unpaid installments, latest first, never below zero.
 * Returns the reductions applied and what could not be absorbed.
 */
export function absorbOmission(open: { id: string; amount: number }[], omission: number) {
  let left = r2(Math.abs(omission));
  const out: { id: string; delta: number }[] = [];
  for (const i of [...open].reverse()) {
    if (left <= 0) break;
    const take = r2(Math.min(left, i.amount));
    if (take > 0) out.push({ id: i.id, delta: -take });
    left = r2(left - take);
  }
  return { deltas: out, left };
}

// ---------- progress ----------

/** % complete weighted by value over leaf tasks (summary tasks are skipped). Undefined when there are no tasks. */
export function weightedProgress(tasks: { id: string; parentId?: string; value: number; pct: number }[]) {
  if (!tasks.length) return undefined;
  const parents = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const leaves = tasks.filter((t) => !parents.has(t.id));
  const total = sum(leaves.map((t) => Math.max(0, t.value || 0)));
  if (total > 0) return r2(leaves.reduce((s, t) => s + Math.max(0, t.value || 0) * Math.min(100, Math.max(0, t.pct || 0)), 0) / total);
  return r2(leaves.reduce((s, t) => s + Math.min(100, Math.max(0, t.pct || 0)), 0) / leaves.length);
}

/** Gross value of measured subcontract work: Σ qty to date × rate. */
export function measuredGross(lines: { id: string; qty: number; rate: number }[], measured: { lineId: string; qtyToDate: number }[]) {
  return sum(lines.map((l) => (measured.find((m) => m.lineId === l.id)?.qtyToDate ?? 0) * l.rate));
}
export const subcontractValue = (lines: { qty: number; rate: number }[]) => sum(lines.map((l) => (Number(l.qty) || 0) * (Number(l.rate) || 0)));

// ---------- dates ----------

/** ISO date n months later (day clamped to the month end). */
export function addMonthsIso(iso: string, n: number) {
  const p = addMonths(iso.slice(0, 7), n);
  const [y, m] = p.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${p}-${String(Math.min(Number(iso.slice(8, 10)), last)).padStart(2, "0")}`;
}
export const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
/** Retention falls due after handover + the defects liability period (ป.พ.พ. ม.600). */
export const retentionDueDate = (handedOver: string | undefined, months: number) => (handedOver ? addMonthsIso(handedOver, months) : undefined);

// ---------- prequalification and rating ----------

export const prequalTotal = (p: Partial<Record<string, number>>) => Math.round(Object.values(p).reduce<number>((s, v) => s + (Number(v) || 0), 0));
/** Suggested result: ≥ 70 pass, 50–69 needs review, below 50 fail. */
export const prequalResult = (score: number): "approved" | "pending" | "suspended" => (score >= 70 ? "approved" : score >= 50 ? "pending" : "suspended");
export const ratingScore = (r: { quality: number; time: number; safety: number; cooperation: number }) => r2((r.quality + r.time + r.safety + r.cooperation) / 4);

// ---------- cash flow ----------

/** `n` months starting at `from` ("2026-11", …). */
export const monthsFrom = (from: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(from, i));

export type Flow = { date: string; amount: number };
/** Sum flows per month; anything dated before the first month (overdue) falls in the first month, after the last is dropped. */
export function bucketByMonth(flows: Flow[], months: string[]) {
  const out = months.map(() => 0);
  if (!months.length) return out;
  for (const f of flows) {
    const p = f.date.slice(0, 7);
    const i = p < months[0] ? 0 : months.indexOf(p);
    if (i >= 0) out[i] = r2(out[i] + f.amount);
  }
  return out;
}
/** Spread an amount evenly over the months from `from` to `to` that fall in the window (all in the first month when already late). */
export function spreadEven(amount: number, from: string, to: string, months: string[]): Flow[] {
  if (!months.length || !amount) return [];
  const a = (from.slice(0, 7) < months[0] ? months[0] : from.slice(0, 7)) as string;
  const b = to.slice(0, 7) < a ? a : to.slice(0, 7);
  const span: string[] = [];
  for (let p = a; p <= b; p = addMonths(p, 1)) span.push(p);
  const each = r2(amount / span.length);
  return span.map((p, i) => ({ date: `${p}-15`, amount: i === span.length - 1 ? r2(amount - each * (span.length - 1)) : each }));
}
export type CfRow = { period: string; inflow: number; outflow: number; net: number; cumulative: number; negative: boolean };
export function cashflowRows(months: string[], inflow: number[], outflow: number[], opening = 0): CfRow[] {
  let cum = opening;
  return months.map((period, i) => {
    const net = r2((inflow[i] ?? 0) - (outflow[i] ?? 0));
    cum = r2(cum + net);
    return { period, inflow: inflow[i] ?? 0, outflow: outflow[i] ?? 0, net, cumulative: cum, negative: cum < 0 };
  });
}
