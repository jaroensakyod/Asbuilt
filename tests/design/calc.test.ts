// Design module: stage fees, design-fee installments, permit checklists / EIA thresholds,
// permit flags (stuck / expiring / extensions), spec resolution and satisfaction score.
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver before any design module is imported
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const calc = await lib("calc");
const { satisfactionScore, responseAvg, isLowScore } = await lib("satisfaction");
const S = calc.DEFAULT_DESIGN_SETTINGS;

test("stage fees split by percentage and add up to the total", () => {
  const f = calc.stageFees(250000, S.feePct);
  assert.equal(f.concept, 37500);
  assert.equal(f.cd, 75000);
  assert.equal(Object.values(f).reduce((t: number, x) => t + (x as number), 0), 250000);
  const odd = calc.stageFees(100001, { concept: 33, schematic: 33, dd: 34, cd: 0, permit: 0 });
  assert.equal(Object.values(odd).reduce((t: number, x) => t + (x as number), 0), 100001);
});

test("design fee installment: title, VAT and due date from the approval", () => {
  const inst = calc.designFeeInstallment({ projectId: "HC-1", key: "schematic", fee: 62500, approvedAt: "2026-10-01" }, { no: 4, vatRate: 7, dueDays: 7, today: "2026-11-04", contractValue: 5000000 });
  assert.equal(inst.id, "INS-DES-HC-1-schematic");
  assert.equal(inst.title, "ค่าออกแบบ · ขั้นร่างแบบ");
  assert.equal(inst.vat, 4375);
  assert.equal(inst.dueDate, "2026-10-08");
  assert.equal(inst.percent, 1.25);
  assert.equal(inst.status, "due");
  assert.equal(calc.nextInstallmentNo([{ projectId: "HC-1", no: 3 }, { projectId: "HC-2", no: 9 }], "HC-1"), 4);
});

test("waiting days and overall design progress", () => {
  assert.equal(calc.waitingDays({ status: "client_review", submittedAt: "2026-10-24" }, "2026-11-04"), 11);
  assert.equal(calc.waitingDays({ status: "approved", submittedAt: "2026-10-24" }, "2026-11-04"), undefined);
  const st = (key: string, status: string, done: number, total = 4) => ({ key, status, revisions: 0, deliverables: Array.from({ length: total }, (_, i) => ({ id: `${i}`, text: "", done: i < done })) });
  const d = calc.designState([st("concept", "approved", 4), st("schematic", "in_progress", 2), st("dd", "not_started", 0), st("cd", "not_started", 0), st("permit", "not_started", 0)], S.feePct);
  assert.equal(d.current.key, "schematic");
  assert.equal(d.pct, 28); // 15 % + half of 25 %
  assert.equal(d.approved, 1);
});

test("EIA thresholds are configurable", () => {
  assert.equal(calc.eiaCheck({ height: 20.5, floorArea: 2220, units: 48, use: "condo" }, S).required, false);
  const big = calc.eiaCheck({ height: 23, floorArea: 12000, units: 120, use: "condo" }, S);
  assert.equal(big.required, true);
  assert.equal(big.reasons.length, 3);
  assert.equal(calc.eiaCheck({ height: 20.5, floorArea: 2220, use: "condo" }, { ...S, eiaHeightM: 20 }).required, true);
});

test("permit checklist depends on route, ownership, size and EIA; keeps uploaded documents", () => {
  const base = { route: "permit", use: "house", height: 8.8, floorArea: 220, ownerIsApplicant: true };
  const a = calc.permitChecklist(base, S);
  assert.equal(a[0].label.includes("ข.1"), true);
  assert.equal(a.find((d: { key: string }) => d.key === "consent").required, false);
  assert.equal(a.some((d: { key: string }) => d.key === "eia"), false);
  const m = calc.permitChecklist({ ...base, route: "m39", ownerIsApplicant: false }, S, [{ key: "title", label: "x", required: true, status: "ready", files: [{ id: "MED-1" }] }]);
  assert.equal(m.some((d: { key: string }) => d.key === "m39cert"), true);
  assert.equal(m.find((d: { key: string }) => d.key === "consent").required, true);
  assert.equal(m.find((d: { key: string }) => d.key === "title").status, "ready");
  const condo = calc.permitChecklist({ ...base, use: "condo", height: 30, floorArea: 2220 }, S);
  assert.equal(condo.some((d: { key: string }) => d.key === "fire"), true);
  assert.equal(condo.some((d: { key: string }) => d.key === "eia"), true);
  assert.equal(calc.completionKindFor("condo"), "a6");
  assert.equal(calc.completionKindFor("house"), "notice");
});

