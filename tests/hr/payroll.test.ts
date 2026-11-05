// Run: node --test --experimental-strip-types tests/hr/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// Loaded by path so tsc (no allowImportingTsExtensions) does not see a ".ts" import;
// the type still comes from the module itself.
const path = "../../src/lib/hr/calc.ts";
const calc = (await import(path)) as typeof import("../../src/lib/hr/calc");
const { DEFAULT_SSO, NO_ALLOWANCES, annualPit, dailyWage, monthlyWht, otPayMonthly, progressiveTax, ssoMonthly, ssoMonthlyMax, ssoPartial } = calc;

test("SSO is 5% of wage, clamped to floor 1,650 and ceiling 15,000", () => {
  assert.equal(ssoMonthly(10_000), 500);
  assert.equal(ssoMonthly(15_000), 750);
  assert.equal(ssoMonthly(20_000), 750);
  assert.equal(ssoMonthly(120_000), 750);
  assert.equal(ssoMonthly(1_000), 83); // floor 1,650 × 5% = 82.5 → 83
  assert.equal(ssoMonthly(0), 0);
  assert.equal(ssoMonthlyMax(), 750);
});

test("SSO ceiling is configurable", () => {
  const raised = { ...DEFAULT_SSO, ceiling: 17_500 };
  assert.equal(ssoMonthly(20_000, raised), 875);
  assert.equal(ssoMonthlyMax(raised), 875);
});

test("SSO on weekly runs stops at the monthly cap", () => {
  // 4 weekly runs of 4,500 baht: 225 + 225 + 225 + 75 (cap 750)
  let paid = 0;
  const parts = [4500, 4500, 4500, 4500].map((w) => {
    const s = ssoPartial(w, paid);
    paid += s;
    return s;
  });
  assert.deepEqual(parts, [225, 225, 225, 75]);
  assert.equal(paid, 750);
});

test("progressive brackets", () => {
  assert.equal(progressiveTax(150_000), 0);
  assert.equal(progressiveTax(300_000), 7_500);
  assert.equal(progressiveTax(500_000), 27_500);
  assert.equal(progressiveTax(750_000), 65_000);
  assert.equal(progressiveTax(1_000_000), 115_000);
  assert.equal(progressiveTax(2_000_000), 365_000);
  assert.equal(progressiveTax(5_000_000), 1_265_000);
  assert.equal(progressiveTax(6_000_000), 1_615_000);
});

test("PND1 annualised: 20,000 / month pays no tax", () => {
  // 240,000 − expense 100,000 − personal 60,000 − SSO 9,000 = 71,000 → 0
  const y = annualPit(240_000, NO_ALLOWANCES, 9_000);
  assert.equal(y.taxable, 71_000);
  assert.equal(y.tax, 0);
  assert.equal(monthlyWht(20_000, NO_ALLOWANCES, 750), 0);
});

test("PND1 annualised: 50,000 / month", () => {
  // 600,000 − 100,000 − 60,000 − 9,000 = 431,000 → 7,500 + 13,100 = 20,600 / 12
  const y = annualPit(600_000, NO_ALLOWANCES, 9_000);
  assert.equal(y.taxable, 431_000);
  assert.equal(y.tax, 20_600);
  assert.equal(monthlyWht(50_000, NO_ALLOWANCES, 750), 1_716.67);
});

test("PND1 annualised: 120,000 / month", () => {
  // 1,440,000 − 100,000 − 60,000 − 9,000 = 1,271,000
  // 7,500 + 20,000 + 37,500 + 50,000 + 271,000 × 25% = 182,750 / 12
  const y = annualPit(1_440_000, NO_ALLOWANCES, 9_000);
  assert.equal(y.tax, 182_750);
  assert.equal(monthlyWht(120_000, NO_ALLOWANCES, 750), 15_229.17);
});

test("PND1 allowances reduce tax (spouse + 2 children + life insurance)", () => {
  const a = { ...NO_ALLOWANCES, spouse: true, children: 2, lifeInsurance: 150_000 };
  // 600,000 − 100,000 − (60,000 + 60,000 + 60,000 + 9,000 + 100,000 capped) = 211,000 → 3,050
  const y = annualPit(600_000, a, 9_000);
  assert.equal(y.taxable, 211_000);
  assert.equal(y.tax, 3_050);
});

test("daily wage: days × rate + OT 1.5×", () => {
  // 6 days × 400 = 2,400; OT 4 h × 400/8 × 1.5 = 300
  assert.deepEqual(dailyWage(6, 400, 4), { base: 2_400, ot: 300, gross: 2_700 });
  // half day counts 0.5
  assert.deepEqual(dailyWage(5.5, 600, 0), { base: 3_300, ot: 0, gross: 3_300 });
  assert.deepEqual(dailyWage(6, 650, 3), { base: 3_900, ot: 365.63, gross: 4_265.63 });
});

test("monthly staff OT = salary / 30 / 8 × 1.5 × hours", () => {
  assert.equal(otPayMonthly(24_000, 10), 1_500);
});
