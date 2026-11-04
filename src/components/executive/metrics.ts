// Executive dashboard calculations. Pure functions over the shared collections,
// so they work with whatever the owner modules have seeded (or nothing yet).

import { daysBetween, TODAY, type Project } from "@/lib/data";
import type { Budget, CostEntry, Installment, PayrollRun, SupplierBill } from "@/lib/biz";
import type { OpsInspection, OpsRepair } from "@/lib/ops-store";

export const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const ym = (iso: string) => iso.slice(0, 7);
export function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const monLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${TH_MON[m - 1]} ${String(y + 543).slice(2)}`;
};

/** ฿ in millions, compact */
export const mb = (n: number, d = 1) => `฿${(n / 1e6).toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d })} ล.`;

export const isOpenProject = (p: Project) => p.status !== "delivered";

// ---------- loosely-typed sales records (owned by the sales module) ----------

export type Rec = Record<string, unknown>;
const num = (r: Rec, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
};
const str = (r: Rec, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v) return v;
  }
  return "";
};
export const quoteValue = (q: Rec) => num(q, ["subtotal", "total", "grandTotal", "amount", "value", "contractValue"]);
export const quoteStatus = (q: Rec) => str(q, ["status", "stage"]).toLowerCase();
export const quoteDate = (q: Rec) => str(q, ["wonDate", "acceptedDate", "signedDate", "date", "issueDate", "issuedDate", "createdAt"]);
export const leadValue = (l: Rec) => num(l, ["value", "expectedValue", "estimatedValue", "budget", "amount"]);
export const leadStage = (l: Rec) => str(l, ["stage", "status"]).toLowerCase();

const WON = ["won", "accepted", "signed", "approved", "contract", "closed-won", "closed_won"];
const LOST = ["lost", "rejected", "cancelled", "canceled", "closed-lost", "closed_lost", "expired", "dead"];
export const isWon = (s: string) => WON.includes(s);
export const isLost = (s: string) => LOST.includes(s);

const STAGE_LABEL: Record<string, string> = {
  new: "ลีดใหม่",
  lead: "ลีดใหม่",
  contacted: "ติดต่อแล้ว",
  qualified: "คัดกรองแล้ว",
  meeting: "นัดพบ",
  visit: "นัดดูบ้านตัวอย่าง",
  site_visit: "สำรวจที่ดิน",
  survey: "สำรวจที่ดิน",
  design: "ออกแบบ",
  proposal: "เสนอราคา",
  quoted: "เสนอราคา",
  quote: "เสนอราคา",
  sent: "ส่งใบเสนอราคา",
  draft: "ร่างใบเสนอราคา",
  negotiation: "ต่อรอง",
  negotiating: "ต่อรอง",
};
export const stageLabel = (s: string) => STAGE_LABEL[s] ?? (s || "ไม่ระบุ");

export type StageRow = { stage: string; label: string; n: number; value: number };
export function pipeline(leads: Rec[], quotes: Rec[]): { rows: StageRow[]; total: number; source: "leads" | "quotes" | "none" } {
  const add = (m: Map<string, StageRow>, s: string, v: number) => {
    const row = m.get(s) ?? { stage: s, label: stageLabel(s), n: 0, value: 0 };
    row.n++;
    row.value += v;
    m.set(s, row);
  };
  const m = new Map<string, StageRow>();
  const openLeads = leads.filter((l) => !isWon(leadStage(l)) && !isLost(leadStage(l)));
  for (const l of openLeads) add(m, leadStage(l), leadValue(l));
  const openQuotes = quotes.filter((q) => !isWon(quoteStatus(q)) && !isLost(quoteStatus(q)));
  // quotes count as one stage after leads, unless the lead list already tracks quoting
  if (openQuotes.length) for (const q of openQuotes) add(m, `quote:${quoteStatus(q) || "sent"}`, quoteValue(q));
  const rows = [...m.values()].map((r) => (r.stage.startsWith("quote:") ? { ...r, label: `ใบเสนอราคา · ${stageLabel(r.stage.slice(6))}` } : r));
  return { rows: rows.sort((a, b) => b.value - a.value), total: rows.reduce((s, r) => s + r.value, 0), source: leads.length ? "leads" : quotes.length ? "quotes" : "none" };
}

// ---------- contract value, cost and margin ----------

export const contractValueOf = (p: Project, budgets: Budget[]) => budgets.find((b) => b.projectId === p.id)?.contractValue ?? p.value * 1e6;
export const budgetTotalOf = (projectId: string, budgets: Budget[]) =>
  budgets.find((b) => b.projectId === projectId)?.lines.reduce((s, l) => s + l.amount, 0) ?? 0;

/** Actual cost per project: cost entries + site labour from payroll runs not already posted as cost entries */
export function actualCosts(costs: CostEntry[], runs: PayrollRun[]) {
  const out = new Map<string, { material: number; labour: number }>();
  const get = (id: string) => out.get(id) ?? (out.set(id, { material: 0, labour: 0 }), out.get(id)!);
  const posted = new Set(costs.filter((c) => c.source === "labour" && c.ref).map((c) => c.ref as string));
  for (const c of costs) {
    const g = get(c.projectId);
    if (c.source === "labour") g.labour += c.amount;
    else g.material += c.amount;
  }
  for (const r of runs) {
    if (posted.has(r.id) || r.status === "draft") continue;
    for (const l of r.lines) if (l.projectId) get(l.projectId).labour += l.gross + l.ot;
  }
  return out;
}

export type MarginRow = {
  project: Project;
  contract: number;
  budget: number;
  cost: number;
  /** estimated cost at completion */
  eac: number;
  margin: number; // projected, fraction
  budgetMargin: number | null; // planned, fraction
  overrun: number; // cost vs budget earned to date, fraction (0.1 = 10% over)
};

export function margins(list: Project[], budgets: Budget[], costMap: ReturnType<typeof actualCosts>): MarginRow[] {
  return list
    .map((p) => {
      const contract = contractValueOf(p, budgets);
      const budget = budgetTotalOf(p.id, budgets);
      const c = costMap.get(p.id);
      const cost = c ? c.material + c.labour : 0;
      const prog = p.actual / 100;
      const eac = prog >= 0.1 && cost > 0 ? Math.max(cost / prog, cost) : budget || cost;
      const earned = budget * prog;
      return {
        project: p,
        contract,
        budget,
        cost,
        eac,
        margin: contract ? (contract - eac) / contract : 0,
        budgetMargin: budget && contract ? (contract - budget) / contract : null,
        overrun: earned > 0 ? cost / earned - 1 : 0,
      };
    })
    .filter((r) => r.cost > 0 || r.budget > 0);
}

// ---------- cash ----------

const instGross = (i: Installment) => i.amount + i.vat;
const billCash = (b: SupplierBill) => b.subtotal + b.vat - (b.subtotal * b.whtRate) / 100;
const runCash = (r: PayrollRun) => r.lines.reduce((s, l) => s + l.gross + l.ot, 0) + r.employerSso;

export type FlowMonth = { key: string; label: string; inflow: number; outflow: number; net: number; forecast: boolean };

/** 6 months actual (paid) + 6 months forecast (due), payroll forecast = average of the last 3 periods */
export function cashFlow(inst: Installment[], bills: SupplierBill[], runs: PayrollRun[], back = 6, ahead = 6): { months: FlowMonth[]; payrollAvg: number } {
  const now = ym(TODAY);
  const keys = Array.from({ length: back + ahead }, (_, i) => addMonths(now, i - back));
  const row = new Map(keys.map((k, i) => [k, { key: k, label: monLabel(k), inflow: 0, outflow: 0, net: 0, forecast: i >= back }]));
  const put = (k: string, field: "inflow" | "outflow", v: number) => {
    const r = row.get(k);
    if (r) r[field] += v;
  };
  for (const i of inst) {
    if (i.status === "paid") put(ym(i.paidDate ?? i.dueDate), "inflow", instGross(i));
    else put(ym(i.dueDate) < now ? now : ym(i.dueDate), "inflow", instGross(i));
  }
  for (const b of bills) {
    if (b.status === "paid") put(ym(b.paidDate ?? b.dueDate), "outflow", billCash(b));
    else put(ym(b.dueDate) < now ? now : ym(b.dueDate), "outflow", billCash(b));
  }
  const byPeriod = new Map<string, number>();
  for (const r of runs) {
    if (r.status === "draft") continue;
    byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + runCash(r));
    if (r.status === "paid") put(ym(r.payDate), "outflow", runCash(r));
  }
  const recent = [...byPeriod.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
  const payrollAvg = recent.length ? recent.reduce((s, [, v]) => s + v, 0) / recent.length : 0;
  // forecast months without a paid run get the average payroll
  const paidPeriods = new Set(runs.filter((r) => r.status === "paid").map((r) => ym(r.payDate)));
  for (const k of keys.slice(back)) if (!paidPeriods.has(k)) put(k, "outflow", payrollAvg);
  const months = keys.map((k) => {
    const r = row.get(k)!;
    return { ...r, net: r.inflow - r.outflow };
  });
  return { months, payrollAvg };
}

export type AgingBucket = { label: string; amount: number; n: number };
const BUCKETS: [string, number][] = [
  ["ยังไม่ครบกำหนด", 0],
  ["1–30 วัน", 30],
  ["31–60 วัน", 60],
  ["61–90 วัน", 90],
  ["เกิน 90 วัน", Infinity],
];
function aging(items: { due: string; amount: number }[]): { buckets: AgingBucket[]; total: number; overdue: number } {
  const buckets = BUCKETS.map(([label]) => ({ label, amount: 0, n: 0 }));
  for (const it of items) {
    const d = daysBetween(it.due, TODAY);
    const idx = BUCKETS.findIndex(([, max]) => d <= max);
    buckets[idx].amount += it.amount;
    buckets[idx].n++;
  }
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  return { buckets, total, overdue: total - buckets[0].amount };
}
/** Receivables: installments billed or due and not paid (scheduled ones count once their due date passed) */
export const arAging = (inst: Installment[]) =>
  aging(inst.filter((i) => i.status !== "paid" && (i.status !== "scheduled" || i.dueDate < TODAY)).map((i) => ({ due: i.dueDate, amount: instGross(i) })));
export const apAging = (bills: SupplierBill[]) => aging(bills.filter((b) => b.status !== "paid").map((b) => ({ due: b.dueDate, amount: billCash(b) })));

// ---------- quality ----------

export function quality(ins: OpsInspection[], reps: OpsRepair[]) {
  const done = ins.filter((i) => i.result === "pass" || i.result === "fail");
  const pass = done.filter((i) => i.result === "pass").length;
  const open = reps.filter((r) => r.status !== "closed");
  const overSla = open.filter((r) => r.slaHours < 0).length;
  const closed = reps.filter((r) => r.status === "closed" && r.closed);
  const onTime = closed.filter((r) => daysBetween(r.reported, r.closed as string) * 24 <= (r.slaTotal ?? 96)).length;
  return {
    inspected: done.length,
    passRate: done.length ? pass / done.length : null,
    open: open.length,
    overSla,
    withinSla: open.length ? (open.length - overSla) / open.length : null,
    closedOnTime: closed.length ? onTime / closed.length : null,
    closedN: closed.length,
  };
}
