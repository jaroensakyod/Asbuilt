// Deterministic demo data for the field + service module.

import { projects, seeded, TODAY, getProject } from "@/lib/data";
import type { Weather } from "@/lib/biz";
import { addDays, addMonths, diaryId, dow } from "./calc";
import { FIELD_DEFAULTS, type Diary, type PunchItem, type ServiceContract, type SurveyRequest, type VanMove, type VanStock, type WarrantyClaim, type WarrantyItem, type WoService } from "./types";

// ---------- site diaries ----------

const WORK_BY_PHASE: Record<string, string[]> = {
  "งานฐานราก": ["ตอกเสาเข็มสปัน ฐาน F1–F4", "ขุดดินฐานรากและบดอัดทรายรองพื้น", "ผูกเหล็กฐานราก F1–F6", "เทคอนกรีตหยาบรองพื้น", "ตั้งแบบคานคอดิน GB1–GB4", "เทคอนกรีตฐานราก 240 ksc"],
  "งานโครงสร้าง": ["ผูกเหล็กเสาชั้น 1", "ตั้งแบบหล่อคานชั้น 2", "เทคอนกรีตเสาชั้น 1", "วางแผ่นพื้นสำเร็จรูปชั้น 2", "เทคอนกรีตทับหน้าพื้นชั้น 2", "ถอดแบบเสาและบ่มคอนกรีต"],
  "งานก่ออิฐ": ["ก่ออิฐมวลเบาผนังชั้น 2", "หล่อเสาเอ็นทับหลังช่องเปิด", "ฉาบปูนผนังภายนอกด้านทิศเหนือ", "ติดตั้งตะแกรงกันร้าวมุมช่องเปิด", "ก่อผนังห้องน้ำชั้น 1", "ฉาบปูนผนังภายในชั้น 1"],
  "งานหลังคา": ["ติดตั้งโครงหลังคาเหล็กรูปพรรณ", "ทาสีกันสนิมโครงหลังคา 2 รอบ", "มุงกระเบื้องหลังคาด้านทิศใต้", "ติดตั้งรางน้ำและท่อลงน้ำฝน", "ทำกันซึมพื้นดาดฟ้า", "ติดตั้งฉนวนกันความร้อนใต้หลังคา"],
  "งานระบบ": ["เดินท่อร้อยสายไฟชั้น 2", "ร้อยสายไฟวงจรแสงสว่าง", "เดินท่อน้ำดี PPR ชั้น 1–2", "ติดตั้งท่อน้ำทิ้ง PVC ห้องน้ำ", "เดินท่อน้ำยาแอร์และท่อน้ำทิ้งแอร์", "ทดสอบแรงดันท่อน้ำดี"],
  "งานตกแต่ง/ผิว": ["ปูกระเบื้องพื้นห้องน้ำชั้น 2", "ทาสีรองพื้นผนังภายใน", "ติดตั้งฝ้ายิปซัมบอร์ดชั้น 1", "ติดตั้งวงกบและบานประตู", "ยาแนวกระเบื้องและเก็บงาน", "ปูพื้นไม้ลามิเนตห้องนอน"],
};
const SUBS_BY_PHASE: Record<string, { group: string; trade: string; n: [number, number] }[]> = {
  "งานฐานราก": [{ group: "หจก. ส.เสาเข็มไทย", trade: "เสาเข็ม", n: [3, 5] }],
  "งานโครงสร้าง": [{ group: "ทีมช่างเหล็ก ช.ชัยมงคล", trade: "เหล็กเสริม", n: [4, 7] }],
  "งานก่ออิฐ": [{ group: "ทีมก่อฉาบ บุญมาการช่าง", trade: "ก่ออิฐ/ฉาบ", n: [5, 9] }],
  "งานหลังคา": [{ group: "บจ. หลังคาเมทัลชีท สยาม", trade: "หลังคา", n: [3, 6] }],
  "งานระบบ": [
    { group: "หจก. ส.รุ่งเรืองการไฟฟ้า", trade: "ไฟฟ้า", n: [2, 4] },
    { group: "ทีมประปา วิชัยการช่าง", trade: "ประปา", n: [2, 3] },
  ],
  "งานตกแต่ง/ผิว": [
    { group: "ทีมกระเบื้อง ป.ประณีต", trade: "กระเบื้อง", n: [3, 5] },
    { group: "ทีมสี เจริญศิลป์", trade: "สี", n: [2, 4] },
  ],
};
const EQUIP_BY_PHASE: Record<string, { name: string; h: [number, number] }[]> = {
  "งานฐานราก": [
    { name: "รถขุด PC120", h: [4, 8] },
    { name: "ปั้นจั่นตอกเสาเข็ม", h: [5, 8] },
  ],
  "งานโครงสร้าง": [
    { name: "เครื่องผสมคอนกรีต", h: [2, 6] },
    { name: "เครื่องตัดเหล็ก", h: [2, 5] },
  ],
  "งานก่ออิฐ": [{ name: "เครื่องผสมปูน", h: [4, 8] }],
  "งานหลังคา": [
    { name: "เครื่องเชื่อมไฟฟ้า", h: [3, 7] },
    { name: "นั่งร้านเหล็ก (ชุด)", h: [8, 8] },
  ],
  "งานระบบ": [{ name: "เครื่องสกัดคอนกรีต", h: [1, 3] }],
  "งานตกแต่ง/ผิว": [{ name: "เครื่องตัดกระเบื้อง", h: [3, 6] }],
};
const DELIVERIES = ["ปูนซีเมนต์ 80 ถุง (PO-2026-0141)", "เหล็ก DB12 1.2 ตัน", "อิฐมวลเบา 2,400 ก้อน", "ทรายหยาบ 6 คิว", "คอนกรีตผสมเสร็จ 8 คิว", "กระเบื้องพื้น 60×60 จำนวน 45 ตร.ม.", "ท่อ PPR และข้อต่อ 1 ชุด", "สีรองพื้นปูนใหม่ 10 ถัง"];
const ISSUES = ["ฝนตกช่วงบ่าย หยุดงานภายนอก 2 ชม.", "รอแบบขยายช่องเปิดหน้าต่างจากสถาปนิก", "คอนกรีตผสมเสร็จมาช้า 1 ชม.", "ช่างไฟฟ้าขาด 1 คน", "ต้องแก้แนวท่อน้ำทิ้งไม่ได้ความลาดเอียง"];
const VISITORS = ["เจ้าของบ้านเข้าดูงาน", "ผู้ตรวจ QC บริษัท", "วิศวกรผู้ควบคุมงานตรวจเหล็กเสริม", "ตัวแทนนิติบุคคล", "เจ้าหน้าที่การไฟฟ้าตรวจมิเตอร์"];
const SAFETY = ["ประชุม Toolbox Talk เช้า 15 นาที", "ตรวจสภาพนั่งร้านก่อนใช้งาน", "ทุกคนสวมหมวกและรองเท้านิรภัย", "ติดตั้งราวกันตกขอบพื้นชั้น 2", "เก็บกวาดเศษวัสดุทางเดิน"];

