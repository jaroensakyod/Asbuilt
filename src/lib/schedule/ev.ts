// Earned value — pure, no React, no "@/" imports (types only). Unit-tested.
//
// PV  planned value: task value spread linearly over its BASELINE dates (current dates if no baseline)
// EV  earned value: task value × % complete (history from progress entries, today from task.pct)
// AC  actual cost: cost lines of the project up to the date
// Task values are contract (selling) values. PV/EV are converted to the cost basis with
// costRatio = project cost budget ÷ contract value, so CPI compares like with like.
// Schedule forecast uses earned schedule (ES): the date at which PV equalled today's EV.

import type { ProgressEntry, WbsTask } from "../biz";
import { addDays, diffDays, maxIso, minIso, monthStart, addMonths } from "./dates";
import { leavesOf, pctOn, plannedFraction } from "./rollup";

export type EvInput = {
  tasks: WbsTask[];
  entries: ProgressEntry[];
  costs: { date: string; amount: number }[];
  asOf: string;
  /** cost budget ÷ contract value, e.g. 0.82 */
  costRatio: number;
  /** finish of the current (recalculated) schedule */
  currentFinish?: string;
  /** build the S-curve series (default true; summaries skip it) */
  withSeries?: boolean;
};

export type EvPoint = { date: string; pv: number; ev?: number; ac?: number };

export type EvResult = {
  /** budget at completion in contract value (sum of leaf values) */
  bac: number;
  /** budget at completion at cost */
  bacCost: number;
  /** cost basis */
  pv: number;
  ev: number;
  ac: number;
  /** contract-value basis */
  pvValue: number;
  evValue: number;
  planPct: number;
  actualPct: number;
  spi?: number;
  cpi?: number;
  sv: number;
  cv: number;
  /** estimate at completion (cost) = BAC / CPI */
  eac?: number;
  etc?: number;
  vac?: number;
  tcpi?: number;
  plannedStart: string;
  plannedFinish: string;
  /** date on the baseline when the work earned so far was planned to be done */
  earnedDate?: string;
  /** time-based SPI from earned schedule */
  spiT?: number;
  /** forecast finish: baseline finish + schedule delay to date (earned schedule), no earlier than the current schedule's finish */
  forecastFinish: string;
  series: EvPoint[];
};

type Leaf = { s: string; f: string; v: number; ms: boolean; id: string; pct: number };

const pvAt = (leaves: Leaf[], date: string) => leaves.reduce((acc, l) => acc + l.v * plannedFraction(l.s, l.f, date, l.ms), 0);

export function earnedValue(inp: EvInput): EvResult {
  const leaves: Leaf[] = leavesOf(inp.tasks).map((t) => ({
    id: t.id,
    s: t.baselineStart ?? t.start,
    f: t.baselineFinish ?? t.finish,
    v: t.value || 0,
    ms: !!t.milestone,
    pct: t.pct || 0,
  }));
  const ratio = inp.costRatio > 0 ? inp.costRatio : 1;
  const bac = leaves.reduce((s, l) => s + l.v, 0);
  const bacCost = bac * ratio;
  const asOf = inp.asOf;
  const plannedStart = leaves.length ? leaves.map((l) => l.s).reduce(minIso) : asOf;
  const plannedFinish = leaves.length ? leaves.map((l) => l.f).reduce(maxIso) : asOf;

  const pvValue = pvAt(leaves, asOf);
  const evValue = leaves.reduce((s, l) => s + (l.v * l.pct) / 100, 0);
  const acAt = (d: string) => inp.costs.reduce((s, c) => (c.date <= d ? s + c.amount : s), 0);
  const ac = acAt(asOf);
  const pv = pvValue * ratio;
  const ev = evValue * ratio;

  const spi = pv > 0 ? ev / pv : undefined;
  const cpi = ac > 0 && ev > 0 ? ev / ac : undefined;
  const eac = cpi ? bacCost / cpi : undefined;
  const etc = eac !== undefined ? eac - ac : undefined;
  const vac = eac !== undefined ? bacCost - eac : undefined;
  const tcpi = bacCost - ac > 0 ? (bacCost - ev) / (bacCost - ac) : undefined;

  // earned schedule: first date whose PV reaches today's EV
  let earnedDate: string | undefined;
  let spiT: number | undefined;
  let esFinish: string | undefined;
  if (bac > 0 && evValue > 0 && asOf >= plannedStart) {
    let lo = 0;
    let hi = Math.max(0, diffDays(plannedStart, plannedFinish));
    if (pvAt(leaves, addDays(plannedStart, hi)) + 1e-6 < evValue) earnedDate = plannedFinish;
    else {
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pvAt(leaves, addDays(plannedStart, mid)) + 1e-6 >= evValue) hi = mid;
        else lo = mid + 1;
      }
      earnedDate = addDays(plannedStart, lo);
    }
    const at = diffDays(plannedStart, asOf) + 1;
    const es = diffDays(plannedStart, earnedDate) + 1;
    spiT = es / Math.max(1, at);
    // remaining work at the planned rate (performance factor 1): the delay to date carries forward.
    // (PD ÷ SPI(t) over-reacts in the first weeks of a project.)
    if (evValue >= bac - 0.5) esFinish = minIso(asOf, inp.currentFinish ?? asOf);
    else esFinish = addDays(plannedFinish, Math.max(0, at - es));
  }
  const base = inp.currentFinish ?? plannedFinish;
  const forecastFinish = esFinish ? (evValue >= bac - 0.5 ? esFinish : maxIso(esFinish, base)) : base;

  // series: weekly for short projects, monthly otherwise
  const end = [plannedFinish, inp.currentFinish ?? plannedFinish, asOf].reduce(maxIso);
  const span = diffDays(plannedStart, end);
  const dates: string[] = [];
  if (span <= 420) {
    for (let d = addDays(plannedStart, -1); d < end; d = addDays(d, 7)) dates.push(d);
  } else {
    for (let m = monthStart(plannedStart); m <= end; m = addMonths(m, 1)) dates.push(addDays(m, -1));
  }
  dates.push(end);
  if (asOf >= plannedStart && asOf <= end) dates.push(asOf);
  const uniq = [...new Set(dates)].sort();
  const series: EvPoint[] = (inp.withSeries === false ? [] : uniq).map((d) => {
    const pt: EvPoint = { date: d, pv: pvAt(leaves, d) * ratio };
    if (d <= asOf) {
      const e = d === asOf ? evValue : leaves.reduce((s, l) => s + (l.v * pctOn(l.id, inp.entries, d)) / 100, 0);
      pt.ev = e * ratio;
      pt.ac = acAt(d);
    }
    return pt;
  });

  return {
    bac,
    bacCost,
    pv,
    ev,
    ac,
    pvValue,
    evValue,
    planPct: bac > 0 ? (pvValue / bac) * 100 : 0,
    actualPct: bac > 0 ? (evValue / bac) * 100 : 0,
    spi,
    cpi,
    sv: ev - pv,
    cv: ev - ac,
    eac,
    etc,
    vac,
    tcpi,
    plannedStart,
    plannedFinish,
    earnedDate,
    spiT,
    forecastFinish,
    series,
  };
}
