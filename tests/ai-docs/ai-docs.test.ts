import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { normTaxId, normName, nameSimilarity, matchSupplier, matchPoNumber, matchLines, guessProject } = await lib("match");
const { checkAmounts, billAmounts, vatSplit, compareWithPO } = await lib("reconcile");
const { normDate, billDraft, expenseDraft, guessCategory, quotePrices, deliveryQty, tenderPatch, boqLines, cleanLine } = await lib("map");
const { invoiceSchema, tenderSchema, quoteSchema, docSummarySchema } = await lib("schemas");
const { invoiceSystem, invoicePrompt, quotePrompt, docSummarySystem } = await lib("prompts");

const SUPPLIERS = [
  { id: "SUP-001", name: "บริษัท ศิลาไทย ซีเมนต์ เทรดดิ้ง จำกัด", taxId: "0105553004183", branch: "สำนักงานใหญ่" },
  { id: "SUP-002", name: "บริษัท เหล็กสยามเจริญ สตีล จำกัด", taxId: "0105541007625", branch: "สำนักงานใหญ่" },
  { id: "SUP-005", name: "ห้างหุ้นส่วนจำกัด รุ่งเรืองวัสดุก่อสร้าง", taxId: "0123551009871", branch: "สำนักงานใหญ่" },
  { id: "SUP-017", name: "บริษัท โฮมมาร์ท วัสดุ จำกัด (มหาชน)", taxId: "0107537001255", branch: "สาขา 00012" },
  { id: "SUP-018", name: "บริษัท โฮมมาร์ท วัสดุ จำกัด (มหาชน)", taxId: "0107537001255", branch: "สาขา 00003" },
];

const inv = (over: Record<string, unknown> = {}) => ({
  docKind: "tax_invoice_full",
  vendorName: "บริษัท ศิลาไทย ซีเมนต์ เทรดดิ้ง จำกัด",
  vendorTaxId: "0105553004183",
  vendorBranch: "สำนักงานใหญ่",
  vendorAddress: "",
  vendorPhone: "",
  docNo: "IV6911-0042",
  date: "2026-11-03",
  dueDate: "",
  creditDays: 30,
  poNumber: "PO-2026-0012",
  lines: [
    { description: "ปูนซีเมนต์ปอร์ตแลนด์ 50 กก.", qty: 200, unit: "ถุง", unitPrice: 145, amount: 29000 },
    { description: "ทรายหยาบ", qty: 10, unit: "ลบ.ม.", unitPrice: 600, amount: 6000 },
  ],
  subtotal: 35000,
  discount: 0,
  pricesIncludeVat: false,
  vatRate: 7,
  vat: 2450,
  total: 37450,
  whtRate: 0,
  whtAmount: 0,
  projectHint: "",
  categoryGuess: "",
  note: "",
  confidence: "high",
  uncertain: [],
  ...over,
});

// ---------- matching ----------

test("tax id normalisation: dashes, spaces and Thai digits; wrong length → empty", () => {
  assert.equal(normTaxId("0-1055-53004-18-3"), "0105553004183");
  assert.equal(normTaxId("๐๑๐๕๕๕๓๐๐๔๑๘๓"), "0105553004183");
  assert.equal(normTaxId("01055530041"), "");
  assert.equal(normTaxId(undefined), "");
});

test("name normalisation drops legal-form words", () => {
  assert.equal(normName("บริษัท ศิลาไทย ซีเมนต์ เทรดดิ้ง จำกัด"), normName("บจก. ศิลาไทยซีเมนต์เทรดดิ้ง"));
  assert.equal(normName("ห้างหุ้นส่วนจำกัด รุ่งเรืองวัสดุก่อสร้าง"), normName("หจก.รุ่งเรืองวัสดุก่อสร้าง"));
  assert.equal(normName("บริษัท โฮมมาร์ท วัสดุ จำกัด (มหาชน)"), "โฮมมาร์ทวัสดุ");
});

test("supplier match: tax id first, branch breaks ties", () => {
  const m = matchSupplier(SUPPLIERS, { taxId: "0-1075-37001-25-5", name: "โฮมมาร์ท", branch: "สาขาที่ 00003" });
  assert.equal(m?.supplier.id, "SUP-018");
  assert.equal(m?.by, "taxId");
  assert.equal(matchSupplier(SUPPLIERS, { taxId: "0107537001255", branch: "สาขา 00012" })?.supplier.id, "SUP-017");
});