export const DIARY_PROJECTS = projects.filter((p) => p.status === "building" || p.status === "handover").map((p) => p.id);
const DIARY_FROM = addDays(TODAY, -28);

export function seedDiaries(): Diary[] {
  const rnd = seeded(8124);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const between = ([a, b]: [number, number]) => a + Math.floor(rnd() * (b - a + 1));
  const out: Diary[] = [];
  for (const pid of DIARY_PROJECTS) {
    const p = getProject(pid);
    if (!p) continue;
    const phase = WORK_BY_PHASE[p.phase] ? p.phase : "งานโครงสร้าง";
    const big = p.modelCode.startsWith("CD") || p.modelCode.startsWith("HO");
    let pct = Math.max(5, Math.round(p.actual - 20));
    for (let date = DIARY_FROM; date <= TODAY; date = addDays(date, 1)) {
      if (dow(date) === 0) continue;
      const yesterday = date === addDays(TODAY, -1);
      // a few gaps, and two sites that forgot yesterday's report
      if ((yesterday && (pid === "HC-2026-08" || pid === "HC-2026-03")) || (!yesterday && date !== TODAY && rnd() < 0.06)) continue;
      if (date === TODAY && !["HC-2026-01", "HC-2025-03"].includes(pid)) continue;
      const rainy = rnd() < 0.22;
      const wAm: Weather = rnd() < 0.7 ? "sunny" : "cloudy";
      const wPm: Weather = rainy ? (rnd() < 0.15 ? "storm" : "rain") : rnd() < 0.5 ? "sunny" : "cloudy";
      const manpower: Diary["manpower"] = [
        { group: "ทีมบริษัท", trade: "โฟร์แมน/ผู้ควบคุมงาน", count: big ? 2 : 1 },
        { group: "ทีมบริษัท", trade: "ช่างไม้/ช่างทั่วไป", count: between(big ? [4, 8] : [2, 4]) },
        { group: "ทีมบริษัท", trade: "กรรมกร", count: between(big ? [6, 12] : [2, 5]) },
        ...(SUBS_BY_PHASE[phase] ?? []).map((s) => ({ group: s.group, trade: s.trade, count: between(big ? [s.n[0] * 2, s.n[1] * 2] : s.n) })),
      ];
      if (big) manpower.push({ group: "บจ. ลิฟต์และเครนก่อสร้าง", trade: "พนักงานขับเครน", count: 1 });
      const equipment = (EQUIP_BY_PHASE[phase] ?? []).filter(() => rnd() < 0.85).map((e) => ({ name: e.name, hours: Math.max(1, between(e.h) - (rainy ? 2 : 0)) }));
      if (big) equipment.unshift({ name: "ทาวเวอร์เครน TC-01", hours: rainy ? 5 : 8 });
      const tasks = WORK_BY_PHASE[phase];
      const i0 = Math.floor(rnd() * tasks.length);
      pct = Math.min(99, pct + (rnd() < 0.6 ? 1 : 0));
      const work: Diary["work"] = [0, 1, 2].slice(0, big ? 3 : 2).map((k) => ({ text: tasks[(i0 + k) % tasks.length], pct: k === 0 ? Math.min(100, 20 + Math.floor(rnd() * 80)) : undefined }));
      const age = Math.round((Date.parse(TODAY) - Date.parse(date)) / 86400000);
      const status: Diary["status"] = date === TODAY ? "draft" : age <= 2 ? "submitted" : "approved";
      out.push({
        id: diaryId(pid, date),
        projectId: pid,
        date,
        weatherAm: wAm,
        weatherPm: wPm,
        rainHours: rainy ? between([1, 3]) : 0,
        manpower,
        equipment,
        work,
        deliveries: rnd() < 0.45 ? pick(DELIVERIES) : undefined,
        issues: rainy ? ISSUES[0] : rnd() < 0.2 ? pick(ISSUES.slice(1)) : undefined,
        visitors: rnd() < 0.25 ? pick(VISITORS) : undefined,
        safety: pick(SAFETY),
        photos: [],
        by: big ? "สมศักดิ์ แก้วมณี" : pick(["สมศักดิ์ แก้วมณี", "ธีรวัฒน์ บุญมา"]),
        status,
        submittedAt: status !== "draft" ? `${date} 18:${String(10 + Math.floor(rnd() * 40))}` : undefined,
        approvedBy: status === "approved" ? p.pm : undefined,
        approvedAt: status === "approved" ? `${addDays(date, 1)} 09:${String(10 + Math.floor(rnd() * 40))}` : undefined,
      });
    }
  }
  return out;
}

