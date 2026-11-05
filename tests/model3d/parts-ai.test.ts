// AI part labelling (prompt, answer mapping) and the registry check for asset codes.
import { test } from "node:test";
import assert from "node:assert/strict";

const a = await import(new URL("../../src/lib/model3d/parts-ai.ts", import.meta.url).href);
const c = await import(new URL("../../src/lib/model3d/classify.ts", import.meta.url).href);

test("generic SketchUp names are ignored", () => {
  for (const n of ["Component_947313", "Componente#2", "群组#258", "组#11", "Group#12", "Grouper#6", "obj_08", "Obj_000005", "Mesh 3", "ROOT", "", "  ", "12"])
    assert.equal(a.isGenericName(n), true, n);
  for (const n of ["Spinal Cafe Table", "light bulb", "chain link", "Leg", "ผนังห้องนอน", "AC-201", "pied 3 bras"]) assert.equal(a.isGenericName(n), false, n);
});

const groups = [
  { id: "r.0", names: [], size: [72, 39, 0.2], base: 0, top: 0.2, tris: 120, meshes: 1, color: "#cccccc" },
  { id: "r.1", names: ["Spinal Cafe Table"], size: [0.8, 0.8, 0.75], base: 0.2, top: 0.95, tris: 4800, meshes: 6 },
  { id: "r.2.0", names: [], size: [0.4, 0.4, 3.5], base: 0, top: 3.5, tris: 12, meshes: 1 },
];

test("prompt numbers every group and carries size and height", () => {
  const p = a.classifyPrompt(groups, [72.4, 39.3, 15.4]);
  assert.match(p.prompt, /72\.4×39\.3×15\.4/);
  assert.match(p.prompt, /^1 \| - \| 72×39×0\.2 \| 0–0\.2 \| 120 \| 1 \| #cccccc$/m);
  assert.match(p.prompt, /^2 \| Spinal Cafe Table \| 0\.8×0\.8×0\.75 \| 0\.2–0\.95 \|/m);
  assert.match(p.prompt, /^3 \|/m);
  assert.deepEqual(a.CLASSIFY_SCHEMA.properties.items.items.properties.kind.enum, a.PART_KINDS.map((k: { key: string }) => k.key));
});

test("answers map back to group ids; unknown or missing → other", () => {
  const k = a.normalizeKinds({ items: [{ n: 1, kind: "slab" }, { n: 2, kind: "furniture" }, { n: 9, kind: "wall" }, { n: "3", kind: "spaceship" }] }, groups);
  assert.deepEqual(k, { "r.0": "slab", "r.1": "furniture", "r.2.0": "other" });
  assert.deepEqual(a.normalizeKinds(null, groups), { "r.0": "other", "r.1": "other", "r.2.0": "other" });
  assert.equal(a.KIND_SYS.slab, "struct");
  assert.equal(a.KIND_SYS.lighting, "elec");
  assert.equal(a.KIND_SYS.furniture, "arch");
});

test("only registered codes count as equipment", () => {
  const known = new Set(["AC-201", "WC-101"]);
  // furniture part names from downloaded models look like codes
  assert.equal(c.assetCodeOf("LEG-048"), "LEG-048");
  assert.equal(a.registeredCode(c.assetCodeOf("LEG-048"), known), null);
  assert.equal(a.registeredCode(c.assetCodeOf("BOX-085"), known), null);
  assert.equal(a.registeredCode(c.assetCodeOf("Daikin ac201"), known), "AC-201");
  assert.equal(a.registeredCode(null, known), null);
});
