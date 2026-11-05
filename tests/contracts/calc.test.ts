// Contract money math: certificates, retention cap, pro-rata advance recovery, variations, progress, cash-flow buckets.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const c = await lib("calc");

test("retention: pct of the period, capped at % of contract, never releases more than was held", () => {
  assert.equal(c.retentionFor(1000000, 10, 500000, 0), 100000);
  assert.equal(c.retentionFor(1000000, 10, 500000, 450000), 50000, "only the room left under the cap");
  assert.equal(c.retentionFor(1000000, 10, 500000, 500000), 0, "cap reached");
  assert.equal(c.retentionFor(-200000, 10, 500000, 15000), -15000, "re-measured down: gives back at most what was held");
  assert.equal(c.retentionFor(-100000, 10, 500000, 50000), -10000);
});

test("advance recovered pro rata to work certified, never more than the advance", () => {
  assert.equal(c.advanceRecoveryFor(1000000, 2500000, 10000000, 0), 250000);
  assert.equal(c.advanceRecoveryFor(1000000, 6000000, 10000000, 250000), 350000);
  assert.equal(c.advanceRecoveryFor(1000000, 12000000, 10000000, 900000), 100000, "variations take gross above contract: stop at the advance");
  assert.equal(c.advanceRecoveryFor(0, 5000000, 10000000, 0), 0);
  assert.equal(c.advanceRecoveryFor(1000000, 3000000, 10000000, 400000), 0, "already recovered more than the pro-rata target");
});

test("client certificate: base, VAT on base, WHT on base less retention, net = AR less WHT", () => {
  const r = c.certCalc({ grossToDate: 3000000, previous: 1000000, contractValue: 10000000, retentionPct: 10, retentionCapPct: 5, retentionBefore: 100000, advance: 1000000, advanceBefore: 100000, vatRate: 7, whtRate: 1 });
  assert.equal(r.thisPeriod, 2000000);
  assert.equal(r.retention, 200000);
  assert.equal(r.advanceRecovery, 200000);
  assert.equal(r.base, 1800000);
  assert.equal(r.vat, 126000);
  assert.equal(r.wht, 16000); // 1% of 1,600,000
  assert.equal(r.net, 1710000); // 1,800,000 + 126,000 − 200,000 − 16,000
  assert.equal(r.retentionToDate, 300000);
  assert.equal(r.advanceToDate, 300000);
});

test("subcontract certificate: back-charges reduce the base, WHT 3% on the whole base", () => {
  const r = c.certCalc({ grossToDate: 300000, previous: 0, contractValue: 1000000, retentionPct: 5, retentionCapPct: 5, retentionBefore: 0, advance: 100000, advanceBefore: 0, backCharges: 10000, vatRate: 7, whtRate: 3, whtOnRetention: true });
  assert.equal(r.retention, 15000);
  assert.equal(r.advanceRecovery, 30000);
  assert.equal(r.base, 260000);
  assert.equal(r.vat, 18200);
  assert.equal(r.wht, 7800);
  assert.equal(r.net, 255400);
});

test("prior totals chain certificates by number", () => {
  const list = [
    { no: 2, grossToDate: 500, retention: 25, advanceRecovery: 50, backCharges: 0, status: "certified" },
    { no: 1, grossToDate: 200, retention: 10, advanceRecovery: 20, backCharges: 5, status: "paid" },
  ];
  assert.deepEqual(c.priorTotals(list, 3), { previous: 500, retention: 35, advance: 70, backCharges: 5 });
  assert.deepEqual(c.priorTotals(list, 1), { previous: 0, retention: 0, advance: 0, backCharges: 0 });
});