// ---------- punch list ----------

export function seedPunch(): PunchItem[] {
  const rows: [string, string, string, string, PunchItem["status"], string][] = [
    ["HC-2025-04", "สีผนังด่างเป็นคราบน้ำ", "ชั้น 2 · ห้องนอนใหญ่", "สี", "open", "2026-11-02"],
    ["HC-2025-04", "ยาแนวกระเบื้องไม่เต็มร่อง", "ชั้น 1 · ห้องน้ำแขก", "กระเบื้อง", "open", "2026-11-02"],
    ["HC-2025-04", "บานเลื่อนกระจกฝืด", "ชั้น 1 · ห้องนั่งเล่น", "ประตู/หน้าต่าง", "fixed", "2026-11-01"],
    ["HC-2025-04", "ฝาครอบสวิตช์เป็นรอย", "ชั้น 2 · โถงบันได", "ไฟฟ้า", "verified", "2026-10-30"],
    ["HC-2025-04", "ซิลิโคนรอบอ่างล้างหน้าหลุด", "ชั้น 2 · ห้องน้ำ 1", "สุขภัณฑ์", "open", "2026-11-03"],
    ["HC-2026-01", "ขอบบัวพื้นไม่ชิดผนัง", "ชั้น 2 · ห้องนอน 2", "งานไม้", "open", "2026-10-28"],
    ["HC-2026-01", "ฝ้ามีรอยต่อเห็นชัด", "ชั้น 1 · ห้องครัว", "ฝ้า", "fixed", "2026-10-27"],
    ["HC-2026-01", "กระเบื้องพื้นเคาะแล้วกลวง 2 แผ่น", "ชั้น 1 · ห้องอาหาร", "กระเบื้อง", "open", "2026-10-31"],
    ["HC-2025-03", "ผิวคอนกรีตเสา C4 เป็นโพรง", "ชั้น 5 · แกนลิฟต์", "โครงสร้าง", "open", "2026-10-29"],
    ["HC-2025-03", "ท่อร้อยสายไม่ยึดตามระยะ", "ชั้น 4 · ทางเดินกลาง", "ไฟฟ้า", "fixed", "2026-10-25"],
  ];
  const n: Record<string, number> = {};
  return rows.map(([projectId, title, location, trade, status, date]) => {
    n[projectId] = (n[projectId] ?? 0) + 1;
    return {
      id: `PUN-${projectId}-${String(n[projectId]).padStart(3, "0")}`,
      projectId,
      title,
      location,
      trade,
      photos: [],
      status,
      by: "อรอุมา จันทร์หอม",
      date,
      due: addDays(date, 7),
      assignee: "สมศักดิ์ แก้วมณี",
      fixedAt: status !== "open" ? addDays(date, 2) : undefined,
      verifiedAt: status === "verified" ? addDays(date, 3) : undefined,
    };
  });
}

