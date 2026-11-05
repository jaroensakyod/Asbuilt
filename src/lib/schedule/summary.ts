// Per-project schedule summary (pure; used by the overview, notifications and other modules).

import type { ProgressEntry, WbsTask } from "../biz";
import type { Calendar } from "./dates";
import { diffDays } from "./dates";
import { cpm, progressAware } from "./cpm";
import { earnedValue, type EvResult } from "./ev";
import { compareCode, isLateState, leavesOf, rollup, taskState, weightedPct } from "./rollup";

export type ScheduleSummary = {
  projectId: string;
  hasWbs: boolean;
  /** weighted % complete from the tasks */
  pct: number;
  /** planned % on the baseline at today */
  planPct: number;
  spi?: number;
  cpi?: number;
  start?: string;
  /** finish of the current schedule (CPM) */
  finish?: string;
  baselineFinish?: string;
  contractFinish?: string;
  forecastFinish?: string;
  /** forecast finish − contract finish (positive = late) */
  daysLate: number;
  tasks: number;
  done: number;
  late: number;
  criticalLate: number;
  dueNotStarted: number;
  criticalIds: string[];
  currentPhase?: string;
  nextMilestone?: { id: string; name: string; date: string };
  cycle?: string[];
  ev?: EvResult;
};

export type SummaryInput = {
  projectId: string;
  contractFinish?: string;
  tasks: WbsTask[];
  entries: ProgressEntry[];
  costs: { date: string; amount: number }[];
  today: string;
  costRatio: number;
  cal?: Calendar;
  behindPts?: number;
  /** include the S-curve series in ev (default false) */
  withSeries?: boolean;
};

export function summarize(inp: SummaryInput): ScheduleSummary {
  const tasks = inp.tasks.filter((t) => t.projectId === inp.projectId);
  const leaves = leavesOf(tasks);
  const empty: ScheduleSummary = { projectId: inp.projectId, hasWbs: false, pct: 0, planPct: 0, daysLate: 0, tasks: 0, done: 0, late: 0, criticalLate: 0, dueNotStarted: 0, criticalIds: [], contractFinish: inp.contractFinish };
  if (!leaves.length) return empty;
  const res = cpm(progressAware(leaves), inp.cal);
  const criticalIds = res.ok ? res.critical : [];
  const crit = new Set(criticalIds);
  const finish = res.ok ? res.finish : leaves.map((t) => t.finish).reduce((a, b) => (a > b ? a : b));
  const ev = earnedValue({ tasks, entries: inp.entries.filter((e) => e.projectId === inp.projectId), costs: inp.costs, asOf: inp.today, costRatio: inp.costRatio, currentFinish: finish, withSeries: !!inp.withSeries });
  let done = 0;
  let late = 0;
  let criticalLate = 0;
  let due = 0;
  for (const t of leaves) {
    const s = taskState(t, inp.today, inp.behindPts);
    if (s === "done") done++;
    if (isLateState(s)) {
      late++;
      if (crit.has(t.id)) criticalLate++;
    }
    if (s === "due") due++;
  }
  const roll = rollup(tasks);
  const tops = tasks.filter((t) => !t.parentId).sort((a, b) => compareCode(a.code, b.code));
  const phase = tops.find((t) => (roll.get(t.id)?.pct ?? 0) < 99.5 && (roll.get(t.id)?.start ?? "") <= inp.today) ?? tops.find((t) => (roll.get(t.id)?.pct ?? 0) < 99.5);
  const ms = leaves.filter((t) => t.milestone && (t.pct || 0) < 100).sort((a, b) => a.finish.localeCompare(b.finish))[0];
  const baselineFinish = leaves.map((t) => t.baselineFinish).filter(Boolean).reduce<string | undefined>((a, b) => (!a || b! > a ? b : a), undefined);
  const forecastFinish = ev.forecastFinish;
  return {
    projectId: inp.projectId,
    hasWbs: true,
    pct: weightedPct(tasks),
    planPct: ev.planPct,
    spi: ev.spi,
    cpi: ev.cpi,
    start: res.ok ? res.start : undefined,
    finish,
    baselineFinish,
    contractFinish: inp.contractFinish,
    forecastFinish,
    daysLate: inp.contractFinish ? diffDays(inp.contractFinish, forecastFinish) : 0,
    tasks: leaves.length,
    done,
    late,
    criticalLate,
    dueNotStarted: due,
    criticalIds,
    currentPhase: phase?.name,
    nextMilestone: ms ? { id: ms.id, name: ms.name, date: ms.finish } : undefined,
    cycle: res.ok ? undefined : res.cycle,
    ev,
  };
}
