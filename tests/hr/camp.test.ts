// Run: node --test --experimental-strip-types tests/hr/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver for extensionless relative imports (URL import keeps tsc happy)
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);
const C = (await lib("camp")) as typeof import("../../src/lib/hr/camp");
type Camp = import("../../src/lib/hr/labour-types").Camp;

const camp = (o: Partial<Camp> = {}): Camp => ({
  id: "CMP-01",
  projectId: "P",
  name: "",
  address: "",
  waterRate: 20,
  elecRate: 7,
  allocation: "per_head",
  chargeWorkers: true,
  facilities: [],
  rooms: [
    { id: "r1", no: "A1", capacity: 4, kind: "male", occupants: ["a", "b", "c"] },
    { id: "r2", no: "A2", capacity: 2, kind: "male", occupants: ["d", "e", "f"] },
    { id: "r3", no: "A3", capacity: 4, kind: "male", occupants: [] },
  ],
  ...o,
});

test("occupancy flags rooms over capacity", () => {
  const o = C.occupancy(camp());
  assert.equal(o.beds, 10);
  assert.equal(o.occupied, 6);
  assert.equal(o.pct, 60);
  assert.deepEqual(
    o.over.map((r) => r.no),
    ["A2"],
  );
});

test("meter cost = units × rate, never negative", () => {
  assert.deepEqual(C.meterCost({ waterPrev: 100, waterCurr: 160, elecPrev: 1000, elecCurr: 1500 }, camp()), { water: 60, elec: 500, waterCost: 1200, elecCost: 3500, total: 4700 });
  assert.equal(C.meterCost({ waterPrev: 100, waterCurr: 90, elecPrev: 0, elecCurr: 0 }, camp()).total, 0);
});

test("allocation per head and per room", () => {
  const head = C.allocate(camp(), 600);
  assert.equal(head.get("a"), 100);
  assert.equal(head.get("f"), 100);
  assert.equal(head.size, 6);
  const room = C.allocate(camp({ allocation: "per_room" }), 600);
  // 2 occupied rooms → 300 each → 100 per person in both rooms
  assert.equal(room.get("a"), 100);
  const uneven = C.allocate(camp({ allocation: "per_room", rooms: [{ id: "r1", no: "A1", capacity: 4, kind: "male", occupants: ["a"] }, { id: "r2", no: "A2", capacity: 4, kind: "male", occupants: ["b", "c", "d"] }] }), 600);
  assert.equal(uneven.get("a"), 300);
  assert.equal(uneven.get("b"), 100);
  assert.equal(C.allocate(camp({ rooms: [] }), 600).size, 0);
});

test("checklist score and next reading", () => {
  assert.equal(C.campScore([{ text: "a", ok: true }, { text: "b", ok: false }, { text: "c", ok: true }, { text: "d", ok: true }]), 75);
  const meters = [
    { id: "1", campId: "CMP-01", period: "2026-09", waterPrev: 0, waterCurr: 50, elecPrev: 0, elecCurr: 400, by: "", photos: [] },
    { id: "2", campId: "CMP-01", period: "2026-10", waterPrev: 50, waterCurr: 120, elecPrev: 400, elecCurr: 900, by: "", photos: [] },
  ];
  assert.deepEqual(C.nextReading(meters, "CMP-01"), { waterPrev: 120, elecPrev: 900, lastPeriod: "2026-10" });
  assert.deepEqual(C.nextReading(meters, "CMP-02"), { waterPrev: 0, elecPrev: 0, lastPeriod: undefined });
});