// ---------- van stock ----------

const VAN: Record<string, { tid: string; parts: [string, string, string, number, number, number][] }> = {
  "สุริยา คำแก้ว": {
    tid: "U08",
    parts: [
      ["E-CB16", "เบรกเกอร์ลูกย่อย C16", "ตัว", 6, 3, 180],
      ["E-RCBO32", "RCBO 32A 30mA", "ตัว", 1, 2, 1450],
      ["E-DL9", "หลอดดาวน์ไลท์ LED 9W", "ดวง", 12, 6, 220],
      ["E-THW25", "สายไฟ THW 2.5 ตร.มม.", "ม.", 40, 30, 18],
      ["E-OUT2", "เต้ารับคู่มีกราวด์", "ตัว", 5, 4, 150],
    ],
  },
  "ไพโรจน์ ดวงจันทร์": {
    tid: "U09",
    parts: [
      ["H-R32", "น้ำยาแอร์ R32", "กก.", 2, 3, 450],
      ["H-DRAIN", "ท่อน้ำทิ้งแอร์ 5/8 นิ้ว", "ม.", 15, 10, 30],
      ["H-FLARE", "แฟลร์นัท 3/8 นิ้ว", "ตัว", 10, 6, 60],
      ["H-CAP35", "คาปาซิเตอร์ 35 µF", "ตัว", 3, 2, 350],
      ["H-CLEAN", "น้ำยาล้างคอยล์", "ขวด", 6, 4, 120],
    ],
  },
  "สมชาย ปานทอง": {
    tid: "U11",
    parts: [
      ["P-FLOAT", "ชุดลูกลอยชักโครก", "ชุด", 0, 2, 450],
      ["P-PVC15", "ข้อต่อ PVC 1½ นิ้ว", "ตัว", 14, 8, 25],
      ["P-TAPE", "เทปพันเกลียว", "ม้วน", 10, 5, 15],
      ["P-HOSE16", "สายน้ำดี 16 นิ้ว", "เส้น", 4, 4, 120],
      ["P-PSW", "สวิตช์แรงดันปั๊มน้ำ", "ตัว", 1, 1, 650],
    ],
  },
  "บุญเลิศ ใจดี": {
    tid: "U10",
    parts: [
      ["G-SIL", "ซิลิโคนกันเชื้อรา", "หลอด", 8, 4, 120],
      ["G-TILEAD", "ปูนกาวปูกระเบื้อง", "ถุง", 3, 4, 180],
      ["G-GROUT", "ยาแนว", "ถุง", 6, 3, 90],
      ["G-PAINT", "สีน้ำอะครีลิกขาว 1 แกลลอน", "แกลลอน", 2, 2, 650],
      ["G-PU", "PU โฟมอุดรอยต่อ", "กระป๋อง", 4, 2, 220],
    ],
  },
};
export const vanIdOf = (tech: string, code: string) => `VAN-${VAN[tech]?.tid ?? tech}-${code}`;
export function seedVanStock(): VanStock[] {
  const out: VanStock[] = [];
  for (const [tech, v] of Object.entries(VAN)) for (const [code, name, unit, qty, min, unitPrice] of v.parts) out.push({ id: `VAN-${v.tid}-${code}`, tech, code, name, unit, qty, min, unitPrice });
  return out;
}
export function seedVanMoves(): VanMove[] {
  return [
    { id: "VMV-0001", stockId: "VAN-U11-P-PVC15", tech: "สมชาย ปานทอง", date: "2026-09-23", qty: -2, woId: "WO-202609-0031", note: "เบิกใช้หน้างาน" },
    { id: "VMV-0002", stockId: "VAN-U11-P-PSW", tech: "สมชาย ปานทอง", date: "2026-10-30", qty: -1, woId: "WO-202610-0014", note: "เบิกใช้หน้างาน" },
    { id: "VMV-0003", stockId: "VAN-U09-H-FLARE", tech: "ไพโรจน์ ดวงจันทร์", date: "2026-11-01", qty: -2, woId: "WO-202610-0012", note: "เบิกใช้หน้างาน" },
    { id: "VMV-0004", stockId: "VAN-U08-E-DL9", tech: "สุริยา คำแก้ว", date: "2026-10-20", qty: 10, note: "เติมสต็อกจากคลังกลาง" },
  ];
}

