// Aggregation helpers behind the company AI assistant's tools.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { aging, pipeline, rankLate, searchRank, textMatch, topN, countBy, sumBy, latestOnOrBefore, numArg, strArg, burnGap, daysDiff, addDaysIso } = await lib("agg");

const TODAY = "2026-11-04";

test("dates", () => {
  assert.equal(daysDiff("2026-11-01", TODAY), 3);
  assert.equal(daysDiff(TODAY, "2026-10-31"), -4);
  assert.equal(addDaysIso(TODAY, 30), "2026-12-04");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
});

test("aging: overdue, this month, horizon, buckets and per project", () => {
  const rows = [
    { id: "A", projectId: "P1", due: "2026-10-30", amount: 100 }, // 5 days overdue
    { id: "B", projectId: "P1", due: "2026-08-01", amount: 300 }, // 95 days overdue
    { id: "C", projectId: "P2", due: "2026-11-20", amount: 50 }, // this month
    { id: "D", projectId: "P2", due: "2026-12-01", amount: 70 }, // next month, within 30 days
    { id: "E", projectId: "P3", due: "2027-02-01", amount: 999 }, // far future
    { id: "Z", projectId: "P3", due: "2026-10-01", amount: 0 }, // nothing owed: ignored
  ];
  const a = aging(rows, TODAY, 30);
  assert.deepEqual(a.outstanding, { count: 5, amount: 1519 });
  assert.deepEqual(a.overdue, { count: 2, amount: 400 });
  assert.deepEqual(a.dueThisMonth, { count: 1, amount: 50 });
  assert.deepEqual(a.dueSoon, { days: 30, count: 2, amount: 120 });
  assert.deepEqual(a.buckets, { "1-30": 100, "31-60": 0, "61-90": 0, "90+": 300 });
  assert.deepEqual(
    a.overdueItems.map((r: { id: string; daysOverdue: number }) => [r.id, r.daysOverdue]),
    [
      ["B", 95],
      ["A", 5],
    ],
  );
  assert.deepEqual(
    a.upcomingItems.map((r: { id: string }) => r.id),
    ["C", "D", "E"],
  );
  assert.deepEqual(a.byProject[0], { projectId: "P1", amount: 400, overdue: 400 });
  // due today is not overdue
  assert.equal(aging([{ id: "T", due: TODAY, amount: 10 }], TODAY).overdue.count, 0);
});

test("pipeline: stage totals, weighted value, win rate and follow-ups", () => {
  const W = { new: 0.1, quoted: 0.5, won: 1, lost: 0 };
  const p = pipeline(
    [
      { id: "L1", stage: "new", budget: 1000, owner: "ก", nextFollowUp: "2026-11-01" },
      { id: "L2", stage: "quoted", budget: 2000, owner: "ข", nextFollowUp: "2026-11-10" },
      { id: "L3", stage: "won", budget: 3000, owner: "ก" },
      { id: "L4", stage: "lost", budget: 500, owner: "ข", nextFollowUp: "2026-10-01" },
      { id: "L5", stage: "lost", budget: 500, owner: "ข" },
    ],
    W,
    TODAY,
  );
  assert.deepEqual(
    p.stages.map((s: { stage: string; count: number; weighted: number }) => [s.stage, s.count, s.weighted]),
    [
      ["new", 1, 100],
      ["quoted", 1, 1000],
      ["won", 1, 3000],
      ["lost", 2, 0],
    ],
  );
  assert.deepEqual(p.open, { count: 2, value: 3000, weighted: 1100 });
  assert.equal(p.winRate, 33.3);
  // only open leads with a follow-up on or before today
  assert.deepEqual(
    p.followUpsDue.map((f: { id: string; overdueDays: number }) => [f.id, f.overdueDays]),
    [["L1", 3]],
  );
  assert.equal(p.byOwner[0].owner, "ข");
});

