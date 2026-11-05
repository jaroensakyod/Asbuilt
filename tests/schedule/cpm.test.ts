// CPM engine: forward/backward pass, all four link types with lags, float, critical path,
// cycles, rescheduling and the Sunday-skipping calendar.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const cpmLib = await lib("cpm");
const { cpm, reschedule, findCycle, wouldCycle } = cpmLib;
const { durationOf, finishFrom, idxOf, dateOf, addDays } = await lib("dates");

type Dep = { taskId: string; type: "FS" | "SS" | "FF" | "SF"; lag: number };
const T = (id: string, start: string, dur: number, deps: Dep[] = [], milestone = false) => ({ id, start, finish: milestone ? start : addDays(start, dur - 1), deps, milestone });
const fs = (taskId: string, lag = 0): Dep => ({ taskId, type: "FS", lag });

test("simple FS chain: dates, float and critical path", () => {
  // A(5) → B(3) → D(2); A → C(1) → D
  const tasks = [T("A", "2026-01-01", 5), T("B", "2026-01-01", 3, [fs("A")]), T("C", "2026-01-01", 1, [fs("A")]), T("D", "2026-01-01", 2, [fs("B"), fs("C")])];
  const r = cpm(tasks);
  assert.equal(r.ok, true);
  assert.equal(r.rows.A.start, "2026-01-01");
  assert.equal(r.rows.A.finish, "2026-01-05");
  assert.equal(r.rows.B.start, "2026-01-06");
  assert.equal(r.rows.B.finish, "2026-01-08");
  assert.equal(r.rows.C.start, "2026-01-06");
  assert.equal(r.rows.D.start, "2026-01-09");
  assert.equal(r.finish, "2026-01-10");
  assert.equal(r.rows.C.totalFloat, 2);
  assert.equal(r.rows.C.freeFloat, 2);
  assert.equal(r.rows.C.lateStart, "2026-01-08");
  assert.equal(r.rows.B.totalFloat, 0);
  assert.deepEqual(r.critical, ["A", "B", "D"]);
});

test("lag and lead on FS", () => {
  const r = cpm([T("A", "2026-03-01", 4), T("B", "2026-03-01", 2, [fs("A", 3)]), T("C", "2026-03-01", 2, [fs("A", -2)])]);
  assert.equal(r.rows.B.start, "2026-03-08"); // A ends 03-04, +3 days
  assert.equal(r.rows.C.start, "2026-03-03"); // two-day lead
});

test("SS, FF and SF links", () => {
  const A = T("A", "2026-05-01", 10);
  const ss = cpm([A, T("B", "2026-05-01", 4, [{ taskId: "A", type: "SS", lag: 3 }])]);
  assert.equal(ss.rows.B.start, "2026-05-04");
  const ff = cpm([A, T("B", "2026-05-01", 4, [{ taskId: "A", type: "FF", lag: 2 }])]);
  assert.equal(ff.rows.B.finish, "2026-05-12"); // A finishes 05-10
  assert.equal(ff.rows.B.start, "2026-05-09");
  const sf = cpm([A, T("B", "2026-05-01", 3, [{ taskId: "A", type: "SF", lag: 5 }])]);
  // B must finish when A has started + 5 days → B.EF = A.ES + 5 → finish 05-05
  assert.equal(sf.rows.B.finish, "2026-05-05");
  assert.equal(sf.rows.B.start, "2026-05-03");
});

test("backward pass across an SS link keeps the predecessor critical", () => {
  const r = cpm([T("A", "2026-01-01", 10), T("B", "2026-01-01", 10, [{ taskId: "A", type: "SS", lag: 2 }])]);
  assert.equal(r.finish, "2026-01-12");
  assert.equal(r.rows.A.totalFloat, 0);
  assert.equal(r.rows.B.totalFloat, 0);
  assert.equal(r.rows.A.critical, true);
});

test("milestones have zero duration and sit at the end of their predecessor", () => {
  const r = cpm([T("A", "2026-02-01", 5), T("M", "2026-02-01", 0, [fs("A")], true), T("B", "2026-02-01", 2, [fs("M")])]);
  assert.equal(r.rows.M.dur, 0);
  assert.equal(r.rows.M.start, "2026-02-05");
  assert.equal(r.rows.M.finish, "2026-02-05");
  assert.equal(r.rows.B.start, "2026-02-06");
  assert.equal(r.rows.M.critical, true);
});