export function seedWoService(): WoService[] {
  return [
    {
      id: "WO-202610-0010",
      projectId: "HC-2025-02",
      slot: "pm",
      checkIn: { at: "2026-10-18 13:24", lat: 13.8431, lng: 100.4166, dist: 30 },
      checklist: [
        { text: "เคาะตรวจกระเบื้องรอบจุดที่ระเบิด", done: true },
        { text: "รื้อกระเบื้องที่โก่ง 4 แผ่น", done: true },
        { text: "ปูใหม่ด้วยปูนกาวเต็มแผ่น เว้นร่องยาแนว", done: false },
        { text: "ทำความสะอาดพื้นที่", done: false },
      ],
      before: [],
      after: [],
      parts: [],
    },
    {
      id: "WO-202610-0012",
      projectId: "HC-2024-05",
      slot: "am",
      checkIn: { at: "2026-11-01 10:05", lat: 13.2101, lng: 100.9175, dist: 40 },
      checklist: [
        { text: "วัดแรงดันน้ำยา", done: true },
        { text: "หาจุดรั่วด้วยฟองสบู่", done: true },
        { text: "เปลี่ยนแฟลร์นัทและเติมน้ำยา", done: false },
      ],
      before: [],
      after: [],
      parts: [{ stockId: "VAN-U09-H-FLARE", code: "H-FLARE", name: "แฟลร์นัท 3/8 นิ้ว", unit: "ตัว", qty: 2, unitPrice: 60 }],
      charge: { amount: 1850, note: "ค่าแรง 1,200 + น้ำยา + อะไหล่" },
    },
    {
      id: "WO-202609-0031",
      projectId: "HC-2024-05",
      slot: "am",
      checkIn: { at: "2026-09-23 09:40", lat: 13.2098, lng: 100.917, dist: 15 },
      checkOut: { at: "2026-09-23 15:05", lat: 13.2098, lng: 100.917, dist: 15 },
      checklist: [{ text: "เปลี่ยนข้อต่อและทดสอบรั่ว", done: true }],
      before: [],
      after: [],
      parts: [{ stockId: "VAN-U11-P-PVC15", code: "P-PVC15", name: "ข้อต่อ PVC 1½ นิ้ว", unit: "ตัว", qty: 2, unitPrice: 25 }],
      signer: "กัลยา",
      signedAt: "2026-09-23 15:00",
      charge: { amount: 650, paid: true, paidAt: "2026-09-23 15:02", method: "promptpay" },
    },
  ];
}

