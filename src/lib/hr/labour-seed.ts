// Deterministic demo data for the labour records (skills, migrant documents, piece-rate,
// advances, camps). Built from the HR employee seed; all people are fictional.
import { getProject, seeded, TODAY } from "../data";
import { addDays, prevPeriod } from "./payroll";
import { ACTIVE_SITES, seedEmployees } from "./seed";
import { DEFAULT_CLOCK } from "./clock";
import { DEFAULT_LABOUR } from "./labour";
import type { Employee } from "./types";
import {
  CAMP_CHECKS,
  type Advance,
  type Camp,
  type CampInspection,
  type CampIssue,
  type CampMeter,
  type CertKey,
  type ClockSettings,
  type LabourSettings,
  type MigrantDoc,
  type PieceRateClaim,
  type PieceRateContract,
  type TrainingRecord,
  type WorkerSkills,
} from "./labour-types";

const int = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number, w = 4) => String(n).padStart(w, "0");
const daily = () => seedEmployees().filter((e) => e.type === "daily");
const onSite = (pid: string) => daily().filter((e) => e.projectId === pid && e.status !== "resigned");
const headman = (pid: string) => onSite(pid).find((e) => e.skill === "หัวหน้าช่าง");

// ---------- training records ----------

const PROVIDER: Partial<Record<CertKey, string>> = {
  crane_operator: "ศูนย์ฝึกอบรมความปลอดภัย ไทยเครน",
  signaller: "ศูนย์ฝึกอบรมความปลอดภัย ไทยเครน",
  rigger: "ศูนย์ฝึกอบรมความปลอดภัย ไทยเครน",
  scaffold: "สถาบันส่งเสริมความปลอดภัย (หน่วยฝึกเอกชน)",
  confined_space: "หน่วยฝึกอบรมที่อับอากาศ เซฟตี้เฟิร์ส",
  work_at_height: "หน่วยฝึกอบรม เซฟตี้เฟิร์ส",
  electrician_license: "สถาบันพัฒนาฝีมือแรงงาน",
  welder: "สถาบันพัฒนาฝีมือแรงงาน",
  first_aid: "สภากาชาดไทย",
  jp_supervisor: "หน่วยฝึกอบรมที่ขึ้นทะเบียนกับกรมสวัสดิการฯ",
  jp_technical: "หน่วยฝึกอบรมที่ขึ้นทะเบียนกับกรมสวัสดิการฯ",
};
const COURSE: Partial<Record<CertKey, string>> = {
  crane_operator: "หลักสูตรผู้บังคับปั้นจั่นชนิดอยู่กับที่ (ทาวเวอร์เครน)",
  signaller: "หลักสูตรผู้ให้สัญญาณแก่ผู้บังคับปั้นจั่น",
  rigger: "หลักสูตรผู้ยึดเกาะวัตถุ",
  scaffold: "หลักสูตรการติดตั้ง ใช้ และรื้อถอนนั่งร้าน",
  confined_space: "หลักสูตรผู้อนุญาต ผู้ควบคุมงาน ผู้ช่วยเหลือ และผู้ปฏิบัติงานในที่อับอากาศ",
  work_at_height: "หลักสูตรการทำงานบนที่สูงและการใช้อุปกรณ์ป้องกันการตก",
  electrician_license: "หนังสือรับรองความรู้ความสามารถ สาขาช่างไฟฟ้าภายในอาคาร",
  welder: "มาตรฐานฝีมือแรงงาน ช่างเชื่อมแม็ก ระดับ 1",
  first_aid: "การปฐมพยาบาลและการช่วยฟื้นคืนชีพ (CPR)",
  jp_supervisor: "เจ้าหน้าที่ความปลอดภัยในการทำงานระดับหัวหน้างาน",
  jp_technical: "เจ้าหน้าที่ความปลอดภัยในการทำงานระดับเทคนิค",
};
const YEARS: Partial<Record<CertKey, number>> = { crane_operator: 2, signaller: 2, rigger: 2, scaffold: 2, confined_space: 5, work_at_height: 2, electrician_license: 5, welder: 3, first_aid: 2 };

