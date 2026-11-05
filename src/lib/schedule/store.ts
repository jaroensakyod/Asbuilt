// Schedule module state: settings record, write helpers for tasks / progress / baseline,
// and the cost inputs for earned value. Collections live in @/lib/biz (shared).

import { useMemo } from "react";
import { createCollection } from "@/lib/collection";
import { budgets, costEntries, payrollRuns, progressEntries, wbsTasks, type Budget, type CostEntry, type PayrollRun, type ProgressEntry, type WbsTask } from "@/lib/biz";
import { TODAY, type Project } from "@/lib/data";
import { BUDGET_RATIO, labourOf } from "@/lib/procurement";
import { progressAware, reschedule } from "./cpm";
import { generateProject, syncSummaries } from "./gen";
import { latestEntries, leavesOf } from "./rollup";
import { summarize, type ScheduleSummary } from "./summary";
import type { Calendar } from "./dates";

// ---------- settings ----------

export type ScheduleSettings = {
  id: "schedule";
  /** Sundays are non-working days for durations and lags */
  skipSundays: boolean;
  /** look-ahead window for the site meeting */
  lookaheadWeeks: number;
  /** notify when a project's SPI falls below this */
  spiWarn: number;
  /** a running task counts as behind when it is this many % points under its linear plan */
  behindPts: number;
};
export const SCHEDULE_DEFAULTS: ScheduleSettings = { id: "schedule", skipSundays: false, lookaheadWeeks: 3, spiWarn: 0.9, behindPts: 10 };
export const scheduleSettings = createCollection<ScheduleSettings>("schedule_settings", []);
export function useScheduleSettings(): ScheduleSettings {
  const rows = scheduleSettings.use();
  return useMemo(() => ({ ...SCHEDULE_DEFAULTS, ...rows.find((r) => r.id === "schedule") }), [rows]);
}
export const getScheduleSettings = (): ScheduleSettings => ({ ...SCHEDULE_DEFAULTS, ...scheduleSettings.all().find((r) => r.id === "schedule") });
export const saveScheduleSettings = (s: ScheduleSettings) => scheduleSettings.upsert(s);
export const calOf = (s: Pick<ScheduleSettings, "skipSundays">): Calendar => ({ skipSundays: s.skipSundays });

// ---------- cost inputs for earned value ----------

/** actual cost lines of a project: cost entries (materials, subcontract, plant …) + site labour from payroll */
export function projectCosts(projectId: string, costs: CostEntry[], payroll: PayrollRun[]) {
  const out = costs.filter((c) => c.projectId === projectId && c.source !== "labour").map((c) => ({ date: c.date, amount: c.amount }));
  for (const l of labourOf(projectId, payroll)) out.push({ date: l.date, amount: l.amount });
  return out;
}
/** cost budget ÷ contract value of a project (falls back to the company's standard ratio) */
export function costRatioOf(p: Pick<Project, "id" | "value">, all: Budget[]) {
  const b = all.find((x) => x.projectId === p.id);
  const total = b?.lines?.reduce((s, l) => s + l.amount, 0) ?? 0;
  const contract = b?.contractValue || p.value * 1e6;
  return total > 0 && contract > 0 ? total / contract : BUDGET_RATIO;
}

export type ScheduleCtx = { tasks: WbsTask[]; entries: ProgressEntry[]; costs: CostEntry[]; payroll: PayrollRun[]; budgets: Budget[]; settings: ScheduleSettings };
export function useScheduleCtx(): ScheduleCtx {
  const tasks = wbsTasks.use();
  const entries = progressEntries.use();
  const costs = costEntries.use();
  const payroll = payrollRuns.use();
  const b = budgets.use();
  const settings = useScheduleSettings();
  return useMemo(() => ({ tasks, entries, costs, payroll, budgets: b, settings }), [tasks, entries, costs, payroll, b, settings]);
}
export const scheduleCtxNow = (): ScheduleCtx => ({ tasks: wbsTasks.all(), entries: progressEntries.all(), costs: costEntries.all(), payroll: payrollRuns.all(), budgets: budgets.all(), settings: getScheduleSettings() });

export function summaryOf(p: Pick<Project, "id" | "value" | "finish">, ctx: ScheduleCtx, opts: { today?: string; withSeries?: boolean } = {}): ScheduleSummary {
  const today = opts.today ?? TODAY;
  return summarize({
    withSeries: opts.withSeries,
    projectId: p.id,
    contractFinish: p.finish,
    tasks: ctx.tasks.filter((t) => t.projectId === p.id),
    entries: ctx.entries.filter((e) => e.projectId === p.id),
    costs: projectCosts(p.id, ctx.costs, ctx.payroll),
    today,
    costRatio: costRatioOf(p, ctx.budgets),
    cal: calOf(ctx.settings),
    behindPts: ctx.settings.behindPts,
  });
}

