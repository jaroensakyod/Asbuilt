// Quantity takeoff: wall runs rebuilt from the model, openings, and the 7 category rules.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const house = await lib("house");
const { computeTakeoff, summarize } = await lib("takeoff/calc");
const { DEFAULT_SETTINGS, BLOCKS } = await lib("takeoff/types");

const S = (patch = {}) => ({ id: "TO-x", projectId: "x", ...DEFAULT_SETTINGS, ...patch });
const model = house.getModel("HM-17");
const base = computeTakeoff(model, S());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

test("walls: runs merged per floor, with openings and columns", () => {
  const front = base.walls.find((w: Any) => w.floor === 1 && w.orient === "h" && w.c === 0);
  assert.ok(front, "front wall exists");
  assert.equal(front.a, 0);
  assert.equal(front.b, model.W);
  assert.equal(front.exterior, true);
  assert.equal(front.height, 2.8);
  assert.ok(front.openings.some((o: Any) => o.kind === "door" && o.sill === 0));
  assert.ok(front.openings.some((o: Any) => o.kind === "window" && o.sill === 0.8 && o.head === 2.2));
  assert.ok(front.columns.length >= 2);
  // interior walls get their door gaps back as openings
  const interior = base.walls.filter((w: Any) => !w.exterior);
  assert.ok(interior.length > 0);
  assert.ok(interior.some((w: Any) => w.openings.some((o: Any) => o.kind === "door" && Math.abs(o.s1 - o.s0 - 0.9) < 0.01)));
  // ids are unique, e.g. 1W1, 2W3
  assert.equal(new Set(base.walls.map((w: Any) => w.id)).size, base.walls.length);
});

test("masonry = wall area minus openings and columns; blocks follow the block type", () => {
  const front = base.walls.find((w: Any) => w.floor === 1 && w.orient === "h" && w.c === 0);
  const line = base.items.find((x: Any) => x.cat === "masonry" && x.wallId === front.id);
  const open = front.openings.reduce((a: number, o: Any) => a + (o.s1 - o.s0) * (o.head - o.sill), 0);
  const cols = front.columns.reduce((a: number, s: number) => a + (Math.min(s + 0.125, front.b) - Math.max(s - 0.125, front.a)) * front.height, 0);
  assert.ok(Math.abs(line.qty - (model.W * front.height - open - cols)) < 0.02);
  assert.equal(line.count, Math.ceil(line.qty * BLOCKS.aac75.perM2));
  const brick = computeTakeoff(model, S({ block: "brick" }));
  const b = brick.items.find((x: Any) => x.cat === "masonry" && x.wallId === front.id);
  assert.equal(b.count, Math.ceil(b.qty * 130));
});

test("every line has a unique code with its category prefix, and shapes to highlight", () => {
  const codes = base.items.map((x: Any) => x.code);
  assert.equal(new Set(codes).size, codes.length);
  const prefix: Record<string, string> = { masonry: "อ", plaster: "ฉ", paint: "ส", ties: "สอ", bead: "ซ", floorTile: "พ", wallTile: "ผ" };
  for (const x of base.items) {
    assert.match(x.code, new RegExp(`^${prefix[x.cat]}\\d+$`));
    assert.ok(x.shapes.length > 0, `${x.code} has shapes`);
    assert.ok(x.qty > 0, `${x.code} qty`);
  }
  for (const c of Object.keys(prefix)) assert.ok(base.items.some((x: Any) => x.cat === c), `has ${c}`);
});

test("plaster covers both faces; paint = plaster minus wall tiles", () => {
  const sum = Object.fromEntries(base.summary.map((x: Any) => [x.cat, x]));
  const masonry = sum.masonry.qty;
  assert.ok(sum.plaster.qty > masonry * 1.8 && sum.plaster.qty < masonry * 2.3, `plaster ${sum.plaster.qty} vs masonry ${masonry}`);
  assert.ok(Math.abs(sum.paint.qty - (sum.plaster.qty - sum.wallTile.qty)) < 0.5);
  // tiles only in bathrooms
  const baths = new Set(model.rooms.filter((r: Any) => r.kind === "bath").map((r: Any) => r.id));
  for (const x of base.items.filter((i: Any) => i.cat === "wallTile")) assert.ok(baths.has(x.roomIds[0]));
});