function genTraining(): TrainingRecord[] {
  const rnd = seeded(4411);
  const out: TrainingRecord[] = [];
  const add = (e: Employee | undefined, cert: CertKey, issuedAt: string, expiryOverride?: string) => {
    if (!e) return;
    const y = YEARS[cert];
    const expiry = expiryOverride ?? (y ? addDays(issuedAt, Math.round(y * 365)) : undefined);
    out.push({
      id: `TRN-${pad(out.length + 1)}`,
      employeeId: e.id,
      cert,
      title: COURSE[cert] ?? cert,
      provider: PROVIDER[cert] ?? "หน่วยฝึกอบรมภายนอก",
      certNo: `${cert.slice(0, 2).toUpperCase()}-${int(rnd, 6400, 6912)}/${int(rnd, 100, 999)}`,
      issuedAt,
      expiry,
      hours: cert.startsWith("jp_") ? (cert === "jp_technical" ? 30 : 12) : int(rnd, 1, 3) * 6,
      attachments: [],
    });
  };
  const emps = seedEmployees();
  const byMember = (m: string) => emps.find((e) => e.memberId === m);
  // company staff
  add(byMember("U16"), "jp_supervisor", "2022-05-14");
  add(byMember("U16"), "work_at_height", "2025-02-10");
  add(byMember("U16"), "first_aid", "2025-07-03");
  add(emps.find((e) => e.name === "กิตติพงษ์ ศรีประเสริฐ"), "jp_technical", "2023-06-20");
  add(emps.find((e) => e.name === "กิตติพงษ์ ศรีประเสริฐ"), "confined_space", "2024-03-11");
  add(emps.find((e) => e.name === "ชาตรี บุญยืน"), "jp_supervisor", "2026-09-02");
  add(byMember("U04"), "electrician_license", "2021-08-01");

  const skipSupervisor = new Set(["HC-2026-08", "HC-2026-09"]);
  for (const p of ACTIVE_SITES) {
    const crew = onSite(p.id);
    const head = crew.find((e) => e.skill === "หัวหน้าช่าง");
    if (head && !skipSupervisor.has(p.id)) add(head, "jp_supervisor", addDays(p.start, -int(rnd, 60, 700)));
    if (head) add(head, "work_at_height", addDays(TODAY, -int(rnd, 100, 650)));
    for (const e of crew) {
      if (e.skill === "ช่างไฟฟ้า") add(e, "electrician_license", addDays(TODAY, -int(rnd, 200, 1500)));
      if (e.skill === "ช่างเชื่อม") add(e, "welder", addDays(TODAY, -int(rnd, 200, 1000)));
      if ((e.skill === "ช่างเหล็ก" || e.skill === "ช่างไม้") && rnd() < 0.5) add(e, "work_at_height", addDays(TODAY, -int(rnd, 60, 700)));
      if (e.skill === "ช่างไม้" && rnd() < 0.4) add(e, "scaffold", addDays(TODAY, -int(rnd, 60, 700)));
    }
  }
  // condo site: lifting crew for the tower crane
  const condo = onSite("HC-2025-03");
  add(condo[3], "crane_operator", addDays(TODAY, -2 * 365 + 21)); // expires in ~3 weeks
  add(condo[4], "crane_operator", addDays(TODAY, -300));
  add(condo[5], "signaller", addDays(TODAY, -400));
  add(condo[6], "rigger", addDays(TODAY, -2 * 365 - 12)); // expired
  add(condo[7], "rigger", addDays(TODAY, -200));
  add(condo[8], "scaffold", addDays(TODAY, -2 * 365 + 9)); // expires in 9 days
  add(condo[2], "first_aid", addDays(TODAY, -500));
  // a confined-space crew for the septic tank works
  add(onSite("HC-2026-04")[2], "confined_space", addDays(TODAY, -800));
  add(onSite("HC-2026-04")[3], "confined_space", addDays(TODAY, -5 * 365 + 18));
  return out;
}
let trnCache: TrainingRecord[] | null = null;
export const seedTraining = () => (trnCache ??= genTraining());

// ---------- trade skill matrix ----------

