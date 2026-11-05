import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const common = await lib("common");
const speech = await lib("speech");
const diary = await lib("diary");
const defect = await lib("defect");
const safety = await lib("safety");
const eng = await lib("engineering");
const insp = await lib("inspection");

const TODAY = "2026-11-04";

// ---------- common ----------

test("similarity: identical, containment, unrelated", () => {
  assert.equal(common.similarity("เทพื้นชั้น 2", "เทพื้น ชั้น 2"), 1);
  assert.ok(common.similarity("เทพื้นชั้น 2", "งานเทคอนกรีตพื้นชั้น 2") > 0.4);
  assert.ok(common.similarity("ติดตั้งสุขภัณฑ์", "เทพื้นชั้น 2") < 0.3);
  assert.equal(common.normKey("ชั้น ๒"), "ชั้น2");
});

test("oneOf / num / isIsoDate / addDaysIso", () => {
  assert.equal(common.oneOf("elec", common.SYSTEM_KEYS, "arch"), "elec");
  assert.equal(common.oneOf("roof", common.SYSTEM_KEYS, "arch"), "arch");
  assert.equal(common.num("20 ถุง"), 20);
  assert.equal(common.num(150, 0, 100), 100);
  assert.equal(common.num("abc"), undefined);
  assert.ok(common.isIsoDate("2026-11-04"));
  assert.ok(!common.isIsoDate("4/11/2026"));
  assert.equal(common.addDaysIso("2026-11-28", 7), "2026-12-05");
});

// ---------- speech ----------

test("thaiWordsToNumber", () => {
  assert.equal(speech.thaiWordsToNumber("หก"), 6);
  assert.equal(speech.thaiWordsToNumber("ยี่สิบห้า"), 25);
  assert.equal(speech.thaiWordsToNumber("สิบเอ็ด"), 11);
  assert.equal(speech.thaiWordsToNumber("หนึ่งร้อยยี่สิบ"), 120);
  assert.equal(speech.thaiWordsToNumber("สองสาม"), undefined);
});

test("normalizeSpeech converts numbers before units, percent, Thai digits, keeps other words", () => {
  assert.equal(speech.normalizeSpeech("วันนี้ช่างปูนหกคน ไฟฟ้าสองคน"), "วันนี้ช่างปูน 6 คน ไฟฟ้า 2 คน");
  assert.equal(speech.normalizeSpeech("เทพื้นชั้น 2 ไป 70 เปอร์เซ็นต์"), "เทพื้นชั้น 2 ไป 70%");
  assert.equal(speech.normalizeSpeech("ฝนตกบ่ายสองชั่วโมง ปูนมาส่ง ๒๐ ถุง"), "ฝนตกบ่าย 2 ชั่วโมง ปูนมาส่ง 20 ถุง");
  assert.equal(speech.normalizeSpeech("ทาสีห้องสี่เหลี่ยม"), "ทาสีห้องสี่เหลี่ยม");
  assert.equal(speech.normalizeSpeech("ทราย 2 จุด 5 คิว"), "ทราย 2.5 คิว");
});

test("appendTranscript adds a space between chunks", () => {
  assert.equal(speech.appendTranscript("", " ช่างปูน 6 คน "), "ช่างปูน 6 คน");
  assert.equal(speech.appendTranscript("ช่างปูน 6 คน", "ไฟฟ้าสองคน"), "ช่างปูน 6 คน ไฟฟ้า 2 คน");
  assert.equal(speech.appendTranscript("ก\n", "ข"), "ก\nข");
});

// ---------- diary ----------

