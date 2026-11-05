import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { factorF, medianPrice, boqTotals, bidFromMarkup, kValue, kAdjustment, trunc, penalty, daysLate, winStats, formulaWeight, kClaimDeadline, bondAmount, vsPct } = await lib("calc");

const TABLE = [
  { cost: 1_000_000, factor: 1.3 },
  { cost: 5_000_000, factor: 1.26 },
  { cost: 10_000_000, factor: 1.24 },
];

test("Factor F: clamps at both ends and interpolates linearly between rows", () => {
  assert.equal(factorF(TABLE, 500_000), 1.3);
  assert.equal(factorF(TABLE, 1_000_000), 1.3);
  assert.equal(factorF(TABLE, 3_000_000), 1.28); // halfway 1.30 → 1.26
  assert.equal(factorF(TABLE, 7_500_000), 1.25);
  assert.equal(factorF(TABLE, 50_000_000), 1.24);
  // unsorted table works too
  assert.equal(factorF([...TABLE].reverse(), 3_000_000), 1.28);
  assert.equal(factorF([], 3_000_000), 1);
});

test("ราคากลาง = direct × F + items outside F with VAT only", () => {
  const lines = [
    { id: "1", group: "a", description: "คอนกรีต", qty: 100, unit: "ลบ.ม.", material: 20_000, labour: 10_000 }, // 3,000,000
    { id: "2", group: "b", description: "ครุภัณฑ์", qty: 1, unit: "ชุด", material: 100_000, labour: 0, noF: true },
  ];
  const t = boqTotals(lines);
  assert.equal(t.direct, 3_000_000);
  assert.equal(t.noF, 100_000);
  const m = medianPrice(lines, TABLE, 7);
  assert.equal(m.factor, 1.28);
  assert.equal(m.withF, 3_840_000);
  assert.equal(m.outside, 107_000);
  assert.equal(m.total, 3_947_000);
  assert.equal(medianPrice(lines, TABLE, 7, 1.25).withF, 3_750_000);
  const bid = bidFromMarkup(lines, 10, 7);
  assert.equal(bid.cost, 3_100_000);
  assert.equal(bid.beforeVat, 3_410_000);
  assert.equal(bid.total, 3_648_700);
  assert.equal(vsPct(3_648_700, 3_947_000), -7.56);
});

const BLD = { id: "K-BLD", name: "งานอาคาร", constant: 0.25, terms: [{ sym: "I", coef: 0.15 }, { sym: "C", coef: 0.1 }, { sym: "M", coef: 0.4 }, { sym: "S", coef: 0.1 }] };

test("ค่า K: building formula, ratios cut to 3 decimals", () => {
  assert.equal(formulaWeight(BLD), 1);
  const same = kValue(BLD, { I: 100, C: 100, M: 100, S: 100 }, { I: 100, C: 100, M: 100, S: 100 });
  assert.equal(same.k, 1);
  const r = kValue(BLD, { I: 110, C: 120, M: 115, S: 150 }, { I: 100, C: 100, M: 100, S: 100 });
  // 0.25 + 0.15×1.1 + 0.1×1.2 + 0.4×1.15 + 0.1×1.5 = 1.145
  assert.equal(r.k, 1.145);
  assert.deepEqual(r.missing, []);
  // 107/103 = 1.038834… → 1.038 (cut, not rounded)
  const c = kValue({ id: "x", name: "x", constant: 0, terms: [{ sym: "I", coef: 1 }] }, { I: 107 }, { I: 103 });
  assert.equal(c.ratios[0].ratio, 1.038);
  assert.equal(trunc(1.0389, 3), 1.038);
  assert.equal(trunc(-0.0389, 3), -0.038);
  const miss = kValue(BLD, { I: 110 }, { I: 100, C: 100 });
  assert.deepEqual(miss.missing, ["C", "M", "S"]);
});

test("ค่า K: only the part beyond ±4% is paid or deducted", () => {
  assert.deepEqual(kAdjustment(1.03, 1_000_000, 4), { applies: false, kNet: 0, amount: 0 });
  assert.deepEqual(kAdjustment(0.97, 1_000_000, 4), { applies: false, kNet: 0, amount: 0 });
  const up = kAdjustment(1.065, 1_000_000, 4);
  assert.equal(up.applies, true);
  assert.equal(up.amount, 25_000);
  const down = kAdjustment(0.95, 2_000_000, 4);
  assert.equal(down.amount, -20_000);
  // threshold is a setting
  assert.equal(kAdjustment(1.03, 1_000_000, 2).amount, 10_000);
  assert.equal(kClaimDeadline("2026-10-01", 90), "2026-12-30");
});

test("ค่าปรับรายวัน: rate % of contract per day with a daily minimum and the 10% flag", () => {
  assert.equal(daysLate("2026-10-27", "2026-11-04"), 8);
  assert.equal(daysLate("2026-10-27", "2026-10-20"), 0);
  const p = penalty(5_210_000, 0.1, 8, 100);
  assert.equal(p.perDay, 5_210);
  assert.equal(p.total, 41_680);
  assert.equal(p.pct, 0.8);
  assert.equal(p.overTen, false);
  assert.equal(penalty(50_000, 0.1, 3, 100).perDay, 100); // minimum applies
  assert.equal(penalty(1_000_000, 0.1, 100).overTen, true);
  assert.equal(bondAmount(14_500_000, 5), 725_000);
});

test("win rate by source", () => {
  const s = winStats([
    { status: "won", source: "egp", bidPrice: 100 },
    { status: "lost", source: "egp", bidPrice: 90 },
    { status: "won", source: "private", award: { value: 300 } },
    { status: "submitted", source: "private" },
  ]);
  assert.equal(s.decided, 3);
  assert.equal(s.won, 2);
  assert.equal(s.rate, 66.67);
  assert.equal(s.valueWon, 400);
  assert.equal(s.bySource[1].rate, 50);
});