const SECOND: Record<string, string[]> = {
  ช่างปูน: ["ช่างกระเบื้อง", "กรรมกร"],
  ช่างไม้: ["ช่างเหล็ก", "ช่างสี"],
  ช่างเหล็ก: ["ช่างเชื่อม", "ช่างไม้"],
  ช่างไฟฟ้า: ["ช่างประปา"],
  ช่างประปา: ["ช่างไฟฟ้า"],
  ช่างสี: ["ช่างปูน"],
  ช่างกระเบื้อง: ["ช่างปูน"],
  ช่างเชื่อม: ["ช่างเหล็ก"],
  หัวหน้าช่าง: ["ช่างปูน", "ช่างไม้"],
  กรรมกร: ["ช่างปูน", "ช่างสี"],
};
export function seedSkills(): WorkerSkills[] {
  const rnd = seeded(9073);
  return daily().map((e) => {
    const skill = e.skill ?? "กรรมกร";
    const trades: WorkerSkills["trades"] = [];
    if (skill === "หัวหน้าช่าง") trades.push({ trade: "หัวหน้าช่าง", level: 3 }, { trade: SECOND[skill][int(rnd, 0, 1)], level: 3 });
    else if (skill === "กรรมกร") trades.push({ trade: "กรรมกร", level: 2 });
    else trades.push({ trade: skill, level: rnd() < 0.25 ? 3 : 2 });
    if (skill !== "หัวหน้าช่าง" && rnd() < 0.45) {
      const opts = SECOND[skill] ?? [];
      const t = opts[int(rnd, 0, opts.length - 1)];
      if (t && !trades.some((x) => x.trade === t)) trades.push({ trade: t, level: 1 });
    }
    return { id: `SKL-${e.id}`, employeeId: e.id, trades };
  });
}

// ---------- migrant documents ----------

export function seedMigrantDocs(): MigrantDoc[] {
  const rnd = seeded(3307);
  const out: MigrantDoc[] = [];
  const add = (d: Omit<MigrantDoc, "id" | "attachments">) => out.push({ ...d, id: `MGD-${pad(out.length + 1)}`, attachments: [] });
  const soon = [8, 19, 26, -3];
  let k = 0;
  for (const e of daily()) {
    if (e.nationality === "TH" || e.status === "resigned") continue;
    const pinkCard = e.nationality === "KH" && rnd() < 0.5;
    const special = k % 7 === 2 ? soon[Math.floor(k / 7) % soon.length] : undefined;
    if (pinkCard) {
      add({ employeeId: e.id, kind: "pink_card", no: `00${int(rnd, 10, 99)}-${int(rnd, 100000, 999999)}-${int(rnd, 10, 99)}-${int(rnd, 1, 9)}`, issuedAt: "2025-02-14", expiry: special !== undefined ? addDays(TODAY, special) : "2027-02-13" });
    } else {
      add({ employeeId: e.id, kind: "passport", no: e.idNo, issuedAt: addDays("2022-01-01", int(rnd, 0, 900)), expiry: special !== undefined ? addDays(TODAY, special) : addDays("2028-01-01", int(rnd, 0, 1200)) });
      add({ employeeId: e.id, kind: "visa", no: `NON-LA ${int(rnd, 1000000, 9999999)}`, issuedAt: addDays(TODAY, -int(rnd, 60, 600)), expiry: e.workPermitExpiry ?? addDays(TODAY, int(rnd, 90, 700)) });
    }
    // next 90-day report
    add({ employeeId: e.id, kind: "report_90", no: `ตม.47`, issuedAt: addDays(TODAY, -int(rnd, 10, 85)), expiry: addDays(TODAY, int(rnd, 4, 80)) });
    k++;
  }
  // 90-day reports are due on a 90-day cycle: align expiry to issued + 90
  return out.map((d) => (d.kind === "report_90" && d.issuedAt ? { ...d, expiry: addDays(d.issuedAt, 90) } : d));
}

// ---------- piece-rate contracts & claims ----------

type Def = { projectId: string; crew: () => Employee | undefined; trade: string; description: string; unit: string; rate: number; est: number; costCode: PieceRateContract["costCode"]; retention: number; claims: number[] };