test("permit flags: stuck, expiring, extension, open query", () => {
  const p = { status: "query", submittedAt: "2026-09-21", queries: [{ id: "Q", date: "2026-10-29", officer: "", text: "" }], extensions: [], docs: [] };
  const a = calc.permitState(p, "2026-11-04", S);
  assert.equal(a.pendingDays, 44);
  assert.deepEqual([...a.flags].sort(), ["query", "stuck"]);
  const ok = { status: "approved", issuedAt: "2025-12-20", expiresAt: "2026-12-20", queries: [], extensions: [], docs: [] };
  assert.deepEqual(calc.permitState(ok, "2026-11-04", S).flags, ["expiring"]);
  assert.equal(calc.permitState(ok, "2026-11-04", S).expiresIn, 46);
  const ext = { ...ok, extensions: [{ id: "E", requestedAt: "2026-11-01", approvedAt: "2026-11-03", newExpiry: "2027-12-20" }] };
  assert.equal(calc.currentExpiry(ext), "2027-12-20");
  assert.deepEqual(calc.permitState(ext, "2026-11-04", S).flags, []);
  assert.deepEqual(calc.permitState({ ...ok, expiresAt: "2026-10-01" }, "2026-11-04", S).flags, ["expired"]);
});

test("spec set resolves sections, exclusions and overrides with cost codes", () => {
  const library = [
    { id: "B", code: "02", name: "b", costCode: "02", clauses: [{ id: "b1", code: "02.01", title: "", text: "orig", brands: ["X"], equivalents: true }] },
    {
      id: "A",
      code: "01",
      name: "a",
      costCode: "01",
      clauses: [
        { id: "a1", code: "01.01", title: "", text: "t", brands: [], equivalents: true },
        { id: "a2", code: "01.02", title: "", text: "t", brands: [], equivalents: true, costCode: "13" },
      ],
    },
  ];
  const r = calc.resolveSpec({ sectionIds: ["A", "B"], excluded: ["a1"], overrides: { b1: { text: "new" } } }, library);
  assert.deepEqual(r.map((s: { id: string }) => s.id), ["A", "B"]);
  assert.equal(r[0].clauses.length, 1);
  assert.equal(r[1].clauses[0].text, "new");
  assert.equal(r[1].clauses[0].overridden, true);
  assert.equal(r[1].clauses[0].costCode, "02");
  assert.deepEqual([...calc.specByCostCode(r).entries()], [["13", 1], ["02", 1]]);
});

test("satisfaction score: average of response means, count, aspects, low scores", () => {
  const list = [
    { id: "1", projectId: "P", trigger: "handover", at: "2026-01-10", by: "", scores: { quality: 5, onTime: 5, communication: 4, afterSales: 4 }, comments: {} },
    { id: "2", projectId: "P", trigger: "repair", at: "2026-06-01", by: "", scores: { quality: 4, onTime: 2 }, comments: {} },
    { id: "3", projectId: "P", trigger: "handover", at: "2026-07-01", by: "", scores: {}, comments: {} },
  ];
  assert.equal(responseAvg(list[0]), 4.5);
  assert.equal(responseAvg(list[2]), undefined);
  const s = satisfactionScore(list);
  assert.equal(s.avg, 3.75);
  assert.equal(s.count, 2);
  assert.equal(s.byAspect.onTime.avg, 3.5);
  assert.equal(s.low, 1);
  assert.equal(isLowScore(list[1]), true);
  assert.equal(satisfactionScore(list, { trigger: "handover" }).avg, 4.5);
  assert.equal(satisfactionScore(list, { since: "2026-05-01" }).count, 1);
  assert.equal(satisfactionScore([]).avg, 0);
});