test("supplier match: fuzzy Thai name without tax id, and no match for strangers", () => {
  const m = matchSupplier(SUPPLIERS, { name: "หจก. รุ่งเรือง วัสดุก่อสร้าง" });
  assert.equal(m?.supplier.id, "SUP-005");
  assert.equal(m?.by, "name");
  assert.ok(nameSimilarity("บริษัท เหล็กสยามเจริญ สตีล จำกัด", "เหล็กสยามเจริญ") >= 0.8);
  assert.equal(matchSupplier(SUPPLIERS, { name: "ร้านก๋วยเตี๋ยวเรือป้าแดง" }), undefined);
  assert.equal(matchSupplier(SUPPLIERS, { name: "" }), undefined);
});

test("PO number in different spellings", () => {
  const ids = ["PO-2026-0012", "PO-2026-0102", "PO-2025-0012"];
  assert.equal(matchPoNumber("PO-2026-0012", ids), "PO-2026-0012");
  assert.equal(matchPoNumber("po 2026/0012", ids), "PO-2026-0012");
  assert.equal(matchPoNumber("อ้างอิง PO2026-102", ids), "PO-2026-0102");
  assert.equal(matchPoNumber("0012", ids), undefined); // ambiguous across years
  assert.equal(matchPoNumber("0102", ids), "PO-2026-0102");
  assert.equal(matchPoNumber("", ids), undefined);
});

test("line matching pairs descriptions one-to-one and respects sizes", () => {
  const po = ["เหล็กข้ออ้อย DB12 SD40", "เหล็กข้ออ้อย DB16 SD40", "ลวดผูกเหล็ก"];
  const bill = ["ลวดผูกเหล็ก เบอร์ 18", "เหล็ก DB16 ยาว 10 ม.", "เหล็ก DB12 ยาว 10 ม."];
  assert.deepEqual(matchLines(po, bill), [2, 1, 0]);
  assert.deepEqual(matchLines(["ปูนซีเมนต์"], ["ค่าขนส่ง"]), [-1]);
});

test("project guess by id or name in the text", () => {
  const list = [
    { id: "HC-2026-02", name: "บ้านคุณวรเชษฐ์ บางบัวทอง" },
    { id: "HC-2025-03", name: "คอนโด CD-01 รัตนาธิเบศร์" },
  ];
  assert.equal(guessProject("ส่งที่ HC-2025-03 ชั้น 4", list)?.id, "HC-2025-03");
  assert.equal(guessProject("หน้างาน บ้านคุณวรเชษฐ์ บางบัวทอง ซอย 5", list)?.id, "HC-2026-02");
  assert.equal(guessProject("", list), undefined);
});

// ---------- amounts ----------

test("VAT split inclusive / exclusive", () => {
  assert.deepEqual(vatSplit(107, 7, true), { base: 100, vat: 7, total: 107 });
  assert.deepEqual(vatSplit(100, 7, false), { base: 100, vat: 7, total: 107 });
  assert.deepEqual(vatSplit(100, 0, false), { base: 100, vat: 0, total: 100 });
});

test("amount checks pass a consistent invoice and flag each inconsistency", () => {
  assert.deepEqual(checkAmounts(inv()), []);
  const bad = checkAmounts(inv({ total: 37540, vat: 2405 }));
  assert.ok(bad.some((i: { field: string }) => i.field === "total"));
  assert.ok(bad.some((i: { field: string }) => i.field === "vat"));
  const line = checkAmounts(inv({ lines: [{ description: "ปูน", qty: 200, unit: "ถุง", unitPrice: 145, amount: 2900 }], subtotal: 2900, vat: 203, total: 3103 }));
  assert.equal(line.length, 1);
  assert.equal(line[0].field, "lines.0");
  // rounding within 1 baht is fine
  assert.deepEqual(checkAmounts(inv({ vat: 2450.4, total: 37450.4 })), []);
});