const DEFS: Def[] = [
  { projectId: "HC-2026-01", crew: () => seedEmployees().find((e) => e.id === "SC-001"), trade: "งานหลังคา", description: "มุงกระเบื้องหลังคาคอนกรีต รวมเชิงชาย ครอบ", unit: "ตร.ม.", rate: 180, est: 260, costCode: "05", retention: 5, claims: [96, 110, 40] },
  { projectId: "HC-2025-04", crew: () => seedEmployees().find((e) => e.id === "SC-002"), trade: "งานฝ้า", description: "ฝ้ายิปซัมฉาบเรียบ โครงเคร่าเหล็กชุบสังกะสี", unit: "ตร.ม.", rate: 120, est: 210, costCode: "10", retention: 5, claims: [88, 92, 24] },
  { projectId: "HC-2026-02", crew: () => seedEmployees().find((e) => e.id === "SC-005"), trade: "งานสี", description: "ทาสีภายในรองพื้น 1 เที่ยว ทับหน้า 2 เที่ยว", unit: "ตร.ม.", rate: 35, est: 820, costCode: "11", retention: 0, claims: [260, 310] },
  { projectId: "HC-2026-04", crew: () => headman("HC-2026-04"), trade: "งานฉาบ", description: "ฉาบปูนผนังภายในและภายนอก หนาเฉลี่ย 1.5 ซม.", unit: "ตร.ม.", rate: 85, est: 720, costCode: "04", retention: 5, claims: [180, 210, 160] },
  { projectId: "HC-2026-03", crew: () => headman("HC-2026-03"), trade: "งานกระเบื้อง", description: "ปูกระเบื้องพื้นแกรนิตโต้ 60×60 ซม. ชั้น 1–2", unit: "ตร.ม.", rate: 150, est: 380, costCode: "10", retention: 5, claims: [120, 95] },
  { projectId: "HC-2025-03", crew: () => headman("HC-2025-03"), trade: "งานเหล็กเสริม", description: "ตัด ดัด ผูกเหล็กเสริม พื้น-คาน ชั้น 5–หลังคา", unit: "ตัน", rate: 4500, est: 46, costCode: "03", retention: 5, claims: [8.6, 9.2, 7.4, 6.1] },
  { projectId: "HC-2026-09", crew: () => seedEmployees().find((e) => e.id === "SC-006"), trade: "งานฐานราก", description: "เข็มเจาะแห้ง ø 0.35 ม. ลึก 18 ม.", unit: "ต้น", rate: 2800, est: 64, costCode: "02", retention: 5, claims: [22, 18] },
];

const CLAIM_PEOPLE = { foreman: ["สมศักดิ์ แก้วมณี", "ชาตรี บุญยืน"], engineer: ["กิตติพงษ์ ศรีประเสริฐ", "ธีรวัฒน์ บุญมา"] };

function genPiece(): { contracts: PieceRateContract[]; claims: PieceRateClaim[] } {
  const contracts: PieceRateContract[] = [];
  const claims: PieceRateClaim[] = [];
  DEFS.forEach((d, i) => {
    const crew = d.crew();
    if (!crew) return;
    const p = getProject(d.projectId);
    const id = `PRC-2026-${pad(i + 1)}`;
    // half-month periods ending around today
    const n = d.claims.length;
    const start = addDays(TODAY, -15 * n - 6);
    contracts.push({ id, projectId: d.projectId, crewId: crew.id, crewName: crew.name, trade: d.trade, description: d.description, unit: d.unit, rate: d.rate, estQty: d.est, costCode: d.costCode, whtRate: DEFAULT_LABOUR.crewWhtRate, retentionPct: d.retention, start, status: "active", createdBy: p?.pm ?? "ศิริพร ตั้งเจริญ" });
    d.claims.forEach((qty, k) => {
      const from = addDays(start, 15 * k);
      const to = addDays(from, 14);
      const last = k === n - 1;
      const second = k === n - 2;
      // the latest claim waits for the foreman, the one before for the engineer on two contracts, older ones paid
      const status: PieceRateClaim["status"] = last ? (i % 2 ? "foreman" : "submitted") : second && i % 3 === 0 ? "approved" : "paid";
      const fm = CLAIM_PEOPLE.foreman[i % 2];
      const end = to > TODAY ? TODAY : to;
      const upTo = (n: number) => (addDays(end, n) > TODAY ? TODAY : addDays(end, n));
      const en = CLAIM_PEOPLE.engineer[i % 2];
      claims.push({
        id: `PRQ-2026-${pad(claims.length + 1)}`,
        contractId: id,
        projectId: d.projectId,
        periodFrom: from,
        periodTo: end,
        qty,
        measuredBy: fm,
        photos: [],
        status,
        foreman: status !== "submitted" ? { by: fm, at: upTo(1) } : undefined,
        engineer: status === "approved" || status === "paid" ? { by: en, at: upTo(2) } : undefined,
        paidAt: status === "paid" ? upTo(4) : undefined,
      });
    });
  });
  return { contracts, claims };
}
let pieceCache: ReturnType<typeof genPiece> | null = null;
export const seedPieceContracts = () => (pieceCache ??= genPiece()).contracts;
export const seedPieceClaims = () => (pieceCache ??= genPiece()).claims;

