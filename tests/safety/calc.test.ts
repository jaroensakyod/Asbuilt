// Run: node --test --experimental-strip-types tests/safety/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver for extensionless relative imports (URL import keeps tsc happy)
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);
const S = (await lib("calc")) as typeof import("../../src/lib/safety/calc");
type Sheet = import("../../src/lib/hr/types").AttendanceSheet;
type Incident = import("../../src/lib/safety/types").Incident;

const ladder = S.DEFAULT_SAFETY.ladder;

test("safety officer ladder: thresholds 2 / 20 / 50 / 100", () => {
  assert.deepEqual(S.jpCheck(1, ladder, []).needs, []);
  const small = S.jpCheck(8, ladder, []);
  assert.deepEqual(small.needs, [{ level: "supervisor", have: 0, ok: false }]);
  assert.equal(S.jpCheck(8, ladder, ["supervisor"]).ok, true);
  const mid = S.jpCheck(23, ladder, ["supervisor"]);
  assert.deepEqual(
    mid.needs.map((n) => [n.level, n.ok]),
    [
      ["supervisor", true],
      ["technical", false],
    ],
  );
  assert.equal(mid.committee, false);
  const big = S.jpCheck(60, ladder, ["supervisor", "technical"]);
  assert.equal(big.committee, true);
  assert.deepEqual(big.needs[1], { level: "advanced", have: 0, ok: false });
  // a higher level satisfies a lower technical rung
  assert.equal(S.jpCheck(60, ladder, ["supervisor", "professional"]).ok, true);
  assert.equal(S.jpCheck(120, ladder, ["supervisor", "advanced"]).ok, false);
});

test("ladder is configurable", () => {
  const custom = [
    { min: 10, level: "supervisor" as const },
    { min: 30, level: "technical" as const },
  ];
  assert.equal(S.jpCheck(8, custom, []).ok, true);
  assert.equal(S.jpCheck(30, custom, ["supervisor"]).ok, false);
});

test("man-hours from attendance and LTIFR", () => {
  const sheets: Sheet[] = [
    {
      id: "a",
      projectId: "P",
      date: "2026-11-02",
      by: "",
      entries: [
        { employeeId: "1", mark: "present", ot: 2 },
        { employeeId: "2", mark: "half", ot: 0 },
        { employeeId: "3", mark: "absent", ot: 0 },
      ],
    },
    { id: "b", projectId: "Q", date: "2026-11-02", by: "", entries: [{ employeeId: "4", mark: "present", ot: 0 }] },
  ];
  assert.equal(S.manHours(sheets), 22);
  assert.equal(S.manHours(sheets, 8, (s) => s.projectId === "P"), 14);
  assert.equal(S.ltifr(1, 500_000), 2);
  assert.equal(S.ltifr(1, 500_000, 200_000), 0.4);
  assert.equal(S.ltifr(0, 0), 0);
});

test("days without lost-time incident", () => {
  const inc = [
    { projectId: "P", cls: "lost_time" as const, date: "2026-09-18" },
    { projectId: "P", cls: "near_miss" as const, date: "2026-11-01" },
    { projectId: "Q", cls: "fatal" as const, date: "2026-10-30" },
  ];
  assert.equal(S.daysWithoutLti(inc, "P", "2025-09-26", "2026-11-04"), 47);
  assert.equal(S.daysWithoutLti(inc, "R", "2026-10-01", "2026-11-04"), 34);
});

test("inspection score ignores n/a items", () => {
  assert.equal(
    S.inspectionScore([
      { text: "a", result: "pass" },
      { text: "b", result: "fail" },
      { text: "c", result: "na" },
      { text: "d", result: "pass" },
    ]),
    67,
  );
  assert.equal(S.inspectionScore([]), 100);
});

test("permit overdue and incident follow-up", () => {
  assert.equal(S.permitOverdue({ status: "active", validTo: "2026-11-04T17:00" }, "2026-11-04T17:30"), true);
  assert.equal(S.permitOverdue({ status: "closed", validTo: "2026-11-04T17:00" }, "2026-11-04T17:30"), false);
  assert.equal(S.permitHours({ validFrom: "2026-11-04T08:00", validTo: "2026-11-04T17:30" }), 9.5);
  const inc = {
    status: "investigating",
    cls: "lost_time",
    actions: [{ id: "1", text: "", owner: "", due: "2026-11-01", done: false }],
    notify: [
      { item: "x", done: true },
      { item: "y", done: false },
    ],
  } as unknown as Incident;
  assert.deepEqual(S.incidentFollowUp(inc, "2026-11-04"), { open: 1, overdue: 1, notifyLeft: 1, kt16Missing: true, needs: true });
});
