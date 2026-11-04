// Payroll builders: employees + attendance → PayrollRun lines.
import { dailyWage, DAY_VALUE, monthlyWht, otPayMonthly, round2, ssoMonthly, ssoPartial, ssoWageBase, type SsoSettings } from "./calc";
import type { AttendanceSheet, Employee, HrLine, HrRun } from "./types";

// ---------- dates ----------

export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
export const weekday = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
export const daysInMonth = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export const periodOf = (iso: string) => iso.slice(0, 7);
export const prevPeriod = (period: string, n = 1) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 7);
};
export function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Thai public holidays the sites stop for (subset used by the demo) */
export const HOLIDAYS = new Set(["2026-07-28", "2026-08-12", "2026-10-13", "2026-10-23", "2026-12-05", "2026-12-10", "2026-12-31", "2027-01-01"]);
export const isWorkday = (iso: string) => weekday(iso) !== 0 && !HOLIDAYS.has(iso);

// ---------- run ids ----------

export const monthlyRunId = (period: string) => `PAY-${period}`;
/** PAY-2026-10-W2 (weekly) / PAY-2026-10-H1 (semi-monthly), optionally per site */
export function dailyRunId(payDate: string, cycle: "weekly" | "semimonthly", projectId?: string) {
  const day = Number(payDate.slice(8, 10));
  const tag = cycle === "weekly" ? `W${Math.ceil(day / 7)}` : day <= 15 ? "H1" : "H2";
  return `PAY-${periodOf(payDate)}-${tag}${projectId ? `-${projectId}` : ""}`;
}

// ---------- employment window ----------

const employedOn = (e: Employee, iso: string) => e.startDate <= iso && (!e.endDate || e.endDate >= iso);

/** Fraction of the month the employee was on the payroll (calendar days). */
export function monthShare(e: Employee, period: string) {
  const first = `${period}-01`;
  const last = `${period}-${String(daysInMonth(period)).padStart(2, "0")}`;
  const from = e.startDate > first ? e.startDate : first;
  const to = e.endDate && e.endDate < last ? e.endDate : last;
  if (from > to) return 0;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  return Math.min(1, days / daysInMonth(period));
}

// ---------- monthly staff ----------

export type MonthlyInputs = {
  /** OT hours this month */
  otHours?: (e: Employee) => number;
  /** other deductions this month */
  deduction?: (e: Employee) => { amount: number; note: string } | undefined;
};

export function monthlyLine(e: Employee, period: string, sso: SsoSettings, inp: MonthlyInputs = {}): HrLine | null {
  if (e.type !== "monthly" || !e.salary) return null;
  const share = monthShare(e, period);
  if (share <= 0) return null;
  const base = round2(e.salary * share);
  const allowance = round2((e.allowance ?? 0) * share);
  const otHours = inp.otHours?.(e) ?? 0;
  const ot = otPayMonthly(e.salary, otHours);
  const gross = round2(base + allowance + ot);
  const ssoEmp = e.ssoRegistered ? ssoMonthly(gross, sso) : 0;
  const ssoEr = e.ssoRegistered ? ssoMonthly(gross, sso, true) : 0;
  const wht = monthlyWht(gross, e.allowances, ssoEmp);
  const ded = inp.deduction?.(e);
  const deduction = ded?.amount ?? 0;
  return {
    employeeId: e.id,
    name: e.name,
    kind: "monthly",
    position: e.position,
    gross,
    ot,
    otHours,
    base,
    allowance,
    sso: ssoEmp,
    employerSso: ssoEr,
    ssoBase: e.ssoRegistered ? ssoWageBase(gross, sso) : 0,
    wht,
    deduction,
    deductionNote: ded?.note,
    net: round2(gross - ssoEmp - wht - deduction),
    bank: e.bank,
    bankAccount: e.bankAccount,
    projectId: e.projectId,
  };
}

export function buildMonthlyRun(emps: Employee[], period: string, payDate: string, sso: SsoSettings, inp: MonthlyInputs = {}): HrRun {
  const lines = emps.map((e) => monthlyLine(e, period, sso, inp)).filter((l): l is HrLine => !!l);
  return {
    id: monthlyRunId(period),
    period,
    kind: "monthly",
    payDate,
    status: "draft",
    lines,
    employerSso: lines.reduce((s, l) => s + (l.employerSso ?? 0), 0),
  };
}

// ---------- daily-wage workers ----------

/** employee id → SSO already deducted (employee side) in other daily runs of the same month */
export function ssoAlreadyThisMonth(runs: HrRun[], period: string, exceptRunId?: string) {
  const m = new Map<string, number>();
  for (const r of runs) {
    if (r.kind !== "daily" || r.period !== period || r.id === exceptRunId) continue;
    for (const l of r.lines) m.set(l.employeeId, (m.get(l.employeeId) ?? 0) + l.sso);
  }
  return m;
}