// ---------- advances ----------

export function seedAdvances(): Advance[] {
  const out: Advance[] = [];
  const add = (e: Employee | undefined, date: string, amount: number, installments: number, reason: string, status: Advance["status"], recovered: Advance["recovered"] = []) => {
    if (!e) return;
    out.push({ id: `ADV-2026-${pad(out.length + 1)}`, employeeId: e.id, projectId: e.projectId, date, amount, installments, reason, status, requestedBy: e.name, approvedBy: status === "approved" ? "ณัฐวุฒิ พงษ์ไพบูลย์" : undefined, recovered });
  };
  const s = (pid: string, i: number) => onSite(pid)[i];
  add(s("HC-2025-03", 1), addDays(TODAY, -20), 3000, 3, "ส่งเงินกลับบ้าน ค่าเทอมบุตร", "approved", [{ date: addDays(TODAY, -13), amount: 1000, ref: "หักค่าแรง PAY-2026-10-W4 (นอกระบบ)" }]);
  add(s("HC-2025-03", 5), addDays(TODAY, -9), 2000, 2, "ค่ารักษาพยาบาลมารดา", "approved");
  add(s("HC-2026-04", 2), addDays(TODAY, -6), 1500, 3, "ค่าเช่าห้อง", "approved");
  add(s("HC-2026-06", 1), addDays(TODAY, -3), 2500, 5, "ซ่อมรถจักรยานยนต์", "pending");
  add(s("HC-2026-02", 3), addDays(TODAY, -40), 2000, 2, "ค่าเดินทางกลับภูมิลำเนา", "approved", [
    { date: addDays(TODAY, -33), amount: 1000, ref: "เงินสด" },
    { date: addDays(TODAY, -26), amount: 1000, ref: "เงินสด" },
  ]);
  add(seedEmployees().find((e) => e.id === "SC-001"), addDays(TODAY, -25), 20000, 2, "เบิกค่าแรงล่วงหน้าซื้ออุปกรณ์มุงหลังคา", "approved");
  add(seedEmployees().find((e) => e.id === "SC-005"), addDays(TODAY, -2), 8000, 1, "เบิกล่วงหน้าค่าแรงทีมสี", "pending");
  add(s("HC-2026-05", 4), addDays(TODAY, -12), 1200, 2, "ค่าโทรศัพท์และค่าน้ำไฟห้องพัก", "rejected");
  return out;
}

// ---------- camps ----------

