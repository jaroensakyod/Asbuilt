// Pure date helpers for the schedule module (ISO "YYYY-MM-DD", UTC, no React, no "@/" imports).
// Working-day calendar: either every calendar day counts, or Sundays are skipped.

const DAY = 86400000;

/** days since 1970-01-01 */
export const toDay = (iso: string) => Math.round(Date.parse(iso.slice(0, 10)) / DAY);
export const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromDay(toDay(iso) + n);
/** b − a in calendar days */
export const diffDays = (a: string, b: string) => toDay(b) - toDay(a);
export const minIso = (a: string, b: string) => (a < b ? a : b);
export const maxIso = (a: string, b: string) => (a > b ? a : b);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (iso: string) => new Date(toDay(iso) * DAY).getUTCDay();

export type Calendar = { skipSundays?: boolean };

// Monday 2018-01-01 is the epoch of the working-day index (any Monday works).
const EPOCH = toDay("2018-01-01");
const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Working-day index of a date. With Sundays skipped a Sunday maps to the following
 * Monday when used as a start ("start") and to the preceding Saturday as a finish ("finish").
 */
export function idxOf(iso: string, cal: Calendar = {}, mode: "start" | "finish" = "start"): number {
  const d = toDay(iso);
  if (!cal.skipSundays) return d;
  const rel = d - EPOCH;
  const w = Math.floor(rel / 7);
  const r = mod(rel, 7); // 0 Mon … 6 Sun
  if (r === 6) return mode === "start" ? w * 6 + 6 : w * 6 + 5;
  return w * 6 + r;
}

/** Date of a working-day index (inverse of idxOf) */
export function dateOf(idx: number, cal: Calendar = {}): string {
  if (!cal.skipSundays) return fromDay(idx);
  const w = Math.floor(idx / 6);
  const r = mod(idx, 6);
  return fromDay(EPOCH + w * 7 + r);
}

/** Duration in working days, start and finish inclusive; milestones are 0 */
export function durationOf(start: string, finish: string, cal: Calendar = {}, milestone = false): number {
  if (milestone) return 0;
  return Math.max(1, idxOf(finish, cal, "finish") - idxOf(start, cal, "start") + 1);
}

/** Finish date (inclusive) of a task that starts on `start` and lasts `dur` working days */
export function finishFrom(start: string, dur: number, cal: Calendar = {}): string {
  if (dur <= 0) return start;
  return dateOf(idxOf(start, cal, "start") + dur - 1, cal);
}

/** Working days between two dates (b − a), counting with the calendar */
export function workDiff(a: string, b: string, cal: Calendar = {}): number {
  return idxOf(b, cal, "start") - idxOf(a, cal, "start");
}

/** first day of the month of `iso` */
export const monthStart = (iso: string) => iso.slice(0, 8) + "01";
/** add whole months (day clamped to 1) */
export function addMonths(iso: string, n: number) {
  const [y, m] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 10);
}
/** Monday on or before `iso` */
export const weekStart = (iso: string) => addDays(iso, -mod(weekday(iso) - 1, 7));
