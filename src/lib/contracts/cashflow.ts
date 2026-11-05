// Project / company cash-flow forecast: monthly inflows and outflows for the next months.
// Pure: callers pass plain records; no React, no "@/" imports.
import { addMonths, r2, sum } from "../accounting/money";
import { addDaysIso, bucketByMonth, cashflowRows, spreadEven, type CfRow, type Flow } from "./calc";

export const INFLOW_CATS = { installments: "งวดเงินลูกค้า / ลูกหนี้ค้างรับ", certs: "เบิกงวดตามผลงาน (คาดการณ์)", retention: "รับคืนเงินประกันผลงาน" } as const;
export const OUTFLOW_CATS = { pos: "ใบสั่งซื้อรอรับของ", bills: "เจ้าหนี้ผู้ขายค้างจ่าย", subs: "ผู้รับเหมาช่วง (งานคงเหลือ)", payroll: "ค่าแรง / เงินเดือน (เฉลี่ย)" } as const;
export type InCat = keyof typeof INFLOW_CATS;
export type OutCat = keyof typeof OUTFLOW_CATS;

export type MeasuredForecast = {
  projectId: string;
  finish: string;
  contractValue: number;
  /** gross certified or submitted so far */
  grossToDate: number;
  retentionPct: number;
  retentionRoom: number;
  advanceLeft: number;
  whtRate: number;
  payLagDays: number;
};

export type CashflowInput = {
  months: string[];
  vatRate: number;
  /** money already owed to us (incl. VAT, after retention / WHT), dated when expected */
  receivables: (Flow & { cat: InCat })[];
  measured: MeasuredForecast[];
  /** money we owe or have committed (incl. VAT, after WHT), dated when it will be paid */
  payables: (Flow & { cat: OutCat })[];
  /** remaining subcontract cash spread from now to the subcontract finish */
  subcontracts: { amount: number; finish: string }[];
  payrollMonthly: number;
  payrollUntil?: string;
  opening: number;
};

/**
 * Remaining measured work spread evenly to the project finish; each month's work is paid `payLagDays` later
 * as base + VAT − retention (until the cap room is used) − withholding, with the advance recovered pro rata.
 */
export function forecastCerts(m: MeasuredForecast, months: string[], vatRate: number): Flow[] {
  const remaining = r2(m.contractValue - m.grossToDate);
  if (!(remaining > 0) || !months.length) return [];
  const work = spreadEven(remaining, addMonths(months[0], 0) + "-01", m.finish, months);
  let room = m.retentionRoom;
  let adv = m.advanceLeft;
  return work.map((w) => {
    const ret = r2(Math.min(room, (w.amount * m.retentionPct) / 100));
    room = r2(room - ret);
    const rec = r2(Math.min(adv, m.contractValue ? (m.advanceLeft * w.amount) / remaining : 0));
    adv = r2(adv - rec);
    const base = r2(w.amount - rec);
    const cash = r2(base * (1 + vatRate / 100) - ret - ((base - ret) * m.whtRate) / 100);
    return { date: addDaysIso(`${w.date.slice(0, 7)}-28`, m.payLagDays), amount: cash };
  });
}

export function buildCashflow(i: CashflowInput) {
  const inflow = {} as Record<InCat, number[]>;
  const outflow = {} as Record<OutCat, number[]>;
  for (const k of Object.keys(INFLOW_CATS) as InCat[]) inflow[k] = bucketByMonth(i.receivables.filter((f) => f.cat === k), i.months);
  const fc = i.measured.flatMap((m) => forecastCerts(m, i.months, i.vatRate));
  inflow.certs = inflow.certs.map((v, k) => r2(v + bucketByMonth(fc, i.months)[k]));
  for (const k of Object.keys(OUTFLOW_CATS) as OutCat[]) outflow[k] = bucketByMonth(i.payables.filter((f) => f.cat === k), i.months);
  const subs = i.subcontracts.flatMap((s) => spreadEven(s.amount, `${i.months[0]}-01`, s.finish, i.months));
  outflow.subs = outflow.subs.map((v, k) => r2(v + bucketByMonth(subs, i.months)[k]));
  outflow.payroll = outflow.payroll.map((v, k) => r2(v + (!i.payrollUntil || i.months[k] <= i.payrollUntil.slice(0, 7) ? i.payrollMonthly : 0)));
  const inTotal = i.months.map((_, k) => sum((Object.keys(inflow) as InCat[]).map((c) => inflow[c][k])));
  const outTotal = i.months.map((_, k) => sum((Object.keys(outflow) as OutCat[]).map((c) => outflow[c][k])));
  const rows: CfRow[] = cashflowRows(i.months, inTotal, outTotal, i.opening);
  return { rows, inflow, outflow, totalIn: sum(inTotal), totalOut: sum(outTotal) };
}
