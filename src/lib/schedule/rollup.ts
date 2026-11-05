// Pure WBS helpers: tree, summary roll-up, weighted progress, planned progress at a date,
// task status. No React, no "@/" imports (types only) — unit-tested.

import type { ProgressEntry, WbsTask } from "../biz";
import { diffDays, maxIso, minIso } from "./dates";

/** natural compare of WBS codes: "2.10" after "2.9" */
export function compareCode(a: string, b: string) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return a.localeCompare(b);
}
export const sortByCode = <T extends Pick<WbsTask, "code">>(tasks: T[]) => [...tasks].sort((a, b) => compareCode(a.code, b.code));

/** parentId → children */
export function childrenOf(tasks: WbsTask[]) {
  const m = new Map<string, WbsTask[]>();
  for (const t of tasks) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
  return m;
}
export const summaryIds = (tasks: WbsTask[]) => new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
/** tasks that carry work (no children) */
export const leavesOf = (tasks: WbsTask[]) => {
  const s = summaryIds(tasks);
  return tasks.filter((t) => !s.has(t.id));
};

export type Rolled = { start: string; finish: string; baselineStart?: string; baselineFinish?: string; value: number; pct: number; earned: number };

/** Roll leaf dates / value / % up to every summary task (summary values themselves are ignored). */
export function rollup(tasks: WbsTask[]): Map<string, Rolled> {
  const kids = childrenOf(tasks);
  const out = new Map<string, Rolled>();
  const calc = (t: WbsTask, guard: Set<string>): Rolled => {
    const hit = out.get(t.id);
    if (hit) return hit;
    const ch = kids.get(t.id);
    let r: Rolled;
    if (!ch?.length || guard.has(t.id)) {
      r = { start: t.start, finish: t.finish, baselineStart: t.baselineStart, baselineFinish: t.baselineFinish, value: t.value || 0, pct: t.pct || 0, earned: ((t.value || 0) * (t.pct || 0)) / 100 };
    } else {
      guard.add(t.id);
      const rs = ch.map((c) => calc(c, guard));
      const value = rs.reduce((s, x) => s + x.value, 0);
      const earned = rs.reduce((s, x) => s + x.earned, 0);
      const bs = rs.map((x) => x.baselineStart).filter(Boolean) as string[];
      const bf = rs.map((x) => x.baselineFinish).filter(Boolean) as string[];
      r = {
        start: rs.map((x) => x.start).reduce(minIso),
        finish: rs.map((x) => x.finish).reduce(maxIso),
        baselineStart: bs.length ? bs.reduce(minIso) : undefined,
        baselineFinish: bf.length ? bf.reduce(maxIso) : undefined,
        value,
        earned,
        pct: value > 0 ? (earned / value) * 100 : rs.length ? rs.reduce((s, x) => s + x.pct, 0) / rs.length : 0,
      };
    }
    out.set(t.id, r);
    return r;
  };
  for (const t of tasks) calc(t, new Set());
  return out;
}

/** Weighted % complete of a set of tasks (leaves weighted by value; equal weights if no values) */
export function weightedPct(tasks: WbsTask[]): number {
  const ls = leavesOf(tasks).filter((t) => !t.milestone);
  if (!ls.length) return 0;
  const total = ls.reduce((s, t) => s + (t.value || 0), 0);
  if (total <= 0) return ls.reduce((s, t) => s + (t.pct || 0), 0) / ls.length;
  return ls.reduce((s, t) => s + (t.value || 0) * (t.pct || 0), 0) / total;
}

/** Linear planned fraction (0–1) of a task at the end of `date` */
export function plannedFraction(start: string, finish: string, date: string, milestone?: boolean): number {
  if (milestone || finish <= start) return date >= finish ? 1 : 0;
  if (date < start) return 0;
  if (date >= finish) return 1;
  return (diffDays(start, date) + 1) / (diffDays(start, finish) + 1);
}

/** Planned weighted % at `date` — from baseline dates when present (else current dates) */
export function plannedPct(tasks: WbsTask[], date: string, basis: "baseline" | "current" = "baseline"): number {
  const ls = leavesOf(tasks).filter((t) => !t.milestone);
  const total = ls.reduce((s, t) => s + (t.value || 0), 0);
  if (!ls.length) return 0;
  let acc = 0;
  for (const t of ls) {
    const s = basis === "baseline" ? (t.baselineStart ?? t.start) : t.start;
    const f = basis === "baseline" ? (t.baselineFinish ?? t.finish) : t.finish;
    acc += (total > 0 ? t.value || 0 : 1) * plannedFraction(s, f, date);
  }
  return (acc / (total > 0 ? total : ls.length)) * 100;
}

/** % complete of a task as it stood on `date`, from its progress entries */
export function pctOn(taskId: string, entries: ProgressEntry[], date: string): number {
  let best: ProgressEntry | undefined;
  for (const e of entries) if (e.taskId === taskId && e.date <= date && (!best || e.date > best.date || (e.date === best.date && e.id > best.id))) best = e;
  return best?.pct ?? 0;
}

/** the latest entry per task */
export function latestEntries(entries: ProgressEntry[]) {
  const m = new Map<string, ProgressEntry>();
  for (const e of entries) {
    const cur = m.get(e.taskId);
    if (!cur || e.date > cur.date || (e.date === cur.date && e.id > cur.id)) m.set(e.taskId, e);
  }
  return m;
}

export type TaskState = "done" | "late" | "behind" | "active" | "due" | "upcoming";
export const TASK_STATE_LABEL: Record<TaskState, string> = {
  done: "เสร็จแล้ว",
  late: "เลยกำหนด",
  behind: "ล่าช้ากว่าแผน",
  active: "กำลังทำ",
  due: "ควรเริ่มแล้ว",
  upcoming: "ยังไม่ถึงกำหนด",
};

/**
 * Status of a leaf task on `today` against its current dates.
 * behindPts = how many % points under the linear plan counts as behind.
 */
export function taskState(t: Pick<WbsTask, "start" | "finish" | "pct" | "milestone">, today: string, behindPts = 10): TaskState {
  if ((t.pct || 0) >= 100) return "done";
  if (t.finish < today) return "late";
  if (t.start <= today && (t.pct || 0) <= 0) return "due";
  if (t.start <= today) {
    const plan = plannedFraction(t.start, t.finish, today, t.milestone) * 100;
    return plan - (t.pct || 0) > behindPts ? "behind" : "active";
  }
  return "upcoming";
}
export const isLateState = (s: TaskState) => s === "late" || s === "behind" || s === "due";
