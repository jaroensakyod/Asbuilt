// Earned value: PV from baseline × value (linear), EV from % complete, AC from cost lines,
// indices, EAC and the earned-schedule forecast. Also weighted progress and the seed generator.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib, demoData }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { earnedValue } = await lib("ev");
const { weightedPct, plannedPct, rollup, taskState, compareCode } = await lib("rollup");
const { generateProject, houseTemplate, condoTemplate } = await lib("gen");
const { cpm, findCycle, progressAware } = await lib("cpm");
const { addDays } = await lib("dates");
const { summarize } = await lib("summary");

const task = (id: string, start: string, finish: string, value: number, pct: number, extra = {}) => ({ id, projectId: "P", code: id, name: id, start, finish, baselineStart: start, baselineFinish: finish, deps: [], value, pct, ...extra });

test("PV spreads value linearly over the baseline", () => {
  // 10-day task worth 1,000,000; at the end of day 4 → 40 %
  const tasks = [task("A", "2026-01-01", "2026-01-10", 1_000_000, 30)];
  const r = earnedValue({ tasks, entries: [], costs: [], asOf: "2026-01-04", costRatio: 1 });
  assert.equal(Math.round(r.pvValue), 400_000);
  assert.equal(Math.round(r.evValue), 300_000);
  assert.equal(Number(r.spi.toFixed(2)), 0.75);
  assert.equal(Math.round(r.sv), -100_000);
  assert.equal(r.planPct.toFixed(0), "40");
});

test("CPI, EAC and VAC on the cost basis", () => {
  const tasks = [task("A", "2026-01-01", "2026-01-10", 1_000_000, 50), task("B", "2026-01-11", "2026-01-20", 1_000_000, 0)];
  const costs = [{ date: "2026-01-03", amount: 200_000 }, { date: "2026-01-09", amount: 250_000 }, { date: "2026-02-01", amount: 999_999 }];
  const r = earnedValue({ tasks, entries: [], costs, asOf: "2026-01-10", costRatio: 0.8 });
  assert.equal(r.bac, 2_000_000);
  assert.equal(r.bacCost, 1_600_000);
  assert.equal(r.ac, 450_000); // later costs excluded
  assert.equal(Math.round(r.ev), 400_000); // 500k earned × 0.8
  assert.equal(Number(r.cpi.toFixed(3)), Number((400_000 / 450_000).toFixed(3)));
  assert.equal(Math.round(r.eac), Math.round(1_600_000 / (400_000 / 450_000)));
  assert.ok(r.vac < 0);
  assert.equal(Math.round(r.cv), -50_000);
});

test("earned schedule forecast finish", () => {
  // two equal tasks over 20 days; at day 10 only 25 % earned → earned date ≈ day 5, SPI(t) 0.5
  const tasks = [task("A", "2026-01-01", "2026-01-10", 500, 50), task("B", "2026-01-11", "2026-01-20", 500, 0)];
  const r = earnedValue({ tasks, entries: [], costs: [], asOf: "2026-01-10", costRatio: 1, currentFinish: "2026-01-20" });
  assert.equal(r.earnedDate, "2026-01-05");
  assert.equal(r.spiT, 0.5);
  assert.equal(r.forecastFinish, "2026-01-25"); // baseline finish + 5 days delay to date
  // never earlier than the current schedule
  const ahead = earnedValue({ tasks: [task("A", "2026-01-01", "2026-01-10", 500, 100), task("B", "2026-01-11", "2026-01-20", 500, 20)], entries: [], costs: [], asOf: "2026-01-10", costRatio: 1, currentFinish: "2026-01-22" });
  assert.equal(ahead.forecastFinish, "2026-01-22");
});

test("EV history comes from dated progress entries", () => {
  const tasks = [task("A", "2026-01-01", "2026-01-31", 1000, 60)];
  const entries = [
    { id: "E1", projectId: "P", taskId: "A", date: "2026-01-10", pct: 20, by: "x", source: "foreman" },
    { id: "E2", projectId: "P", taskId: "A", date: "2026-01-20", pct: 60, by: "x", source: "engineer" },
  ];
  const r = earnedValue({ tasks, entries, costs: [], asOf: "2026-01-25", costRatio: 1 });
  const at = (d: string) => r.series.find((p: { date: string }) => p.date === d);
  const jan14 = r.series.filter((p: { date: string; ev?: number }) => p.date >= "2026-01-10" && p.date < "2026-01-20" && p.ev !== undefined)[0];
  assert.equal(jan14.ev, 200);
  assert.equal(at("2026-01-25").ev, 600);
  assert.ok(r.series.every((p: { date: string; ev?: number }) => (p.date > "2026-01-25" ? p.ev === undefined : true)));
});

