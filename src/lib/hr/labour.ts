// Pure labour arithmetic: piece-rate claims, advances and their payroll deduction
// schedule, minimum wage / OT compliance checks. Type-only imports so the file is
// unit-tested directly (tests/hr/labour.test.ts).
import type { AttendanceSheet, Employee, HrLine, HrRun } from "./types";
import type { Advance, LabourSettings, PieceRateClaim, PieceRateContract } from "./labour-types";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const DEFAULT_LABOUR: LabourSettings = {
  id: "labour-settings",
  // ค่าจ้างขั้นต่ำรายวัน (ค่าใกล้เคียงประกาศปี 2568) ต้องตรวจสอบกับประกาศคณะกรรมการค่าจ้างล่าสุด
  minWage: [
    { province: "กรุงเทพฯ", rate: 400 },
    { province: "นนทบุรี", rate: 372 },
    { province: "ปทุมธานี", rate: 372 },
    { province: "สมุทรปราการ", rate: 372 },
    { province: "นครปฐม", rate: 372 },
    { province: "ชลบุรี", rate: 400 },
    { province: "เชียงใหม่", rate: 360 },
    { province: "ขอนแก่น", rate: 357 },
    { province: "อยุธยา", rate: 360 },
  ],
  defaultMinWage: 337,
  otMultiplier: 1.5,
  holidayOtMultiplier: 3,
  weeklyOtCap: 36,
  crewWhtRate: 3,
  maxDeductShare: 0.2,
};

// ---------- piece-rate ----------

export type ClaimAmount = { gross: number; retention: number; wht: number; advance: number; net: number };

/** qty × rate; retention and WHT (on the gross value of work) are deducted, then any advance. */
export function claimAmount(qty: number, rate: number, whtRate: number, retentionPct = 0, advance = 0): ClaimAmount {
  const gross = r2(Math.max(0, qty) * rate);
  const retention = r2((gross * retentionPct) / 100);
  const wht = r2((gross * whtRate) / 100);
  const adv = r2(Math.min(Math.max(0, advance), Math.max(0, gross - retention - wht)));
  return { gross, retention, wht, advance: adv, net: r2(gross - retention - wht - adv) };
}

export const claimOf = (c: PieceRateClaim, k: PieceRateContract) => claimAmount(c.qty, k.rate, k.whtRate, k.retentionPct, c.advanceDeduct ?? 0);

/** quantity claimed so far on a contract (rejected claims excluded) */
export function qtyToDate(claims: PieceRateClaim[], contractId: string, exceptId?: string) {
  return r2(claims.filter((c) => c.contractId === contractId && c.status !== "rejected" && c.id !== exceptId).reduce((s, c) => s + c.qty, 0));
}

/** next approval step for a claim */
export function nextClaimStatus(c: PieceRateClaim): PieceRateClaim["status"] | null {
  if (c.status === "submitted") return "foreman";
  if (c.status === "foreman") return "approved";
  if (c.status === "approved") return "paid";
  return null;
}

// ---------- advances ----------

export type AdvanceBalance = { recovered: number; payroll: number; inDraft: number; crew: number; outstanding: number };

type RunLike = Pick<HrRun, "id" | "status"> & { lines: Pick<HrLine, "advances">[] };

/** How much of an advance is recovered: cash repayments + paid/approved pay runs + crew payments. Draft runs are shown separately. */
export function advanceBalance(a: Advance, runs: RunLike[], claims: PieceRateClaim[] = [], exceptRunId?: string): AdvanceBalance {
  const recovered = a.recovered.reduce((s, x) => s + x.amount, 0);
  let payroll = 0;
  let inDraft = 0;
  for (const r of runs) {
    if (r.id === exceptRunId) continue;
    for (const l of r.lines) for (const x of l.advances ?? []) {
        if (x.id !== a.id) continue;
        if (r.status === "draft") inDraft += x.amount;
        else payroll += x.amount;
      }
  }
  const crew = claims.filter((c) => c.advanceId === a.id && c.status !== "rejected").reduce((s, c) => s + (c.advanceDeduct ?? 0), 0);
  return { recovered: r2(recovered), payroll: r2(payroll), inDraft: r2(inDraft), crew: r2(crew), outstanding: r2(Math.max(0, a.amount - recovered - payroll - inDraft - crew)) };
}

