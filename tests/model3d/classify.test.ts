// Uploaded 3D models: system and asset-code detection from names, file checks, unit guesses.
import { test } from "node:test";
import assert from "node:assert/strict";

const c = await import(new URL("../../src/lib/model3d/classify.ts", import.meta.url).href);

test("systems from SketchUp tag / group names (Thai and English)", () => {
  assert.equal(c.systemOfName("ไฟฟ้า"), "elec");
  assert.equal(c.systemOfName("Tag_Electrical"), "elec");
  assert.equal(c.systemOfName("ประปา ชั้น 1"), "plumb");
  assert.equal(c.systemOfName("สุขภัณฑ์"), "sanitary");
  assert.equal(c.systemOfName("WC 01"), "sanitary");
  assert.equal(c.systemOfName("แอร์ห้องนอน"), "hvac");
  assert.equal(c.systemOfName("Structure"), "struct");
  assert.equal(c.systemOfName("เสา C1"), "struct");
  assert.equal(c.systemOfName("Landscape"), "ext");
  assert.equal(c.systemOfName("Ground Floor"), null);
  assert.equal(c.systemOfName("Group#12"), null);
  assert.equal(c.systemOfName(undefined), null);
});

test("nearest name wins, default is architecture", () => {
  assert.equal(c.systemOfPath(["AC-201", "แอร์", "ไฟฟ้า"]), "hvac");
  assert.equal(c.systemOfPath(["Mesh 3", "Group#4", "ไฟฟ้า"]), "elec");
  assert.equal(c.systemOfPath(["Mesh 3"]), "arch");
});

test("asset codes", () => {
  assert.equal(c.assetCodeOf("AC-201"), "AC-201");
  assert.equal(c.assetCodeOf("ac201"), "AC-201");
  assert.equal(c.assetCodeOf("WC-01#2"), "WC-001");
  assert.equal(c.assetCodeOf("Daikin AC-201"), "AC-201");
  assert.equal(c.assetCodeOf("PU_001"), "PU-001");
  assert.equal(c.assetCodeOf("D-204"), "D-204");
  assert.equal(c.assetCodeOf("Group#12"), null);
  assert.equal(c.assetCodeOf("Mesh 3"), null);
  assert.equal(c.assetCodeOf("ผนังห้องนอน"), null);
  assert.equal(c.assetCodeOfPath(["Mesh 3", "LT-118", "ไฟฟ้า"]), "LT-118");
});

test("IFC entity types", () => {
  assert.equal(c.systemOfIfcType("IFCCOLUMN"), "struct");
  assert.equal(c.systemOfIfcType("IFCSLAB"), "struct");
  assert.equal(c.systemOfIfcType("IFCSANITARYTERMINAL"), "sanitary");
  assert.equal(c.systemOfIfcType("IFCLIGHTFIXTURE"), "elec");
  assert.equal(c.systemOfIfcType("IFCPIPESEGMENT"), "plumb");
  assert.equal(c.systemOfIfcType("IFCDUCTSEGMENT"), "hvac");
  assert.equal(c.systemOfIfcType("IFCWALLSTANDARDCASE"), "arch");
  assert.equal(c.systemOfIfcType("IFCBUILDINGELEMENTPROXY", "แอร์ AC-201"), "hvac");
});

test("file checks", () => {
  assert.equal(c.formatOf("บ้าน A.GLB"), "glb");
  assert.equal(c.formatOf("x.skp"), null);
  assert.equal(c.rejectReason("house.skp", 1000), null); // converted on the server
  assert.equal(c.isSkpName("บ้าน.SKP"), true);
  assert.match(c.rejectReason("big.skp", c.MAX_SKP_BYTES + 1), /200 MB/);
  assert.match(c.ACCEPT, /.skp/);
  assert.match(c.rejectReason("plan.dwg", 1000), /2 มิติ/);
  assert.match(c.rejectReason("big.glb", c.MAX_BYTES + 1), /ใหญ่เกิน/);
  assert.equal(c.rejectReason("house.ifc", 5_000_000), null);
});

test("units and orientation", () => {
  assert.equal(c.unitScale(18).unit, "m");
  assert.equal(c.unitScale(708).unit, "in"); // 18 m in inches
  assert.equal(c.unitScale(1800, "fbx").unit, "cm");
  assert.equal(c.unitScale(18000).unit, "mm");
  assert.deepEqual(c.unitScale(18000, "obj", "cm"), { scale: 0.01, unit: "cm" });
  assert.equal(c.needsUpright({ x: 12, y: 15, z: 7 }, "obj"), true);
  assert.equal(c.needsUpright({ x: 12, y: 7, z: 15 }, "obj"), false);
  assert.equal(c.needsUpright({ x: 12, y: 15, z: 7 }, "glb"), false);
  assert.equal(c.needsUpright({ x: 12, y: 7, z: 15 }, "glb", true), true);
});

test("summary", () => {
  const s = c.summarize([{ sys: "elec", asset: "LT-118" }, { sys: "elec", asset: "LT-118" }, { sys: "arch", asset: null }]);
  assert.equal(s.parts, 3);
  assert.equal(s.bySys.elec, 2);
  assert.deepEqual(s.assets, ["LT-118"]);
});
