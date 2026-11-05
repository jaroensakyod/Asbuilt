// Run: node --test --experimental-strip-types tests/plant/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver for extensionless relative imports (URL import keeps tsc happy)
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);
const P = (await lib("calc")) as typeof import("../../src/lib/plant/calc");
type Plant = import("../../src/lib/plant/types").Plant;
type Booking = import("../../src/lib/plant/types").PlantBooking;
type Usage = import("../../src/lib/plant/types").PlantUsage;

const plant = (o: Partial<Plant>): Plant => ({ id: "PL-1", name: "x", type: "excavator", ownership: "owned", rateBasis: "hour", rate: 850, costCode: "02", status: "on_site", photos: [], ...o });
const bk = (id: string, plantId: string, from: string, to: string, status: Booking["status"] = "booked"): Booking => ({ id, plantId, projectId: "P", from, to, purpose: "", by: "", status });
const use = (date: string, hours: number, fuelL = 0, projectId = "P"): Usage => ({ id: date, plantId: "PL-1", projectId, date, hours, fuelL, operatorName: "" });

test("crane inspection interval by capacity (configurable)", () => {
  assert.equal(P.craneIntervalMonths(1), 6);
  assert.equal(P.craneIntervalMonths(5), 3);
  assert.equal(P.craneIntervalMonths(80), 3);
  assert.equal(P.craneIntervalMonths(5, { ...P.DEFAULT_PLANT, craneIntervals: [{ maxT: 10, months: 12 }] }), 12);
  assert.equal(P.addMonths("2026-08-31", 3), "2026-11-30");
  assert.equal(P.certExpiry("crane_periodic", "2026-08-12", { capacityT: 5 }), "2026-11-12");
});

test("required certificates: cranes and tall scaffold only", () => {
  assert.deepEqual(P.requiredCerts({ type: "tower_crane" }), ["crane_load_test", "crane_periodic"]);
  assert.deepEqual(P.requiredCerts({ type: "scaffold", heightM: 22 }), ["scaffold_engineer"]);
  assert.deepEqual(P.requiredCerts({ type: "scaffold", heightM: 12 }), []);
  assert.deepEqual(P.requiredCerts({ type: "excavator" }), []);
});

test("certificate states", () => {
  const p = plant({ type: "mobile_crane", capacityT: 25 });
  const certs = [{ id: "c1", plantId: "PL-1", kind: "crane_periodic" as const, issuedAt: "2026-08-12", expiry: "2026-11-12", inspector: "", result: "pass" as const, attachments: [] }];
  assert.equal(P.certStates(p, certs, "2026-11-04")[0].state, "expiring");
  assert.equal(P.certStates(p, certs, "2026-11-04")[0].daysLeft, 8);
  assert.equal(P.certStates(p, certs, "2026-11-20")[0].state, "expired");
  assert.equal(P.certStates(p, certs, "2026-09-01")[0].state, "ok");
  assert.equal(P.certStates(p, [], "2026-09-01")[0].state, "missing");
});

test("double booking", () => {
  const list = [bk("a", "PL-1", "2026-11-06", "2026-11-06"), bk("b", "PL-1", "2026-11-06", "2026-11-07"), bk("c", "PL-1", "2026-11-08", "2026-11-09"), bk("d", "PL-2", "2026-11-06", "2026-11-06"), bk("e", "PL-1", "2026-11-01", "2026-11-30", "cancelled")];
  const pairs = P.doubleBookings(list);
  assert.equal(pairs.length, 1);
  assert.deepEqual(
    pairs[0].map((x) => x.id),
    ["a", "b"],
  );
  assert.deepEqual(
    P.clashes({ id: "new", plantId: "PL-1", from: "2026-11-07", to: "2026-11-08" }, list).map((x) => x.id),
    ["b", "c"],
  );
});

test("monthly usage cost by rate basis plus fuel", () => {
  const u = [use("2026-10-01", 6, 45), use("2026-10-02", 4, 30), use("2026-10-02", 0, 0), use("2026-11-01", 8, 60), use("2026-10-03", 5, 0, "Q")];
  const hour = P.usageCost(plant({}), u, "P", "2026-10");
  assert.deepEqual([hour.hours, hour.days, hour.fuelL, hour.hire, hour.fuel, hour.total], [10, 2, 75, 8500, 2400, 10900]);
  assert.equal(P.usageCost(plant({ rateBasis: "day", rate: 4500 }), u, "P", "2026-10").hire, 9000);
  assert.equal(P.usageCost(plant({ rateBasis: "month", rate: 26000 }), u, "P", "2026-10").hire, 2000);
  assert.equal(P.monthCosts([plant({})], u, "2026-10").length, 2);
  assert.equal(P.plantCostId({ projectId: "P", period: "2026-10", plantId: "PL-1" }), "CE-PLANT-P-2026-10-PL-1");
});

test("hours to next service", () => {
  assert.equal(P.hoursToService({ meterHours: 6830, serviceEveryHours: 250 }, 6750), 170);
  assert.equal(P.hoursToService({ meterHours: 6830 }, undefined), undefined);
});
