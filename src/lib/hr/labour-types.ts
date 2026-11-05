// Labour records added in phase 8–14: skills & certificates, migrant-worker documents,
// piece-rate (ค่าแรงเหมา) contracts and claims, advances (เบิกล่วงหน้า), worker camps,
// time-clock geofences and labour-law settings. Types only (plus label tables).
import type { CostCode } from "../biz";
import type { MediaRef } from "../media";

// ---------- skills & certificates ----------

export type CertKey =
  | "crane_operator"
  | "signaller"
  | "rigger"
  | "crane_controller"
  | "scaffold"
  | "confined_space"
  | "work_at_height"
  | "electrician_license"
  | "welder"
  | "forklift"
  | "first_aid"
  | "jp_supervisor"
  | "jp_technical"
  | "jp_advanced"
  | "jp_professional"
  | "other";

export const CERT_LABEL: Record<CertKey, string> = {
  crane_operator: "ผู้บังคับปั้นจั่น",
  signaller: "ผู้ให้สัญญาณแก่ผู้บังคับปั้นจั่น",
  rigger: "ผู้ยึดเกาะวัตถุ",
  crane_controller: "ผู้ควบคุมการใช้ปั้นจั่น",
  scaffold: "นั่งร้าน (ติดตั้ง/รื้อถอน)",
  confined_space: "ที่อับอากาศ",
  work_at_height: "ทำงานบนที่สูง",
  electrician_license: "ช่างไฟฟ้ามีหนังสือรับรองความรู้ความสามารถ",
  welder: "ช่างเชื่อมมาตรฐานฝีมือ",
  forklift: "ผู้ขับรถยก",
  first_aid: "ปฐมพยาบาลเบื้องต้น",
  jp_supervisor: "จป.หัวหน้างาน",
  jp_technical: "จป.เทคนิค",
  jp_advanced: "จป.เทคนิคขั้นสูง",
  jp_professional: "จป.วิชาชีพ",
  other: "อื่น ๆ",
};
export const CERT_SHORT: Record<CertKey, string> = {
  crane_operator: "บังคับปั้นจั่น",
  signaller: "ให้สัญญาณ",
  rigger: "ยึดเกาะ",
  crane_controller: "ควบคุมปั้นจั่น",
  scaffold: "นั่งร้าน",
  confined_space: "อับอากาศ",
  work_at_height: "ที่สูง",
  electrician_license: "ช่างไฟ (รับรอง)",
  welder: "ช่างเชื่อม",
  forklift: "รถยก",
  first_aid: "ปฐมพยาบาล",
  jp_supervisor: "จป.หัวหน้างาน",
  jp_technical: "จป.เทคนิค",
  jp_advanced: "จป.ขั้นสูง",
  jp_professional: "จป.วิชาชีพ",
  other: "อื่น ๆ",
};
/** default validity in years when the form proposes an expiry date (0 = no expiry); editable per record */
export const CERT_VALID_YEARS: Record<CertKey, number> = {
  crane_operator: 2,
  signaller: 2,
  rigger: 2,
  crane_controller: 2,
  scaffold: 2,
  confined_space: 5,
  work_at_height: 2,
  electrician_license: 5,
  welder: 3,
  forklift: 2,
  first_aid: 2,
  jp_supervisor: 0,
  jp_technical: 0,
  jp_advanced: 0,
  jp_professional: 0,
  other: 0,
};
export const CERT_KEYS = Object.keys(CERT_LABEL) as CertKey[];
export const MATRIX_CERTS: CertKey[] = ["crane_operator", "signaller", "rigger", "scaffold", "confined_space", "work_at_height", "electrician_license", "welder", "first_aid", "jp_supervisor", "jp_technical"];

/** A training course / licence held by a worker. */
export type TrainingRecord = {
  id: string; // TRN-0001
  employeeId: string;
  cert: CertKey;
  title: string;
  provider: string;
  certNo?: string;
  issuedAt: string;
  /** missing = no expiry */
  expiry?: string;
  hours?: number;
  attachments: MediaRef[];
  note?: string;
};

/** Trade skill levels per worker (1 ช่างฝึกหัด · 2 ช่างฝีมือ · 3 หัวหน้าช่าง). */
export type WorkerSkills = {
  id: string; // SKL-<employeeId>
  employeeId: string;
  trades: { trade: string; level: 1 | 2 | 3 }[];
};
export const LEVEL_LABEL: Record<1 | 2 | 3, string> = { 1: "ฝึกหัด", 2: "ฝีมือ", 3: "หัวหน้าช่าง" };

// ---------- migrant-worker documents ----------

export type MigrantDocKind = "passport" | "visa" | "pink_card" | "work_permit" | "report_90" | "health";
export const MIGRANT_DOC_LABEL: Record<MigrantDocKind, string> = {
  passport: "หนังสือเดินทาง",
  visa: "วีซ่า",
  pink_card: "บัตรชมพู (บัตรประจำตัวคนซึ่งไม่มีสัญชาติไทย)",
  work_permit: "ใบอนุญาตทำงาน",
  report_90: "รายงานตัว 90 วัน",
  health: "ใบรับรองแพทย์/ประกันสุขภาพ",
};
export type MigrantDoc = {
  id: string; // MGD-0001
  employeeId: string;
  kind: MigrantDocKind;
  no: string;
  issuedAt?: string;
  expiry: string;
  attachments: MediaRef[];
  note?: string;
};

// ---------- piece-rate (ค่าแรงเหมา) ----------

