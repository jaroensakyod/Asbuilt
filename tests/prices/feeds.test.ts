import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const moc = await lib("moc");
const match = await lib("match");
const merge = await lib("merge");
const extract = await lib("extract");
const kindex = await lib("kindex");
const explain = await lib("explain");

// ---------- MOC normalisation ----------

test("csi-product-indexes rows → dated prices with app province names", () => {
  const raw = [
    { com_code: "0401020100200000", com_name_th: "  ขนาด 12 มม. ", province_code: "10", province_name: "กรุงเทพมหานคร", year: 2026, month: 9, units: "ตัน", price: 24850.5 },
    { com_code: "0401020100200000", province_code: 12, year: 2569, month: 10, units: "ตัน", price: "25,100" },
    { com_code: "0401020100200000", province_code: "10", year: 2026, month: 10, price: 0 }, // no price → dropped
    { com_code: "", year: 2026, month: 10, price: 5 },
    null,
  ];
  const out = moc.normaliseMocPrices(raw);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { comCode: "0401020100200000", name: "ขนาด 12 มม.", unit: "ตัน", provinceCode: "10", province: "กรุงเทพฯ", date: "2026-09-01", price: 24850.5 });
  assert.equal(out[1].province, "นนทบุรี"); // from code
  assert.equal(out[1].date, "2026-10-01"); // Buddhist year converted
  assert.equal(out[1].price, 25100);
  assert.deepEqual(moc.normaliseMocPrices({ data: raw.slice(0, 1) }).length, 1);
  assert.deepEqual(moc.normaliseMocPrices("<html>"), []);
});

test("csi-indexes rows (field 'mon' as returned by the live API) → monthly index points", () => {
  const raw = [
    { index_id: "0000000000000000", index_description: "ดัชนีรวม", base_year: 2015, year: 2024, month: 2, price_index: 112.0, mon: 0.0, yoy: -1.1, aoa: -1.1 },
    { index_id: "0000000000000000", index_description: "ดัชนีรวม", base_year: 2015, year: 2024, month: 1, price_index: 112.0, mon: 0.0, yoy: -1.0, aoa: -1.0 },
    { index_id: "4000000000000000", year: 2024, month: 13, price_index: 1 },
  ];
  const out = moc.normaliseMocIndex(raw);
  assert.equal(out.length, 2);
  assert.equal(out[0].month, "2024-01");
  assert.equal(out[0].baseYear, 2015);
  assert.equal(out[1].mom, 0);
  assert.equal(out[1].yoy, -1.1);
});

test("product catalogue: code/unit split and parent path from the 16-digit hierarchy", () => {
  const cat = moc.buildCatalog([
    { id: "0401000000000000", name: "0401000000000000 - เหล็กเสริมคอนกรีต" },
    { id: "0401020000000000", name: "0401020000000000 - เหล็กเส้นกลมผิวข้ออ้อย" },
    { id: "0401020100000000", name: "0401020100000000 - ชั้นคุณภาพ SD40" },
    { id: "0401020100200000", name: "0401020100200000 -     ขนาด 12 มม. ยาว 10 เมตร (ตัน)" },
    ["2002020100200001", "สาย THW ขนาด 1 x 2.5 ตร.มม. ยาว 100 ม.", "ม้วน"],
  ]);
  const leaf = cat.find((p: { code: string }) => p.code === "0401020100200000");
  assert.equal(leaf.unit, "ตัน");
  assert.equal(leaf.name, "ขนาด 12 มม. ยาว 10 เมตร");
  assert.deepEqual(leaf.path, ["เหล็กเสริมคอนกรีต", "เหล็กเส้นกลมผิวข้ออ้อย", "ชั้นคุณภาพ SD40"]);
  assert.equal(moc.fullName(leaf), "เหล็กเสริมคอนกรีต › เหล็กเส้นกลมผิวข้ออ้อย › ชั้นคุณภาพ SD40 › ขนาด 12 มม. ยาว 10 เมตร");
  assert.deepEqual(moc.ancestors("0401020100200000"), ["0400000000000000", "0401000000000000", "0401020000000000", "0401020100000000"]);
});