const task = (id: string, code: string, name: string, pct: number, start = "2026-10-20", finish = "2026-11-20", extra = {}) => ({ id, projectId: "P1", code, name, start, finish, deps: [], value: 1, pct, ...extra });
const TASKS = [
  task("W1", "1", "งานโครงสร้าง", 50),
  task("W2", "1.1", "เทพื้นชั้น 2", 40, "2026-10-28", "2026-11-08", { parentId: "W1" }),
  task("W3", "1.2", "ก่ออิฐชั้น 2", 0, "2026-11-10", "2026-11-25", { parentId: "W1" }),
  task("W4", "2", "ส่งมอบ", 0, "2026-12-01", "2026-12-01", { milestone: true }),
  task("W5", "3", "ฐานราก", 100, "2026-08-01", "2026-08-30"),
  { ...task("X1", "1", "งานอื่น", 0), projectId: "P2" },
];
const SUBS = [
  { id: "SUB-1", name: "หจก. ไฟฟ้ารุ่งเรือง", trades: ["ไฟฟ้า"] },
  { id: "SUB-2", name: "ช่างปูนสมศักดิ์", trades: ["ฉาบ", "ก่ออิฐ"] },
];
const blank = () => ({ id: "D1", projectId: "P1", date: TODAY, weatherAm: "sunny", weatherPm: "sunny", manpower: [], equipment: [], work: [], photos: [], by: "x", status: "draft" });

test("pickTasks: leaf, non-milestone, own project, running first, old finished dropped", () => {
  const ids = diary.pickTasks(TASKS, "P1", TODAY).map((t: { id: string }) => t.id);
  assert.deepEqual(ids, ["W2", "W3"]);
});

test("diaryPrompt lists task ids and the text", () => {
  const p = diary.diaryPrompt({ text: "เทพื้นชั้น 2 ไป 70%", date: TODAY, projectName: "บ้านทดสอบ", tasks: diary.pickTasks(TASKS, "P1", TODAY), subs: SUBS });
  assert.match(p.prompt, /W2 \| 1\.1 เทพื้นชั้น 2/);
  assert.match(p.prompt, /หจก\. ไฟฟ้ารุ่งเรือง/);
  assert.match(p.prompt, /เทพื้นชั้น 2 ไป 70%$/);
  assert.match(p.system, /2026-11-04/);
});

test("applyDiaryDraft maps weather, manpower (subcontractor match), work (id + fuzzy), deliveries", () => {
  const draft = {
    weatherAm: "sunny",
    weatherPm: "rain",
    rainHours: 2,
    manpower: [
      { group: "ทีมบริษัท", trade: "ช่างปูน", count: 6 },
      { group: "ไฟฟ้ารุ่งเรือง", trade: "ช่างไฟฟ้า", count: 2 },
      { group: "ทีมบริษัท", trade: "กรรมกร", count: 0 },
    ],
    work: [
      { text: "เทพื้นชั้น 2", taskId: "W2", pct: 70 },
      { text: "ก่ออิฐ ชั้น2", taskId: "bogus" },
      { text: "เก็บกวาดหน้างาน" },
    ],
    deliveries: "ปูนซีเมนต์ 20 ถุง",
  };
  const { diary: d, filled } = diary.applyDiaryDraft(blank(), draft, TASKS.filter((t) => t.projectId === "P1"), SUBS);
  assert.equal(d.weatherPm, "rain");
  assert.equal(d.rainHours, 2);
  assert.equal(d.manpower.length, 2);
  assert.deepEqual(d.manpower[1], { group: "หจก. ไฟฟ้ารุ่งเรือง", trade: "ช่างไฟฟ้า", count: 2, subcontractorId: "SUB-1" });
  assert.equal(d.manpower[0].subcontractorId, undefined);
  assert.deepEqual(d.work[0], { text: "เทพื้นชั้น 2", taskId: "W2", pct: 70 });
  assert.equal(d.work[1].taskId, "W3");
  assert.equal(d.work[2].taskId, undefined);
  assert.equal(d.deliveries, "ปูนซีเมนต์ 20 ถุง");
  assert.deepEqual(filled.sort(), ["deliveries", "manpower", "weather", "work"]);
});