export type PieceRateContract = {
  id: string; // PRC-2026-0001
  projectId: string;
  /** crew leader: subcontract crew (SC-xxx) or a daily headman (EMP-xxxx) */
  crewId: string;
  crewName: string;
  trade: string;
  description: string;
  unit: string;
  rate: number;
  estQty?: number;
  /** optional WBS task link (wbsTasks, schedule module) */
  taskId?: string;
  costCode: CostCode;
  /** withholding tax on the crew payment, % (ค่าจ้างทำของ 3%) */
  whtRate: number;
  /** retention held back from each payment, % */
  retentionPct: number;
  start: string;
  status: "active" | "closed";
  createdBy: string;
};

export type ClaimStatus = "submitted" | "foreman" | "approved" | "paid" | "rejected";
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  submitted: "รอโฟร์แมนรับรอง",
  foreman: "รอวิศวกรอนุมัติ",
  approved: "อนุมัติ รอจ่าย",
  paid: "จ่ายแล้ว",
  rejected: "ไม่อนุมัติ",
};
export type Approval = { by: string; at: string };
export type PieceRateClaim = {
  id: string; // PRQ-2026-0001
  contractId: string;
  projectId: string;
  periodFrom: string;
  periodTo: string;
  /** quantity measured this period */
  qty: number;
  taskId?: string;
  measuredBy: string;
  photos: MediaRef[];
  note?: string;
  status: ClaimStatus;
  foreman?: Approval;
  engineer?: Approval;
  rejectedBy?: Approval & { reason: string };
  paidAt?: string;
  /** advance recovered from this payment */
  advanceId?: string;
  advanceDeduct?: number;
  /** cost entry created when paid (source "piecerate") */
  costEntryId?: string;
};

// ---------- advances (เบิกล่วงหน้า) ----------

export type Advance = {
  id: string; // ADV-2026-0001
  /** worker (EMP-) or crew (SC-) */
  employeeId: string;
  projectId?: string;
  date: string;
  amount: number;
  reason: string;
  /** recovered in this many pay runs / crew payments */
  installments: number;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  approvedBy?: string;
  /** cash repayments and recoveries recorded outside payroll */
  recovered: { date: string; amount: number; ref: string }[];
};

// ---------- worker camps (แคมป์คนงาน) ----------

export type CampRoom = { id: string; no: string; capacity: number; kind: "male" | "female" | "family"; occupants: string[] };
export const ROOM_KIND_LABEL: Record<CampRoom["kind"], string> = { male: "ชาย", female: "หญิง", family: "ครอบครัว" };
export type Camp = {
  id: string; // CMP-01
  projectId: string;
  name: string;
  address: string;
  /** ฿ per unit, configurable per camp (การประปา/การไฟฟ้า or landlord rates) */
  waterRate: number;
  elecRate: number;
  /** how utility cost is split */
  allocation: "per_head" | "per_room";
  /** deduct utility share from workers (otherwise company cost) */
  chargeWorkers: boolean;
  rooms: CampRoom[];
  facilities: string[];
  note?: string;
};
export type CampMeter = {
  id: string; // CMR-<campId>-<period>
  campId: string;
  period: string; // "2026-10"
  waterPrev: number;
  waterCurr: number;
  elecPrev: number;
  elecCurr: number;
  by: string;
  photos: MediaRef[];
};
export type CampInspection = {
  id: string; // CIN-2026-0001
  campId: string;
  date: string;
  by: string;
  items: { text: string; ok: boolean; note?: string }[];
  photos: MediaRef[];
  note?: string;
};
export const CAMP_CHECKS = [
  "ห้องน้ำ-ห้องส้วมสะอาด เพียงพอ (1 ที่ต่อ 15 คน)",
  "น้ำดื่มสะอาด มีภาชนะปิด",
  "ที่ทิ้งขยะมีฝาปิด เก็บขนสม่ำเสมอ",
  "ไม่มีน้ำขังแหล่งเพาะพันธุ์ยุง",
  "สายไฟ ปลั๊ก เบรกเกอร์ ไม่ชำรุด มีเครื่องตัดไฟรั่ว",
  "ถังดับเพลิงพร้อมใช้ ไม่หมดอายุ",
  "ห้องพักไม่แออัดเกินความจุ",
  "บ่อบำบัด/ท่อระบายน้ำไม่อุดตัน",
  "ไม่มีการประกอบอาหารด้วยไฟในห้องนอน",
  "ป้ายทางหนีไฟและจุดรวมพล",
];
export type CampIssue = {
  id: string; // CIS-2026-0001
  campId: string;
  date: string;
  title: string;
  detail?: string;
  by: string;
  status: "open" | "done";
  doneAt?: string;
  photos: MediaRef[];
};

// ---------- settings ----------

/** Labour-law numbers. All configurable; defaults need checking against the latest announcements. */
export type LabourSettings = {
  id: "labour-settings";
  /** minimum daily wage per province (ประกาศคณะกรรมการค่าจ้าง) */
  minWage: { province: string; rate: number }[];
  /** used when the province is not in the table */
  defaultMinWage: number;
  otMultiplier: number;
  /** OT on a holiday */
  holidayOtMultiplier: number;
  /** combined OT + holiday work hours per week */
  weeklyOtCap: number;
  /** withholding tax on crew / piece-rate payments, % */
  crewWhtRate: number;
  /** cap on total deductions per pay line as a share of gross (advances, damages) */
  maxDeductShare: number;
};

/** Geofence for the phone time clock. Site pin defaults to the project lat/lng. */
export type ClockSettings = {
  id: "clock-settings";
  defaultRadius: number;
  sites: { projectId: string; radius: number; lat?: number; lng?: number }[];
  /** hours after check-in that count as the normal day (8 h + 1 h lunch) */
  dayHours: number;
  breakHours: number;
  /** worked less than this → half day */
  halfDayBelow: number;
  /** OT counts after this time ("17:00"), in half hours */
  shiftEnd: string;
};
