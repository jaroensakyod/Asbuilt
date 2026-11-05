// Critical Path Method — pure, no React and no "@/" imports (unit-tested in tests/schedule).
//
// Tasks carry their current start/finish; the duration is taken from those dates. Dependencies
// FS / SS / FF / SF with a lag in working days (negative = lead). Forward pass gives ES/EF,
// backward pass LS/LF, total float = LS − ES, critical = total float ≤ 0.
// A task without predecessors keeps the start the user gave it; a task with predecessors starts
// as early as its links allow. Milestones have zero duration and happen at the end of their date.
//
// Internally every time is a working-day index (see dates.ts) and EF/LF are exclusive.

import { dateOf, durationOf, idxOf, type Calendar } from "./dates";

export type DepType = "FS" | "SS" | "FF" | "SF";
export type CpmDep = { taskId: string; type: DepType; lag: number };
export type CpmTask = {
  id: string;
  start: string;
  finish: string;
  deps: CpmDep[];
  milestone?: boolean;
  /** started already: keep the actual start whatever the predecessors say (links still count backwards) */
  fixed?: boolean;
  /** "start no earlier than" constraint, e.g. remaining work rescheduled after the status date */
  notBefore?: string;
};

/** Tasks with progress keep their actual start when the plan is recalculated. */
export const progressAware = <T extends CpmTask & { pct?: number }>(tasks: T[]): T[] => tasks.map((t) => ((t.pct ?? 0) > 0 ? { ...t, fixed: true } : t));

export type CpmRow = {
  id: string;
  dur: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  start: string;
  finish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  freeFloat: number;
  critical: boolean;
  /** start is set by its predecessors (false = keeps the user's own start) */
  driven: boolean;
};

export type CpmResult =
  | { ok: true; rows: Record<string, CpmRow>; start: string; finish: string; critical: string[]; order: string[] }
  | { ok: false; cycle: string[] };

/** Links of a task that point to tasks in the set (unknown ids are ignored) */
const linksOf = (t: CpmTask, ids: Set<string>) => (t.deps ?? []).filter((d) => ids.has(d.taskId));

/** Returns the ids forming a dependency loop, or null when the network is acyclic */
export function findCycle(tasks: CpmTask[]): string[] | null {
  const ids = new Set(tasks.map((t) => t.id));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const stack: string[] = [];
  let found: string[] | null = null;
  const visit = (id: string): boolean => {
    state.set(id, 1);
    stack.push(id);
    for (const d of linksOf(byId.get(id)!, ids)) {
      const s = state.get(d.taskId);
      if (s === 1) {
        found = [...stack.slice(stack.indexOf(d.taskId)), d.taskId];
        return true;
      }
      if (!s && visit(d.taskId)) return true;
    }
    stack.pop();
    state.set(id, 2);
    return false;
  };
  for (const t of tasks) if (!state.has(t.id) && visit(t.id)) return found;
  return null;
}

/** true if giving task `id` these dependencies would create a loop */
export function wouldCycle(tasks: CpmTask[], id: string, deps: CpmDep[]): boolean {
  return findCycle(tasks.map((t) => (t.id === id ? { ...t, deps } : t))) !== null;
}

/** Topological order (predecessors first). Assumes no cycle. */
function topo(tasks: CpmTask[], ids: Set<string>): CpmTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const t of tasks) {
    indeg.set(t.id, indeg.get(t.id) ?? 0);
    for (const d of linksOf(t, ids)) {
      indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
      succ.set(d.taskId, [...(succ.get(d.taskId) ?? []), t.id]);
    }
  }
  const queue = tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
  const out: CpmTask[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(byId.get(id)!);
    for (const s of succ.get(id) ?? []) {
      const n = indeg.get(s)! - 1;
      indeg.set(s, n);
      if (n === 0) queue.push(s);
    }
  }
  return out;
}