test("applyDiaryDraft keeps typed rows and bad values are clamped", () => {
  const start = { ...blank(), manpower: [{ group: "ทีมบริษัท", trade: "กรรมกร", count: 3 }], work: [{ text: "" }], issues: "รอแบบ" };
  const { diary: d } = diary.applyDiaryDraft(start, { weatherAm: "snow", weatherPm: "x", rainHours: 40, manpower: [{ trade: "ช่างไม้", count: 2.6 }], work: [{ text: "ตั้งแบบ", pct: 140 }], issues: "ฝนตก" }, [], []);
  assert.equal(d.weatherAm, "sunny");
  assert.equal(d.weatherPm, "rain"); // rain hours given → afternoon rain
  assert.equal(d.rainHours, 24);
  assert.deepEqual(d.manpower.map((m: { trade: string; count: number }) => `${m.trade}:${m.count}`), ["กรรมกร:3", "ช่างไม้:3"]);
  assert.deepEqual(d.work, [{ text: "ตั้งแบบ", taskId: undefined, pct: 100 }]);
  assert.equal(d.issues, "รอแบบ\nฝนตก");
});

// ---------- defect ----------

const ASSETS = [
  { code: "WC-201", name: "สุขภัณฑ์ชิ้นเดียว", system: "plumb", location: "ชั้น 2 · ห้องน้ำ 2" },
  { code: "AC-201", name: "แอร์ติดผนัง 12,000 BTU", system: "hvac", location: "ชั้น 2 · ห้องนอน 2" },
];
const TRADES = ["โครงสร้าง", "ก่ออิฐ/ฉาบ", "กระเบื้อง", "สี", "ไฟฟ้า", "ประปา", "สุขภัณฑ์"];

test("normalizeDefect validates enums, asset code and trade", () => {
  const s = defect.normalizeDefect({ title: "แอร์น้ำหยด", system: "elec", severity: "urgent", assetCode: "ac-201", detail: "มีน้ำหยด", cause: "ท่อน้ำทิ้งตัน", fix: "ล้างท่อ", confidence: "high" }, { assets: ASSETS });
  assert.equal(s.asset?.code, "AC-201");
  assert.equal(s.system, "hvac"); // asset's system wins
  assert.equal(s.severity, "medium");
  const t = defect.normalizeDefect({ system: "arch", trade: "งานกระเบื้อง", assetCode: "" }, { trades: TRADES });
  assert.equal(t.trade, "กระเบื้อง");
  assert.equal(t.title, "ข้อบกพร่องจากรูปถ่าย");
  assert.equal(t.asset, undefined);
  const u = defect.normalizeDefect({ system: "plumb", trade: "อื่น ๆ" }, { trades: TRADES });
  assert.equal(u.trade, "ประปา");
});

test("defectPrompt includes assets, enums and note; detail text joins cause and fix", () => {
  const p = defect.defectPrompt({ today: TODAY, context: "repair", assets: ASSETS, note: "น้ำหยด", trades: TRADES });
  assert.match(p.prompt, /WC-201 \| สุขภัณฑ์ชิ้นเดียว/);
  assert.match(p.prompt, /plumb=ประปา/);
  assert.match(p.prompt, /น้ำหยด/);
  assert.equal(defect.defectDetailText({ detail: "ร้าว", cause: "ทรุด", fix: "" }), "ร้าว\nสาเหตุที่เป็นไปได้: ทรุด");
});

test("normalizeFix", () => {
  assert.deepEqual(defect.normalizeFix({ verdict: "fixed", reason: "ไม่เห็นรอยร้าว" }), { verdict: "fixed", reason: "ไม่เห็นรอยร้าว", remaining: [] });
  assert.equal(defect.normalizeFix(undefined).verdict, "unsure");
});

// ---------- safety ----------

const CHECK = ["ความเป็นระเบียบ ทางเดินโล่ง", "ช่องเปิดพื้นปิด/มีราวกั้น", "ระบบไฟฟ้าชั่วคราวมีเครื่องตัดไฟรั่ว"];

