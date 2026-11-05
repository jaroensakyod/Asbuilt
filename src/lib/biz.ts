// Shared business records that cross module boundaries (Phases 3–7).
// Each collection has ONE owner module that provides its demo seed via
// provideSeed(); other modules read it and may add records.
//
//   installments   owner: sales (quote → contract → payment schedule)
//                  read by: accounting (AR invoices/receipts), portal, executive
//   supplierBills  owner: procurement (PO → goods receipt → bill)
//                  read by: accounting (AP), costs, executive
//   costEntries    owner: procurement (actual cost lines per project/cost code)
//                  read by: costs, executive, accounting
//   payrollRuns    owner: hr (monthly / daily-wage payroll)
//                  read by: accounting (salary journal, PND1, SSO), costs (site labour)
//   budgets        owner: sales/estimating (project budget from the accepted estimate)
//                  read by: costs, executive

import { createCollection } from "./collection";
import type { MediaRef } from "./media";

const providers = new Map<string, () => unknown[]>();
/** Owner modules call this at import time to supply demo data for a shared collection. */
export function provideSeed(kind: string, fn: () => unknown[]) {
  providers.set(kind, fn);
}
const seedOf = <T>(kind: string) => () => (providers.get(kind)?.() ?? []) as T[];

// ---------- cost codes (shared by estimating, budgets, purchasing, costs) ----------

export const COST_CODES = {
  "01": "งานเตรียมการ/ใบอนุญาต",
  "02": "งานฐานราก",
  "03": "งานโครงสร้าง",
  "04": "งานก่ออิฐ/ฉาบ",
  "05": "งานหลังคา",
  "06": "งานระบบไฟฟ้า",
  "07": "งานระบบประปา/สุขาภิบาล",
  "08": "งานระบบปรับอากาศ",
  "09": "งานประตู/หน้าต่าง",
  "10": "งานพื้น/ผนัง/ฝ้า (ตกแต่ง)",
  "11": "งานสี",
  "12": "สุขภัณฑ์/อุปกรณ์",
  "13": "งานภายนอก/รั้ว/ถนน",
  "90": "ค่าดำเนินการ (overhead)",
} as const;
export type CostCode = keyof typeof COST_CODES;

// ---------- installments (งวดเงินลูกค้า) ----------

export type InstallmentStatus = "scheduled" | "due" | "invoiced" | "paid" | "overdue";
export type Installment = {
  id: string; // INS-PAY-<projectId>-<n>
  projectId: string;
  quoteId?: string;
  no: number; // งวดที่
  title: string; // e.g. "งวดที่ 3 · งานโครงสร้างชั้น 2 แล้วเสร็จ"
  milestone: string; // phase label that triggers it
  percent: number; // of contract value
  amount: number; // baht, excl. VAT
  vat: number; // baht
  dueDate: string; // ISO
  status: InstallmentStatus;
  invoiceNo?: string; // set by accounting when a tax invoice is issued
  receiptNo?: string; // set by accounting when paid
  paidDate?: string;
};
export const installments = createCollection<Installment>("installments", seedOf<Installment>("installments"));

// ---------- supplier bills (ใบแจ้งหนี้ผู้ขาย) ----------

export type SupplierBill = {
  id: string; // BILL-2026-0001
  supplierId: string;
  supplierName: string;
  supplierTaxId?: string;
  poId?: string;
  projectId?: string;
  costCode?: CostCode;
  date: string;
  dueDate: string;
  subtotal: number; // excl. VAT
  vat: number;
  whtRate: number; // 0, 1, 3, 5 (%)
  status: "open" | "approved" | "paid";
  paidDate?: string;
  lines: { description: string; qty: number; unit: string; unitPrice: number }[];
};
export const supplierBills = createCollection<SupplierBill>("supplier_bills", seedOf<SupplierBill>("supplier_bills"));

// ---------- actual cost lines ----------

export type CostEntry = {
  id: string;
  projectId: string;
  costCode: CostCode;
  date: string;
  source: "po" | "bill" | "labour" | "petty" | "subcontract" | "plant" | "piecerate";
  ref?: string; // PO / bill / payroll id
  description: string;
  amount: number; // baht excl. VAT
};
export const costEntries = createCollection<CostEntry>("cost_entries", seedOf<CostEntry>("cost_entries"));

