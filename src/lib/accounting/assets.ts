// Fixed-asset register: straight-line depreciation.
// Depreciable amount = cost − salvage, spread evenly over lifeYears × 12 months.
// The first month is prorated by the days the asset was in use (start date inclusive); the last month takes the
// satang remainder so the schedule adds up exactly. No depreciation from the month of disposal onwards.
import { addMonths, monthEnd, periodOf, r2 } from "./money";
import type { FixedAsset } from "./types";

export const ASSET_CLASSES: { account: string; name: string; life: number }[] = [
  { account: "1210", name: "อาคารสำนักงาน", life: 20 },
  { account: "1220", name: "เครื่องจักรและเครื่องมือก่อสร้าง", life: 5 },
  { account: "1230", name: "ยานพาหนะ", life: 5 },
  { account: "1240", name: "อุปกรณ์สำนักงานและคอมพิวเตอร์", life: 3 },
  { account: "1250", name: "เฟอร์นิเจอร์และเครื่องตกแต่ง", life: 5 },
  { account: "1260", name: "ที่ดิน", life: 0 },
];
/** 1220 → 1221 ค่าเสื่อมราคาสะสม */
export const accumAccount = (assetAccount: string) => String(Number(assetAccount) + 1);

export type DepRow = { period: string; amount: number; accum: number; nbv: number };

export function depreciationSchedule(a: FixedAsset): DepRow[] {
  const total = r2(a.cost - (a.salvage || 0));
  if (!a.lifeYears || total <= 0) return [];
  const months = a.lifeYears * 12;
  const monthly = total / months;
  const start = periodOf(a.startDate);
  const daysInMonth = Number(monthEnd(start).slice(8));
  const frac = (daysInMonth - Number(a.startDate.slice(8, 10)) + 1) / daysInMonth;
  const stop = a.disposedDate ? periodOf(a.disposedDate) : null;
  const out: DepRow[] = [];
  let remaining = total,
    accum = 0;
  for (let i = 0, p = start; remaining > 0.004 && i <= months + 1; i++, p = addMonths(p, 1)) {
    if (stop && p >= stop) break;
    let amt = r2(i === 0 ? monthly * frac : monthly);
    if (amt >= remaining - 0.004 || i === months) amt = r2(remaining);
    remaining = r2(remaining - amt);
    accum = r2(accum + amt);
    out.push({ period: p, amount: amt, accum, nbv: r2(a.cost - accum) });
  }
  return out;
}

/** Accumulated depreciation up to and including `period`. */
export function accumulatedAt(a: FixedAsset, period: string) {
  let acc = 0;
  for (const row of depreciationSchedule(a)) if (row.period <= period) acc = row.accum;
  return acc;
}
