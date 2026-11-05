// Interior: pricing, selection differences → variation, late selections, FF&E delivery,
// room budgets, sample returns and the fee schedule.
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver before any interior module is imported
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const c = await lib("calc");

const sel = (over: Record<string, unknown> = {}) => ({
  id: "SEL-HC-1-01",
  projectId: "HC-1",
  room: "ห้องน้ำ 1",
  category: "wall",
  item: "กระเบื้องผนัง",
  qty: 30,
  unit: "ตร.ม.",
  allowanceUnit: 380,
  allowanceCostUnit: 290,
  options: [
    { id: "o1", name: "มาตรฐาน", price: 380, cost: 290, images: [] },
    { id: "o2", name: "พอร์ซเลน", brand: "กระเบื้องงาม", price: 920, cost: 700, images: [] },
    { id: "o3", name: "ถูกกว่า", price: 300, images: [] },
  ],
  deadline: "2026-11-01",
  status: "chosen",
  chosenId: "o2",
  ...over,
});

test("markup and margin", () => {
  assert.equal(c.priceFromMarkup(28500, 35), 38475);
  assert.equal(c.markupFromPrice(28500, 38475), 35);
  assert.equal(c.marginPct(700, 1000), 30);
  assert.equal(c.markupFromPrice(0, 100), 0);
});

test("selection difference and cost difference", () => {
  assert.equal(c.allowanceTotal(sel()), 11400);
  assert.equal(c.selectionDiff(sel()), 16200);
  assert.equal(c.selectionCostDiff(sel()), 12300);
  assert.equal(c.selectionDiff(sel({ chosenId: "o1" })), 0);
  assert.equal(c.selectionDiff(sel({ chosenId: undefined })), 0);
  // omission: cheaper option, cost taken from the ratio
  assert.equal(c.selectionDiff(sel({ chosenId: "o3" })), -2400);
  assert.equal(c.selectionCostDiff(sel({ chosenId: "o3" })), 30 * (240 - 290));
});

test("variation from an approved selection", () => {
  const v = c.selectionVariation(sel({ status: "approved" }), { no: 3, by: "ณัฐชา", today: "2026-11-04" });
  assert.equal(v.id, "VO-HC-1-3");
  assert.equal(v.origin, "selection");
  assert.equal(v.selectionId, "SEL-HC-1-01");
  assert.equal(v.status, "submitted");
  assert.equal(v.amount, 16200);
  assert.equal(v.cost, 12300);
  assert.equal(v.lines[0].unitPrice, 540);
  assert.equal(v.lines[0].costCode, "10");
  assert.equal(v.lines[0].qty * v.lines[0].unitPrice, v.amount);
  assert.equal(c.selectionVariation(sel({ chosenId: "o1" }), { no: 1, by: "", today: "" }), undefined);
  assert.equal(c.nextVariationNo([{ projectId: "HC-1", no: 2 }, { projectId: "HC-9", no: 7 }], "HC-1"), 3);
});

test("late selections and summary", () => {
  assert.equal(c.isSelectionLate(sel({ status: "pending" }), "2026-11-04"), true);
  assert.equal(c.isSelectionLate(sel({ status: "chosen" }), "2026-11-04"), false);
  assert.equal(c.isSelectionLate(sel({ status: "pending", deadline: "2026-11-04" }), "2026-11-04"), false);
  assert.equal(c.daysToDeadline(sel(), "2026-11-04"), -3);
  const s = c.selectionSummary([sel(), sel({ status: "pending", chosenId: undefined }), sel({ status: "approved", chosenId: "o1" })], "2026-11-04");
  assert.deepEqual([s.total, s.late, s.pending, s.chosen, s.approved, s.diff], [3, 1, 1, 1, 1, 16200]);
});

test("FF&E expected delivery, lateness and room budgets", () => {
  assert.equal(c.expectedDelivery("2026-10-01", 45), "2026-11-15");
  assert.equal(c.isFfeLate({ status: "confirmed", expectedAt: "2026-10-30" }, "2026-11-04"), true);
  assert.equal(c.isFfeLate({ status: "received", expectedAt: "2026-10-30" }, "2026-11-04"), false);
  assert.equal(c.isFfeLate({ status: "specified", expectedAt: "2026-10-30" }, "2026-11-04"), false);
  const items = [
    { room: "A", qty: 2, unitCost: 100, unitSell: 150, status: "installed" },
    { room: "A", qty: 1, unitCost: 200, unitSell: 300, status: "ordered" },
    { room: "A", qty: 1, unitCost: 50, unitSell: 80, status: "specified" },
    { room: "B", qty: 1, unitCost: 10, unitSell: 20, status: "received" },
  ];
  const b = c.roomBudgets([{ name: "A", budget: 1000 }], items);
  assert.deepEqual(b.map((r: { room: string }) => r.room), ["A", "B"]);
  assert.deepEqual([b[0].specified, b[0].committed, b[0].actual, b[0].cost, b[0].variance], [680, 600, 300, 450, 320]);
  assert.equal(b[1].allowance, 0);
  assert.equal(b[1].variance, -20);
});

test("sample return dates", () => {
  assert.equal(c.sampleReturnBy({ shownAt: "2026-10-16" }, 14), "2026-10-30");
  assert.equal(c.sampleReturnBy({ returnBy: "2026-11-30", shownAt: "2026-10-16" }, 14), "2026-11-30");
  assert.equal(c.isSampleOverdue({ status: "shown", shownAt: "2026-10-16" }, "2026-11-04", 14), true);
  assert.equal(c.isSampleOverdue({ status: "returned", shownAt: "2026-10-16" }, "2026-11-04", 14), false);
  assert.equal(c.isSampleOverdue({ status: "received", receivedAt: "2026-10-28" }, "2026-11-04", 14), false);
});

test("fee schedule adds up to the fee", () => {
  const f = c.defaultFeeSchedule(85001, "2026-10-05", "2027-02-26");
  assert.equal(f.length, 3);
  assert.equal(Math.round(f.reduce((t: number, x: { amount: number }) => t + x.amount, 0) * 100) / 100, 85001);
  assert.equal(f[0].amount, 25500.3);
  assert.equal(f[0].due, "2026-10-05");
  assert.equal(f[2].due, "2027-02-26");
});