test("normalizeHazards: item index from 1-based, fuzzy fallback, sorted by severity", () => {
  const r = safety.normalizeHazards(
    {
      hazards: [
        { hazard: "เศษวัสดุกองบนทางเดิน", severity: "low", action: "เก็บกวาด", item: 1 },
        { hazard: "ช่องเปิดพื้นไม่มีราวกั้น", severity: "high", action: "ติดราวกันตก", item: 0 },
        { hazard: "คนงานไม่สวมหมวก", severity: "weird", action: "สวมหมวก", item: 9 },
        { hazard: "", severity: "high", action: "x", item: 1 },
      ],
      summary: "พบ 3 จุด",
    },
    CHECK,
  );
  assert.equal(r.hazards.length, 3);
  assert.equal(r.hazards[0].severity, "high");
  assert.equal(r.hazards[0].item, 1);
  assert.equal(r.hazards[1].severity, "medium");
  assert.equal(r.hazards[1].item, -1);
  assert.equal(r.hazards[2].item, 0);
});

test("applyHazards marks items failed with notes; actions text; follow-up days", () => {
  const items = CHECK.map((text) => ({ text, result: "pass", note: "" }));
  const hz = [
    { hazard: "ช่องเปิดพื้นไม่มีราวกั้น", where: "ชั้น 2", severity: "high", action: "ติดราวกันตก", item: 1 },
    { hazard: "ไม่สวมหมวก", where: "", severity: "medium", action: "สวมหมวก", item: -1 },
  ];
  const r = safety.applyHazards(items, hz);
  assert.equal(r.items[1].result, "fail");
  assert.equal(r.items[1].note, "ช่องเปิดพื้นไม่มีราวกั้น (ชั้น 2)");
  assert.equal(r.items[0].result, "pass");
  assert.equal(items[1].result, "pass"); // input untouched
  assert.equal(r.unmatched.length, 1);
  assert.equal(r.actions, "1. ติดราวกันตก (หยุดงานจนกว่าจะแก้)\n2. สวมหมวก");
  assert.equal(safety.followUpDays(hz), 0);
  assert.equal(safety.followUpDays([]), 7);
});

test("normalizeTopics matches library ids and titles", () => {
  const LIB = [
    { id: "T01", cat: "height", title: "การใช้เข็มขัดนิรภัยแบบเต็มตัวและจุดยึดที่มั่นคง" },
    { id: "T14", cat: "health", title: "ป้องกันโรคลมร้อน: ดื่มน้ำ พักในที่ร่ม สังเกตอาการ" },
  ];
  const r = safety.normalizeTopics(
    {
      topics: [
        { topicId: "T01", title: "เข็มขัด", why: "มี permit ที่สูง", points: ["คล้องตลอด"] },
        { title: "ป้องกันโรคลมร้อน: ดื่มน้ำ พักในที่ร่ม สังเกตอาการ", why: "อากาศร้อน", points: [] },
        { title: "ทางลื่นหลังฝนตก", why: "ฝนตกบ่าย", points: ["ทรายโรย"] },
      ],
    },
    LIB,
  );
  assert.equal(r[0].title, LIB[0].title);
  assert.equal(r[0].cat, "height");
  assert.equal(r[1].topicId, "T14");
  assert.equal(r[2].topicId, undefined);
});

// ---------- engineering ----------

const ATT = [
  { name: "สมชาย ปานทอง", org: "บริษัท (PM)" },
  { name: "วิภา ศรีงาม", org: "หจก. ไฟฟ้ารุ่งเรือง" },
  { name: "อนันต์ ใจดี", org: "ที่ปรึกษา" },
];