test("amount checks for VAT-inclusive receipts and withholding", () => {
  const r = { lines: [{ description: "น้ำมันดีเซล", qty: 40, unit: "ลิตร", unitPrice: 32.1, amount: 1284 }], subtotal: 1284, discount: 0, pricesIncludeVat: true, vatRate: 7, vat: 84, total: 1284 };
  assert.deepEqual(checkAmounts(r), []);
  assert.deepEqual(billAmounts(r), { subtotal: 1200, vat: 84, total: 1284 });
  const w = checkAmounts({ ...inv(), whtRate: 3, whtAmount: 1500 });
  assert.equal(w[0].field, "whtAmount");
});

test("bill amounts after document discount", () => {
  assert.deepEqual(billAmounts(inv({ discount: 1000, vat: 2380, total: 36380 })), { subtotal: 34000, vat: 2380, total: 36380 });
  // VAT missing on the document but rate printed → computed
  assert.deepEqual(billAmounts(inv({ vat: 0 })), { subtotal: 35000, vat: 2450, total: 37450 });
});

test("compare bill with PO: quantities, prices, extras", () => {
  const po = [
    { description: "ปูนซีเมนต์ปอร์ตแลนด์ 50 กก.", qty: 200, unit: "ถุง", unitPrice: 145 },
    { description: "ทรายหยาบ", qty: 12, unit: "ลบ.ม.", unitPrice: 580 },
  ];
  const c = compareWithPO(po, inv().lines);
  assert.equal(c.lines[0].issue, undefined);
  assert.match(c.lines[1].issue, /จำนวนขาด 2/);
  assert.match(c.lines[1].issue, /ราคาสูงกว่า PO 20/);
  assert.equal(c.refTotal, 35960);
  assert.equal(c.billTotal, 35000);
  assert.equal(c.ok, false);
  const withGr = compareWithPO(po, [...inv().lines, { description: "ค่าขนส่ง", qty: 1, unitPrice: 500 }], { refQty: [200, 10] });
  assert.deepEqual(withGr.extra, [2]);
  const same = compareWithPO([{ description: "ทรายหยาบ", qty: 10, unit: "ลบ.ม.", unitPrice: 600 }], [{ description: "ทรายหยาบ", qty: 10, unitPrice: 600 }]);
  assert.equal(same.ok, true);
});

// ---------- drafts ----------

test("dates: Buddhist year, invalid → empty", () => {
  assert.equal(normDate("2569-11-03"), "2026-11-03");
  assert.equal(normDate("2026-1-5"), "2026-01-05");
  assert.equal(normDate("03/11/2569"), "");
  assert.equal(normDate(""), "");
});

test("cleanLine fills qty / price from the amount", () => {
  assert.deepEqual(cleanLine({ description: " ค่าแรง ", qty: 0, unit: "", unitPrice: 0, amount: 5000 }), { description: "ค่าแรง", qty: 1, unit: "", unitPrice: 5000, amount: 5000 });
  assert.equal(cleanLine({ description: "x", qty: 0, unit: "", unitPrice: 50, amount: 500 }).qty, 10);
});

test("bill draft: supplier terms, due date, VAT-inclusive lines converted", () => {
  const s = { id: "SUP-001", name: "ศิลาไทย", taxId: "0105553004183", paymentTerms: 45, whtRate: 0 };
  const d = billDraft(inv({ creditDays: 0 }), { today: "2026-11-04", supplier: s });
  assert.equal(d.supplierId, "SUP-001");
  assert.equal(d.dueDate, "2026-12-18");
  assert.equal(d.subtotal, 35000);
  assert.equal(d.vat, 2450);
  const inc = billDraft(inv({ pricesIncludeVat: true, lines: [{ description: "ปูน", qty: 10, unit: "ถุง", unitPrice: 160.5, amount: 1605 }], subtotal: 1605, vat: 105, total: 1605, dueDate: "2026-12-01" }), { today: "2026-11-04" });
  assert.equal(inc.lines[0].unitPrice, 150);
  assert.equal(inc.subtotal, 1500);
  assert.equal(inc.dueDate, "2026-12-01");
  assert.equal(inc.supplierTaxId, "0105553004183");
  const disc = billDraft(inv({ discount: 1000, vat: 2380, total: 36380 }), { today: "2026-11-04" });
  assert.equal(disc.lines.length, 3);
  assert.equal(disc.lines[2].unitPrice, -1000);
  assert.equal(disc.subtotal, disc.lines.reduce((t: number, l: { qty: number; unitPrice: number }) => t + l.qty * l.unitPrice, 0));
});

