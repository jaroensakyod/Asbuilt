// Project cost control: budget vs committed vs actual by cost code, forecast
// at completion, overrun alerts, risk ranking and S-curve series. Pure.

import { COST_CODES, type Budget, type CostCode, type CostEntry, type PayrollRun, type SupplierBill } from "../biz";
import { TODAY, type Project } from "../data";
import { CODES, codeEarned, fallbackBudget } from "./gen";
import { receivedByLine, isOpenPO } from "./store";
import type { GoodsReceipt, PurchaseOrder } from "./types";

export type CostCtx = {
  budgets: Budget[];
  costs: CostEntry[];
  pos: PurchaseOrder[];
  receipts: GoodsReceipt[];
  bills: SupplierBill[];
  payroll: PayrollRun[];
};

export type CodeRow = {
  code: CostCode;
  budget: number;
  committed: number;
  actual: number;
  expectedPct: number; // planned completion of this code at the current progress
  usedPct: number; // (actual + committed) / budget
  flag?: "over" | "warn";
};

export type Alert = { tone: "neg" | "warn"; text: string };

export type ProjectCost = {
  project: Project;
  budget: number;
  budgetSource: "estimate" | "fallback";
  contract: number;
  rows: CodeRow[];
  labour: number;
  actual: number;
  committed: number;
  forecast: number;
  variance: number; // budget − forecast (negative = overrun)
  margin: number; // contract − forecast
  marginPct: number;
  usedPct: number;
  /** simple actual / progress extrapolation, for comparison */
  runRate?: number;
  alerts: Alert[];
  risk: number;
  entries: CostEntry[];
  labourLines: { date: string; amount: number; ref: string; days?: number }[];
};

export function labourOf(projectId: string, runs: PayrollRun[]) {
  const out: { date: string; amount: number; ref: string; days?: number }[] = [];
  for (const r of runs) {
    if (r.status === "draft") continue;
    let amount = 0;
    let days = 0;
    for (const l of r.lines) {
      if (l.kind !== "daily" || l.projectId !== projectId) continue;
      amount += l.net + l.sso + l.wht; // total earnings, whatever the gross/ot split
      days += l.days ?? 0;
    }
    if (amount > 0) out.push({ date: r.payDate, amount, ref: r.id, days });
  }
  return out;
}

/** a cost code counts as over budget beyond this ratio (absorbs rounding and small price moves) */
const OVER_TOLERANCE = 1.03;
const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

