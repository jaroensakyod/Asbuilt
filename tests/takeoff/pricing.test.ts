// Takeoff step 3: price-book rates, rule checks and the estimate record.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const house = await lib("house");
const { computeTakeoff, summarize } = await lib("takeoff/calc");
const { catRates } = await lib("takeoff/pricing");
const { takeoffFlags, reviewPrompt } = await lib("takeoff/checks");
const { estimateFromTakeoff, CAT_COST_CODE } = await lib("takeoff/estimate");
const { DEFAULT_SETTINGS } = await lib("takeoff/types");
const { sampleBook } = await lib("sales/prices-data");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const S = (patch = {}) => ({ id: "TO-x", projectId: "x", ...DEFAULT_SETTINGS, ...patch });
const model = house.getModel("HM-17");
const t = computeTakeoff(model, S());
const book = sampleBook("cgd");

test("rates come from the price book recipes", () => {
  const r = catRates(S(), book, t.items);
  const aac = book.material("MS-AAC75").price;
  const mortar = book.material("MS-MORTAR").price;
  assert.ok(Math.abs(r.masonry.material - (8.33 * aac + 0.11 * mortar)) < 0.02);
  assert.equal(r.masonry.status, "partial"); // blocks have no labour in the book → labour setting
  assert.equal(r.masonry.labour, DEFAULT_SETTINGS.labour.masonry);
  // tiles have labour in the book
  assert.equal(r.floorTile.status, "book");
  assert.ok(r.floorTile.parts.some((p: Any) => p.code === "FN-GRANITO"));
  assert.ok(r.floorTile.labour > 0);
  // ties are priced per metre of precast lintel, converted to m³
  const lintel = book.material("MS-LINTEL").price + book.labour("MS-LINTEL");
  assert.ok(Math.abs(r.ties.total - lintel / 0.01) < 1);
  // corner bead is not in the book
  assert.equal(r.bead.status, "sample");
  // paint mixes interior / exterior by area
  assert.ok(r.paint.parts.some((p: Any) => p.code === "PT-EXT") && r.paint.parts.some((p: Any) => p.code === "PT-INT"));
  // a smaller floor tile switches to the ceramic item
  assert.ok(catRates(S({ floorTile: 0.3 }), book, t.items).floorTile.parts.some((p: Any) => p.code === "FN-CERAMIC"));
  // sample mode ignores the book
  assert.equal(catRates(S({ priceMode: "sample" }), book, t.items).masonry.total, DEFAULT_SETTINGS.price.masonry);
});

test("summary splits material and labour cost", () => {
  const r = catRates(S(), book, t.items);
  const sum = summarize(t.items, S(), r);
  for (const x of sum) {
    assert.equal(x.cost, x.materialCost + x.labourCost);
    assert.ok(Math.abs(x.price - (r[x.cat].material + r[x.cat].labour)) < 0.02);
  }
});

test("rule checks: clean model has no high flags; broken data is flagged", () => {
  const flags = takeoffFlags(t.source, t.walls, t.items, t.summary);
  assert.equal(flags.filter((f: Any) => f.severity === "high").length, 0);
  // a bathroom with no wall tiles and an over-opened wall
  const bath = t.source.rooms.find((r: Any) => r.bath);
  const items = t.items.filter((x: Any) => !(x.cat === "wallTile" && x.roomIds.includes(bath.id)));
  const w = { ...t.walls[0], openings: [{ id: "X", kind: "window", s0: t.walls[0].a, s1: t.walls[0].b, sill: 0.1, head: 2.7 }] };
  const f2 = takeoffFlags(t.source, [w, ...t.walls.slice(1)], items, t.summary);
  assert.ok(f2.some((f: Any) => f.severity === "high" && f.title.includes(bath.name)));
  assert.ok(f2.some((f: Any) => f.id === `open-${w.id}`));
  assert.equal(f2[0].severity, "high");
});

test("AI review prompt carries the numbers and the rule flags", () => {
  const flags = takeoffFlags(t.source, t.walls, t.items, t.summary);
  const p = reviewPrompt({ project: "HC-1", source: t.source, walls: t.walls, items: t.items, summary: t.summary, flags });
  assert.match(p.prompt, /ก่ออิฐ: [\d.]+ ตร\.ม\./);
  assert.match(p.prompt, /1W1 ชั้น1/);
  assert.match(p.system, /ใช้เฉพาะตัวเลขที่ให้มา/);
});

test("estimate from takeoff: cost codes, overhead and margin", () => {
  const sum = summarize(t.items, S(), catRates(S(), book, t.items));
  const e = estimateFromTakeoff(sum, { id: "EST-1", name: "x", date: "2026-11-05", by: "QS", projectId: "P", modelCode: "HM-17", area: 180, choice: "cgd", overheadPct: 8, marginPct: 18 });
  assert.equal(e.lines.length, 7);
  assert.equal(e.direct, sum.reduce((a: number, x: Any) => a + x.cost, 0));
  assert.equal(e.overhead, Math.round(e.direct * 0.08));
  assert.equal(e.selling, Math.round(e.cost / 0.82));
  assert.deepEqual(e.byCode.map((c: Any) => c.costCode), ["04", "10", "11"]);
  assert.equal(e.byCode.reduce((a: number, c: Any) => a + c.amount, 0), e.direct);
  assert.equal(CAT_COST_CODE.paint, "11");
  assert.ok(e.lines.find((l: Any) => l.key === "TO-bead").sample);
});
