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
  source: "po" | "bill" | "labour" | "petty" | "subcontract";
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