test("tasks without predecessors keep the user's start", () => {
  const r = cpm([T("A", "2026-01-01", 3), T("X", "2026-01-20", 2)]);
  assert.equal(r.rows.X.start, "2026-01-20");
  assert.equal(r.rows.X.driven, false);
  assert.equal(r.rows.A.totalFloat, 18);
});

test("cycle detection", () => {
  const tasks = [T("A", "2026-01-01", 2, [fs("C")]), T("B", "2026-01-01", 2, [fs("A")]), T("C", "2026-01-01", 2, [fs("B")])];
  const cyc = findCycle(tasks);
  assert.ok(cyc && cyc.length === 4 && cyc[0] === cyc[cyc.length - 1]);
  const r = cpm(tasks);
  assert.equal(r.ok, false);
  assert.ok(r.cycle.includes("A"));
  const ok = [T("A", "2026-01-01", 2), T("B", "2026-01-01", 2, [fs("A")])];
  assert.equal(findCycle(ok), null);
  assert.equal(wouldCycle(ok, "A", [fs("B")]), true);
  assert.equal(wouldCycle(ok, "A", []), false);
  assert.equal(findCycle([T("S", "2026-01-01", 1, [fs("S")])])?.[0], "S");
});

test("unknown dependency ids are ignored", () => {
  const r = cpm([T("A", "2026-01-01", 2, [fs("ZZ")])]);
  assert.equal(r.ok, true);
  assert.equal(r.rows.A.start, "2026-01-01");
});

test("reschedule moves successors when a duration grows and keeps durations", () => {
  const tasks = [T("A", "2026-01-01", 5), T("B", "2026-01-06", 3, [fs("A")])];
  const longer = tasks.map((t) => (t.id === "A" ? { ...t, finish: "2026-01-09" } : t));
  const r = reschedule(longer);
  assert.equal(r.ok, true);
  const b = r.tasks.find((t: { id: string }) => t.id === "B");
  assert.equal(b.start, "2026-01-10");
  assert.equal(b.finish, "2026-01-12");
  assert.deepEqual(r.changed, ["B"]);
  // a dependency loop is refused
  const bad = reschedule([T("A", "2026-01-01", 2, [fs("B")]), T("B", "2026-01-01", 2, [fs("A")])]);
  assert.equal(bad.ok, false);
});

test("working-day calendar skips Sundays", () => {
  const cal = { skipSundays: true };
  // 2026-11-07 is a Saturday, 11-08 a Sunday
  assert.equal(dateOf(idxOf("2026-11-07", cal), cal), "2026-11-07");
  assert.equal(dateOf(idxOf("2026-11-08", cal, "start"), cal), "2026-11-09");
  assert.equal(dateOf(idxOf("2026-11-08", cal, "finish"), cal), "2026-11-07");
  assert.equal(finishFrom("2026-11-05", 4, cal), "2026-11-09"); // Thu Fri Sat (skip Sun) Mon
  assert.equal(durationOf("2026-11-05", "2026-11-09", cal), 4);
  const r = cpm([{ id: "A", start: "2026-11-05", finish: "2026-11-09", deps: [] }, { id: "B", start: "2026-11-05", finish: "2026-11-05", deps: [fs("A", 1)] }], cal);
  assert.equal(r.rows.B.start, "2026-11-11"); // Tue 10 is the lag day
});

test("started tasks keep their actual start; start-no-earlier-than constraints", () => {
  const { progressAware } = cpmLib;
  const tasks = [
    { ...T("A", "2026-01-01", 10), pct: 100 },
    { ...T("B", "2026-01-05", 5, [fs("A")]), pct: 40 }, // started early, before A finished
    { ...T("C", "2026-01-01", 3, [fs("A")]), pct: 0, notBefore: "2026-01-20" },
  ];
  const r = cpm(progressAware(tasks));
  assert.equal(r.rows.B.start, "2026-01-05");
  assert.equal(r.rows.B.driven, false);
  assert.equal(r.rows.C.start, "2026-01-20");
  // without progress B is pushed behind A
  assert.equal(cpm(tasks.map((t) => ({ ...t, pct: 0 }))).rows.B.start, "2026-01-11");
});
