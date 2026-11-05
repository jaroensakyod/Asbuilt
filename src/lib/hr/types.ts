import type { PayrollLine, PayrollRun } from "../biz";
import type { MediaRef } from "../media";
import type { DayMark, SsoSettings, TaxAllowances } from "./calc";

export type EmpType = "monthly" | "daily" | "subcontract";
export const EMP_TYPE_LABEL: Record<EmpType, string> = {
  monthly: "พนักงานรายเดือน",
  daily: "คนงานรายวัน",
  subcontract: "ผู้รับเหมาค่าแรง",
};

export type Nationality = "TH" | "MM" | "KH" | "LA";
export const NATIONALITY_LABEL: Record<Nationality, string> = { TH: "ไทย", MM: "เมียนมา", KH: "กัมพูชา", LA: "ลาว" };

export type EmpStatus = "active" | "probation" | "suspended" | "resigned";
export const EMP_STATUS_LABEL: Record<EmpStatus, string> = {
  active: "ทำงานอยู่",
  probation: "ทดลองงาน",
  suspended: "พักงาน",
  resigned: "ลาออก/พ้นสภาพ",
};

export const DEPARTMENTS = ["บริหาร", "ก่อสร้าง", "ออกแบบ", "ควบคุมคุณภาพ", "บริการหลังการขาย", "ขาย", "จัดซื้อ", "บัญชีการเงิน", "ธุรการ/บุคคล"] as const;

export const SKILLS = ["ช่างปูน", "ช่างไม้", "ช่างเหล็ก", "ช่างไฟฟ้า", "ช่างประปา", "ช่างสี", "ช่างกระเบื้อง", "ช่างเชื่อม", "หัวหน้าช่าง", "กรรมกร"] as const;

export const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา", "ทหารไทยธนชาต", "ออมสิน"] as const;

export type Employee = {
  id: string; // EMP-0001
  type: EmpType;
  name: string;
  nickname?: string;
  /** link to an app user (data.ts team) */
  memberId?: string;
  nationality: Nationality;
  /** Thai ID card (13 digits) or passport / pink card number */
  idNo: string;
  workPermitNo?: string;
  workPermitExpiry?: string;
  phone?: string;
  startDate: string;
  endDate?: string;
  position: string;
  department: string;
  skill?: string;
  /** assigned site (daily workers, subcontract crews, site staff) */
  projectId?: string;
  /** monthly salary (monthly staff) */
  salary?: number;
  /** fixed taxable monthly allowance: position / travel / phone */
  allowance?: number;
  /** daily wage (daily workers) */
  dailyRate?: number;
  bank?: string;
  bankAccount?: string;
  ssoRegistered: boolean;
  allowances: TaxAllowances;
  status: EmpStatus;
  /** subcontract crews: headcount and agreed lump-sum / rate note */
  crewSize?: number;
  contractNote?: string;
  note?: string;
};

/** A check-in / check-out stamp from the phone time clock (/m/clock). Missing on sheets keyed in by hand. */
export type ClockStamp = {
  /** "HH:mm" local time */
  at: string;
  method: "gps" | "qr" | "manual";
  lat?: number;
  lng?: number;
  /** GPS accuracy in metres */
  acc?: number;
  /** distance from the site pin in metres */
  dist?: number;
  /** inside the site geofence (outside is allowed but flagged) */
  inside?: boolean;
  selfie?: MediaRef;
  /** who stamped it (foreman in QR / crew mode) */
  by?: string;
};
export type AttendanceEntry = { employeeId: string; mark: DayMark; ot: number; in?: ClockStamp; out?: ClockStamp };
/** One sheet per site per day, entered by the foreman */
export type AttendanceSheet = {
  id: string; // ATT-<projectId>-<date>
  projectId: string;
  date: string;
  by: string;
  entries: AttendanceEntry[];
  note?: string;
};

export type LeaveType = "sick" | "personal" | "vacation" | "unpaid";
export const LEAVE_LABEL: Record<LeaveType, string> = { sick: "ลาป่วย", personal: "ลากิจ", vacation: "ลาพักร้อน", unpaid: "ลาไม่รับค่าจ้าง" };
export const LEAVE_QUOTA: Record<LeaveType, number> = { sick: 30, personal: 6, vacation: 6, unpaid: 0 };

export type LeaveRequest = {
  id: string; // LV-2026-0001
  employeeId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  decidedAt?: string;
};

/** PayrollLine plus the breakdown the payslip needs (extra fields are optional, other modules ignore them). */
export type HrLine = PayrollLine & {
  base?: number;
  allowance?: number;
  otHours?: number;
  /** other deductions (advance, loan, damage) */
  deduction?: number;
  deductionNote?: string;
  bank?: string;
  bankAccount?: string;
  ssoBase?: number;
  employerSso?: number;
  position?: string;
  /** advances (เบิกล่วงหน้า) recovered in this line; already included in `deduction` */
  advances?: { id: string; amount: number }[];
};

export type HrRun = Omit<PayrollRun, "lines"> & {
  lines: HrLine[];
  /** work period covered (daily-wage runs) */
  from?: string;
  to?: string;
  /** set when the daily run covers one site only */
  projectId?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  note?: string;
};

export type HrSettings = {
  id: "hr-settings";
  sso: SsoSettings;
  /** day of month salaries are paid */
  payDay: number;
  /** daily-wage cycle */
  dailyCycle: "weekly" | "semimonthly";
};