/** Instalment per pay run: amount / installments, rounded up to whole baht. */
export const advanceInstalment = (a: Pick<Advance, "amount" | "installments">) => Math.ceil(a.amount / Math.max(1, a.installments));

/**
 * Add the scheduled advance recoveries to the lines of a draft run. For each approved advance
 * of an employee the instalment (or what is still outstanding) is deducted, oldest first, once per
 * employee (first line), without taking total deductions over `maxShare` of the line's gross.
 * Existing non-advance deductions on a line are kept.
 */
export function applyAdvances<L extends HrLine>(lines: L[], runId: string, advances: Advance[], runs: RunLike[], claims: PieceRateClaim[] = [], maxShare = DEFAULT_LABOUR.maxDeductShare): L[] {
  const seen = new Set<string>();
  const open = advances.filter((a) => a.status === "approved").sort((a, b) => a.date.localeCompare(b.date));
  return lines.map((l) => {
    const prevAdv = (l.advances ?? []).reduce((s, x) => s + x.amount, 0);
    const other = r2((l.deduction ?? 0) - prevAdv);
    const base = { ...l, advances: undefined as HrLine["advances"], deduction: other };
    if (seen.has(l.employeeId)) return finish(base, other, l.deductionNote);
    seen.add(l.employeeId);
    let room = Math.max(0, r2(l.gross * maxShare - other));
    const taken: { id: string; amount: number }[] = [];
    for (const a of open) {
      if (a.employeeId !== l.employeeId || room <= 0) continue;
      const left = advanceBalance(a, runs, claims, runId).outstanding;
      const amt = r2(Math.min(advanceInstalment(a), left, room));
      if (amt <= 0) continue;
      taken.push({ id: a.id, amount: amt });
      room = r2(room - amt);
    }
    if (!taken.length) return finish(base, other, other > 0 ? l.deductionNote : undefined);
    const advSum = taken.reduce((s, x) => s + x.amount, 0);
    const note = [other > 0 && l.deductionNote && !/เบิก/.test(l.deductionNote) ? l.deductionNote : "", `หักเงินเบิกล่วงหน้า ${taken.map((t) => t.id).join(", ")}`].filter(Boolean).join(" · ");
    return { ...finish(base, r2(other + advSum), note), advances: taken };
  });
}
function finish<L extends HrLine>(l: L, deduction: number, note?: string): L {
  return { ...l, deduction, deductionNote: deduction > 0 ? note : undefined, net: r2(l.gross - l.sso - l.wht - deduction) };
}

// ---------- compliance ----------

export const minWageFor = (province: string | undefined, s: LabourSettings = DEFAULT_LABOUR) => s.minWage.find((m) => m.province === province)?.rate ?? s.defaultMinWage;

export type Issue = { kind: "min_wage" | "ot_cap" | "holiday_ot" | "deduct_cap"; employeeId: string; name: string; detail: string; amount?: number; tone: "neg" | "warn" };

/** Daily workers whose rate is below the minimum wage of their site's province. */
export function minWageIssues(emps: Employee[], provinceOf: (projectId?: string) => string | undefined, s: LabourSettings = DEFAULT_LABOUR): Issue[] {
  const out: Issue[] = [];
  for (const e of emps) {
    if (e.type !== "daily" || !e.dailyRate || e.status === "resigned") continue;
    const prov = provinceOf(e.projectId);
    const min = minWageFor(prov, s);
    if (e.dailyRate < min) out.push({ kind: "min_wage", employeeId: e.id, name: e.name, tone: "neg", amount: min - e.dailyRate, detail: `ค่าแรง ${e.dailyRate} ต่ำกว่าค่าจ้างขั้นต่ำ ${prov ?? "ทั่วไป"} ${min} บาท/วัน` });
  }
  return out;
}