export function seedSurveys(): SurveyRequest[] {
  const p = getProject("HC-2024-05");
  return [{ id: "SRV-REP-202609-0021", repairId: "REP-202609-0021", woId: "WO-202609-0031", projectId: "HC-2024-05", customer: p?.owner ?? "", phone: p?.phone, requestedAt: "2026-09-23", by: "นภัสสร วงศ์ใหญ่", channel: "line", status: "answered" }];
}

// ---------- service contracts ----------

export function seedContracts(): ServiceContract[] {
  const c = (x: Omit<ServiceContract, "customer"> & { customer?: string }): ServiceContract => ({ ...x, customer: x.customer ?? getProject(x.projectId)?.owner ?? "" });
  return [
    c({
      id: "SVC-2025-0003",
      projectId: "HC-2024-05",
      title: "สัญญาบำรุงรักษาพูลวิลล่า รายปี",
      scopes: [
        { key: "ac", label: "ล้างแอร์ 8 เครื่อง", system: "hvac", cycleMonths: 6, units: 8 },
        { key: "pool", label: "ตรวจเครื่องกรองสระว่ายน้ำ", system: "ext", cycleMonths: 3 },
        { key: "pump", label: "ตรวจปั๊มน้ำและถังแรงดัน", system: "plumb", cycleMonths: 6 },
      ],
      price: 36000,
      billing: "quarterly",
      start: "2025-11-15",
      end: "2026-11-14",
      status: "active",
      autoRenew: false,
      remindDays: 30,
      assignee: "ไพโรจน์ ดวงจันทร์",
    }),
    c({
      id: "SVC-2026-0001",
      projectId: "HC-2021-03",
      title: "บำรุงรักษาแอร์และหลังคา",
      scopes: [
        { key: "ac", label: "ล้างแอร์ 6 เครื่อง", system: "hvac", cycleMonths: 6, units: 6 },
        { key: "roof", label: "ตรวจหลังคาและรางน้ำก่อนหน้าฝน", system: "arch", cycleMonths: 12 },
      ],
      price: 18000,
      billing: "annual",
      start: "2026-01-01",
      end: "2026-12-31",
      status: "active",
      autoRenew: true,
      remindDays: 45,
      assignee: "ไพโรจน์ ดวงจันทร์",
    }),
    c({
      id: "SVC-2026-0002",
      projectId: "HC-2025-01",
      title: "Home Care Plus",
      scopes: [
        { key: "ac", label: "ล้างแอร์ 4 เครื่อง", system: "hvac", cycleMonths: 6, units: 4 },
        { key: "pump", label: "ตรวจปั๊มน้ำ", system: "plumb", cycleMonths: 6 },
        { key: "grease", label: "ตักไขมันถังดักไขมัน", system: "plumb", cycleMonths: 3 },
        { key: "elcb", label: "ทดสอบเบรกเกอร์กันดูด", system: "elec", cycleMonths: 12 },
      ],
      price: 14500,
      billing: "semiannual",
      start: "2026-02-01",
      end: "2027-01-31",
      status: "active",
      autoRenew: false,
      remindDays: 30,
      assignee: "สมชาย ปานทอง",
    }),
    c({
      id: "SVC-2025-0002",
      projectId: "HC-2023-12",
      title: "ตรวจหลังคาและงานภายนอก รายปี",
      scopes: [{ key: "roof", label: "ตรวจหลังคา รางน้ำ และกันซึม", system: "arch", cycleMonths: 12 }],
      price: 9000,
      billing: "annual",
      start: "2025-11-02",
      end: "2026-11-01",
      status: "expired",
      autoRenew: false,
      remindDays: 30,
      assignee: "บุญเลิศ ใจดี",
    }),
    c({
      id: "SVC-2026-0003",
      projectId: "HC-2024-11",
      title: "ข้อเสนอสัญญาบำรุงรักษาหลังหมดประกัน",
      scopes: [
        { key: "ac", label: "ล้างแอร์ 5 เครื่อง", system: "hvac", cycleMonths: 6, units: 5 },
        { key: "tank", label: "ล้างถังเก็บน้ำ", system: "plumb", cycleMonths: 12 },
      ],
      price: 12000,
      billing: "annual",
      start: "2026-12-01",
      end: "2027-11-30",
      status: "draft",
      autoRenew: false,
      remindDays: 30,
      assignee: "ไพโรจน์ ดวงจันทร์",
    }),
  ];
}

