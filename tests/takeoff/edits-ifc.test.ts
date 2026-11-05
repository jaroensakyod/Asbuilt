// Takeoff step 2: wall edits on top of a source, and the IFC source built from element boxes.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const house = await lib("house");
const { computeTakeoff, computeFromSource } = await lib("takeoff/calc");
const { applyEdits, openingProblem, sourceFromModel } = await lib("takeoff/walls");
const { sourceFromIfc, floorLevels } = await lib("takeoff/ifc");
const { DEFAULT_SETTINGS, BLOCKS } = await lib("takeoff/types");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const S = (patch = {}) => ({ id: "TO-x", projectId: "x", ...DEFAULT_SETTINGS, ...patch });
const E = (patch = {}) => ({ id: "TE-x-model", projectId: "x", source: "model", walls: {}, removed: [], added: [], ...patch });
const model = house.getModel("HM-17");
const src = sourceFromModel(model);
const front = src.walls.find((w: Any) => w.floor === 1 && w.orient === "h" && w.c === 0);
const masonryOf = (t: Any, id: string) => t.items.find((x: Any) => x.cat === "masonry" && x.wallId === id);

test("no edits = same result as before", () => {
  const a = computeTakeoff(model, S());
  const b = computeFromSource(src, S(), E());
  assert.deepEqual(
    a.summary.map((x: Any) => x.qty),
    b.summary.map((x: Any) => x.qty),
  );
});

test("excluding a wall removes all its lines", () => {
  const t = computeFromSource(src, S(), E({ walls: { [front.id]: { excluded: true } } }));
  assert.equal(t.items.filter((x: Any) => x.wallId === front.id).length, 0);
  assert.equal(t.walls.some((w: Any) => w.id === front.id), false);
});

test("wall height and block type per wall", () => {
  const base = masonryOf(computeFromSource(src, S(), E()), front.id);
  const t = computeFromSource(src, S(), E({ walls: { [front.id]: { height: 3.2, block: "brick" } } }));
  const m = masonryOf(t, front.id);
  assert.ok(m.qty > base.qty);
  assert.equal(m.count, Math.ceil(m.qty * BLOCKS.brick.perM2));
  assert.equal(m.rate, 130);
  // the summary sums blocks per line when types differ
  const sum = t.summary.find((x: Any) => x.cat === "masonry");
  const expect = Math.ceil(t.items.filter((x: Any) => x.cat === "masonry").reduce((a: number, x: Any) => a + x.qty * 1.05 * x.rate, 0) - 1e-9);
  assert.equal(sum.purchase, expect);
  assert.equal(t.walls.find((w: Any) => w.id === front.id).edited, true);
});

test("remove and add openings", () => {
  const win = front.openings.find((o: Any) => o.kind === "window");
  const base = masonryOf(computeFromSource(src, S(), E()), front.id);
  const removed = computeFromSource(src, S(), E({ removed: [`${front.id}:${win.id}`] }));
  const m1 = masonryOf(removed, front.id);
  assert.ok(Math.abs(m1.qty - base.qty - (win.s1 - win.s0) * (win.head - win.sill)) < 0.02);
  assert.equal(removed.items.filter((x: Any) => x.cat === "bead" && x.detail.includes(` ${win.id} `)).length, 0);

  const added = { id: "W-N1", wallId: front.id, kind: "window", offset: 5, width: 1.2, sill: 0.9, head: 2.1 };
  const t = computeFromSource(src, S(), E({ added: [added] }));
  const m2 = masonryOf(t, front.id);
  assert.ok(Math.abs(base.qty - m2.qty - 1.2 * 1.2) < 0.02);
  assert.equal(t.items.filter((x: Any) => x.cat === "bead" && x.detail.includes(" W-N1 ")).length, 8);
  assert.ok(t.items.some((x: Any) => x.kind === "คานเอ็น" && x.detail.includes("W-N1")));
});

test("opening checks", () => {
  const w = applyEdits(src.walls, E()).find((x: Any) => x.id === front.id);
  assert.equal(openingProblem(w, { kind: "window", offset: 5, width: 1.2, sill: 0.9, head: 2.1 }), null);
  assert.match(openingProblem(w, { kind: "window", offset: w.b - w.a - 0.5, width: 1.2, sill: 0.9, head: 2.1 }), /ความยาวผนัง/);
  assert.match(openingProblem(w, { kind: "door", offset: 5, width: 0.9, sill: 0, head: 3.5 }), /สูงเกิน/);
  const o = w.openings[0];
  assert.match(openingProblem(w, { kind: "door", offset: o.s0 - w.a, width: 0.9, sill: 0, head: 2 }), /ซ้อน/);
});

// ---------- IFC ----------