export function buildDailyRun(
  emps: Employee[],
  sheets: AttendanceSheet[],
  opts: { from: string; to: string; payDate: string; cycle: "weekly" | "semimonthly"; projectId?: string; sso: SsoSettings; already: Map<string, number> },
): HrRun {
  const byId = new Map(emps.map((e) => [e.id, e]));
  // employee → project → {days, ot}
  const acc = new Map<string, Map<string, { days: number; ot: number }>>();
  for (const s of sheets) {
    if (s.date < opts.from || s.date > opts.to) continue;
    if (opts.projectId && s.projectId !== opts.projectId) continue;
    for (const en of s.entries) {
      const e = byId.get(en.employeeId);
      if (!e || e.type !== "daily") continue;
      const v = DAY_VALUE[en.mark];
      if (!v && !en.ot) continue;
      const per = acc.get(e.id) ?? new Map<string, { days: number; ot: number }>();
      const cur = per.get(s.projectId) ?? { days: 0, ot: 0 };
      cur.days += v;
      cur.ot += en.ot;
      per.set(s.projectId, cur);
      acc.set(e.id, per);
    }
  }
  const lines: HrLine[] = [];
  const used = new Map(opts.already);
  for (const e of emps) {
    const per = acc.get(e.id);
    if (!per || !e.dailyRate) continue;
    for (const [projectId, { days, ot: otHours }] of per) {
      const w = dailyWage(days, e.dailyRate, otHours);
      const prior = used.get(e.id) ?? 0;
      const sso = e.ssoRegistered ? ssoPartial(w.gross, prior, opts.sso) : 0;
      const er = e.ssoRegistered ? ssoPartial(w.gross, prior, opts.sso, true) : 0;
      used.set(e.id, prior + sso);
      lines.push({
        employeeId: e.id,
        name: e.name,
        kind: "daily",
        projectId,
        position: e.skill ?? e.position,
        days,
        base: w.base,
        ot: w.ot,
        otHours,
        gross: w.gross,
        sso,
        employerSso: er,
        ssoBase: e.ssoRegistered ? w.gross : 0,
        wht: 0,
        deduction: 0,
        net: round2(w.gross - sso),
        bank: e.bank,
        bankAccount: e.bankAccount,
      });
    }
  }
  return {
    id: dailyRunId(opts.payDate, opts.cycle, opts.projectId),
    period: periodOf(opts.payDate),
    kind: "daily",
    payDate: opts.payDate,
    status: "draft",
    lines,
    employerSso: lines.reduce((s, l) => s + (l.employerSso ?? 0), 0),
    from: opts.from,
    to: opts.to,
    projectId: opts.projectId,
  };
}

/** Recompute derived numbers after a line was edited by hand (OT hours, deduction). */
export function recalcLine(l: HrLine, e: Employee | undefined, sso: SsoSettings, prior = 0): HrLine {
  if (l.kind === "daily") {
    const rate = e?.dailyRate ?? (l.days ? (l.base ?? 0) / l.days : 0);
    const w = dailyWage(l.days ?? 0, rate, l.otHours ?? 0);
    const reg = e?.ssoRegistered ?? l.sso > 0;
    const s = reg ? ssoPartial(w.gross, prior, sso) : 0;
    return { ...l, base: w.base, ot: w.ot, gross: w.gross, sso: s, employerSso: reg ? ssoPartial(w.gross, prior, sso, true) : 0, ssoBase: reg ? w.gross : 0, net: round2(w.gross - s - (l.deduction ?? 0)) };
  }
  const salary = e?.salary ?? l.base ?? 0;
  const ot = otPayMonthly(salary, l.otHours ?? 0);
  const gross = round2((l.base ?? 0) + (l.allowance ?? 0) + ot);
  const reg = e?.ssoRegistered ?? l.sso > 0;
  const s = reg ? ssoMonthly(gross, sso) : 0;
  const wht = e ? monthlyWht(gross, e.allowances, s) : l.wht;
  return { ...l, ot, gross, sso: s, employerSso: reg ? ssoMonthly(gross, sso, true) : 0, ssoBase: reg ? ssoWageBase(gross, sso) : 0, wht, net: round2(gross - s - wht - (l.deduction ?? 0)) };
}

export const runTotals = (r: HrRun) =>
  r.lines.reduce(
    (t, l) => ({ gross: t.gross + l.gross, ot: t.ot + l.ot, sso: t.sso + l.sso, wht: t.wht + l.wht, deduction: t.deduction + (l.deduction ?? 0), net: t.net + l.net, heads: t.heads + 1 }),
    { gross: 0, ot: 0, sso: 0, wht: 0, deduction: 0, net: 0, heads: 0 },
  );

export { employedOn };
