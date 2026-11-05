// SketchUp import: build a real .skp with OpenSKP's writer, read it back (the patched reader the
// server uses), and check the building picker drops far-away groups (2D-only groups: the writer
// refuses face-less components, so that case is covered by the hand-made nodes below).
import { test } from "node:test";
import assert from "node:assert/strict";
await import(new URL("../ai/load.ts", import.meta.url).href); // extensionless relative imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { create, buildInstancedScene, toInstancedGLB }: any = await import("openskp");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s: any = await import(new URL("../../src/lib/model3d/skp-scene.ts", import.meta.url).href);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const IN = 39.37007874; // SketchUp's internal unit is the inch

function makeSkp() {
  const b = create();
  const red = b.addMaterial("Red", [200, 30, 30]);
  // a 3D box component (the "building")
  const box = b.addComponentDefinition("Building", (d: Any) => {
    const m = 4 * IN, h = 3 * IN;
    d.addFace([[0, 0, 0], [m, 0, 0], [m, m, 0], [0, m, 0]]);
    d.addFace([[0, 0, h], [m, 0, h], [m, m, h], [0, m, h]], { material: red });
    d.addFace([[0, 0, 0], [m, 0, 0], [m, 0, h], [0, 0, h]]);
  });
  // the writer wants every definition before the first instance
  b.addInstance(box, { translation: [0, 0, 0] });
  b.addInstance(box, { translation: [6 * IN, 0, 0] });
  // the same box far away (a stray copy 500 m off)
  b.addInstance(box, { translation: [500000 / 25.4, 0, 0] });
  return b.toBytes() as Uint8Array;
}

test("header helpers", () => {
  const bytes = makeSkp();
  assert.equal(s.isSkp(bytes), true);
  assert.equal(s.isSkp(new TextEncoder().encode("not a sketchup file at all, sorry")), false);
  assert.match(String(s.skpVersion(bytes) ?? ""), /^\d+\.\d+\.\d+$|^$/);
});

test("written .skp → instanced scene → building picked, stray dropped → GLB", () => {
  const bytes = makeSkp();
  const scene = buildInstancedScene(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { respectEdgeVisibility: true });
  const tris = new Map(scene.meshResources.map((m: Any) => [m.id, m.primitives.reduce((a: number, p: Any) => a + (p.indices ? p.indices.length / 3 : 0), 0)]));
  const pick = s.pickBuilding(scene.sceneHierarchy.children, tris);
  assert.equal(pick.keep.length, 2);
  assert.equal(pick.droppedFar, 1);
  assert.equal(pick.dropped2d, 0);
  assert.ok(pick.triangles > 0);
  const glb = toInstancedGLB({ ...scene, sceneHierarchy: { ...scene.sceneHierarchy, children: pick.keep } });
  assert.equal(new TextDecoder().decode(glb.subarray(0, 4)), "glTF");
});

test("picker on hand-made nodes", () => {
  const n = (x: number, mesh?: string, children: Any[] = []) => ({ name: "", definitionName: "", layer: "Layer0", positionMm: [x, 0, 0], meshResourceId: mesh, children });
  const tris = new Map([["m", 12]]);
  const r = s.pickBuilding([n(0, "m"), n(1000, undefined, [n(0, "m")]), n(2000), n(900000, "m")], tris, 60);
  assert.equal(r.keep.length, 2);
  assert.equal(r.triangles, 24);
  assert.equal(r.dropped2d, 1);
  assert.equal(r.droppedFar, 1);
});

test("OpenSKP is patched for SketchUp 2019 files (patches/openskp+1.5.0.patch)", async () => {
  const fs = await import("node:fs");
  const { createRequire } = await import("node:module");
  const dist = createRequire(import.meta.url).resolve("openskp");
  for (const f of [dist, dist.replace(/index\.js$/, "index.mjs")]) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(src.includes("CCustomLineStyle: readLineStyle"), `${f}: line style reader missing — run npm install (patch-package)`);
    assert.ok(src.includes("if (t === 8) return Array.from(r.raw(4));"), `${f}: colour attribute type missing`);
  }
});
