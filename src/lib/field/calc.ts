// Pure field/service calculations (no React, no "@/"): diary coverage, headcount,
// distance for GPS check-in, technician skill match and workload, warranty and
// service-contract dates. Unit-tested in tests/field.

import type { Diary, ServiceContract, VanStock, WarrantyItem, BillingFreq } from "./types";
import type { SystemKey } from "../data";

const DAY = 86400000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
export const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
export const daysDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** working days in [from, to] on which a diary is expected */
export const expectedDays = (from: string, to: string, weekdays: number[]) => dateRange(from, to).filter((d) => weekdays.includes(dow(d)));

/** expected days with no diary for this project */
export function missingDiaryDays(dates: string[], from: string, to: string, weekdays: number[]): string[] {
  const have = new Set(dates);
  return expectedDays(from, to, weekdays).filter((d) => !have.has(d));
}

export function diaryTotals(d: Pick<Diary, "manpower" | "equipment" | "work">) {
  const headcount = d.manpower.reduce((s, m) => s + (m.count || 0), 0);
  const sub = d.manpower.filter((m) => m.subcontractorId || m.group !== "ทีมบริษัท").reduce((s, m) => s + (m.count || 0), 0);
  return {
    headcount,
    own: headcount - sub,
    sub,
    equipmentHours: d.equipment.reduce((s, e) => s + (e.hours || 0), 0),
    workLines: d.work.filter((w) => w.text.trim()).length,
  };
}

/** Start a new diary from the previous one: same crews, equipment and ongoing work, no photos or notes. */
export function copyDiary(prev: Diary, date: string, by: string, id: string): Diary {
  return {
    id,
    projectId: prev.projectId,
    date,
    weatherAm: "sunny",
    weatherPm: "sunny",
    rainHours: 0,
    manpower: prev.manpower.map((m) => ({ ...m })),
    equipment: prev.equipment.map((e) => ({ ...e })),
    work: prev.work.filter((w) => w.pct === undefined || w.pct < 100).map((w) => ({ taskId: w.taskId, text: w.text, pct: w.pct })),
    photos: [],
    by,
    status: "draft",
  };
}

export const diaryId = (projectId: string, date: string) => `DIA-${projectId}-${date.replace(/-/g, "")}`;

/** great-circle distance in metres */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// ---------- dispatch ----------

const SKILL_WORDS: Record<SystemKey, string[]> = {
  elec: ["ไฟฟ้า"],
  hvac: ["แอร์", "ปรับอากาศ"],
  plumb: ["ประปา", "สุขภัณฑ์"],
  arch: ["ทั่วไป", "ปูน", "สี", "กระเบื้อง"],
  struct: ["ทั่วไป", "ปูน", "โครงสร้าง"],
  ext: ["ทั่วไป", "ภายนอก", "ปูน"],
};
/** does a technician's skill text cover the job's system */
export const skillMatch = (system: SystemKey, skill: string | undefined) => !!skill && SKILL_WORDS[system].some((w) => skill.includes(w));

export type Job = { id: string; tech: string; date: string; hours?: number };
/** jobs per technician per day */
export function workload(jobs: Job[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const j of jobs) {
    out[j.tech] ??= {};
    out[j.tech][j.date] = (out[j.tech][j.date] ?? 0) + 1;
  }
  return out;
}
export function overloaded(jobs: Job[], max: number) {
  const w = workload(jobs);
  const out: { tech: string; date: string; count: number }[] = [];
  for (const [tech, days] of Object.entries(w)) for (const [date, count] of Object.entries(days)) if (count > max) out.push({ tech, date, count });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** best technician for a job: matching skill first, then fewest jobs that day */
export function suggestTech(system: SystemKey, date: string, techs: { name: string; skill?: string }[], jobs: Job[]) {
  const w = workload(jobs);
  const ranked = [...techs].sort((a, b) => {
    const ma = skillMatch(system, a.skill) ? 0 : 1;
    const mb = skillMatch(system, b.skill) ? 0 : 1;
    return ma - mb || (w[a.name]?.[date] ?? 0) - (w[b.name]?.[date] ?? 0);
  });
  return ranked[0]?.name;
}

export const lowStock = (items: VanStock[]) => items.filter((s) => s.qty <= s.min);

// ---------- warranty ----------

export const warrantyEnd = (w: Pick<WarrantyItem, "start" | "months">) => addMonths(w.start, w.months);
export type WarrantyState = "active" | "expiring" | "expired";
export function warrantyState(end: string, today: string, soonDays: number): WarrantyState {
  if (end < today) return "expired";
  return daysDiff(today, end) <= soonDays ? "expiring" : "active";
}
/** is the date covered by the item */
export const covers = (w: Pick<WarrantyItem, "start" | "months">, date: string) => date >= w.start && date <= warrantyEnd(w);

// ---------- service contracts ----------

const MONTHS_PER_BILL: Record<BillingFreq, number> = { annual: 12, semiannual: 6, quarterly: 3, monthly: 1 };
/** invoice dates and amounts across the contract term */
export function billingSchedule(c: Pick<ServiceContract, "start" | "end" | "price" | "billing">) {
  const step = MONTHS_PER_BILL[c.billing];
  const amount = Math.round((c.price * step) / 12);
  const out: { date: string; amount: number }[] = [];
  for (let d = c.start; d < c.end; d = addMonths(d, step)) out.push({ date: d, amount });
  return out;
}
/** visits per year across all scopes */
export const visitsPerYear = (c: Pick<ServiceContract, "scopes">) => c.scopes.reduce((s, x) => s + Math.round(12 / Math.max(1, x.cycleMonths)), 0);

/** contract revenue: annual run-rate of active contracts, billed this year, still to bill this year */
export function contractRevenue(list: Pick<ServiceContract, "start" | "end" | "price" | "billing" | "status">[], today: string) {
  const year = today.slice(0, 4);
  let runRate = 0;
  let billedYtd = 0;
  let toBill = 0;
  for (const c of list) {
    if (c.status === "cancelled" || c.status === "draft") continue;
    if (c.status === "active" && c.end >= today) runRate += c.price;
    for (const b of billingSchedule(c)) {
      if (!b.date.startsWith(year)) continue;
      if (b.date <= today) billedYtd += b.amount;
      else toBill += b.amount;
    }
  }
  return { runRate, billedYtd, toBill };
}
export const renewalDue = (c: Pick<ServiceContract, "end" | "status">, today: string, days: number) => c.status === "active" && c.end >= today && daysDiff(today, c.end) <= days;