// ---------- writes ----------

const same = (a: WbsTask, b: WbsTask) => JSON.stringify(a) === JSON.stringify(b);

export type SaveResult = { ok: true; moved: string[] } | { ok: false; cycle: string[] };

/**
 * Apply edits to a project's tasks, recalculate the CPM dates (tasks without predecessors keep
 * their start), roll summaries up, and write only the records that changed.
 */
export function applyTasks(projectId: string, edited: WbsTask[] = [], removed: string[] = []): SaveResult {
  const before = wbsTasks.all().filter((t) => t.projectId === projectId);
  const gone = new Set(removed);
  const map = new Map(before.filter((t) => !gone.has(t.id)).map((t) => [t.id, t]));
  for (const t of edited) map.set(t.id, t);
  // links to removed tasks disappear
  let merged = [...map.values()].map((t) => (t.deps.some((d) => gone.has(d.taskId)) ? { ...t, deps: t.deps.filter((d) => !gone.has(d.taskId)) } : t));
  const leaves = leavesOf(merged);
  // started tasks keep their actual start; "start no earlier than" constraints are respected
  const r = reschedule(progressAware(leaves), calOf(getScheduleSettings()));
  if (!r.ok) return r;
  const moved = new Map(r.tasks.map((t) => [t.id, t]));
  merged = syncSummaries(
    merged.map((t) => {
      const m = moved.get(t.id);
      return m && (m.start !== t.start || m.finish !== t.finish) ? { ...t, start: m.start, finish: m.finish } : t;
    }),
  );
  const old = new Map(before.map((t) => [t.id, t]));
  const changed = merged.filter((t) => !old.has(t.id) || !same(old.get(t.id)!, t));
  for (const id of removed) wbsTasks.remove(id);
  wbsTasks.upsertMany(changed);
  return { ok: true, moved: r.changed.filter((id) => !edited.some((e) => e.id === id)) };
}

export const saveTask = (t: WbsTask) => applyTasks(t.projectId, [t]);

/** Delete a task with its sub-tasks and their progress records. */
export function deleteTask(id: string): SaveResult {
  const t = wbsTasks.get(id);
  if (!t) return { ok: true, moved: [] };
  const all = wbsTasks.all().filter((x) => x.projectId === t.projectId);
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const x of all)
      if (x.parentId && ids.has(x.parentId) && !ids.has(x.id)) {
        ids.add(x.id);
        grew = true;
      }
  }
  for (const e of progressEntries.all()) if (ids.has(e.taskId)) progressEntries.remove(e.id);
  return applyTasks(t.projectId, [], [...ids]);
}

/** Copy the current dates of every task into its baseline. */
export function setBaseline(projectId: string) {
  const ts = wbsTasks.all().filter((t) => t.projectId === projectId);
  wbsTasks.upsertMany(ts.map((t) => ({ ...t, baselineStart: t.start, baselineFinish: t.finish })));
}

export const newTaskId = (projectId: string) => wbsTasks.nextId(`WBS-${projectId}-`, 3);
export const newProgressId = (projectId: string) => progressEntries.nextId(`PRG-${projectId}-`, 4);

/** Save a measurement and set the task's % to its latest measurement. */
export function recordProgress(e: ProgressEntry) {
  progressEntries.upsert(e);
  syncTaskPct(e.projectId, e.taskId);
}
export function deleteProgress(id: string) {
  const e = progressEntries.get(id);
  if (!e) return;
  progressEntries.remove(id);
  syncTaskPct(e.projectId, e.taskId);
}
function syncTaskPct(projectId: string, taskId: string) {
  const t = wbsTasks.get(taskId);
  if (!t) return;
  const last = latestEntries(progressEntries.all().filter((x) => x.taskId === taskId)).get(taskId);
  const pct = last?.pct ?? 0;
  if (pct !== t.pct) applyTasks(projectId, [{ ...t, pct }]);
}

/** Create a WBS for a project from the house / condo template (baseline set, nothing measured yet). */
export function createFromTemplate(p: Project) {
  const { tasks } = generateProject(
    { id: p.id, start: p.start, finish: p.finish, status: "planning", actual: 0, plan: 0, value: p.value, floors: p.floors, area: p.area, modelCode: p.modelCode, pm: p.pm },
    TODAY,
    { withProgress: false },
  );
  wbsTasks.upsertMany(tasks);
}
