import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver before any engineering module is imported
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const calc = await lib("calc");
const { DEFAULT_ITP, DEFAULT_LICENSE_RULES, defaultCloseoutItems } = await lib("defaults");
const { evalStrength, evalEarly, planSets, setState, concreteVerdict, slumpOk, dueSets, rebarVerdict, DEFAULT_CONCRETE_RULE: RULE, DEFAULT_REBAR_SPEC } = calc;

test("cube acceptance: average ≥ fc' and every specimen ≥ fc' − 35 ksc", () => {
  const ok = evalStrength([262, 255, 270], 240, RULE);
  assert.equal(ok.pass, true);
  assert.equal(Math.round(ok.avg * 10) / 10, 262.3);
  assert.equal(ok.eachLimit, 205);

  // average fine but one specimen below fc' − 35
  const low = evalStrength([298, 305, 240], 280, RULE);
  assert.equal(low.avgOk, true);
  assert.equal(low.eachOk, false);
  assert.equal(low.pass, false);

  // average below fc'
  const avg = evalStrength([235, 238, 236], 240, RULE);
  assert.equal(avg.avgOk, false);
  assert.equal(avg.eachOk, true);
  assert.equal(avg.pass, false);

  // exactly on the limits passes
  assert.equal(evalStrength([240, 205, 275], 240, RULE).pass, true);
  // blanks and zeros are ignored, empty fails
  assert.equal(evalStrength([0, Number.NaN], 240, RULE).pass, false);
  assert.equal(evalStrength([250, 0, 250], 240, RULE).n, 2);
});

test("configurable rule: stricter tolerance and average offset", () => {
  const strict = { avgOffset: 10, tolKsc: 20 };
  assert.equal(evalStrength([245, 250, 248], 240, strict).avgOk, false); // avg 247.7 < 250
  assert.equal(evalStrength([255, 260, 218], 240, strict).eachOk, false); // 218 < 220
  assert.equal(evalStrength([255, 275, 221], 240, strict).pass, true);
});

test("early-age check uses earlyPct of fc'", () => {
  assert.equal(evalEarly([150, 146, 141], 240, 65).ok, false); // 145.7 < 156
  assert.equal(evalEarly([170, 165, 160], 240, 65).ok, true);
  assert.equal(evalEarly([], 240, 65).ok, false);
});

test("test due dates are pour date + age, sorted by age", () => {
  const sets = planSets("2026-10-07", [28, 7]);
  assert.deepEqual(
    sets.map((s: { age: number; due: string }) => [s.age, s.due]),
    [
      [7, "2026-10-14"],
      [28, "2026-11-04"],
    ],
  );
  assert.equal(planSets("2026-12-20", [28])[0].due, "2027-01-17"); // across year end
});

test("set state: done / overdue / today / upcoming", () => {
  const today = "2026-11-04";
  assert.equal(setState({ age: 7, due: "2026-11-04", results: [] }, today), "today");
  assert.equal(setState({ age: 7, due: "2026-11-01", results: [] }, today), "overdue");
  assert.equal(setState({ age: 28, due: "2026-11-20", results: [] }, today), "upcoming");
  assert.equal(setState({ age: 7, due: "2026-11-01", results: [180] }, today), "done");
  const list = dueSets(
    [
      { id: "A", sets: [{ age: 28, due: "2026-11-20", results: [] }] },
      { id: "B", sets: [{ age: 7, due: "2026-11-04", results: [] }, { age: 28, due: "2026-11-25", results: [] }] },
      { id: "C", sets: [{ age: 7, due: "2026-10-30", results: [] }] },
    ],
    today,
  );
  assert.deepEqual(
    list.map((x: { testId: string; state: string }) => `${x.testId}:${x.state}`),
    ["C:overdue", "B:today", "A:upcoming", "B:upcoming"],
  );
});

test("concrete verdict follows the last age; early low flagged while waiting", () => {
  const base = { fc: 240 };
  assert.equal(concreteVerdict({ ...base, sets: [{ age: 7, due: "x", results: [170, 168, 175] }, { age: 28, due: "y", results: [] }] }, RULE), "pending");
  assert.equal(concreteVerdict({ ...base, sets: [{ age: 7, due: "x", results: [140, 138, 141] }, { age: 28, due: "y", results: [] }] }, RULE), "early-low");
  assert.equal(concreteVerdict({ ...base, sets: [{ age: 7, due: "x", results: [170] }, { age: 28, due: "y", results: [258, 249, 261] }] }, RULE), "pass");
  assert.equal(concreteVerdict({ ...base, sets: [{ age: 28, due: "y", results: [262, 271, 200] }, { age: 7, due: "x", results: [190] }] }, RULE), "fail");
});

test("slump range", () => {
  assert.equal(slumpOk({ slump: 10, slumpMin: 7.5, slumpMax: 12.5 }), true);
  assert.equal(slumpOk({ slump: 15, slumpMin: 7.5, slumpMax: 12.5 }), false);
  assert.equal(slumpOk({ slump: 5, slumpMin: 7.5 }), false);
  assert.equal(slumpOk({}), undefined);
});

test("rebar tensile check against grade minimums", () => {
  assert.equal(rebarVerdict({ grade: "SD40", yieldKsc: 4420, tensileKsc: 6150, elongation: 19 }, DEFAULT_REBAR_SPEC), "pass");
  assert.equal(rebarVerdict({ grade: "SD40", yieldKsc: 3820, tensileKsc: 5710, elongation: 16 }, DEFAULT_REBAR_SPEC), "fail");
  assert.equal(rebarVerdict({ grade: "SD50", yieldKsc: 5000, tensileKsc: 6400, elongation: 12 }, DEFAULT_REBAR_SPEC), "fail");
  assert.equal(rebarVerdict({ grade: "SR24" }, DEFAULT_REBAR_SPEC), "pending");
});