test("matchOwner: exact, first name, org, none", () => {
  assert.equal(eng.matchOwner("สมชาย ปานทอง", ATT), "สมชาย ปานทอง");
  assert.equal(eng.matchOwner("คุณวิภา", ATT), "วิภา ศรีงาม");
  assert.equal(eng.matchOwner("ไฟฟ้ารุ่งเรือง", ATT), "วิภา ศรีงาม");
  assert.equal(eng.matchOwner("ผู้ว่าจ้าง", ATT), undefined);
});

test("normalizeMinutes fixes owners and due dates", () => {
  const r = eng.normalizeMinutes(
    {
      minutes: "วาระ 1 ...",
      decisions: ["อนุมัติเปลี่ยนสเปกโคม", ""],
      actions: [
        { text: "ส่ง shop drawing ตู้ไฟ", owner: "วิภา", due: "2026-11-07" },
        { text: "ยืนยันสีผนัง", owner: "เจ้าของบ้าน", due: "next week" },
        { text: "", owner: "x", due: "2026-11-07" },
        { text: "ตรวจแบบ", owner: "อนันต์", due: "2026-10-01" },
      ],
    },
    { date: TODAY, attendees: ATT },
  );
  assert.deepEqual(r.decisions, ["อนุมัติเปลี่ยนสเปกโคม"]);
  assert.equal(r.actions.length, 3);
  assert.deepEqual(r.actions[0], { text: "ส่ง shop drawing ตู้ไฟ", owner: "วิภา ศรีงาม", matched: true, due: "2026-11-07" });
  assert.equal(r.actions[1].matched, false);
  assert.equal(r.actions[1].owner, "เจ้าของบ้าน");
  assert.equal(r.actions[1].due, "2026-11-11");
  assert.equal(r.actions[2].due, "2026-11-11"); // past date → default
});

test("minutesPrompt lists attendees and default due", () => {
  const p = eng.minutesPrompt({ today: TODAY, date: TODAY, title: "ประชุมประจำสัปดาห์", projectName: "บ้าน", attendees: ATT, agenda: ["ความคืบหน้า"], carried: [], notes: "โน้ต" });
  assert.match(p.prompt, /วิภา ศรีงาม · หจก\. ไฟฟ้ารุ่งเรือง/);
  assert.match(p.prompt, /2026-11-11/);
});

test("normalizeRfi / normalizeNcr / normalizeSupervision", () => {
  const r = eng.normalizeRfi({ subject: "ระยะทาบเหล็ก", question: "ขอคำชี้แจง", disc: "X", priority: "urgent", sheet: "s-101", costImpact: true, timeImpact: "yes" }, [{ id: "S-101" }]);
  assert.equal(r.disc, "S");
  assert.equal(r.priority, "urgent");
  assert.equal(r.sheet, "S-101");
  assert.equal(r.costImpact, true);
  assert.equal(r.timeImpact, false);
  assert.equal(eng.normalizeRfi({ sheet: "Z-9" }, [{ id: "S-101" }]).sheet, "");
  const n = eng.normalizeNcr({ title: "รูพรุน", disc: "S", severity: "bad" });
  assert.equal(n.severity, "major");
  assert.equal(n.rootCause, "");
  assert.deepEqual(eng.normalizeSupervision({ work: "ตรวจเหล็ก" }), { work: "ตรวจเหล็ก", tests: "", instructions: "", issues: "" });
});

// ---------- inspection ----------

test("normalizeItem + itemPrompt", () => {
  assert.deepEqual(insp.normalizeItem({ verdict: "fail", comment: "ยาแนวไม่เต็ม", severity: "low", checks: ["เคาะฟังเสียงโปร่ง"] }), { verdict: "fail", comment: "ยาแนวไม่เต็ม", severity: "low", checks: ["เคาะฟังเสียงโปร่ง"] });
  assert.equal(insp.normalizeItem({ verdict: "maybe" }).verdict, "unsure");
  const p = insp.itemPrompt({ today: TODAY, text: "กระเบื้องได้ระดับ", standard: "ต่างระดับไม่เกิน 1 มม.", phase: "งานผิว", location: "ชั้น 1", photoCount: 2 });
  assert.match(p.prompt, /เกณฑ์: ต่างระดับไม่เกิน 1 มม\./);
});