/** Run the forward and backward pass. */
export function cpm(tasks: CpmTask[], cal: Calendar = {}): CpmResult {
  if (!tasks.length) return { ok: true, rows: {}, start: "", finish: "", critical: [], order: [] };
  const cycle = findCycle(tasks);
  if (cycle) return { ok: false, cycle };
  const ids = new Set(tasks.map((t) => t.id));
  const order = topo(tasks, ids);
  const dur = new Map<string, number>();
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const driven = new Map<string, boolean>();

  // forward pass
  for (const t of order) {
    const d = durationOf(t.start, t.finish, cal, t.milestone);
    dur.set(t.id, d);
    const links = linksOf(t, ids);
    let start: number;
    if (!links.length || t.fixed) {
      start = t.milestone ? idxOf(t.start, cal, "finish") + 1 : idxOf(t.start, cal, "start");
    } else {
      start = -Infinity;
      for (const l of links) {
        const pes = es.get(l.taskId)!;
        const pef = ef.get(l.taskId)!;
        const lag = l.lag || 0;
        const c = l.type === "SS" ? pes + lag : l.type === "FF" ? pef + lag - d : l.type === "SF" ? pes + lag - d : pef + lag;
        if (c > start) start = c;
      }
    }
    if (t.notBefore && !t.fixed) start = Math.max(start, t.milestone ? idxOf(t.notBefore, cal, "finish") + 1 : idxOf(t.notBefore, cal, "start"));
    driven.set(t.id, links.length > 0 && !t.fixed);
    es.set(t.id, start);
    ef.set(t.id, start + d);
  }

  const projectEnd = Math.max(...order.map((t) => ef.get(t.id)!));
  const projectStart = Math.min(...order.map((t) => es.get(t.id)! - (dur.get(t.id) === 0 ? 1 : 0)));

  // successors with the link that ties them
  const succOf = new Map<string, { id: string; type: DepType; lag: number }[]>();
  for (const t of order) for (const l of linksOf(t, ids)) succOf.set(l.taskId, [...(succOf.get(l.taskId) ?? []), { id: t.id, type: l.type, lag: l.lag || 0 }]);

  // backward pass
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const t = order[i];
    const d = dur.get(t.id)!;
    let finish = projectEnd;
    for (const s of succOf.get(t.id) ?? []) {
      const sls = ls.get(s.id)!;
      const slf = lf.get(s.id)!;
      const c = s.type === "SS" ? sls - s.lag + d : s.type === "FF" ? slf - s.lag : s.type === "SF" ? slf - s.lag + d : sls - s.lag;
      if (c < finish) finish = c;
    }
    lf.set(t.id, finish);
    ls.set(t.id, finish - d);
  }

  const rows: Record<string, CpmRow> = {};
  for (const t of order) {
    const d = dur.get(t.id)!;
    const e = es.get(t.id)!;
    const f = ef.get(t.id)!;
    const l = ls.get(t.id)!;
    const lfin = lf.get(t.id)!;
    // free float: how far the task can slip without moving any successor's early dates
    let free = projectEnd - f;
    for (const s of succOf.get(t.id) ?? []) {
      const ses = es.get(s.id)!;
      const sef = ef.get(s.id)!;
      const slack = s.type === "SS" ? ses - (e + s.lag) : s.type === "FF" ? sef - (f + s.lag) : s.type === "SF" ? sef - (e + s.lag) : ses - (f + s.lag);
      if (slack < free) free = slack;
    }
    const total = l - e;
    rows[t.id] = {
      id: t.id,
      dur: d,
      es: e,
      ef: f,
      ls: l,
      lf: lfin,
      start: d === 0 ? dateOf(e - 1, cal) : dateOf(e, cal),
      finish: d === 0 ? dateOf(e - 1, cal) : dateOf(f - 1, cal),
      lateStart: d === 0 ? dateOf(l - 1, cal) : dateOf(l, cal),
      lateFinish: d === 0 ? dateOf(lfin - 1, cal) : dateOf(lfin - 1, cal),
      totalFloat: total,
      freeFloat: Math.max(0, free),
      critical: total <= 0,
      driven: driven.get(t.id)!,
    };
  }
  const critical = order
    .filter((t) => rows[t.id].critical)
    .sort((a, b) => rows[a.id].es - rows[b.id].es || rows[a.id].ef - rows[b.id].ef)
    .map((t) => t.id);
  return { ok: true, rows, start: dateOf(projectStart, cal), finish: dateOf(projectEnd - 1, cal), critical, order: order.map((t) => t.id) };
}

/**
 * Recalculate dates: every task gets its early start/finish from the CPM result
 * (tasks without predecessors or marked fixed keep their start; durations are preserved).
 * Returns the updated list and the ids whose dates moved.
 */
export function reschedule<T extends CpmTask>(tasks: T[], cal: Calendar = {}): { ok: true; tasks: T[]; changed: string[]; result: Extract<CpmResult, { ok: true }> } | { ok: false; cycle: string[] } {
  const result = cpm(tasks, cal);
  if (!result.ok) return result;
  const changed: string[] = [];
  const out = tasks.map((t) => {
    const r = result.rows[t.id];
    if (!r || (r.start === t.start && r.finish === t.finish)) return t;
    changed.push(t.id);
    return { ...t, start: r.start, finish: r.finish };
  });
  return { ok: true, tasks: out, changed, result };
}