test("weighted % uses leaf values and ignores summaries", () => {
  const tasks = [
    { ...task("1", "2026-01-01", "2026-01-31", 0, 0) },
    task("1.1", "2026-01-01", "2026-01-10", 300, 100, { parentId: "1" }),
    task("1.2", "2026-01-11", "2026-01-31", 700, 10, { parentId: "1" }),
  ];
  assert.equal(weightedPct(tasks), 37);
  const roll = rollup(tasks).get("1");
  assert.equal(roll.value, 1000);
  assert.equal(roll.pct, 37);
  assert.equal(roll.start, "2026-01-01");
  assert.equal(roll.finish, "2026-01-31");
  assert.equal(Math.round(plannedPct(tasks, "2026-01-10")), 30);
});

test("task state", () => {
  assert.equal(taskState({ start: "2026-01-01", finish: "2026-01-10", pct: 100 }, "2026-01-05"), "done");
  assert.equal(taskState({ start: "2026-01-01", finish: "2026-01-10", pct: 50 }, "2026-01-12"), "late");
  assert.equal(taskState({ start: "2026-01-01", finish: "2026-01-10", pct: 0 }, "2026-01-03"), "due");
  assert.equal(taskState({ start: "2026-01-01", finish: "2026-01-10", pct: 10 }, "2026-01-08"), "behind");
  assert.equal(taskState({ start: "2026-01-01", finish: "2026-01-10", pct: 70 }, "2026-01-08"), "active");
  assert.equal(taskState({ start: "2026-02-01", finish: "2026-02-10", pct: 0 }, "2026-01-08"), "upcoming");
  assert.ok(compareCode("2.10", "2.9") > 0);
  assert.ok(compareCode("2", "2.1") < 0);
});

test("demo schedules: values sum to the contract, weighted % ≈ project actual, network acyclic", async () => {
  const { projects, TODAY } = await demoData();
  const active = projects.filter((p: { status: string }) => p.status === "building" || p.status === "handover");
  assert.ok(active.length >= 10);
  for (const p of active) {
    const { tasks, entries } = generateProject(p, TODAY);
    const sum = tasks.reduce((s: number, t: { value: number }) => s + t.value, 0);
    assert.equal(sum, Math.round(p.value * 1e6), `${p.id} value`);
    const pct = weightedPct(tasks);
    assert.ok(Math.abs(pct - p.actual) <= 1.5, `${p.id} weighted ${pct.toFixed(1)} vs actual ${p.actual}`);
    assert.equal(findCycle(tasks), null);
    const leaves = tasks.filter((t: { id: string }) => !tasks.some((x: { parentId?: string }) => x.parentId === t.id));
    // recalculating the stored plan moves nothing (started tasks keep their start, constraints kept)
    const re = cpm(progressAware(leaves));
    assert.ok(re.ok);
    for (const t of leaves) {
      assert.equal(re.rows[t.id].start, t.start, `${t.id} start stable`);
      assert.equal(re.rows[t.id].finish, t.finish, `${t.id} finish stable`);
      if (t.pct < 100) assert.ok(t.finish >= addDays(TODAY, -7), `${t.id} unfinished work not left in the past`);
    }
    assert.ok(entries.every((e: { date: string }) => e.date <= TODAY), `${p.id} entry dates`);
    // every task's % equals its latest entry
    for (const t of leaves.filter((x: { pct: number }) => x.pct > 0)) {
      const last = entries.filter((e: { taskId: string }) => e.taskId === t.id).sort((a: { date: string; id: string }, b: { date: string; id: string }) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).pop();
      assert.equal(last?.pct, t.pct, `${t.id} latest entry`);
    }
    const bf = leaves.map((t: { baselineFinish: string }) => t.baselineFinish).sort().pop();
    assert.ok(bf <= p.finish, `${p.id} baseline finish ${bf} after contract ${p.finish}`);
    const s = summarize({ projectId: p.id, contractFinish: p.finish, tasks, entries, costs: [], today: TODAY, costRatio: 0.82 });
    assert.ok(s.hasWbs && s.spi > 0.5 && s.spi < 1.5, `${p.id} spi ${s.spi}`);
  }
  for (const tpl of [houseTemplate(1, 120), houseTemplate(2, 200), houseTemplate(4, 320), condoTemplate()]) {
    const keys = tpl.map((n: { key: string }) => n.key);
    assert.equal(new Set(keys).size, keys.length, "template keys unique");
  }
  const condo = generateProject(projects.find((p: { id: string }) => p.id === "HC-2025-03"), TODAY).tasks;
  assert.ok(condo.length > 100);
});