test("MOC prices → PriceObs via links with unit factor; plan + month helpers", () => {
  const prices = [{ comCode: "C1", name: "", unit: "ตัน", province: "กรุงเทพฯ", date: "2026-10-01", price: 25000 }];
  const obs = moc.mocToObs(prices, [{ itemCode: "ST-DB12", comCode: "C1", factor: 0.001 }, { itemCode: "X", comCode: "C2", factor: 1 }], "2026-11-05T00:00:00Z");
  assert.equal(obs.length, 1);
  assert.equal(obs[0].price, 25);
  assert.equal(obs[0].source, "moc");
  assert.equal(obs[0].rawPrice, 25000);
  assert.equal(obs[0].ref, "C1");
  assert.deepEqual(moc.planRequests(["A", "B", "A"], ["กรุงเทพมหานคร", "ชลบุรี", "ไม่มีจังหวัดนี้"]), [
    { province: "10", comCode: "A" },
    { province: "10", comCode: "B" },
    { province: "20", comCode: "A" },
    { province: "20", comCode: "B" },
  ]);
  assert.deepEqual(moc.monthRange("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(moc.yearsOf("2025-11", "2026-02"), { from: 2025, to: 2026 });
  assert.equal(moc.inMonths([{ date: "2025-10-01" }, { date: "2025-11-01" }], "2025-11", "2026-01").length, 1);
  assert.equal(moc.provinceCode("กรุงเทพฯ"), "10");
  assert.equal(moc.provinceName("จ.เชียงใหม่"), "เชียงใหม่");
});

// ---------- matching ----------

test("unit factors between outside lists and our item units", () => {
  assert.equal(match.unitFactor("ตัน", "", "กก."), 0.001);
  assert.equal(match.unitFactor("เมตร", "", "ม."), 1);
  assert.equal(match.unitFactor("ตัน", "ปูนซีเมนต์ บรรจุ 50 กก./ถุง", "ถุง", "ปูนซีเมนต์ (50 กก.)"), 0.05);
  assert.equal(match.unitFactor("ม้วน", "สาย THW 1 x 2.5 ตร.มม. ยาว 100 ม.", "ม."), 0.01);
  assert.equal(match.unitFactor("ท่อน", "ท่อ พีวีซี ยาว 4 เมตร", "ม."), 0.25);
  assert.equal(match.unitFactor("ลัง", "", "ตร.ม."), undefined);
  assert.equal(match.normUnit("ตร. ม."), "ตร.ม.");
});

test("com_code suggestion picks the right size and strength", () => {
  const cat = moc.buildCatalog([
    ["0401020000000000", "เหล็กเส้นกลมผิวข้ออ้อย"],
    ["0401020100100000", "ขนาด 10 มม. ยาว 10 เมตร", "ตัน"],
    ["0401020100200000", "ขนาด 12 มม. ยาว 10 เมตร", "ตัน"],
    ["0401020100300000", "ขนาด 16 มม. ยาว 10 เมตร", "ตัน"],
    ["0101000000000000", "คอนกรีตผสมเสร็จ"],
    ["0101010100100000", "รูปลูกบาศก์ 180 กก./ตร.ซม. และรูปทรงกระบอก 140 กก./ตร.ซม.", "ลบ.ม."],
    ["0101010100300000", "รูปลูกบาศก์ 240 กก./ตร.ซม. และรูปทรงกระบอก 210 กก./ตร.ซม.", "ลบ.ม."],
    ["2002020100200001", "สายเคเบิลเดินภายในอาคาร THW สายกลมแกนเดียว ขนาด 1 x 2.5 ตร.มม. ยาว 100 ม. ตราไทยยาซากิ", "ม้วน"],
  ]);
  const prep = match.prepareCatalog(cat);
  const db12 = match.suggestComCodes({ name: "เหล็กข้ออ้อย DB12 SD40", unit: "กก." }, prep);
  assert.equal(db12[0].item.code, "0401020100200000");
  assert.equal(db12[0].factor, 0.001);
  const cn = match.suggestComCodes({ name: "คอนกรีตผสมเสร็จ 240 ksc (ทรงลูกบาศก์)", unit: "ลบ.ม." }, prep);
  assert.equal(cn[0].item.code, "0101010100300000");
  assert.equal(cn[0].factor, 1);
  const thw = match.suggestComCodes({ name: "สายไฟ THW 2.5 ตร.มม.", unit: "ม." }, prep);
  assert.equal(thw[0].item.code, "2002020100200001");
  assert.equal(thw[0].factor, 0.01);
  assert.ok(db12[0].score > db12[1].score);
});

// ---------- merge ----------

test("mergeObs: stable ids, last row wins, only new/changed rows returned", () => {
  const existing = [{ id: "O-ST-DB12-moc-2026-10-กรุงเทพฯ", itemCode: "ST-DB12", source: "moc", date: "2026-10-01", price: 25, province: "กรุงเทพฯ", ref: "C1" }];
  const incoming = [
    { id: "", itemCode: "ST-DB12", source: "moc", date: "2026-10-15", price: 25, province: "กรุงเทพฯ", ref: "C1" }, // same → unchanged
    { id: "", itemCode: "ST-DB12", source: "moc", date: "2026-09-01", price: 24, province: "กรุงเทพฯ" },
    { id: "", itemCode: "ST-DB12", source: "moc", date: "2026-09-01", price: 24.5, province: "กรุงเทพฯ" }, // dup key, last wins
    { id: "", itemCode: "ST-DB12", source: "cgd", date: "2026-09-01", price: 4.5, kind: "labour" },
    { id: "", itemCode: "ST-DB12", source: "moc", date: "bad", price: 1 },
  ];
  const r = merge.mergeObs(existing, incoming);
  assert.equal(r.added, 2);
  assert.equal(r.updated, 0);
  assert.equal(r.unchanged, 1);
  assert.deepEqual(r.rows.map((o: { id: string }) => o.id).sort(), ["O-ST-DB12-cgd-2026-09-L", "O-ST-DB12-moc-2026-09-กรุงเทพฯ"]);
  assert.equal(r.rows.find((o: { source: string }) => o.source === "moc").price, 24.5);
  const r2 = merge.mergeObs(existing, [{ ...existing[0], id: "", price: 26 }]);
  assert.equal(r2.updated, 1);
  assert.equal(merge.obsId({ itemCode: "A", source: "moc", date: "2026-10-01", province: "สมุทร ปราการ" }), "O-A-moc-2026-10-สมุทร_ปราการ");
  assert.deepEqual([...merge.itemsWithReal([...existing, { id: "s", itemCode: "B", source: "moc", date: "2026-10-01", price: 1, sample: true }], "moc")], ["ST-DB12"]);
});

// ---------- PDF rows ----------

test("month parsing for Thai documents", () => {
  assert.equal(extract.parseMonth("2026-10"), "2026-10");
  assert.equal(extract.parseMonth("ตุลาคม 2569"), "2026-10");
  assert.equal(extract.parseMonth("ต.ค. 69"), "2026-10");
  assert.equal(extract.parseMonth("10/2569"), "2026-10");
  assert.equal(extract.parseMonth("2569-13"), undefined);
  assert.equal(extract.parseMonth(""), undefined);
});

const ITEMS = [
  { code: "ST-DB12", name: "เหล็กข้ออ้อย DB12 SD40", unit: "กก." },
  { code: "ST-CEMENT", name: "ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1 (50 กก.)", unit: "ถุง" },
  { code: "CN-240", name: "คอนกรีตผสมเสร็จ 240 ksc (ทรงลูกบาศก์)", unit: "ลบ.ม." },
  { code: "FN-GRANITO", name: "กระเบื้องแกรนิตโต้ 60×60 ซม.", unit: "ตร.ม." },
];

test("extracted PDF rows → review rows matched to items with unit factors → PriceObs", () => {
  const ex = {
    province: "กรุงเทพมหานคร",
    month: "ตุลาคม 2569",
    rows: [
      { name: "เหล็กเส้นกลมผิวข้ออ้อย SD40 ขนาด 12 มม.", unit: "ตัน", price: 24900 },
      { name: "ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1 บรรจุ 50 กก.", unit: "ตัน", price: 3150 },
      { name: "คอนกรีตผสมเสร็จ รูปลูกบาศก์ 240 กก./ตร.ซม.", unit: "ลบ.ม.", price: 2450, labour: 410 },
      { name: "ยางมะตอย", unit: "ถัง" },
    ],
  };
  const rows = extract.toReviewRows(ex, "moc-province", ITEMS);
  const by = (k: string) => rows.find((r: { key: string }) => r.key === k);
  assert.equal(by("0-material").itemCode, "ST-DB12");
  assert.equal(by("0-material").factor, 0.001);
  assert.equal(by("0-material").province, "กรุงเทพฯ");
  assert.equal(by("0-material").month, "2026-10");
  assert.equal(by("1-material").itemCode, "ST-CEMENT");
  assert.equal(by("1-material").factor, 0.05);
  assert.equal(by("2-material").itemCode, "CN-240");
  assert.equal(by("2-labour").kind, "labour");
  assert.deepEqual(by("3-material").errors, ["ไม่มีราคา"]);
  const obs = extract.reviewToObs(rows, "moc", "2026-11-05T00:00:00Z", "file.pdf");
  assert.equal(obs.length, 4);
  const steel = obs.find((o: { itemCode: string }) => o.itemCode === "ST-DB12");
  assert.equal(steel.price, 24.9);
  assert.equal(steel.date, "2026-10-01");
  assert.equal(steel.via, "file");
  assert.equal(obs.find((o: { itemCode: string }) => o.itemCode === "ST-CEMENT").price, 157.5);
  assert.equal(obs.find((o: { kind?: string }) => o.kind === "labour").price, 410);
});

test("labour booklet rows are stored as labour observations", () => {
  const rows = extract.toReviewRows({ month: "2026-10", rows: [{ name: "ค่าแรงงานเหล็กเสริม DB12", unit: "กก.", price: 4.75 }] }, "cgd-labour", ITEMS);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "labour");
  assert.equal(rows[0].itemCode, "ST-DB12");
  assert.equal(extract.reviewToObs(rows, "cgd", "t")[0].kind, "labour");
});

// ---------- ค่า K indices ----------

test("CMI points → K symbols; merge reports changes and base-year suspects", () => {
  const pts = [
    { indexId: "2000000000000000", name: "ซีเมนต์", month: "2026-09", value: 118.4 },
    { indexId: "4000000000000000", name: "เหล็ก", month: "2026-09", value: 141.2 },
    { indexId: "9000000000000000", name: "อื่น ๆ", month: "2026-09", value: 101 },
  ];
  const inc = kindex.cmiToIndices(pts, kindex.DEFAULT_K_MAP);
  assert.deepEqual(inc, { "2026-09": { C: 118.4, S: 141.2 } });
  const cur = { "2026-09": { C: 118.4, S: 100, I: 108 }, "2026-08": { C: 117 } };
  const r = kindex.mergeIndices(cur, { ...inc, "2026-10": { C: 119 }, bad: { C: 1 } });
  assert.deepEqual(
    r.changes.map((c: { month: string; sym: string }) => `${c.month}:${c.sym}`),
    ["2026-09:S", "2026-10:C"],
  );
  assert.deepEqual(r.suspect, ["S"]); // 100 → 141.2 is > 25 %
  assert.equal(r.indices["2026-09"].I, 108);
  assert.equal(cur["2026-09"].S, 100); // input not mutated
});

test("AI-read index announcement → indices, only allowed symbols", () => {
  const out = kindex.extractedToIndices(
    { months: [{ month: "2569-10", values: [{ sym: "c", value: 119.04 }, { sym: "Z", value: 5 }, { sym: "S", value: 0 }] }, { month: "x", values: [] }] },
    ["I", "C", "S"],
  );
  assert.deepEqual(out, { "2026-10": { C: 119.04 } });
});

// ---------- AI explanation prompt ----------

test("alert explanation groups moves by category and passes only given numbers", () => {
  const facts = [
    { code: "ST-DB12", name: "เหล็ก DB12", category: "เหล็กเสริม", unit: "กก.", source: "moc", prev: 24.3, price: 25.9, change: 0.064, sample: false, history: [24, 24.3, 25.9] },
    { code: "ST-DB16", name: "เหล็ก DB16", category: "เหล็กเสริม", unit: "กก.", source: "moc", prev: 24.1, price: 25.6, change: 0.06, sample: false, history: [24.1, 25.6] },
    { code: "EL-THW", name: "สาย THW", category: "สายไฟ", unit: "ม.", source: "supplier", prev: 11.2, price: 10.6, change: -0.054, sample: true, history: [11.2, 10.6] },
  ];
  const cats = explain.categoryMoves(facts);
  assert.equal(cats[0].category, "เหล็กเสริม");
  assert.equal(cats[0].avgChange, 0.062);
  assert.equal(cats[0].up, 2);
  const p = explain.explainPrompt(facts, 5, "2026-11-04", { openQuotes: 3 });
  assert.match(p.prompt, /24\.3 → 25\.9/);
  assert.match(p.prompt, /\+6\.4%/);
  assert.match(p.prompt, /ราคาตัวอย่าง/);
  assert.match(p.prompt, /ใบเสนอราคาที่ยังไม่ปิด 3/);
});