// ---------- project budgets ----------

export type Budget = {
  id: string; // BUD-<projectId>
  projectId: string;
  estimateId?: string;
  lines: { costCode: CostCode; amount: number }[];
  contractValue: number; // excl. VAT
  approvedDate: string;
};
export const budgets = createCollection<Budget>("budgets", seedOf<Budget>("budgets"));

// ---------- payroll runs ----------

export type PayrollLine = {
  employeeId: string;
  name: string;
  kind: "monthly" | "daily";
  projectId?: string; // daily-wage site workers
  days?: number;
  gross: number;
  ot: number;
  sso: number; // employee social security (5%, capped)
  wht: number; // PND1 withholding
  net: number;
};
export type PayrollRun = {
  id: string; // PAY-2026-10 or PAY-2026-10-W2 (weekly daily-wage)
  period: string; // "2026-10"
  kind: "monthly" | "daily";
  payDate: string;
  status: "draft" | "approved" | "paid";
  lines: PayrollLine[];
  employerSso: number;
};
export const payrollRuns = createCollection<PayrollRun>("payroll_runs", seedOf<PayrollRun>("payroll_runs"));

export const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const baht0 = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

// =====================================================================
// Phase 8–14 shared contracts. Same rule: one owner module seeds each
// collection via provideSeed(); others read and may add records.
//
//   wbsTasks        owner: schedule   (WBS / Gantt tasks per project)
//                   read by: progress, contracts (payment certs), plant, diary, executive, 3D timeline
//   progressEntries owner: schedule   (measured progress per task, from engineers / foremen / diary)
//                   read by: contracts (certs, subcontract claims), labour (piece-rate), executive (EV)
//   variations      owner: contracts  (change orders: client, design, site, RFI)
//                   read by: sales (contract value), installments, budgets, engineering (RFI link), interior (selections), portal
//   subcontractors  owner: contracts  (register + prequalification)
//                   read by: safety (headcount, induction), labour, procurement
//   subcontracts    owner: contracts  (subcontract agreements with BOQ-style lines)
//   paymentCerts    owner: contracts  (client & subcontract interim payment certificates)
//                   read by: accounting (AR/AP), executive, portal
//   siteDiaries     owner: field      (daily site report)
//                   read by: schedule (progress), safety (manpower), plant (hours), engineering (supervision report)
// =====================================================================


export type DepType = "FS" | "SS" | "FF" | "SF";
export type WbsTask = {
  id: string; // WBS-<projectId>-<n>
  projectId: string;
  code: string; // "3.2.1"
  name: string;
  parentId?: string; // summary task
  costCode?: CostCode;
  start: string; // ISO date (planned / current forecast)
  finish: string;
  baselineStart?: string;
  baselineFinish?: string;
  deps: { taskId: string; type: DepType; lag: number }[]; // lag in days
  /** planned value of the task (baht, excl. VAT) — weights progress and earned value */
  value: number;
  qty?: number; // measurable quantity, e.g. 120 m³
  unit?: string;
  crew?: string; // trade / crew / subcontractor name
  subcontractId?: string;
  milestone?: boolean;
  /** cumulative % complete (0–100), kept in sync with the latest ProgressEntry */
  pct: number;
};
export const wbsTasks = createCollection<WbsTask>("wbs_tasks", seedOf<WbsTask>("wbs_tasks"));

export type ProgressEntry = {
  id: string; // PRG-<projectId>-<n>
  projectId: string;
  taskId: string;
  date: string;
  /** cumulative % complete of the task after this measurement */
  pct: number;
  qtyToDate?: number;
  by: string;
  source: "engineer" | "foreman" | "diary" | "subcontractor";
  note?: string;
  photos?: MediaRef[];
};
export const progressEntries = createCollection<ProgressEntry>("progress_entries", seedOf<ProgressEntry>("progress_entries"));