export function projectCost(p: Project, ctx: CostCtx): ProjectCost {
  const bud = ctx.budgets.find((b) => b.projectId === p.id);
  const lines = bud?.lines?.length ? bud.lines : fallbackBudget(p);
  const budgetSource = bud?.lines?.length ? "estimate" : "fallback";
  const contract = bud?.contractValue || p.value * 1e6;

  const rowMap = new Map<CostCode, CodeRow>();
  const row = (c: CostCode) => {
    let r = rowMap.get(c);
    if (!r) rowMap.set(c, (r = { code: c, budget: 0, committed: 0, actual: 0, expectedPct: codeEarned(c, p.actual) * 100, usedPct: 0 }));
    return r;
  };
  for (const l of lines) row(l.costCode).budget += l.amount;

  const entries = ctx.costs.filter((e) => e.projectId === p.id && e.source !== "labour");
  for (const e of entries) row(e.costCode).actual += e.amount;

  for (const po of ctx.pos) {
    if (po.projectId !== p.id || !isOpenPO(po)) continue;
    if (po.kind === "service") {
      const billed = ctx.bills.filter((b) => b.poId === po.id && b.status !== "open").reduce((t, b) => t + b.subtotal, 0);
      row(po.costCode).committed += Math.max(0, po.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0) - billed);
    } else {
      const got = receivedByLine(po, ctx.receipts);
      row(po.costCode).committed += po.lines.reduce((t, l, i) => t + Math.max(0, l.qty - got[i]) * l.unitPrice, 0);
    }
  }
  // received service POs and subcontract claims not yet approved are still commitments
  for (const b of ctx.bills) {
    if (b.projectId !== p.id || b.status !== "open") continue;
    const po = b.poId ? ctx.pos.find((x) => x.id === b.poId) : undefined;
    if (po && (po.kind === "goods" || isOpenPO(po))) continue;
    row(b.costCode ?? "90").committed += b.subtotal;
  }

  const labourLines = labourOf(p.id, ctx.payroll);
  const labour = labourLines.reduce((t, l) => t + l.amount, 0);

  const rows = CODES.filter((c) => rowMap.has(c)).map((c) => {
    const r = rowMap.get(c)!;
    r.usedPct = pctOf(r.actual + r.committed, r.budget);
    if (r.budget > 0 && r.actual + r.committed > r.budget * OVER_TOLERANCE) r.flag = "over";
    else if (r.usedPct > 90 && r.usedPct > r.expectedPct + 10) r.flag = "warn";
    return r;
  });

  const budget = rows.reduce((t, r) => t + r.budget, 0);
  const actual = rows.reduce((t, r) => t + r.actual, 0) + labour;
  const committed = rows.reduce((t, r) => t + r.committed, 0);
  const prog = p.actual / 100;
  // forecast at completion: finished codes at actual + committed, running codes at no less than
  // their budget (more if already exceeded), site labour extrapolated by progress (actual / progress,
  // progress floored at 25% so early, front-loaded weeks do not explode the forecast)
  const forecast =
    rows.reduce((t, r) => t + (r.expectedPct >= 98 ? r.actual + r.committed : Math.max(r.budget, r.actual + r.committed)), 0) + labour / Math.max(prog, 0.25);
  const runRate = prog >= 0.1 ? actual / prog : undefined;
  const variance = budget - forecast;
  const margin = contract - forecast;
  const marginPct = pctOf(margin, contract);
  const usedPct = pctOf(actual + committed, budget);

  const alerts: Alert[] = [];
  if (forecast > budget * 1.005 && budget > 0) alerts.push({ tone: "neg", text: `คาดการณ์ต้นทุนเมื่อแล้วเสร็จเกินงบ ${pctOf(forecast - budget, budget).toFixed(1)}%` });
  for (const r of rows) {
    if (r.flag === "over") alerts.push({ tone: "neg", text: `${r.code} ${COST_CODES[r.code]} ใช้เกินงบ ${pctOf(r.actual + r.committed - r.budget, r.budget).toFixed(0)}%` });
    else if (r.flag === "warn") alerts.push({ tone: "warn", text: `${r.code} ${COST_CODES[r.code]} ใช้งบแล้ว ${r.usedPct.toFixed(0)}% ขณะที่งานควรเสร็จ ${r.expectedPct.toFixed(0)}%` });
  }
  if (p.status !== "planning" && usedPct > 90 && p.actual < 90) alerts.push({ tone: "warn", text: `ใช้งบรวมแล้ว ${usedPct.toFixed(0)}% แต่ความคืบหน้า ${p.actual}%` });
  if (contract > 0 && marginPct < 8 && p.actual > 0) alerts.push({ tone: marginPct < 0 ? "neg" : "warn", text: `กำไรขั้นต้นคาดการณ์ ${marginPct.toFixed(1)}% ต่ำกว่าเป้า 8%` });

  const risk =
    Math.max(0, pctOf(forecast - budget, budget)) * 3 +
    rows.filter((r) => r.flag === "over").length * 6 +
    rows.filter((r) => r.flag === "warn").length * 2 +
    Math.max(0, p.plan - p.actual) * 0.5 +
    Math.max(0, 12 - marginPct) * 0.8;

  return { project: p, budget, budgetSource, contract, rows, labour, actual, committed, forecast, runRate, variance, margin, marginPct, usedPct, alerts, risk, entries, labourLines };
}

// ---------- S-curve ----------

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export type CurvePoint = { date: string; planned: number; earned?: number; actual?: number; forecast?: number };

export function sCurve(pc: ProjectCost): CurvePoint[] {
  const p = pc.project;
  const s = Date.parse(p.start);
  const f = Date.parse(p.finish);
  const t = Date.parse(TODAY);
  const xT = (t - s) / Math.max(1, f - s);
  const sT = smooth(xT);
  const all = [...pc.entries.map((e) => ({ date: e.date, amount: e.amount })), ...pc.labourLines];
  const pts: CurvePoint[] = [];
  const first = new Date(p.start.slice(0, 7) + "-01T00:00:00Z");
  first.setUTCMonth(first.getUTCMonth() - 1);
  const dates: string[] = [];
  for (const d = first; ; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    dates.push(end);
    if (end >= p.finish) break;
    if (dates.length > 60) break;
  }
  // today as its own point so the actual line ends exactly at the latest figure
  const withToday = [...new Set([...dates, ...(TODAY > p.start && TODAY < p.finish ? [TODAY] : [])])].sort();
  for (const date of withToday) {
    const x = (Date.parse(date) - s) / Math.max(1, f - s);
    const pt: CurvePoint = { date, planned: pc.budget * smooth(x) };
    if (date <= TODAY) {
      pt.earned = sT > 0 ? (pc.budget * (p.actual / 100) * smooth(x)) / sT : 0;
      pt.actual = all.filter((e) => e.date <= date).reduce((a, e) => a + e.amount, 0);
    }
    if (date >= TODAY) {
      const base = pc.actual;
      pt.forecast = sT >= 1 ? pc.forecast : base + (pc.forecast - base) * Math.max(0, (smooth(x) - sT) / (1 - sT));
    }
    pts.push(pt);
  }
  return pts;
}