test("variations: totals, contract value incl. approved only, budget merge, omission absorbed latest first", () => {
  const lines = [
    { qty: 10, unitPrice: 1000, unitCost: 800, costCode: "03" },
    { qty: -5, unitPrice: 200, unitCost: 150, costCode: "11" },
    { qty: 2, unitPrice: 500, unitCost: 300 },
  ];
  assert.deepEqual(c.voTotals(lines), { amount: 10000, cost: 7850 });
  assert.deepEqual(c.costByCode(lines, "90"), [
    { costCode: "03", amount: 8000 },
    { costCode: "11", amount: -750 },
    { costCode: "90", amount: 600 },
  ]);
  const vos = [
    { projectId: "P1", status: "approved", amount: 100, approvedAt: "2026-02-01" },
    { projectId: "P1", status: "submitted", amount: 999 },
    { projectId: "P1", status: "approved", amount: -30, approvedAt: "2026-05-01" },
    { projectId: "P2", status: "approved", amount: 50, approvedAt: "2026-01-01" },
  ];
  assert.equal(c.contractValueOf(1000, vos, "P1"), 1070);
  assert.equal(c.contractValueOf(1000, vos, "P1", "2026-03-01"), 1100);
  assert.deepEqual(c.mergeBudgetLines([{ costCode: "03", amount: 500 }], [{ costCode: "03", amount: 100 }, { costCode: "12", amount: 40 }]), [
    { costCode: "03", amount: 600 },
    { costCode: "12", amount: 40 },
  ]);
  assert.deepEqual(c.absorbOmission([{ id: "a", amount: 100 }, { id: "b", amount: 50 }], -120), { deltas: [{ id: "b", delta: -50 }, { id: "a", delta: -70 }], left: 0 });
  assert.equal(c.absorbOmission([{ id: "a", amount: 10 }], -25).left, 15);
});

test("progress weighted by value over leaf tasks; measured subcontract gross", () => {
  assert.equal(c.weightedProgress([]), undefined);
  const tasks = [
    { id: "S", value: 999, pct: 0 },
    { id: "A", parentId: "S", value: 300, pct: 100 },
    { id: "B", parentId: "S", value: 100, pct: 20 },
  ];
  assert.equal(c.weightedProgress(tasks), 80);
  assert.equal(c.weightedProgress([{ id: "x", value: 0, pct: 40 }, { id: "y", value: 0, pct: 60 }]), 50);
  assert.equal(c.measuredGross([{ id: "L1", qty: 10, rate: 100 }, { id: "L2", qty: 5, rate: 30 }], [{ lineId: "L1", qtyToDate: 4 }]), 400);
});

test("dates: month arithmetic clamps the day; retention due after the defects period", () => {
  assert.equal(c.addMonthsIso("2026-01-31", 1), "2026-02-28");
  assert.equal(c.retentionDueDate("2025-11-15", 12), "2026-11-15");
  assert.equal(c.retentionDueDate(undefined, 12), undefined);
  assert.equal(c.prequalResult(c.prequalTotal({ a: 30, b: 25, c: 10, d: 10 })), "approved");
  assert.equal(c.prequalResult(55), "pending");
  assert.equal(c.ratingScore({ quality: 5, time: 4, safety: 4, cooperation: 3 }), 4);
});

test("cash-flow: overdue falls in the first month, spread evenly, cumulative and negative months", () => {
  const months = c.monthsFrom("2026-11", 3);
  assert.deepEqual(months, ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(c.bucketByMonth([{ date: "2026-09-01", amount: 5 }, { date: "2026-12-10", amount: 7 }, { date: "2027-05-01", amount: 9 }], months), [5, 7, 0]);
  const spread = c.spreadEven(100, "2026-10-01", "2027-01-31", months);
  assert.deepEqual(spread.map((f: { amount: number }) => f.amount), [33.33, 33.33, 33.34]);
  assert.deepEqual(c.spreadEven(50, "2026-01-01", "2026-03-01", months).map((f: { date: string }) => f.date.slice(0, 7)), ["2026-11"]);
  const rows = c.cashflowRows(months, [100, 0, 50], [30, 200, 10], 50);
  assert.deepEqual(rows.map((r: { cumulative: number }) => r.cumulative), [120, -80, -40]);
  assert.deepEqual(rows.map((r: { negative: boolean }) => r.negative), [false, true, true]);
});