test("ties: jambs beside openings unless a column is there, and spacing rule", () => {
  const ties = base.items.filter((x: Any) => x.cat === "ties" && x.kind === "เสาเอ็น");
  assert.ok(ties.length > 0);
  for (const w of base.walls) {
    const xs = ties.filter((t: Any) => t.wallId === w.id).map((t: Any) => Number(t.detail.match(/ที่ระยะ ([\d.]+)/)[1]) + w.a);
    const supports = [w.a, w.b, ...w.columns, ...xs].sort((p, q) => p - q);
    for (let i = 1; i < supports.length; i++) {
      const p = supports[i - 1];
      const q = supports[i];
      const isOpening = w.openings.some((o: Any) => o.s0 >= p - 0.2 && o.s1 <= q + 0.2);
      if (!isOpening) assert.ok(q - p <= 2.5 + 0.36, `${w.id} gap ${p}-${q}`);
    }
  }
  // closer spacing → more ties
  const tight = computeTakeoff(model, S({ tieSpacing: 1.5 })).items.filter((x: Any) => x.kind === "เสาเอ็น").length;
  assert.ok(tight > ties.length);
  // a mid-height band appears only when walls are taller than the setting
  assert.equal(base.items.filter((x: Any) => x.detail.startsWith("คานเอ็นกลางผนัง")).length, 0);
  const band = computeTakeoff(model, S({ bandAbove: 2.5 })).items.filter((x: Any) => x.detail.startsWith("คานเอ็นกลางผนัง"));
  assert.equal(band.length, base.walls.length);
});

test("corner bead: windows have 4 edges per face, doors 3; sticks rounded per line", () => {
  const front = base.walls.find((w: Any) => w.floor === 1 && w.orient === "h" && w.c === 0);
  const win = front.openings.find((o: Any) => o.kind === "window");
  const door = front.openings.find((o: Any) => o.kind === "door");
  const beads = (id: string) => base.items.filter((x: Any) => x.cat === "bead" && x.detail.includes(` ${id} `));
  assert.equal(beads(win.id).length, 8);
  assert.equal(beads(door.id).length, 6);
  const corners = base.items.filter((x: Any) => x.kind === "มุมอาคาร");
  assert.equal(corners.length, 4 * model.floors);
  const none = computeTakeoff(model, S({ outerCorners: false })).items.filter((x: Any) => x.kind === "มุมอาคาร");
  assert.equal(none.length, 0);
  const sum = base.summary.find((x: Any) => x.cat === "bead");
  assert.ok(sum.purchase >= Math.ceil(sum.qtyWithWaste / 2.5));
});

test("floor tiles per room (no stair / lift), totals with waste and price", () => {
  const rooms = model.rooms.filter((r: Any) => r.kind !== "lift" && r.kind !== "stair");
  const tiles = base.items.filter((x: Any) => x.cat === "floorTile");
  assert.equal(tiles.length, rooms.length);
  const area = rooms.reduce((a: number, r: Any) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  const sum = base.summary.find((x: Any) => x.cat === "floorTile");
  assert.ok(Math.abs(sum.qty - area) < 0.1);
  assert.equal(sum.qtyWithWaste, Math.round(sum.qty * 1.05 * 100) / 100);
  // no price book: the flat sample price, split into material and labour
  assert.equal(sum.price, DEFAULT_SETTINGS.price.floorTile);
  assert.ok(Math.abs(sum.cost - sum.qtyWithWaste * DEFAULT_SETTINGS.price.floorTile) <= 1);
  assert.equal(sum.labourCost, Math.round(sum.qtyWithWaste * DEFAULT_SETTINGS.labour.floorTile));
  // summarize works on a filtered list (one floor)
  const f1 = summarize(base.items.filter((x: Any) => x.floor === 1), S());
  assert.ok(f1.find((x: Any) => x.cat === "floorTile").qty < sum.qty);
});
