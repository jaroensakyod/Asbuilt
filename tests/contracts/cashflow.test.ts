// Cash-flow forecast: receivables / payables bucketed by month, measured work forecast to finish, payroll, cumulative.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { buildCashflow, forecastCerts } = await lib("cashflow");
const { monthsFrom } = await lib("calc");

const months = monthsFrom("2026-11", 4);

test("measured work left is spread to the finish and paid net of retention, advance recovery and WHT", () => {
  const f = forecastCerts({ projectId: "P", finish: "2027-02-28", contractValue: 1000000, grossToDate: 600000, retentionPct: 10, retentionRoom: 30000, advanceLeft: 40000, whtRate: 1, payLagDays: 0 }, months, 7);
  assert.equal(f.length, 4);
  // 100,000 of work a month; retention 10,000 until 30,000 room is used; advance 10,000 a month
  assert.equal(f[0].amount, 85500); // base 90,000 × 1.07 − 10,000 − 1% of 80,000
  assert.equal(f[3].amount, 95400); // no retention room left: 96,300 − 900
});

test("cash-flow rows: overdue in the first month, payroll until the project ends, negative months flagged", () => {
  const cf = buildCashflow({
    months,
    vatRate: 7,
    receivables: [
      { cat: "installments", date: "2026-10-01", amount: 500000 },
      { cat: "retention", date: "2027-01-20", amount: 50000 },
    ],
    measured: [],
    payables: [
      { cat: "bills", date: "2026-11-30", amount: 300000 },
      { cat: "pos", date: "2026-12-15", amount: 700000 },
    ],
    subcontracts: [{ amount: 200000, finish: "2026-12-31" }],
    payrollMonthly: 50000,
    payrollUntil: "2027-01-31",
    opening: 100000,
  });
  assert.deepEqual(cf.inflow.installments, [500000, 0, 0, 0]);
  assert.deepEqual(cf.outflow.subs, [100000, 100000, 0, 0]);
  assert.deepEqual(cf.outflow.payroll, [50000, 50000, 50000, 0]);
  assert.deepEqual(cf.rows.map((r: { cumulative: number }) => r.cumulative), [150000, -700000, -700000, -700000]);
  assert.deepEqual(cf.rows.map((r: { negative: boolean }) => r.negative), [false, true, true, true]);
  assert.equal(cf.totalIn, 550000);
});
