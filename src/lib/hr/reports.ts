// Statutory reports and exports built from payroll runs.
import { round2, ssoMonthly, ssoWageBase, type SsoSettings } from "./calc";
import type { Employee, HrLine, HrRun } from "./types";

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

/** Runs that count for a month's filings (draft runs are excluded). */
export const filedRuns = (runs: HrRun[], period: string) => runs.filter((r) => r.period === period && r.status !== "draft");

// ---------- สปส.1-10 ----------

export type SsoRow = { employeeId: string; name: string; idNo: string; kind: "monthly" | "daily"; wage: number; base: number; employee: number; employer: number };

/**
 * Monthly SSO contribution list. Wages of the month are summed across runs (daily-wage
 * workers are paid weekly), then the employee side is what was actually deducted and the
 * employer side matches it.
 */
export function ssoReport(runs: HrRun[], period: string, emps: Employee[], sso: SsoSettings) {
  const byEmp = new Map<string, { lines: HrLine[] }>();
  for (const r of filedRuns(runs, period)) for (const l of r.lines) {
    if (!l.sso && !l.employerSso) continue;
    const cur = byEmp.get(l.employeeId) ?? { lines: [] };
    cur.lines.push(l);
    byEmp.set(l.employeeId, cur);
  }
  const rows: SsoRow[] = [];
  for (const [id, { lines }] of byEmp) {
    const e = emps.find((x) => x.id === id);
    const wage = round2(sum(lines, (l) => l.gross));
    const employee = sum(lines, (l) => l.sso);
    const employer = sum(lines, (l) => l.employerSso ?? l.sso);
    rows.push({ employeeId: id, name: lines[0].name, idNo: e?.idNo ?? "", kind: lines[0].kind, wage, base: ssoWageBase(wage, sso), employee, employer });
  }
  rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.employeeId.localeCompare(b.employeeId));
  return {
    rows,
    wage: round2(sum(rows, (r) => r.wage)),
    base: round2(sum(rows, (r) => r.base)),
    employee: sum(rows, (r) => r.employee),
    employer: sum(rows, (r) => r.employer),
    /** sanity check: what a single monthly calculation on the summed wage would give */
    expected: sum(rows, (r) => ssoMonthly(r.wage, sso)),
  };
}

// ---------- ภ.ง.ด.1 ----------

export type Pnd1Row = { employeeId: string; name: string; idNo: string; payDate: string; income: number; tax: number };

export function pnd1Report(runs: HrRun[], period: string, emps: Employee[], withTaxOnly = false) {
  const m = new Map<string, Pnd1Row>();
  for (const r of filedRuns(runs, period)) for (const l of r.lines) {
    if (l.kind !== "monthly" && !l.wht) continue; // daily-wage workers below the threshold are not listed
    const cur = m.get(l.employeeId) ?? { employeeId: l.employeeId, name: l.name, idNo: emps.find((e) => e.id === l.employeeId)?.idNo ?? "", payDate: r.payDate, income: 0, tax: 0 };
    cur.income = round2(cur.income + l.gross);
    cur.tax = round2(cur.tax + l.wht);
    m.set(l.employeeId, cur);
  }
  const rows = [...m.values()].filter((r) => !withTaxOnly || r.tax > 0).sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  return { rows, income: round2(sum(rows, (r) => r.income)), tax: round2(sum(rows, (r) => r.tax)) };
}

// ---------- 50 ทวิ (annual, per employee) ----------

export function annualCertificate(runs: HrRun[], year: string, employeeId: string) {
  const lines = runs.filter((r) => r.period.startsWith(year) && r.status === "paid").flatMap((r) => r.lines.filter((l) => l.employeeId === employeeId).map((l) => ({ ...l, period: r.period })));
  return {
    months: [...new Set(lines.map((l) => l.period))].length,
    income: round2(sum(lines, (l) => l.gross)),
    tax: round2(sum(lines, (l) => l.wht)),
    sso: sum(lines, (l) => l.sso),
  };
}

// ---------- labour cost per project ----------

export type LabourRow = { projectId: string; heads: number; days: number; gross: number; ot: number; employerSso: number; cost: number };

/** Daily-wage lines carry projectId: site labour = wages + employer SSO. */
export function labourByProject(runs: HrRun[], filter: (r: HrRun) => boolean = () => true) {
  const m = new Map<string, LabourRow & { ids: Set<string> }>();
  for (const r of runs) {
    if (r.kind !== "daily" || r.status === "draft" || !filter(r)) continue;
    for (const l of r.lines) {
      if (!l.projectId) continue;
      const cur = m.get(l.projectId) ?? { projectId: l.projectId, heads: 0, days: 0, gross: 0, ot: 0, employerSso: 0, cost: 0, ids: new Set<string>() };
      cur.ids.add(l.employeeId);
      cur.days += l.days ?? 0;
      cur.gross += l.gross;
      cur.ot += l.ot;
      cur.employerSso += l.employerSso ?? 0;
      cur.cost += l.gross + (l.employerSso ?? 0);
      m.set(l.projectId, cur);
    }
  }
  return [...m.values()].map(({ ids, ...r }) => ({ ...r, heads: ids.size, gross: round2(r.gross), ot: round2(r.ot), cost: round2(r.cost) })).sort((a, b) => b.cost - a.cost);
}

// ---------- bank transfer CSV ----------

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function bankCsv(run: HrRun) {
  const head = ["ลำดับ", "รหัสพนักงาน", "ชื่อ-สกุล", "ธนาคาร", "เลขที่บัญชี", "จำนวนเงิน", "วันที่โอน", "อ้างอิง"];
  const rows = run.lines.filter((l) => l.bankAccount && l.net > 0).map((l, i) => [i + 1, l.employeeId, l.name, l.bank ?? "", l.bankAccount ?? "", l.net.toFixed(2), run.payDate, run.id]);
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** lines without a bank account are paid in cash */
export const cashLines = (run: HrRun) => run.lines.filter((l) => !l.bankAccount && l.net > 0);

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
