// Deterministic demo data for HR: employees, site attendance, leave requests and
// payroll runs (12 monthly runs + 16 weekly daily-wage runs). All people are fictional.
import { projects, seeded, team, TODAY, type Project } from "../data";
import { provideSeed } from "../biz";
import { DEFAULT_SSO, NO_ALLOWANCES, type DayMark, type TaxAllowances } from "./calc";
import { addDays, buildDailyRun, buildMonthlyRun, dateRange, employedOn, isWorkday, prevPeriod, weekday } from "./payroll";
import type { AttendanceSheet, Employee, HrRun, HrSettings, LeaveRequest, LeaveType, Nationality } from "./types";

export const ACTIVE_SITES: Project[] = projects.filter((p) => p.status === "building" || p.status === "handover");

const pick = <T,>(rnd: () => number, xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** valid-looking Thai ID card number (13 digits with the mod-11 check digit) */
function thaiId(rnd: () => number) {
  const d = [int(rnd, 1, 3), ...Array.from({ length: 11 }, () => int(rnd, 0, 9))];
  const sum = d.reduce((s, x, i) => s + x * (13 - i), 0);
  return [...d, (11 - (sum % 11)) % 10].join("");
}
const account = (rnd: () => number) => `${int(rnd, 100, 999)}-${int(rnd, 1, 9)}-${String(int(rnd, 0, 99999)).padStart(5, "0")}-${int(rnd, 0, 9)}`;

function allowancesFor(rnd: () => number, salary: number): TaxAllowances {
  const a = { ...NO_ALLOWANCES };
  if (rnd() < 0.35) a.spouse = true;
  if (rnd() < 0.45) a.children = int(rnd, 1, 2);
  if (rnd() < 0.3) a.parents = int(rnd, 1, 2);
  if (salary >= 30000 && rnd() < 0.6) a.lifeInsurance = int(rnd, 2, 10) * 10000;
  if (salary >= 40000 && rnd() < 0.4) a.healthInsurance = int(rnd, 1, 2) * 12000;
  if (salary >= 50000 && rnd() < 0.5) a.homeLoanInterest = int(rnd, 4, 10) * 10000;
  return a;
}

// ---------- monthly staff (25) ----------

type StaffDef = { memberId?: string; name?: string; position: string; department: string; salary: number; allowance?: number; start: string; projectId?: string; status?: Employee["status"]; end?: string; sso?: boolean };

const STAFF: StaffDef[] = [
  { memberId: "U13", position: "กรรมการผู้จัดการ", department: "บริหาร", salary: 150000, allowance: 20000, start: "2014-06-01", sso: true },
  { memberId: "U01", position: "ผู้จัดการฝ่ายปฏิบัติการ", department: "บริหาร", salary: 85000, allowance: 5000, start: "2016-03-01" },
  { memberId: "U02", position: "ผู้จัดการโครงการ", department: "ก่อสร้าง", salary: 58000, allowance: 4000, start: "2018-01-15" },
  { memberId: "U03", position: "ผู้จัดการโครงการ", department: "ก่อสร้าง", salary: 55000, allowance: 4000, start: "2019-05-02" },
  { memberId: "U04", position: "วิศวกรไฟฟ้า", department: "ก่อสร้าง", salary: 48000, allowance: 3000, start: "2020-07-01" },
  { memberId: "U05", position: "เจ้าหน้าที่ควบคุมคุณภาพ", department: "ควบคุมคุณภาพ", salary: 30000, allowance: 1500, start: "2021-02-01" },
  { memberId: "U06", position: "เจ้าหน้าที่ควบคุมคุณภาพ", department: "ควบคุมคุณภาพ", salary: 28000, allowance: 1500, start: "2022-04-18" },
  { memberId: "U07", position: "เจ้าหน้าที่ควบคุมคุณภาพ", department: "ควบคุมคุณภาพ", salary: 26500, allowance: 1500, start: "2023-09-01" },
  { memberId: "U08", position: "ช่างบริการ (ไฟฟ้า)", department: "บริการหลังการขาย", salary: 21000, allowance: 1000, start: "2019-11-01" },
  { memberId: "U09", position: "ช่างบริการ (แอร์)", department: "บริการหลังการขาย", salary: 19500, allowance: 1000, start: "2021-06-01" },
  { memberId: "U10", position: "ช่างบริการ (ทั่วไป)", department: "บริการหลังการขาย", salary: 18000, allowance: 1000, start: "2022-01-10" },
  { memberId: "U11", position: "ช่างบริการ (ประปา)", department: "บริการหลังการขาย", salary: 18500, allowance: 1000, start: "2023-03-01" },
  { memberId: "U12", position: "ธุรการบริการหลังการขาย", department: "ธุรการ/บุคคล", salary: 22000, start: "2020-10-01" },
  { memberId: "U14", position: "เจ้าหน้าที่ขาย", department: "ขาย", salary: 25000, allowance: 3000, start: "2022-08-01" },
  { memberId: "U15", position: "สถาปนิก", department: "ออกแบบ", salary: 42000, allowance: 2000, start: "2021-01-04" },
  { memberId: "U16", position: "โฟร์แมน", department: "ก่อสร้าง", salary: 27000, allowance: 2000, start: "2017-04-01", projectId: "HC-2025-03" },
  { memberId: "U17", position: "เจ้าหน้าที่จัดซื้อ", department: "จัดซื้อ", salary: 30000, allowance: 1000, start: "2020-02-03" },
  { memberId: "U18", position: "หัวหน้าฝ่ายบัญชี", department: "บัญชีการเงิน", salary: 38000, allowance: 2000, start: "2018-09-01" },
  { memberId: "U19", position: "โฟร์แมน", department: "ก่อสร้าง", salary: 25000, allowance: 2000, start: "2019-06-01", status: "resigned", end: "2026-08-15" },
  { name: "กิตติพงษ์ ศรีประเสริฐ", position: "วิศวกรโยธา (ประจำไซต์)", department: "ก่อสร้าง", salary: 40000, allowance: 3000, start: "2023-01-09", projectId: "HC-2026-03" },
  { name: "สุภาวดี ทองคำ", position: "เจ้าหน้าที่บุคคล", department: "ธุรการ/บุคคล", salary: 24000, start: "2024-05-01" },
  { name: "พัชรี มณีวงศ์", position: "ผู้ช่วยฝ่ายบัญชี", department: "บัญชีการเงิน", salary: 18000, start: "2025-12-01" },
  { name: "สมพงษ์ แสงอรุณ", position: "พนักงานขับรถ", department: "ธุรการ/บุคคล", salary: 15000, allowance: 1500, start: "2019-03-01" },
  { name: "ทองใบ ศรีสวัสดิ์", position: "เจ้าหน้าที่คลังวัสดุ", department: "จัดซื้อ", salary: 16500, start: "2024-11-01" },
  { name: "ชาตรี บุญยืน", position: "โฟร์แมน", department: "ก่อสร้าง", salary: 28000, allowance: 2000, start: "2026-08-20", projectId: "HC-2026-06", status: "probation" },
];

// ---------- daily workers (80) ----------

const SITE_HEADS: Record<string, number> = {
  "HC-2025-03": 14,
  "HC-2025-04": 3,
  "HC-2026-01": 7,
  "HC-2026-02": 7,
  "HC-2026-05": 7,
  "HC-2026-04": 8,
  "HC-2026-03": 8,
  "HC-2026-06": 7,
  "HC-2026-07": 6,
  "HC-2026-08": 7,
  "HC-2026-09": 6,
};

const TH_FIRST = ["สมหมาย", "บุญมา", "สมพร", "ประยงค์", "สุนทร", "วิชัย", "ชาญ", "ทองสุข", "สมบัติ", "เสถียร", "อำนาจ", "ไพบูลย์", "บุญส่ง", "สายทอง", "มานะ", "จำลอง", "คำปัน", "ศรีนวล", "ทองหล่อ", "สำราญ", "บัวผัน", "เพ็ญศรี", "ประสิทธิ์", "อุทัย", "สมจิตร", "นิพนธ์", "ถาวร", "เฉลิม", "วันเพ็ญ", "สุวิทย์"];
const TH_LAST = ["ศรีจันทร์", "ทองมี", "แก้วกล้า", "บุญเรือง", "สีดา", "พรมมา", "จันทร์แก้ว", "ใจกล้า", "อินทร์ทอง", "ศรีสุข", "คำภู", "มาลัย", "สิงห์ทอง", "นาคสวัสดิ์", "พันธ์ดี", "โพธิ์ศรี"];
const NAMES: Record<Exclude<Nationality, "TH">, string[]> = {
  MM: ["อ่อง มิน", "จ่อ ซอ", "ทุน ทุน อ่อง", "มิน ลวิน", "เต็ง ซอ", "หม่อง ยุ้น", "ขิ่น หม่อง จี", "ทิน ทุน", "ซาย ตุน", "เน วิน อู", "โซ ไมง์", "ยาน นาย", "ซอ ลวิน", "อู เต็ง", "นาย ลิน", "มะ เอ", "มะ ขิ่น", "ทัน ซอ", "เมี้ยว วิน", "ซอ ทุน"],
  KH: ["สม ปิช", "ซก เฮง", "จันทา เวือน", "เฮง ซารี", "ปรัก โสภา", "เสือน สาริน", "เมียช บุนนี", "เขียว วันนา", "ลี สมบัติ", "ปิช ดารา"],
  LA: ["บุญมี พมมะจัน", "คำพัน สีหาราช", "สุลิยา วงพะจัน", "ทองดี ไชยะวง", "พอน แก้วมะนี", "สีสะหวาด บุดดา", "คำแพง อินทะวง"],
};
const PASS_PREFIX: Record<Exclude<Nationality, "TH">, string> = { MM: "MF", KH: "N0", LA: "P0" };

const RATE: Record<string, [number, number]> = {
  หัวหน้าช่าง: [750, 850],
  ช่างปูน: [550, 650],
  ช่างไม้: [550, 650],
  ช่างเหล็ก: [550, 650],
  ช่างไฟฟ้า: [600, 700],
  ช่างประปา: [580, 680],
  ช่างสี: [500, 580],
  ช่างกระเบื้อง: [550, 650],
  ช่างเชื่อม: [600, 700],
  กรรมกร: [400, 450],
};
const LOW_WAGE_PROVINCE = new Set(["เชียงใหม่", "ขอนแก่น"]);

function genEmployees(): Employee[] {
  const rnd = seeded(5507);
  const out: Employee[] = [];
  let n = 0;
  const code = () => `EMP-${String(++n).padStart(4, "0")}`;

  for (const s of STAFF) {
    const m = s.memberId ? team.find((t) => t.id === s.memberId) : undefined;
    out.push({
      id: code(),
      type: "monthly",
      name: m?.name ?? s.name ?? "",
      memberId: m?.id,
      nationality: "TH",
      idNo: thaiId(rnd),
      phone: m?.phone ?? `08${int(rnd, 0, 9)}-${int(rnd, 100, 999)}-${int(rnd, 1000, 9999)}`,
      startDate: s.start,
      endDate: s.end,
      position: s.position,
      department: s.department,
      projectId: s.projectId,
      salary: s.salary,
      allowance: s.allowance,
      bank: pick(rnd, ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย"]),
      bankAccount: account(rnd),
      ssoRegistered: s.sso ?? true,
      allowances: allowancesFor(rnd, s.salary),
      status: s.status ?? "active",
    });
  }

  const usedNames = new Set<string>();
  const foreignPools: Record<string, number> = { MM: 0, KH: 0, LA: 0 };
  // a few permits expire soon (alerts), one already expired
  const expiringSoon = [12, 27, 41, 55, -6];
  let foreignIdx = 0;
  for (const p of ACTIVE_SITES) {
    const heads = SITE_HEADS[p.id] ?? 6;
    const north = LOW_WAGE_PROVINCE.has(p.province);
    for (let i = 0; i < heads; i++) {
      const skill = i === 0 ? "หัวหน้าช่าง" : i === 1 ? "ช่างปูน" : i === 2 ? "ช่างไม้" : pick(rnd, ["ช่างปูน", "ช่างเหล็ก", "ช่างไม้", "ช่างไฟฟ้า", "ช่างประปา", "ช่างสี", "ช่างกระเบื้อง", "ช่างเชื่อม", "กรรมกร", "กรรมกร", "กรรมกร"]);
      const roll = rnd();
      const nat: Nationality = i === 0 ? "TH" : north ? (roll < 0.8 ? "TH" : p.province === "ขอนแก่น" ? "LA" : "MM") : roll < 0.4 ? "TH" : roll < 0.72 ? "MM" : roll < 0.9 ? "KH" : "LA";
      let name: string;
      if (nat === "TH") {
        do name = `${pick(rnd, TH_FIRST)} ${pick(rnd, TH_LAST)}`;
        while (usedNames.has(name));
      } else {
        const pool = NAMES[nat];
        name = pool[foreignPools[nat]++ % pool.length];
        if (usedNames.has(name)) name = `${name} (${foreignPools[nat]})`;
      }
      usedNames.add(name);
      const [lo, hi] = RATE[skill];
      let rate = Math.round(int(rnd, lo, hi) / 10) * 10;
      if (north) rate = Math.max(380, rate - 30);
      if (nat !== "TH" && skill === "กรรมกร") rate = north ? 380 : 400;
      const startOffset = p.id === "HC-2025-03" ? int(rnd, 0, 300) : int(rnd, 0, 25);
      const start = addDays(p.start, startOffset);
      let permitExpiry: string | undefined;
      if (nat !== "TH") {
        const soon = foreignIdx % 9 === 3 ? expiringSoon[Math.floor(foreignIdx / 9)] : undefined;
        permitExpiry = soon !== undefined ? addDays(TODAY, soon) : addDays("2027-01-01", int(rnd, 0, 600));
        foreignIdx++;
      }
      out.push({
        id: code(),
        type: "daily",
        name,
        nationality: nat,
        idNo: nat === "TH" ? thaiId(rnd) : `${PASS_PREFIX[nat]}${int(rnd, 1000000, 9999999)}`,
        workPermitNo: nat !== "TH" ? `${int(rnd, 10, 99)}${String(int(rnd, 0, 99999999)).padStart(8, "0")}` : undefined,
        workPermitExpiry: permitExpiry,
        phone: `0${pick(rnd, ["8", "9", "6"])}${int(rnd, 0, 9)}-${int(rnd, 100, 999)}-${int(rnd, 1000, 9999)}`,
        startDate: start,
        position: skill === "กรรมกร" ? "คนงานรายวัน" : skill,
        department: "ก่อสร้าง",
        skill,
        projectId: p.id,
        dailyRate: rate,
        bank: nat === "TH" || rnd() < 0.6 ? pick(rnd, ["กสิกรไทย", "กรุงไทย", "ออมสิน", "ไทยพาณิชย์"]) : undefined,
        bankAccount: undefined,
        ssoRegistered: rnd() < 0.85,
        allowances: { ...NO_ALLOWANCES },
        status: "active",
      });
      const last = out[out.length - 1];
      if (last.bank) last.bankAccount = account(rnd);
    }
  }
  // two workers left in the last two months
  const leavers = out.filter((e) => e.type === "daily" && e.skill === "กรรมกร").slice(3, 5);
  leavers[0].status = "resigned";
  leavers[0].endDate = "2026-09-26";
  leavers[1].status = "resigned";
  leavers[1].endDate = "2026-10-17";

  // subcontract crews: listed only, paid through procurement / bills
  const crews: [string, string, string, number, string][] = [
    ["ทีมหลังคา นายสมหมาย ทองแท้", "HC-2026-01", "งานหลังคา", 6, "เหมาค่าแรงมุงหลังคา ตร.ม. ละ 180 บาท"],
    ["ทีมฝ้า-ยิปซัม นายประจวบ แสนดี", "HC-2025-04", "งานฝ้า", 4, "เหมาค่าแรงฝ้ายิปซัม ตร.ม. ละ 120 บาท"],
    ["หจก. ช่างไฟพัฒนา", "HC-2025-03", "งานระบบไฟฟ้า", 8, "เหมาค่าแรงเดินระบบไฟฟ้าทั้งอาคาร 380,000 บาท"],
    ["ทีมอลูมิเนียม นายวีระ คงมั่น", "HC-2026-03", "งานประตู/หน้าต่าง", 3, "เหมาค่าแรงติดตั้งบานอลูมิเนียม 45,000 บาท"],
    ["ทีมสี นายชูชาติ บุญมาก", "HC-2026-02", "งานสี", 5, "เหมาค่าแรงทาสี ตร.ม. ละ 35 บาท"],
    ["ทีมเสาเข็ม เชียงใหม่เข็มเจาะ", "HC-2026-09", "งานฐานราก", 7, "เหมาเข็มเจาะ ต้นละ 2,800 บาท"],
  ];
  crews.forEach(([name, projectId, position, crewSize, contractNote], i) =>
    out.push({
      id: `SC-${String(i + 1).padStart(3, "0")}`,
      type: "subcontract",
      name,
      nationality: "TH",
      idNo: name.startsWith("หจก") ? "0503558001234" : thaiId(rnd),
      startDate: addDays(ACTIVE_SITES.find((p) => p.id === projectId)?.start ?? "2026-03-01", 30 + i * 7),
      position,
      department: "ก่อสร้าง",
      projectId,
      ssoRegistered: false,
      allowances: { ...NO_ALLOWANCES },
      status: "active",
      crewSize,
      contractNote,
      phone: `08${int(rnd, 0, 9)}-${int(rnd, 100, 999)}-${int(rnd, 1000, 9999)}`,
    }),
  );
  return out;
}

let empCache: Employee[] | null = null;
export const seedEmployees = () => (empCache ??= genEmployees());

// ---------- attendance ----------

const siteOf = (id: string) => ACTIVE_SITES.find((p) => p.id === id);

/** Who keys in the sheet: the company foreman on his site, otherwise the site's head tradesman */
function recorder(projectId: string, emps: Employee[]) {
  const foreman = emps.find((e) => e.type === "monthly" && e.position === "โฟร์แมน" && e.projectId === projectId && e.status !== "resigned");
  if (foreman) return foreman.name;
  return emps.find((e) => e.type === "daily" && e.projectId === projectId && e.skill === "หัวหน้าช่าง")?.name ?? siteOf(projectId)?.pm ?? "";
}

/** Deterministic site sheet for any date (used for the attendance seed and older payroll runs). */
export function genSheet(projectId: string, date: string, emps = seedEmployees()): AttendanceSheet | null {
  const p = siteOf(projectId);
  if (!p || date < p.start || !isWorkday(date)) return null;
  const rnd = seeded(hash(projectId + date));
  const rainy = rnd() < 0.06; // whole-site half day
  const entries = emps
    .filter((e) => e.type === "daily" && e.projectId === projectId && employedOn(e, date))
    .map((e) => {
      const r = rnd();
      let mark: DayMark = r < 0.07 ? "absent" : r < 0.11 ? "half" : "present";
      if (rainy && mark === "present") mark = "half";
      const ot = mark === "present" && weekday(date) !== 6 && rnd() < 0.22 ? pick(rnd, [2, 2, 3, 4]) : 0;
      return { employeeId: e.id, mark, ot };
    });
  if (!entries.length) return null;
  return { id: `ATT-${projectId}-${date}`, projectId, date, by: recorder(projectId, emps), entries, note: rainy ? "ฝนตกช่วงบ่าย หยุดงานครึ่งวัน" : undefined };
}

export const ATTENDANCE_DAYS = 60;
export function seedAttendance(): AttendanceSheet[] {
  const emps = seedEmployees();
  const out: AttendanceSheet[] = [];
  // up to yesterday; today's sheets are for the foreman to fill in
  for (const d of dateRange(addDays(TODAY, -ATTENDANCE_DAYS), addDays(TODAY, -1)))
    for (const p of ACTIVE_SITES) {
      const s = genSheet(p.id, d, emps);
      if (s) out.push(s);
    }
  return out;
}

// ---------- leave requests ----------

const REASONS: Record<LeaveType, string[]> = {
  sick: ["มีไข้ ไปพบแพทย์", "ปวดหลัง แพทย์ให้พัก", "อาหารเป็นพิษ", "ไข้หวัดใหญ่"],
  personal: ["ติดต่อราชการที่อำเภอ", "พาบุตรไปโรงพยาบาล", "ธุระครอบครัวต่างจังหวัด", "งานบวชญาติ"],
  vacation: ["ท่องเที่ยวกับครอบครัว", "กลับบ้านต่างจังหวัด", "พักผ่อนประจำปี"],
  unpaid: ["ธุระส่วนตัวต่อเนื่อง"],
};

export function seedLeaves(): LeaveRequest[] {
  const rnd = seeded(8812);
  const staff = seedEmployees().filter((e) => e.type === "monthly" && e.status !== "resigned");
  const out: LeaveRequest[] = [];
  const approver = (e: Employee) => (e.memberId === "U01" ? "ประเสริฐ อุดมสุข" : "ณัฐวุฒิ พงษ์ไพบูลย์");
  for (let i = 0; i < 24; i++) {
    const e = pick(rnd, staff);
    const type: LeaveType = pick(rnd, ["sick", "sick", "personal", "vacation", "vacation"] as const);
    const offset = int(rnd, -58, 20);
    let from = addDays(TODAY, offset);
    while (!isWorkday(from)) from = addDays(from, 1);
    const days = type === "vacation" ? int(rnd, 1, 4) : type === "sick" ? int(rnd, 1, 2) : 1;
    let to = from;
    let counted = 1;
    while (counted < days) {
      to = addDays(to, 1);
      if (isWorkday(to)) counted++;
    }
    const requestedAt = type === "sick" ? from : addDays(from, -int(rnd, 3, 14));
    const decided = from < TODAY || rnd() < 0.5;
    const status: LeaveRequest["status"] = !decided ? "pending" : rnd() < 0.08 ? "rejected" : "approved";
    out.push({
      id: `LV-2026-${String(i + 1).padStart(4, "0")}`,
      employeeId: e.id,
      type,
      from,
      to,
      days,
      reason: pick(rnd, REASONS[type]),
      requestedAt: requestedAt > TODAY ? TODAY : requestedAt,
      status,
      approver: status === "pending" ? undefined : approver(e),
      decidedAt: status === "pending" ? undefined : requestedAt > TODAY ? TODAY : addDays(requestedAt, 1) > TODAY ? TODAY : addDays(requestedAt, 1),
    });
  }
  return out.sort((a, b) => b.from.localeCompare(a.from));
}

// ---------- settings ----------

export const seedSettings = (): HrSettings[] => [{ id: "hr-settings", sso: { ...DEFAULT_SSO }, payDay: 25, dailyCycle: "weekly" }];

// ---------- payroll runs ----------

const MONTHLY_RUNS = 12;
const DAILY_WEEKS = 16;

function genRuns(): HrRun[] {
  const emps = seedEmployees();
  const sso = DEFAULT_SSO;
  const runs: HrRun[] = [];
  const current = TODAY.slice(0, 7);

  // monthly: last 12 closed months paid, current month as a draft
  for (let k = MONTHLY_RUNS; k >= 0; k--) {
    const period = prevPeriod(current, k);
    const rnd = seeded(hash("pay" + period));
    const payDate = `${period}-25`;
    const run = buildMonthlyRun(emps, period, payDate, sso, {
      otHours: (e) => (/ช่าง|โฟร์แมน|วิศวกรโยธา|ขับรถ/.test(e.position) && rnd() < 0.7 ? int(rnd, 2, 18) : 0),
      deduction: (e) => (e.salary! < 25000 && rnd() < 0.08 ? { amount: int(rnd, 1, 3) * 1000, note: "หักเงินเบิกล่วงหน้า" } : undefined),
    });
    const closed = k > 0;
    runs.push({
      ...run,
      status: closed ? "paid" : "draft",
      createdBy: "สุภาวดี ทองคำ",
      approvedBy: closed ? "ประเสริฐ อุดมสุข" : undefined,
      approvedAt: closed ? `${period}-22` : undefined,
      paidAt: closed ? payDate : undefined,
    });
  }

  // daily-wage: weekly Mon–Sat, paid on Saturday, last 16 weeks
  let sat = addDays(TODAY, -((weekday(TODAY) + 1) % 7)); // last Saturday on/before today
  if (sat === TODAY) sat = addDays(sat, -7);
  const saturdays = Array.from({ length: DAILY_WEEKS }, (_, i) => addDays(sat, -7 * (DAILY_WEEKS - 1 - i)));
  for (const payDate of saturdays) {
    const from = addDays(payDate, -5);
    const sheets: AttendanceSheet[] = [];
    for (const d of dateRange(from, payDate)) for (const p of ACTIVE_SITES) {
      const s = genSheet(p.id, d, emps);
      if (s) sheets.push(s);
    }
    const period = payDate.slice(0, 7);
    const already = new Map<string, number>();
    for (const r of runs) if (r.kind === "daily" && r.period === period) for (const l of r.lines) already.set(l.employeeId, (already.get(l.employeeId) ?? 0) + l.sso);
    const run = buildDailyRun(emps, sheets, { from, to: payDate, payDate, cycle: "weekly", sso, already });
    runs.push({ ...run, status: "paid", createdBy: "สุภาวดี ทองคำ", approvedBy: "ณัฐวุฒิ พงษ์ไพบูลย์", approvedAt: addDays(payDate, -1), paidAt: payDate });
  }
  return runs;
}

let runCache: HrRun[] | null = null;
export const seedRuns = () => (runCache ??= genRuns());

provideSeed("payroll_runs", seedRuns);