/** Monday of the ISO week of a date */
export function weekStart(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - wd * 86400000).toISOString().slice(0, 10);
}

/** OT hours per employee per week (Monday key) from site sheets in [from, to]. */
export function weeklyOtHours(sheets: AttendanceSheet[], from: string, to: string) {
  const m = new Map<string, Map<string, number>>();
  for (const s of sheets) {
    if (s.date < from || s.date > to) continue;
    const wk = weekStart(s.date);
    for (const e of s.entries) {
      if (!e.ot) continue;
      const per = m.get(e.employeeId) ?? new Map<string, number>();
      per.set(wk, (per.get(wk) ?? 0) + e.ot);
      m.set(e.employeeId, per);
    }
  }
  return m;
}

export function otCapIssues(sheets: AttendanceSheet[], from: string, to: string, nameOf: (id: string) => string, s: LabourSettings = DEFAULT_LABOUR): Issue[] {
  const out: Issue[] = [];
  for (const [id, weeks] of weeklyOtHours(sheets, from, to))
    for (const [wk, h] of weeks) if (h > s.weeklyOtCap) out.push({ kind: "ot_cap", employeeId: id, name: nameOf(id), tone: "warn", amount: h, detail: `OT สัปดาห์ ${wk} รวม ${h} ชม. เกินเพดาน ${s.weeklyOtCap} ชม./สัปดาห์` });
  return out;
}

/**
 * OT worked on a public holiday must be paid at the holiday OT rate (default 3×) while the
 * daily-wage run pays the normal 1.5×. Returns the top-up owed per employee.
 */
export function holidayOtIssues(sheets: AttendanceSheet[], from: string, to: string, holidays: Set<string>, rateOf: (id: string) => number | undefined, nameOf: (id: string) => string, s: LabourSettings = DEFAULT_LABOUR): Issue[] {
  const owed = new Map<string, { hours: number; amount: number }>();
  for (const sh of sheets) {
    if (sh.date < from || sh.date > to || !holidays.has(sh.date)) continue;
    for (const e of sh.entries) {
      const rate = rateOf(e.employeeId);
      if (!e.ot || !rate) continue;
      const cur = owed.get(e.employeeId) ?? { hours: 0, amount: 0 };
      cur.hours += e.ot;
      cur.amount += e.ot * (rate / 8) * (s.holidayOtMultiplier - s.otMultiplier);
      owed.set(e.employeeId, cur);
    }
  }
  return [...owed].map(([id, v]) => ({ kind: "holiday_ot" as const, employeeId: id, name: nameOf(id), tone: "warn" as const, amount: r2(v.amount), detail: `OT วันหยุด ${v.hours} ชม. ต้องจ่าย ${s.holidayOtMultiplier}× ค่าจ้างต่อชั่วโมง ขาดอีก ${r2(v.amount)} บาท` }));
}

/** Lines whose deductions exceed the allowed share of gross (Labour Protection Act s.76). */
export function deductIssues(lines: HrLine[], s: LabourSettings = DEFAULT_LABOUR): Issue[] {
  return lines
    .filter((l) => (l.deduction ?? 0) > r2(l.gross * s.maxDeductShare) + 0.01)
    .map((l) => ({ kind: "deduct_cap" as const, employeeId: l.employeeId, name: l.name, tone: "neg" as const, amount: l.deduction, detail: `หัก ${l.deduction} บาท เกิน ${Math.round(s.maxDeductShare * 100)}% ของรายได้ ${l.gross} บาท` }));
}

/** OT pay at a given multiplier for a daily rate */
export const otPayDaily = (rate: number, hours: number, mult: number) => r2(hours * (rate / 8) * mult);
