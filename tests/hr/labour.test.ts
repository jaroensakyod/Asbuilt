// Run: node --test --experimental-strip-types tests/hr/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver for extensionless relative imports (URL import keeps tsc happy)
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const L = (await lib("labour")) as typeof import("../../src/lib/hr/labour");
const C = (await lib("clock")) as typeof import("../../src/lib/hr/clock");
type Advance = import("../../src/lib/hr/labour-types").Advance;
type HrLine = import("../../src/lib/hr/types").HrLine;
type Sheet = import("../../src/lib/hr/types").AttendanceSheet;

const adv = (o: Partial<Advance> = {}): Advance => ({ id: "ADV-1", employeeId: "E1", date: "2026-10-01", amount: 3000, reason: "", installments: 3, status: "approved", requestedBy: "", recovered: [], ...o });
const line = (o: Partial<HrLine> = {}): HrLine => ({ employeeId: "E1", name: "ก", kind: "daily", gross: 3000, ot: 0, sso: 150, wht: 0, net: 2850, deduction: 0, ...o });

test("piece-rate claim: qty × rate, retention, WHT 3% on gross, advance", () => {
  assert.deepEqual(L.claimAmount(120, 85, 3, 5), { gross: 10200, retention: 510, wht: 306, advance: 0, net: 9384 });
  // advance recovery is capped at what is left after retention and WHT
  const a = L.claimAmount(10, 100, 3, 0, 5000);
  assert.equal(a.advance, 970);
  assert.equal(a.net, 0);
});

test("advance instalment rounds up and balance counts runs, cash and crew payments", () => {
  assert.equal(L.advanceInstalment({ amount: 2500, installments: 3 }), 834);
  const runs = [
    { id: "R1", status: "paid" as const, lines: [{ advances: [{ id: "ADV-1", amount: 1000 }] }] },
    { id: "R2", status: "draft" as const, lines: [{ advances: [{ id: "ADV-1", amount: 500 }] }] },
  ];
  const b = L.advanceBalance(adv({ recovered: [{ date: "2026-10-05", amount: 500, ref: "เงินสด" }] }), runs);
  assert.deepEqual(b, { recovered: 500, payroll: 1000, inDraft: 500, crew: 0, outstanding: 1000 });
  // excluding the run being rebuilt
  assert.equal(L.advanceBalance(adv(), runs, [], "R2").outstanding, 2000);
});

test("applyAdvances deducts the instalment once per employee and respects the deduction cap", () => {
  const out = L.applyAdvances([line(), line({ projectId: "P2" })], "R9", [adv()], []);
  assert.equal(out[0].deduction, 600); // 1,000 instalment capped at 20% of 3,000
  assert.deepEqual(out[0].advances, [{ id: "ADV-1", amount: 600 }]);
  assert.equal(out[0].net, 2250);
  assert.equal(out[1].deduction, 0);
  // re-applying replaces the earlier advance part, keeps other deductions
  const again = L.applyAdvances([{ ...out[0], deduction: 800, deductionNote: "ค่าเสียหาย" }], "R9", [adv()], [], [], 0.5);
  assert.equal(again[0].deduction, 1200); // 200 other + 1,000 instalment
  // pending advances are not deducted
  assert.equal(L.applyAdvances([line()], "R9", [adv({ status: "pending" })], [])[0].deduction, 0);
});

test("minimum wage per province", () => {
  assert.equal(L.minWageFor("กรุงเทพฯ"), 400);
  assert.equal(L.minWageFor("ไม่มีในตาราง"), L.DEFAULT_LABOUR.defaultMinWage);
  const emp = { id: "E1", type: "daily", name: "ก", dailyRate: 380, status: "active", projectId: "P1" } as import("../../src/lib/hr/types").Employee;
  assert.equal(L.minWageIssues([emp], () => "กรุงเทพฯ").length, 1);
  assert.equal(L.minWageIssues([emp], () => "เชียงใหม่").length, 0);
});

test("weekly OT cap and holiday OT 3×", () => {
  const sheets: Sheet[] = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"].map((date) => ({ id: date, projectId: "P", date, by: "", entries: [{ employeeId: "E1", mark: "present", ot: 6.5 }] }));
  assert.equal(L.weekStart("2026-11-07"), "2026-11-02");
  const issues = L.otCapIssues(sheets, "2026-11-01", "2026-11-30", () => "ก");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].amount, 39);
  const hol = L.holidayOtIssues(sheets, "2026-11-01", "2026-11-30", new Set(["2026-11-03"]), () => 400, () => "ก");
  // 6.5 h × 50 × (3 − 1.5)
  assert.equal(hol[0].amount, 487.5);
});

test("geofence distance and check", () => {
  const d = C.distanceM(13.75, 100.5, 13.7527, 100.5);
  assert.ok(d > 290 && d < 310, String(d));
  assert.deepEqual(C.checkFence({ lat: 13.75, lng: 100.5 }, { lat: 13.75, lng: 100.501, radius: 300 }), { dist: 108, inside: true });
  assert.equal(C.checkFence({ lat: 13.76, lng: 100.5 }, { lat: 13.75, lng: 100.5, radius: 300 }).inside, false);
  assert.deepEqual(C.checkFence({ lat: 1, lng: 1 }, { radius: 300 }), {});
});

test("clock in/out → day mark and OT", () => {
  assert.equal(C.workedHours("07:45", "17:00"), 8.25);
  assert.deepEqual(C.markFromStamps("07:30", "17:14"), { mark: "present", ot: 0, hours: 8.73 });
  assert.deepEqual(C.markFromStamps("07:45", "19:20"), { mark: "present", ot: 2, hours: 10.58 });
  assert.deepEqual(C.markFromStamps("07:50", "12:00"), { mark: "half", ot: 0, hours: 4.17 });
  let s = C.clockIn(undefined, { projectId: "P", date: "2026-11-04", by: "หัวหน้า" }, "E1", { at: "07:40", method: "gps", inside: true });
  s = C.clockIn(s, { projectId: "P", date: "2026-11-04", by: "หัวหน้า" }, "E1", { at: "08:30", method: "gps" });
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].in?.at, "07:40");
  s = C.clockOut(s, "E1", { at: "19:10", method: "gps" });
  assert.equal(s.entries[0].mark, "present");
  assert.equal(s.entries[0].ot, 2);
  assert.equal(s.id, "ATT-P-2026-11-04");
  assert.equal(C.verification(s.entries[0]), "gps");
  assert.equal(C.verification({ employeeId: "x", mark: "present", ot: 0 }), "manual");
});