function genCamps() {
  const rnd = seeded(6120);
  const camps: Camp[] = [];
  const meters: CampMeter[] = [];
  const insp: CampInspection[] = [];
  const issues: CampIssue[] = [];
  const defs: [string, string, string, number, number][] = [
    ["HC-2025-03", "แคมป์คนงาน ลาดพร้าว 71", "ที่ดินเช่าซอยลาดพร้าว 73 ห่างไซต์ 250 ม.", 6, 4],
    ["HC-2026-04", "แคมป์คนงาน บ้านคุณพรทิพย์", "พื้นที่ว่างด้านหลังแปลงก่อสร้าง", 3, 4],
    ["HC-2026-06", "บ้านพักคนงาน สันทราย", "ห้องแถวเช่า อ.สันทราย เชียงใหม่", 2, 4],
  ];
  defs.forEach(([pid, name, address, roomCount, cap], ci) => {
    const id = `CMP-${pad(ci + 1, 2)}`;
    const crew = onSite(pid).filter((e) => e.skill !== "หัวหน้าช่าง");
    const rooms = Array.from({ length: roomCount }, (_, r) => ({ id: `${id}-R${r + 1}`, no: `${ci === 2 ? "ห้อง " : "A"}${r + 1}`, capacity: r === roomCount - 1 && ci === 0 ? 3 : cap, kind: (r === roomCount - 1 && ci === 0 ? "family" : "male") as Camp["rooms"][number]["kind"], occupants: [] as string[] }));
    let r = 0;
    for (const e of crew) {
      while (r < rooms.length && rooms[r].occupants.length >= rooms[r].capacity) r++;
      if (r >= rooms.length) break;
      rooms[r].occupants.push(e.id);
    }
    // condo camp: one room over capacity (flagged on the page)
    if (ci === 0) rooms[1].occupants.push(...crew.slice(-1).map((e) => e.id).filter((x) => !rooms[1].occupants.includes(x)));
    camps.push({
      id,
      projectId: pid,
      name,
      address,
      waterRate: ci === 2 ? 18 : 22,
      elecRate: ci === 2 ? 5 : 7,
      allocation: "per_head",
      chargeWorkers: ci === 2,
      rooms,
      facilities: ci === 0 ? ["ห้องน้ำ 4 ห้อง", "ห้องส้วม 4 ที่", "ลานซักล้าง", "ครัวรวม", "ถังดับเพลิง 3 ถัง"] : ["ห้องน้ำ 2 ห้อง", "ลานซักล้าง", "ถังดับเพลิง 1 ถัง"],
    });
    let w = int(rnd, 1200, 3000);
    let el = int(rnd, 8000, 20000);
    for (let k = 3; k >= 1; k--) {
      const period = prevPeriod(TODAY.slice(0, 7), k);
      const dw = Math.round((ci === 0 ? 120 : 45) * (0.9 + rnd() * 0.3));
      const de = Math.round((ci === 0 ? 1450 : 520) * (0.85 + rnd() * 0.35));
      meters.push({ id: `CMR-${id}-${period}`, campId: id, period, waterPrev: w, waterCurr: w + dw, elecPrev: el, elecCurr: el + de, by: "สุภาวดี ทองคำ", photos: [] });
      w += dw;
      el += de;
    }
    for (let k = 0; k < 2; k++) {
      const date = addDays(TODAY, -int(rnd, 3, 12) - k * 28);
      const items = CAMP_CHECKS.map((text) => ({ text, ok: rnd() > (k === 0 && ci !== 1 ? 0.18 : 0.06) }));
      insp.push({ id: `CIN-2026-${pad(insp.length + 1)}`, campId: id, date, by: ci === 2 ? "ชาตรี บุญยืน" : "สมศักดิ์ แก้วมณี", items, photos: [], note: items.every((x) => x.ok) ? "เรียบร้อย" : "แจ้งหัวหน้าช่างแก้ไขภายใน 3 วัน" });
    }
  });
  const iss: [number, number, string, string, boolean][] = [
    [0, 4, "ปั๊มน้ำห้องน้ำชายเสีย", "น้ำไม่ไหลช่วงเช้า คนงานต้องหิ้วน้ำจากไซต์", false],
    [0, 15, "ขยะล้นถังหลังครัว", "นัดรถเก็บขยะเขตเพิ่มเป็นสัปดาห์ละ 2 ครั้ง", true],
    [1, 2, "หลังคาสังกะสีรั่วห้อง A2", "ฝนตกน้ำหยดใส่ที่นอน", false],
    [2, 9, "เบรกเกอร์ตัดบ่อย", "มีการใช้หม้อหุงข้าวพร้อมกันหลายห้อง", true],
  ];
  for (const [ci, ago, title, detail, done] of iss)
    issues.push({ id: `CIS-2026-${pad(issues.length + 1)}`, campId: camps[ci].id, date: addDays(TODAY, -ago), title, detail, by: "หัวหน้าช่าง", status: done ? "done" : "open", doneAt: done ? addDays(TODAY, -ago + 2) : undefined, photos: [] });
  return { camps, meters, insp, issues };
}
let campCache: ReturnType<typeof genCamps> | null = null;
export const seedCamps = () => (campCache ??= genCamps()).camps;
export const seedCampMeters = () => (campCache ??= genCamps()).meters;
export const seedCampInspections = () => (campCache ??= genCamps()).insp;
export const seedCampIssues = () => (campCache ??= genCamps()).issues;

// ---------- settings ----------

export const seedLabourSettings = (): LabourSettings[] => [{ ...DEFAULT_LABOUR, minWage: DEFAULT_LABOUR.minWage.map((m) => ({ ...m })) }];
export const seedClockSettings = (): ClockSettings[] => [{ ...DEFAULT_CLOCK, sites: [{ projectId: "HC-2025-03", radius: 150 }] }];
