// AI sales & estimating pure helpers: price-book matching / line pricing, lead brief mapping,
// model recommendations, quote option pricing, reply context, selections and pipeline digest.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { matchItem, priceLine, priceLines, totalsOf, withMarkup, similarity, linesToTsv, bookForPrompt } = await lib("pricing");
const { briefChanges, patchFrom, cleanRecommendations, fitIssues, matchProvince, rankModels, leadBriefPrompt } = await lib("lead");
const { priceOptions, UPGRADE_PACKAGES } = await lib("quote");
const { voLineFrom, cleanDays, signedQty, estimatePrompt } = await lib("estimate");
const { replyContext, cleanReply, replyPrompt } = await lib("reply");
const { candidates, cleanPicks } = await lib("selection");
const { pipelineDigest, cleanInsights } = await lib("pipeline");

const ITEMS = [
  { code: "RF-METAL", name: "เมทัลชีทหลังคา หนา 0.35 มม. เคลือบสี", unit: "ตร.ม.", costCode: "05", labour: 70 },
  { code: "FN-CERAMIC", name: "กระเบื้องเซรามิกพื้นกันลื่น 30×30 ซม.", unit: "ตร.ม.", costCode: "10", labour: 220 },
  { code: "CN-240", name: "คอนกรีตผสมเสร็จ 240 ksc (ทรงลูกบาศก์)", unit: "ลบ.ม.", costCode: "03", labour: 420 },
];
const MAT: Record<string, number> = { "RF-METAL": 215, "FN-CERAMIC": 235, "CN-240": 2480 };
const book = {
  item: (c: string) => ITEMS.find((i) => i.code === c),
  material: (c: string) => (MAT[c] ? { price: MAT[c], source: "cgd", sample: true } : null),
  labour: (c: string) => ITEMS.find((i) => i.code === c)?.labour ?? 0,
};

test("exact code match prices from the book, never from the AI", () => {
  const l = priceLine({ itemCode: "rf-metal", name: "หลังคา", qty: 14, unit: "ตร.ม.", costCode: "10" }, book, ITEMS);
  assert.equal(l.status, "book");
  assert.equal(l.itemCode, "RF-METAL");
  assert.equal(l.unitCost, 285);
  assert.equal(l.amount, 3990);
  assert.equal(l.costCode, "05"); // book cost code wins
  assert.equal(l.name, ITEMS[0].name);
});

test("fuzzy name match is flagged, unknown items are ต้องสืบราคา at 0", () => {
  const f = priceLine({ name: "กระเบื้องเซรามิกพื้นกันลื่น 30x30", qty: 12, unit: "ตร.ม.", costCode: "10" }, book, ITEMS);
  assert.equal(f.status, "fuzzy");
  assert.equal(f.itemCode, "FN-CERAMIC");
  const u = priceLine({ itemCode: "XX-NOPE", name: "ประตูบานเฟี้ยมอะลูมิเนียม", qty: 1, unit: "ชุด", costCode: "09" }, book, ITEMS);
  assert.equal(u.status, "unpriced");
  assert.equal(u.amount, 0);
  assert.ok(u.warnings.some((w: string) => w.includes("XX-NOPE")));
  const m = priceLine({ name: "ประตูบานเฟี้ยมอะลูมิเนียม", qty: 2, unit: "ชุด", costCode: "09", manualUnitCost: 18000 }, book, ITEMS);
  assert.equal(m.status, "manual");
  assert.equal(m.amount, 36000);
});

test("unit mismatch keeps the book unit and warns", () => {
  const l = priceLine({ itemCode: "CN-240", name: "คอนกรีต", qty: 2, unit: "คิว", costCode: "03" }, book, ITEMS);
  assert.equal(l.unit, "ลบ.ม.");
  assert.equal(l.warnings.length, 1);
});

test("similarity and matching basics", () => {
  assert.equal(similarity("abc", "abc"), 1);
  assert.equal(similarity("", "abc"), 0);
  assert.equal(matchItem({ name: "งานรื้อถอนผนังเดิม", unit: "งาน" }, ITEMS), null);
});