const CATS = [
  { name: "วัสดุก่อสร้าง", wht: 0 },
  { name: "ค่าน้ำมัน/ค่าเดินทาง", wht: 0 },
  { name: "วัสดุสิ้นเปลือง/เครื่องมือเล็ก", wht: 0 },
  { name: "ค่าใช้จ่ายอื่น", wht: 0 },
];

test("expense draft: doc type, VAT mode, category and project guesses", () => {
  const fuel = inv({
    docKind: "tax_invoice_abb",
    vendorName: "สถานีบริการน้ำมัน ปตท. สาขาบางบัวทอง",
    vendorTaxId: "",
    lines: [{ description: "ดีเซล B7", qty: 40, unit: "ลิตร", unitPrice: 32.1, amount: 1284 }],
    subtotal: 1284,
    pricesIncludeVat: true,
    vat: 84,
    total: 1284,
    projectHint: "รถกระบะไซต์ HC-2026-02",
  });
  const d = expenseDraft(fuel, { today: "2026-11-04", categories: CATS, projects: [{ id: "HC-2026-02", name: "บ้านคุณวรเชษฐ์" }] });
  assert.equal(d.docType, "ใบกำกับภาษีอย่างย่อ");
  assert.equal(d.vatMode, "included");
  assert.equal(d.category, "ค่าน้ำมัน/ค่าเดินทาง");
  assert.equal(d.projectId, "HC-2026-02");
  assert.equal(d.lines[0].price, 32.1);
  // "full" without a tax id is downgraded; no VAT → none
  const cash = expenseDraft(inv({ docKind: "tax_invoice_full", vendorTaxId: "", vat: 0, vatRate: 0, categoryGuess: "วัสดุก่อสร้าง" }), { today: "2026-11-04", categories: CATS, projects: [] });
  assert.equal(cash.docType, "ใบกำกับภาษีอย่างย่อ");
  assert.equal(cash.vatMode, "none");
  assert.equal(cash.category, "วัสดุก่อสร้าง");
  assert.equal(guessCategory({ categoryGuess: "ไม่มีหมวดนี้", vendorName: "ร้านป้าแดง", lines: [] }, CATS), "ค่าใช้จ่ายอื่น");
});

test("quotation prices per PR line, VAT stripped, validity from days", () => {
  const pr = [{ description: "เหล็กข้ออ้อย DB12" }, { description: "ลวดผูกเหล็ก" }, { description: "ปูนซีเมนต์" }];
  const q = {
    vendorName: "",
    vendorTaxId: "",
    docNo: "QT-1",
    date: "2026-11-01",
    validUntil: "",
    validDays: 15,
    leadDays: 3,
    creditDays: 30,
    pricesIncludeVat: true,
    lines: [
      { description: "ลวดผูก #18", qty: 10, unit: "กก.", unitPrice: 53.5, amount: 535 },
      { description: "DB12 SD40 10 ม.", qty: 100, unit: "เส้น", unitPrice: 214, amount: 21400 },
    ],
    subtotal: 0,
    vat: 0,
    total: 0,
    note: "",
    confidence: "high",
    uncertain: [],
  };
  const r = quotePrices(pr, q, { today: "2026-11-04" });
  assert.deepEqual(r.matched, [1, 0, -1]);
  assert.deepEqual(r.prices, [200, 50, 0]);
  assert.equal(r.validUntil, "2026-11-16");
  assert.equal(r.leadDays, 3);
});

test("delivery note quantities clamp to what is still open on the PO", () => {
  const po = [{ description: "ปูนซีเมนต์ 50 กก." }, { description: "ทรายหยาบ" }];
  const r = deliveryQty(po, [100, 5], { lines: [{ description: "ทรายหยาบ", qty: 6, unit: "ลบ.ม.", unitPrice: 0, amount: 0 }, { description: "ปูนซีเมนต์", qty: 80, unit: "ถุง", unitPrice: 0, amount: 0 }] });
  assert.deepEqual(r.qty, [80, 5]);
  assert.deepEqual(r.over, [0, 1]);
  assert.deepEqual(r.extra, []);
});