test("buildWeekContext filters by site and date windows", () => {
  const c = safety.buildWeekContext({
    site: "P1",
    today: TODAY,
    incidents: [
      { projectId: "P1", date: "2026-11-01", cls: "near_miss", description: "ค้อนตกจากนั่งร้าน" },
      { projectId: "P1", date: "2026-10-01", cls: "first_aid", description: "เก่า" },
      { projectId: "P2", date: "2026-11-02", cls: "first_aid", description: "ไซต์อื่น" },
    ],
    permits: [
      { projectId: "P1", type: "height", title: "ติดตั้งรางน้ำ", validFrom: "2026-11-05T08:00", validTo: "2026-11-05T17:00", status: "issued" },
      { projectId: "P1", type: "hot", title: "เชื่อม", validFrom: "2026-11-03T08:00", validTo: "2026-11-03T17:00", status: "cancelled" },
    ],
    diaries: [{ projectId: "P1", date: "2026-11-03", weatherAm: "sunny", weatherPm: "rain", rainHours: 2 }],
    inspections: [{ projectId: "P1", date: "2026-11-02", items: [{ text: "ช่องเปิดพื้น", result: "fail", note: "ไม่มีราว" }, { text: "ถังดับเพลิง", result: "pass" }] }],
    talks: [{ projectId: "P1", date: "2026-11-02", topic: "หมวกนิรภัย" }, { projectId: "P1", date: "2026-11-03", topic: "หมวกนิรภัย" }],
    tasks: [{ projectId: "P1", name: "มุงหลังคา", start: "2026-11-01", finish: "2026-11-20", pct: 30 }],
    labels: { incident: { near_miss: "เกือบเกิดอุบัติเหตุ" }, weather: { sunny: "แดดออก", rain: "ฝนตก" } },
  });
  assert.deepEqual(c.incidents, [{ date: "2026-11-01", cls: "เกือบเกิดอุบัติเหตุ", description: "ค้อนตกจากนั่งร้าน" }]);
  assert.equal(c.permits.length, 1);
  assert.equal(c.weather[0].pm, "ฝนตก");
  assert.deepEqual(c.findings, ["ช่องเปิดพื้น: ไม่มีราว"]);
  assert.deepEqual(c.recentTopics, ["หมวกนิรภัย"]);
  assert.deepEqual(c.work, ["มุงหลังคา"]);
  const p = safety.topicPrompt({ today: TODAY, siteName: "บ้าน", ctx: c, library: [{ id: "T01", title: "เข็มขัด" }] });
  assert.match(p.prompt, /T01\. เข็มขัด/);
  assert.match(p.prompt, /ค้อนตกจากนั่งร้าน/);
});

test("applyDiaryDraft: spoken count replaces yesterday's row of the same trade", () => {
  const start = { ...blank(), manpower: [{ group: "หจก. ไฟฟ้ารุ่งเรือง", trade: "ไฟฟ้า", count: 3, subcontractorId: "SUB-1" }, { group: "ทีมบริษัท", trade: "กรรมกร", count: 3 }] };
  const { diary: d } = diary.applyDiaryDraft(start, { manpower: [{ group: "ทีมบริษัท", trade: "ช่างไฟฟ้า", count: 2 }, { group: "ทีมบริษัท", trade: "ช่างปูน", count: 6 }] }, [], SUBS);
  assert.deepEqual(
    d.manpower.map((m: { group: string; trade: string; count: number }) => `${m.group}/${m.trade}:${m.count}`),
    ["หจก. ไฟฟ้ารุ่งเรือง/ไฟฟ้า:2", "ทีมบริษัท/กรรมกร:3", "ทีมบริษัท/ช่างปูน:6"],
  );
});