test("priceLines drops empty/zero lines; totals follow the BOQ formula", () => {
  const ls = priceLines(
    [
      { itemCode: "RF-METAL", name: "x", qty: 10, unit: "ตร.ม.", costCode: "05" },
      { name: "", qty: 3, unit: "ชุด" },
      { itemCode: "FN-CERAMIC", name: "y", qty: 0, unit: "ตร.ม.", costCode: "10" },
      { name: "ของแปลก", qty: 1, unit: "ชุด", costCode: "10" },
    ],
    book,
    ITEMS,
  );
  assert.equal(ls.length, 2);
  const t = totalsOf(ls, 10, 20);
  assert.equal(t.direct, 2850);
  assert.equal(t.overhead, 285);
  assert.equal(t.cost, 3135);
  assert.equal(t.selling, 3918.75);
  assert.equal(t.unpriced, 1);
  assert.deepEqual(t.byCode.map((c: { costCode: string }) => c.costCode), ["05", "10"]);
  assert.match(linesToTsv(ls), /ต้องสืบราคา/);
});

test("markup and variation lines", () => {
  assert.equal(withMarkup(100, 25), 125);
  const v = voLineFrom({ name: "เมทัลชีท", qty: 12, unit: "ตร.ม.", unitCost: 285, costCode: "05" }, 20);
  assert.deepEqual(v, { description: "เมทัลชีท", qty: 12, unit: "ตร.ม.", unitCost: 285, unitPrice: 342, costCode: "05" });
  assert.equal(cleanDays(-3), 0);
  assert.equal(cleanDays("7.6"), 8);
  assert.equal(cleanDays(9999), 365);
  const s = signedQty({ name: "ลดกระเบื้อง", qty: -10, unit: "ตร.ม." });
  assert.equal(s.sign, -1);
  assert.equal(s.line.qty, 10);
});

test("prompts carry codes but no prices", () => {
  const p = estimatePrompt("ต่อเติมครัว 3x4", ITEMS, { "05": "หลังคา" }, "2026-11-04");
  assert.match(p, /RF-METAL\|เมทัลชีท/);
  assert.doesNotMatch(p, /215/);
  assert.equal(bookForPrompt(ITEMS).split("\n").length, 3);
});

const MODELS = [
  { code: "HM-04", name: "Sabai 120", nameTh: "บ้านชั้นเดียว", type: "house", floors: 1, area: 125, beds: 3, baths: 2, parking: 2, style: "Modern Thai", land: "18 × 20 ม.", W: 14, D: 9, priceMin: 2.5, priceMax: 2.9, months: 8 },
  { code: "HM-07", name: "Luxury Villa 420", nameTh: "วิลล่า", type: "house", floors: 2, area: 438, beds: 5, baths: 6, parking: 3, style: "Resort Luxury", land: "30 × 36 ม.", W: 18, D: 12, priceMin: 13.5, priceMax: 15.8, months: 14 },
  { code: "HM-15", name: "Garden Cottage 110", nameTh: "คอทเทจ", type: "house", floors: 1, area: 112, beds: 2, baths: 2, parking: 1, style: "Cottage", land: "16 × 20 ม.", W: 12, D: 9, priceMin: 2.2, priceMax: 2.6, months: 7 },
  { code: "CD-01", name: "Condo", nameTh: "คอนโด", type: "condo", floors: 6, area: 2220, beds: 2, baths: 1, parking: 28, style: "Modern", land: "42 × 33 ม.", W: 30, D: 14, priceMin: 72, priceMax: 90, months: 22 },
];

test("recommendations keep catalogue codes only, max 3, deduped", () => {
  const r = cleanRecommendations(
    [
      { code: "hm-04", reason: "ในงบ", fit: 140 },
      { code: "HM-99", reason: "ไม่มีจริง", fit: 90 },
      { code: "HM-04", reason: "ซ้ำ", fit: 80 },
      { code: "HM-15", reason: "เล็กกว่า", fit: 70 },
    ],
    MODELS,
  );
  assert.deepEqual(r.map((x: { code: string }) => x.code), ["HM-04", "HM-15"]);
  assert.equal(r[0].fit, 100);
});