test("rankLate: days late first, then points behind plan, then SPI", () => {
  const r = rankLate([
    { id: "A", pct: 50, planPct: 55, daysLate: 0, spi: 0.95 },
    { id: "B", pct: 40, planPct: 60, daysLate: 12, spi: 0.7 },
    { id: "C", pct: 30, planPct: 50, daysLate: 0, spi: 0.8 },
    { id: "D", pct: 30, planPct: 50, daysLate: 0, spi: 0.6 },
  ]);
  assert.deepEqual(
    r.map((x: { id: string }) => x.id),
    ["B", "D", "C", "A"],
  );
  assert.equal(r[0].behindPts, 20);
});

test("searchRank: exact id beats prefix beats title; Thai tokens; limit", () => {
  const items = [
    { kind: "โครงการ", id: "HC-2026-02", title: "บ้านคุณสมชาย", href: "/projects/HC-2026-02" },
    { kind: "โครงการ", id: "HC-2026-021", title: "บ้านคุณวิภา", href: "/projects/HC-2026-021" },
    { kind: "RFI", id: "RFI-HC-2026-02-001", title: "ระยะเหล็กเสริมคาน", href: "/rfi/RFI-HC-2026-02-001", sub: "รอตอบ" },
    { kind: "ผู้ขาย", id: "SUP-001", title: "เหล็กสยาม ค้าวัสดุ", href: "/suppliers?q=SUP-001" },
  ];
  const r = searchRank(items, "hc-2026-02");
  assert.deepEqual(
    r.map((x: { id: string }) => x.id),
    ["HC-2026-02", "HC-2026-021", "RFI-HC-2026-02-001"],
  );
  assert.equal(r[0].score, 100);
  assert.equal(searchRank(items, "สมชาย")[0].id, "HC-2026-02");
  assert.equal(searchRank(items, "เหล็ก รอตอบ")[0].id, "RFI-HC-2026-02-001");
  assert.equal(searchRank(items, "   ").length, 0);
  assert.equal(searchRank(items, "HC", 2).length, 2);
});

test("textMatch, topN, countBy, sumBy", () => {
  assert.equal(textMatch(undefined, "x"), true);
  assert.equal(textMatch("ศิริพร", "ศิริพร ตั้งเจริญ"), true);
  assert.equal(textMatch("hc 2026 02", "HC-2026-02"), true);
  assert.equal(textMatch("ธีรวัฒน์", "ศิริพร ตั้งเจริญ"), false);
  assert.deepEqual(topN([1, 2, 3, 4], 2), { items: [1, 2], total: 4, more: 2 });
  assert.deepEqual(topN([1], 999).more, 0);
  assert.deepEqual(
    countBy([{ s: "a" }, { s: "b" }, { s: "a" }, {}], (x: { s?: string }) => x.s),
    { a: 2, b: 1 },
  );
  assert.deepEqual(
    sumBy([{ k: "x", v: 2 }, { k: "x", v: 3 }, { k: "y", v: 1 }], (x: { k: string }) => x.k, (x: { v: number }) => x.v),
    { x: 5, y: 1 },
  );
});

test("argument guards and small helpers", () => {
  assert.equal(numArg(undefined, 10), 10);
  assert.equal(numArg("7", 10), 7);
  assert.equal(numArg(500, 10), 50);
  assert.equal(numArg(-3, 10, 0, 60), 0);
  assert.equal(strArg("  "), undefined);
  assert.equal(strArg(" HC-2026-02 "), "HC-2026-02");
  assert.equal(strArg(5), undefined);
  assert.equal(latestOnOrBefore(["2026-11-02", "2026-11-05", "2026-11-04", "2026-10-30"], TODAY), "2026-11-04");
  assert.equal(latestOnOrBefore(["2026-12-01"], TODAY), undefined);
  assert.equal(burnGap(62.5, 50), 12.5);
  assert.equal(burnGap(null, 50), null);
});