const B = (id: number, type: string, min: number[], max: number[], name = "", aligned?: boolean) => ({ id, type, name, min, max, aligned });
// a 10 × 8 m single-storey box: 4 exterior walls + 1 interior wall, a door, a window, a column, two spaces
const boxes = [
  B(1, "IFCWALLSTANDARDCASE", [0, 0, 0], [10, 2.8, 0.2], "", true),
  B(2, "IFCWALLSTANDARDCASE", [0, 0, 7.8], [10, 2.8, 8], "", true),
  B(3, "IFCWALLSTANDARDCASE", [0, 0, 0], [0.2, 2.8, 8], "", true),
  B(4, "IFCWALLSTANDARDCASE", [9.8, 0, 0], [10, 2.8, 8], "", true),
  B(5, "IFCWALL", [6, 0, 0.2], [6.1, 2.8, 7.8], "", true),
  B(6, "IFCWALL", [0, 0, 0], [3, 2.8, 3], "angled", false),
  B(10, "IFCDOOR", [2, 0, 0.02], [2.9, 2.1, 0.18]),
  B(11, "IFCWINDOW", [7, 0.9, 7.82], [8.2, 2.1, 7.98]),
  B(12, "IFCCOLUMN", [4.9, 0, 0], [5.1, 2.8, 0.2]),
  B(20, "IFCSPACE", [0.2, 0, 0.2], [6, 2.8, 7.8], "Living"),
  B(21, "IFCSPACE", [6.1, 0, 0.2], [9.8, 2.8, 7.8], "ห้องน้ำ"),
];

test("floor levels group close heights", () => {
  assert.deepEqual(floorLevels([0, 0.02, 3.0, 3.05, 6.1]), [0, 3, 6.1]);
});

test("IFC boxes → walls, openings, columns, rooms, exterior", () => {
  const s = sourceFromIfc(boxes, "M3D-1", "test.ifc");
  assert.equal(s.kind, "ifc");
  assert.equal(s.floors, 1);
  assert.equal(s.walls.length, 5);
  assert.ok(s.notes.some((n: string) => /เอียง 1/.test(n)));
  const south = s.walls.find((w: Any) => w.orient === "h" && w.c === 0.1);
  assert.equal(south.exterior, true);
  assert.equal(south.outside, -1);
  assert.deepEqual(
    south.openings.map((o: Any) => [o.kind, o.s0, o.s1, o.sill, o.head]),
    [["door", 2, 2.9, 0, 2.1]],
  );
  assert.deepEqual(south.columns, [5]);
  const north = s.walls.find((w: Any) => w.orient === "h" && w.c === 7.9);
  assert.equal(north.outside, 1);
  assert.equal(north.openings[0].kind, "window");
  assert.equal(north.openings[0].sill, 0.9);
  const inner = s.walls.find((w: Any) => w.orient === "v" && w.c === 6.05);
  assert.equal(inner.exterior, false);
  assert.equal(s.rooms.length, 2);
  assert.equal(s.rooms.find((r: Any) => r.name === "ห้องน้ำ").bath, true);
  assert.equal(s.corners.length, 4);
});

test("IFC takeoff: rooms beside walls, wall tiles in the bathroom only", () => {
  const t = computeFromSource(sourceFromIfc(boxes, "M3D-1", "test.ifc"), S(), null);
  const plaster = t.items.filter((x: Any) => x.cat === "plaster" && x.kind !== "ขอบช่องเปิด");
  assert.ok(plaster.some((x: Any) => x.rooms[0] === "Living"));
  assert.ok(plaster.some((x: Any) => x.rooms[0] === "ภายนอก"));
  const tiles = t.items.filter((x: Any) => x.cat === "wallTile");
  assert.ok(tiles.length > 0);
  assert.ok(tiles.every((x: Any) => x.rooms[0] === "ห้องน้ำ"));
  assert.equal(t.items.filter((x: Any) => x.cat === "floorTile").length, 2);
});

test("IFC levels are shifted so the lowest wall stands on 0", () => {
  const low = boxes.map((b) => ({ ...b, min: [b.min[0], b.min[1] - 3, b.min[2]], max: [b.max[0], b.max[1] - 3, b.max[2]] }));
  const s = sourceFromIfc(low, "M3D-3", "low.ifc");
  assert.ok(s.walls.every((w: Any) => w.base === 0));
  assert.equal(s.bounds.min[1], 0);
  assert.equal(s.walls.find((w: Any) => w.c === 0.1).openings[0].sill, 0);
});

test("IFC without spaces: faces A/B, no tiles", () => {
  const s = sourceFromIfc(boxes.filter((b) => b.type !== "IFCSPACE"), "M3D-2", "x.ifc");
  assert.ok(s.notes.some((n: string) => /IfcSpace/.test(n)));
  const t = computeFromSource(s, S(), null);
  const inner = t.items.filter((x: Any) => x.cat === "plaster" && x.wallId === s.walls.find((w: Any) => !w.exterior).id && x.kind !== "ขอบช่องเปิด");
  assert.deepEqual(inner.map((x: Any) => x.kind).sort(), ["ด้าน A", "ด้าน B"]);
  assert.equal(t.items.filter((x: Any) => x.cat === "floorTile" || x.cat === "wallTile").length, 0);
});