test("fit issues and deterministic ranking", () => {
  const b = { budgetMillion: 3, bedrooms: 3, floors: 1, landWidthM: 15 };
  assert.ok(fitIssues(MODELS[1], b).length >= 2);
  assert.deepEqual(fitIssues(MODELS[0], { budgetMillion: 3, bedrooms: 3, floors: 1, landWidthM: 18 }), []);
  assert.match(fitIssues(MODELS[0], b).join(), /แคบกว่า/);
  const rank = rankModels(MODELS, { budgetMillion: 2.8, bedrooms: 3, floors: 1 });
  assert.equal(rank[0].code, "HM-04");
  assert.ok(!rank.some((x: { code: string }) => x.code === "CD-01"));
});

test("brief → lead changes only touch existing fields; the rest is a note", () => {
  const lead = { name: "ลีดใหม่", phone: "", budget: 0, province: "กรุงเทพฯ", models: [], landSize: undefined };
  const { changes, note } = briefChanges(
    lead,
    { name: "คุณมานพ", phone: "081-111-2222", budgetMillion: 3.5, province: "โคราช", landWidthM: 20, landDepthM: 30, bedrooms: 3, floors: 1, style: "โมเดิร์น", timeline: "ต้นปี 2570", mustHaves: ["ห้องพระ"] },
    ["กรุงเทพฯ", "นครราชสีมา", "ชลบุรี"],
  );
  const by = Object.fromEntries(changes.map((c: { field: string; value: unknown }) => [c.field, c.value]));
  assert.equal(by.name, "คุณมานพ");
  assert.equal(by.budget, 3.5);
  assert.equal(by.province, "นครราชสีมา");
  assert.equal(by.landSize, 150);
  assert.match(note, /3 ห้องนอน/);
  assert.match(note, /ห้องพระ/);
  assert.match(note, /ต้นปี 2570/);
  const patch = patchFrom(changes, new Set(["budget", "province"]));
  assert.deepEqual(patch, { budget: 3.5, province: "นครราชสีมา" });
});

test("existing real name/phone are not overwritten", () => {
  const { changes } = briefChanges({ name: "สมศรี ใจดี", phone: "089-000-0000", budget: 4, province: "ชลบุรี", models: [] }, { name: "คุณเอ", phone: "080", budgetMillion: 4 }, ["ชลบุรี"]);
  assert.equal(changes.length, 0);
});

test("province aliases", () => {
  assert.equal(matchProvince("กทม.", ["กรุงเทพฯ"]), "กรุงเทพฯ");
  assert.equal(matchProvince("จ.ชลบุรี", ["ชลบุรี"]), "ชลบุรี");
  assert.equal(matchProvince("ดาวอังคาร", ["ชลบุรี"]), undefined);
  assert.match(leadBriefPrompt({ text: "x", models: MODELS, provinces: ["ชลบุรี"], upgrades: ["โซลาร์"], today: "2026-11-04" }), /HM-04\|Sabai 120/);
});

test("quote options: packages at list price, book items at cost+markup, others flagged", () => {
  const o = priceOptions(
    [
      { code: "PK-SOLAR5", name: "โซลาร์", qty: 1, unit: "ระบบ", reason: "ค่าไฟ" },
      { code: "RF-METAL", name: "หลังคาโรงรถ", qty: 20, unit: "ตร.ม." },
      { name: "สระว่ายน้ำ", qty: 1, unit: "งาน" },
      { name: "", qty: 1, unit: "ชุด" },
    ],
    { packages: UPGRADE_PACKAGES, book, markupPct: 30 },
  );
  assert.equal(o.length, 3);
  assert.equal(o[0].unitPrice, 165000);
  assert.equal(o[0].basis, "package");
  assert.equal(o[1].unitPrice, Math.round(285 * 1.3));
  assert.equal(o[1].basis, "book");
  assert.equal(o[2].unitPrice, 0);
  assert.equal(o[2].basis, "unpriced");
});

