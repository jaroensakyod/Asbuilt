// Plant & equipment: register, bookings, usage log, maintenance, inspection certificates.
import type { CostCode } from "../biz";
import type { MediaRef } from "../media";
import type { CertKey } from "../hr/labour-types";

export type PlantType =
  | "tower_crane"
  | "mobile_crane"
  | "excavator"
  | "backhoe"
  | "concrete_pump"
  | "hoist"
  | "generator"
  | "scaffold"
  | "vibrator"
  | "compactor"
  | "welder"
  | "forklift";

export const PLANT_TYPE_LABEL: Record<PlantType, string> = {
  tower_crane: "ทาวเวอร์เครน",
  mobile_crane: "รถเครน",
  excavator: "รถขุด",
  backhoe: "รถแบ็คโฮ",
  concrete_pump: "ปั๊มคอนกรีต",
  hoist: "ลิฟต์ขนส่งวัสดุ (hoist)",
  generator: "เครื่องกำเนิดไฟฟ้า",
  scaffold: "นั่งร้าน (ชุด)",
  vibrator: "เครื่องจี้คอนกรีต",
  compactor: "เครื่องตบดิน",
  welder: "ตู้เชื่อม",
  forklift: "รถยก",
};
/** cranes and hoists need lifting certificates; scaffold sets need an engineer above the height threshold */
export const IS_CRANE: Partial<Record<PlantType, true>> = { tower_crane: true, mobile_crane: true, hoist: true };
/** operator certificate a type requires (skills module) */
export const OPERATOR_CERT: Partial<Record<PlantType, CertKey>> = { tower_crane: "crane_operator", mobile_crane: "crane_operator", hoist: "crane_operator", forklift: "forklift" };
export const DEFAULT_COST_CODE: Record<PlantType, CostCode> = {
  tower_crane: "03",
  mobile_crane: "03",
  excavator: "02",
  backhoe: "02",
  concrete_pump: "03",
  hoist: "03",
  generator: "90",
  scaffold: "03",
  vibrator: "03",
  compactor: "02",
  welder: "03",
  forklift: "90",
};

export type RateBasis = "hour" | "day" | "month";
export const BASIS_LABEL: Record<RateBasis, string> = { hour: "ชั่วโมง", day: "วัน", month: "เดือน" };

export type PlantStatus = "available" | "on_site" | "maintenance" | "breakdown" | "off_hired";
export const PLANT_STATUS_LABEL: Record<PlantStatus, string> = { available: "ว่าง", on_site: "อยู่หน้างาน", maintenance: "ซ่อมบำรุง", breakdown: "เสีย", off_hired: "คืนแล้ว" };

export type Plant = {
  id: string; // PL-001
  name: string;
  type: PlantType;
  ownership: "owned" | "rented";
  supplier?: string;
  make?: string;
  model?: string;
  serial?: string;
  /** rated capacity in tonnes (cranes, hoists) */
  capacityT?: number;
  /** scaffold set height in metres */
  heightM?: number;
  rateBasis: RateBasis;
  /** rental rate (rented) or internal charge-out rate (owned), ฿ per basis, excl. VAT */
  rate: number;
  costCode: CostCode;
  /** current site */
  projectId?: string;
  status: PlantStatus;
  meterHours?: number;
  /** service every N engine hours (0 = by date only) */
  serviceEveryHours?: number;
  onHire?: string;
  offHire?: string;
  photos: MediaRef[];
  note?: string;
};

export type PlantBooking = {
  id: string; // PB-2026-0001
  plantId: string;
  projectId: string;
  from: string;
  to: string;
  purpose: string;
  by: string;
  status: "booked" | "cancelled";
};

export type PlantUsage = {
  id: string; // PU-<plantId>-<date>
  plantId: string;
  projectId: string;
  date: string;
  hours: number;
  fuelL: number;
  operatorId?: string;
  operatorName: string;
  note?: string;
};

export type MaintKind = "service" | "breakdown" | "repair";
export const MAINT_LABEL: Record<MaintKind, string> = { service: "บำรุงรักษาตามรอบ", breakdown: "แจ้งเสีย", repair: "ซ่อม" };
export type PlantMaint = {
  id: string; // PMT-2026-0001
  plantId: string;
  kind: MaintKind;
  title: string;
  /** scheduled / reported date */
  date: string;
  doneAt?: string;
  meterHours?: number;
  cost?: number;
  downtimeDays?: number;
  by: string;
  photos: MediaRef[];
};

export type CertKind = "crane_load_test" | "crane_periodic" | "scaffold_engineer" | "electrical" | "pressure";
export const CERT_KIND_LABEL: Record<CertKind, string> = {
  crane_load_test: "ทดสอบการรับน้ำหนักปั้นจั่น (ก่อนใช้งาน/ติดตั้ง)",
  crane_periodic: "ตรวจสอบปั้นจั่นตามระยะ (ปจ.2)",
  scaffold_engineer: "วิศวกรรับรองนั่งร้าน",
  electrical: "ตรวจระบบไฟฟ้า/สายดิน",
  pressure: "ตรวจภาชนะรับแรงดัน",
};
export type PlantCert = {
  id: string; // PCT-2026-0001
  plantId: string;
  kind: CertKind;
  issuedAt: string;
  expiry: string;
  /** engineer and licence no. (ใบอนุญาตประกอบวิชาชีพวิศวกรรมควบคุม) */
  inspector: string;
  licenseNo?: string;
  ref?: string;
  loadTestT?: number;
  result: "pass" | "fail";
  attachments: MediaRef[];
};

export type PlantSettings = {
  id: "plant-settings";
  /** crane periodic inspection interval by rated capacity: up to maxT tonnes → every N months (กฎกระทรวงปั้นจั่น 2564, verify) */
  craneIntervals: { maxT: number; months: number }[];
  /** scaffold sets above this height need an engineer's certificate */
  scaffoldCertHeightM: number;
  scaffoldCertMonths: number;
  /** diesel ฿/litre for usage costing */
  fuelPrice: number;
  /** working days per month used to prorate monthly rates */
  daysPerMonth: number;
  /** warn this many days before a certificate expires */
  warnDays: number;
};