// ---------- warranty register ----------

const MAKERS: { label: string; system: WarrantyItem["system"]; months: number; supplier: string }[] = [
  { label: "เครื่องปรับอากาศ · คอมเพรสเซอร์", system: "hvac", months: 60, supplier: "บจ. เย็นสบายแอร์ (ตัวแทนผู้ผลิต)" },
  { label: "เครื่องปรับอากาศ · อะไหล่ทั่วไป", system: "hvac", months: 12, supplier: "บจ. เย็นสบายแอร์ (ตัวแทนผู้ผลิต)" },
  { label: "ปั๊มน้ำอัตโนมัติ", system: "plumb", months: 24, supplier: "หจก. ไทยปั๊มเซอร์วิส" },
  { label: "เครื่องทำน้ำอุ่น", system: "elec", months: 36, supplier: "บจ. วอเตอร์ฮีทเทค" },
  { label: "กระเบื้องหลังคาคอนกรีต", system: "arch", months: 120, supplier: "บจ. หลังคาไทยวัสดุ" },
];
export function seedWarranty(): WarrantyItem[] {
  const out: WarrantyItem[] = [];
  const W = FIELD_DEFAULTS.warrantyMonths;
  for (const p of projects) {
    if (!p.handedOver || p.handedOver < "2021-06-01") continue;
    let n = 0;
    const id = () => `WAR-${p.id}-${String(++n).padStart(2, "0")}`;
    const s = p.handedOver;
    out.push({ id: id(), projectId: p.id, category: "structure", label: "โครงสร้างหลัก เสาเข็ม ฐานราก เสา คาน พื้น", months: W.structure, start: s, source: "company", system: "struct", note: "ตาม ป.พ.พ. ม.600 หรือสัญญา" });
    out.push({ id: id(), projectId: p.id, category: "roof", label: "หลังคารั่วซึมและงานกันซึม", months: W.roof, start: s, source: "company", system: "arch" });
    out.push({ id: id(), projectId: p.id, category: "general", label: "งานสถาปัตย์ทั่วไป สี กระเบื้อง ประตูหน้าต่าง", months: W.general, start: s, source: "company", system: "arch" });
    out.push({ id: id(), projectId: p.id, category: "system", label: "งานระบบไฟฟ้าและประปา", months: W.system, start: s, source: "company", system: "elec" });
    for (const m of MAKERS) if (m.system !== "arch" || p.floors <= 2) out.push({ id: id(), projectId: p.id, category: "equipment", label: m.label, months: m.months, start: s, source: "manufacturer", supplier: m.supplier, system: m.system });
  }
  return out;
}

export function seedClaims(): WarrantyClaim[] {
  return [
    { id: "WCL-REP-202610-0003", repairId: "REP-202610-0003", projectId: "HC-2025-02", decision: "in", note: "อยู่ในประกันหลังคา/กันซึม 2 ปี", by: "นภัสสร วงศ์ใหญ่", date: "2026-10-26" },
    { id: "WCL-REP-202610-0006", repairId: "REP-202610-0006", projectId: "HC-2024-05", decision: "chargeable", note: "เลยประกันงานระบบ 1 ปี คิดค่าบริการ อะไหล่ส่งเคลมผู้ผลิตไม่ได้", by: "นภัสสร วงศ์ใหญ่", date: "2026-10-30" },
  ];
}

export const contractFirstVisit = (start: string, cycle: number, today: string) => {
  let d = start;
  while (d < today) d = addMonths(d, cycle);
  return d;
};