test("ITP hold points block later steps until released", () => {
  const tpl = DEFAULT_ITP.find((t: { id: string }) => t.id === "ITP-FDN");
  // steps: W, H, W, H, W, H
  const req = (steps: [string, string][]) => ({ status: "inprogress", steps: steps.map(([stepId, result]) => ({ stepId, result })) });
  assert.equal(calc.nextOpenStep(tpl, req([])), 0);
  assert.equal(calc.canRecordStep(tpl, req([]), 1), true); // W before it does not block
  assert.equal(calc.canRecordStep(tpl, req([["FDN-1", "pass"]]), 2), false); // hold FDN-2 not released
  assert.equal(calc.waitingHold(tpl, req([["FDN-1", "pass"]]))?.step.id, "FDN-2");
  assert.equal(calc.canRecordStep(tpl, req([["FDN-1", "pass"], ["FDN-2", "pass"]]), 2), true);
  // failed hold stays the open step
  assert.equal(calc.nextOpenStep(tpl, req([["FDN-1", "pass"], ["FDN-2", "fail"]])), 1);
  assert.equal(calc.canRecordStep(tpl, req([["FDN-1", "pass"], ["FDN-2", "fail"]]), 2), false);
  // no hold waiting once approved
  assert.equal(calc.waitingHold(tpl, { status: "approved", steps: [] }), undefined);
  const all = tpl.steps.map((s: { id: string }) => [s.id, "pass"]);
  assert.deepEqual(calc.itpProgress(tpl, req(all)), { done: 6, total: 6, failed: 0, pct: 100 });
});

test("submittal state from the latest revision", () => {
  const t = "2026-11-04";
  assert.equal(calc.submittalState({ revs: [{ rev: 0, due: "2026-11-05" }] }, t), "review");
  assert.equal(calc.submittalState({ revs: [{ rev: 0, due: "2026-11-01" }] }, t), "overdue");
  assert.equal(calc.submittalState({ revs: [{ rev: 0, due: "2026-10-01", code: "C" }, { rev: 1, due: "2026-11-10" }] }, t), "review");
  assert.equal(calc.submittalState({ revs: [{ rev: 0, due: "2026-10-01", code: "B" }] }, t), "approvedNotes");
  assert.equal(calc.submittalState({ revs: [{ rev: 0, due: "2026-10-01", code: "D" }] }, t), "rejected");
});

test("licence rules: strictest matching rule per duty and problems", () => {
  const people = [
    { id: "L1", name: "ก", council: "coe", branch: "โยธา", level: 1, licenseNo: "1", expiry: "2030-01-01" },
    { id: "L2", name: "ข", council: "coe", branch: "โยธา", level: 2, licenseNo: "2", expiry: "2026-10-01" },
    { id: "L3", name: "ค", council: "act", branch: "สถาปัตยกรรมหลัก", level: 2, licenseNo: "3", expiry: "2030-01-01" },
  ];
  const req = calc.requiredFor(DEFAULT_LICENSE_RULES, 6, 2220);
  assert.equal(req.struct.minLevel, 2);
  assert.equal(req.supervise.minLevel, 1);
  assert.equal(req.elec.minLevel, 1);
  const house = calc.requiredFor(DEFAULT_LICENSE_RULES, 1, 120);
  assert.equal(house.arch, undefined); // ≤ 150 m²
  const name = (_c: string, l: number) => ["", "ภาคี", "สามัญ", "วุฒิ"][l];
  const res = calc.checkLicensing(DEFAULT_LICENSE_RULES, 6, 2220, { struct: "L1", supervise: "L2", arch: "L3" }, people, "2026-11-04", name);
  const by = Object.fromEntries(res.map((r: { duty: string }) => [r.duty, r]));
  assert.equal(by.struct.ok, false); // level 1 < 2
  assert.match(by.struct.problems.join(), /ระดับ/);
  assert.equal(by.supervise.ok, false); // expired
  assert.match(by.supervise.problems.join(), /หมดอายุ/);
  assert.equal(by.arch.ok, true);
  assert.equal(by.elec.ok, false); // not assigned
  // wrong council
  const wrong = calc.checkLicensing(DEFAULT_LICENSE_RULES, 2, 200, { arch: "L1" }, people, "2026-11-04", name);
  assert.match(wrong.find((r: { duty: string }) => r.duty === "arch").problems.join(), /สภาสถาปนิก/);
});

test("closeout completion ignores N/A items", () => {
  const items = defaultCloseoutItems({ needsCertificate: false });
  assert.equal(items.find((i: { key: string }) => i.key === "a6").na, true);
  const done = items.map((i: { key: string }, n: number) => ({ ...i, done: n < 5 }));
  assert.deepEqual(calc.closeoutPct({ items: done }), { done: 5, total: 10, pct: 50 });
  assert.equal(defaultCloseoutItems({ needsCertificate: true }).find((i: { key: string }) => i.key === "a6").na, undefined);
});

test("running numbers per project", () => {
  const rows = [
    { projectId: "P1", no: 1 },
    { projectId: "P1", no: 3 },
    { projectId: "P2", no: 7 },
  ];
  assert.equal(calc.nextNo(rows, "P1"), 4);
  assert.equal(calc.nextNo(rows, "P3"), 1);
  assert.equal(calc.pad(7), "007");
  assert.equal(calc.addDays("2026-11-04", -7), "2026-10-28");
  assert.equal(calc.diffDays("2026-11-04", "2026-11-06"), 2);
});