test("tender patch: dates, bond from %, TOR note; BOQ lines", () => {
  const x = {
    title: "ก่อสร้างอาคารเรียน 3 ชั้น",
    client: "องค์การบริหารส่วนจังหวัดนนทบุรี",
    province: "จังหวัดนนทบุรี",
    source: "egp",
    method: "e-bidding",
    egpNo: "69119012345",
    budget: 12_000_000,
    medianPrice: 11_800_000,
    announced: "2569-11-01",
    siteVisit: "",
    questionsDue: "2026-11-10",
    submitDue: "2026-11-20",
    openDate: "",
    bidBondAmount: 0,
    bidBondPct: 5,
    durationDays: 360,
    penaltyRatePct: 0.1,
    warrantyMonths: 24,
    summary: "ก่อสร้างอาคารเรียน คสล. 3 ชั้น",
    qualifications: ["มีผลงานก่อสร้างอาคารไม่น้อยกว่า 5 ล้านบาท"],
    risks: ["ค่าปรับวันละ 0.10%"],
    boq: [
      { group: "งานโครงสร้าง", description: "คอนกรีตโครงสร้าง 240 ksc", qty: 320, unit: "ลบ.ม.", material: 2100, labour: 450, unitPrice: 0 },
      { group: "", description: "ไม้แบบ", qty: 900, unit: "ตร.ม.", material: 0, labour: 0, unitPrice: 380 },
      { group: "งานสถาปัตย์", description: "  ", qty: 1, unit: "", material: 0, labour: 0, unitPrice: 0 },
    ],
    confidence: "medium",
    uncertain: [],
  };
  const p = tenderPatch(x);
  assert.equal(p.province, "นนทบุรี");
  assert.equal(p.announced, "2026-11-01");
  assert.equal(p.siteVisit, undefined);
  assert.equal(p.bidBondAmount, 590_000);
  assert.match(p.torNote, /ระยะเวลาก่อสร้าง 360 วัน · ค่าปรับ 0.1% ต่อวัน · รับประกัน 24 เดือน/);
  assert.match(p.torNote, /- มีผลงาน/);
  const lines = boqLines(x, 5);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1], { id: "L6", group: "งานโครงสร้าง", description: "ไม้แบบ", qty: 900, unit: "ตร.ม.", material: 380, labour: 0 });
});

// ---------- schemas & prompts ----------

test("schemas require every key and carry the enums", () => {
  const s = invoiceSchema(["วัสดุก่อสร้าง"]);
  assert.deepEqual(s.required, Object.keys(s.properties));
  assert.deepEqual(s.properties.categoryGuess.enum, ["", "วัสดุก่อสร้าง"]);
  assert.ok(s.properties.docKind.enum.includes("delivery_note"));
  for (const x of [tenderSchema, quoteSchema, docSummarySchema]) assert.deepEqual(x.required, Object.keys(x.properties));
  assert.deepEqual(tenderSchema.properties.boq.items.required, ["group", "description", "qty", "unit", "material", "labour", "unitPrice"]);
});

test("prompts carry today, Buddhist-year rule and the context lists", () => {
  const sys = invoiceSystem("2026-11-04");
  assert.match(sys, /2026-11-04/);
  assert.match(sys, /ลบ 543/);
  const p = invoicePrompt({ purpose: "bill", poNumbers: ["PO-2026-0012"], categories: ["วัสดุก่อสร้าง"] });
  assert.match(p, /PO-2026-0012/);
  assert.match(p, /วัสดุก่อสร้าง/);
  assert.match(quotePrompt([{ description: "ทรายหยาบ", qty: 10, unit: "ลบ.ม." }]), /1\. ทรายหยาบ — 10 ลบ\.ม\./);
  assert.match(docSummarySystem("2026-11-04", "contract"), /ค่าปรับ/);
});

test("tax id check digit", async () => {
  const { taxIdChecksumOk } = await lib("match");
  assert.equal(taxIdChecksumOk("0105553004186"), true);
  assert.equal(taxIdChecksumOk("0105553004183"), false);
  assert.equal(taxIdChecksumOk("123"), false);
});