export type VariationStatus = "draft" | "priced" | "submitted" | "approved" | "rejected" | "void";
export type Variation = {
  id: string; // VO-<projectId>-<n>
  projectId: string;
  no: number;
  title: string;
  reason: string;
  origin: "client" | "design" | "site" | "rfi" | "selection" | "authority";
  rfiId?: string;
  selectionId?: string;
  lines: { description: string; qty: number; unit: string; unitPrice: number; unitCost: number; costCode?: CostCode }[];
  /** sell price change excl. VAT (negative = omission) */
  amount: number;
  /** cost change excl. VAT */
  cost: number;
  /** time extension in days */
  days: number;
  status: VariationStatus;
  raisedBy: string;
  raisedAt: string;
  approvedBy?: string; // customer name (portal) or exec
  approvedAt?: string;
  signature?: MediaRef;
  attachments?: MediaRef[];
};
export const variations = createCollection<Variation>("variations", seedOf<Variation>("variations"));

export type Subcontractor = {
  id: string; // SUB-0001
  name: string;
  taxId?: string;
  contact: string;
  phone: string;
  trades: string[]; // งานโครงสร้าง, ไฟฟ้า, ประปา, ฉาบ, กระเบื้อง …
  /** prequalification */
  prequal: "pending" | "approved" | "suspended" | "blacklisted";
  prequalScore?: number; // 0–100
  insuranceExpiry?: string; // ประกันภัยความรับผิด / กองทุนเงินทดแทน
  workers?: number;
  supplierId?: string; // link to procurement supplier (for bills/payments)
  note?: string;
};
export const subcontractors = createCollection<Subcontractor>("subcontractors", seedOf<Subcontractor>("subcontractors"));

export type Subcontract = {
  id: string; // SC-2026-0001
  projectId: string;
  subcontractorId: string;
  title: string; // ขอบเขตงาน
  lines: { id: string; description: string; qty: number; unit: string; rate: number; taskId?: string; costCode?: CostCode }[];
  value: number; // excl. VAT
  retentionPct: number; // usually 5–10
  advance: number; // advance payment (baht), recovered pro rata
  whtRate: number; // 3 (ค่าจ้างทำของ)
  vat: boolean; // subcontractor VAT-registered
  start: string;
  finish: string;
  status: "draft" | "active" | "completed" | "terminated";
  signedAt?: string;
};
export const subcontracts = createCollection<Subcontract>("subcontracts", seedOf<Subcontract>("subcontracts"));

export type PaymentCert = {
  id: string; // IPC-<projectId>-<n> (client) or SPC-<subcontractId>-<n>
  projectId: string;
  side: "client" | "sub";
  subcontractId?: string;
  no: number;
  periodTo: string; // work measured up to this date
  date: string;
  /** cumulative value of work done incl. approved variations (excl. VAT) */
  grossToDate: number;
  previous: number; // grossToDate of the previous certificate
  thisPeriod: number; // grossToDate − previous
  retention: number; // deducted this period
  advanceRecovery: number;
  backCharges: number;
  vat: number;
  wht: number;
  net: number; // amount payable this certificate
  status: "draft" | "submitted" | "certified" | "paid";
  certifiedBy?: string;
  paidDate?: string;
};
export const paymentCerts = createCollection<PaymentCert>("payment_certs", seedOf<PaymentCert>("payment_certs"));

export type Weather = "sunny" | "cloudy" | "rain" | "storm";
export const WEATHER_LABEL: Record<Weather, string> = { sunny: "แดดออก", cloudy: "มีเมฆ", rain: "ฝนตก", storm: "พายุ" };
export type SiteDiary = {
  id: string; // DIA-<projectId>-<yyyymmdd>
  projectId: string;
  date: string;
  weatherAm: Weather;
  weatherPm: Weather;
  rainHours?: number;
  /** headcount by company / trade (own crew, each subcontractor) */
  manpower: { group: string; trade: string; count: number; subcontractorId?: string }[];
  equipment: { name: string; hours: number; plantId?: string }[];
  work: { taskId?: string; text: string; pct?: number }[];
  deliveries?: string;
  issues?: string;
  visitors?: string;
  safety?: string;
  photos: MediaRef[];
  by: string;
  status: "draft" | "submitted" | "approved";
  approvedBy?: string;
};
export const siteDiaries = createCollection<SiteDiary>("site_diaries", seedOf<SiteDiary>("site_diaries"));