test("reply context respects omitted (not permitted) lists and trims the thread", () => {
  const project = { id: "P1", name: "บ้าน", owner: "คุณเอ", phase: "งานระบบ", actual: 60, plan: 62, finish: "2027-01-01", status: "building", pm: "PM" };
  const messages = Array.from({ length: 12 }, (_, i) => ({ projectId: "P1", side: i % 2 ? "company" : "customer", author: "x", text: `m${i}`, at: `2026-11-0${(i % 9) + 1}T10:00` }));
  const ctx = replyContext({
    project,
    installments: [
      { projectId: "P1", no: 3, title: "งวด 3", amount: 100, vat: 7, dueDate: "2026-12-01", status: "scheduled" },
      { projectId: "P1", no: 2, title: "งวด 2", amount: 100, vat: 7, dueDate: "2026-11-01", status: "overdue" },
      { projectId: "P1", no: 1, title: "งวด 1", amount: 100, vat: 7, dueDate: "2026-10-01", status: "paid" },
    ],
    messages: messages as never,
    maxMessages: 5,
  });
  assert.equal(ctx.nextInstallment?.no, 2);
  assert.equal(ctx.overdueInstallments, 1);
  assert.equal(ctx.openRepairs, undefined);
  assert.equal(ctx.thread.length, 5);
  assert.match(replyPrompt(ctx, { staffName: "ศิริพร", politeEnding: "ค่ะ", today: "2026-11-04" }), /ค่ะ/);
  assert.equal(cleanReply('คำตอบ: "สวัสดีค่ะ"'), "สวัสดีค่ะ");
});

test("selection candidates and picks", () => {
  const prods = [
    { id: "P1", sku: "S1", name: "กระเบื้อง A", category: "surface", clientPrice: 500, tradeCost: 300, unit: "ตร.ม.", leadDays: 7 },
    { id: "P2", sku: "S2", name: "กระเบื้อง B", category: "surface", clientPrice: 1400, tradeCost: 900, unit: "ตร.ม.", leadDays: 7 },
    { id: "P3", sku: "S3", name: "โคม", category: "lighting", clientPrice: 600, tradeCost: 300, unit: "ชุด", leadDays: 7 },
    { id: "P4", sku: "S4", name: "กระเบื้อง C", category: "surface", clientPrice: 700, tradeCost: 400, unit: "ตร.ม.", leadDays: 7 },
  ];
  const c = candidates({ category: "floor", allowanceUnit: 600 }, prods);
  assert.deepEqual(c.map((p: { id: string }) => p.id), ["P1", "P4"]);
  const picks = cleanPicks([{ id: "P4", reason: "สวย" }, { id: "P3", reason: "ไม่ใช่หมวด" }, { id: "S1", reason: "ในงบ" }], c, 600);
  assert.deepEqual(picks.map((p: { product: { id: string } }) => p.product.id), ["P4", "P1"]);
  assert.equal(picks[1].within, true);
  assert.equal(picks[0].diffUnit, 100);
});

test("pipeline digest flags stalled leads and expiring quotes", () => {
  const leads = [
    { id: "LD-1", name: "A", stage: "quoted", budget: 5, owner: "x", source: "line", created: "2026-08-01", updated: "2026-09-01", nextFollowUp: "2026-10-20", models: [] },
    { id: "LD-2", name: "B", stage: "new", budget: 3, owner: "x", source: "web", created: "2026-11-01", updated: "2026-11-03", nextFollowUp: "2026-11-06", models: [] },
    { id: "LD-3", name: "C", stage: "lost", budget: 4, owner: "y", source: "web", created: "2026-05-01", updated: "2026-06-01", models: [], lostReason: "ราคา" },
  ];
  const quotes = [{ id: "QT-1", leadId: "LD-1", status: "sent", date: "2026-10-10", validDays: 30, total: 5350000 }];
  const d = pipelineDigest(leads, quotes, { today: "2026-11-04", weights: { quoted: 0.4, new: 0.05 } });
  assert.equal(d.openLeads, 2);
  assert.equal(d.weightedM, 2.2);
  assert.deepEqual(d.stalled.map((s: { id: string }) => s.id), ["LD-1"]);
  assert.equal(d.stalled[0].overdueDays, 15);
  assert.equal(d.expiringQuotes[0].daysLeft, 5);
  assert.equal(d.lostReasons[0].reason, "ราคา");
  assert.equal(JSON.stringify(d).includes("phone"), false);
  const ins = cleanInsights({ health: "ok", highlights: [], stalled: [{ leadId: "LD-1", why: "", action: "" }, { leadId: "LD-999", why: "", action: "" }], actions: [] }, d, ["LD-2"]);
  assert.equal(ins.stalled.length, 1);
});
