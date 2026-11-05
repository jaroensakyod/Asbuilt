// Record shapes of the contracts module (สัญญา งานเปลี่ยนแปลง เบิกงวด ผู้รับเหมาช่วง).
// Pure types + labels: no React, no "@/" imports (shared biz shapes are type-only imports).
import type { CostCode, PaymentCert, Subcontract, Subcontractor, Variation } from "../biz";
import type { MediaRef } from "../media";

export type Tone = "neutral" | "accent" | "pos" | "neg" | "warn";

// ---------- variations ----------

export type VoOrigin = Variation["origin"];
export const ORIGIN_LABEL: Record<VoOrigin, string> = {
  client: "ลูกค้าขอเปลี่ยน",
  design: "แก้แบบ",
  site: "สภาพหน้างาน",
  rfi: "จาก RFI",
  selection: "เปลี่ยนวัสดุ/สเปก",
  authority: "ข้อกำหนดราชการ",
};
export const VO_STATUS_LABEL: Record<Variation["status"], string> = {
  draft: "ร่าง",
  priced: "ประเมินราคาแล้ว",
  submitted: "รอลูกค้าอนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  void: "ยกเลิก",
};
export const VO_STATUS_TONE: Record<Variation["status"], Tone> = { draft: "neutral", priced: "accent", submitted: "warn", approved: "pos", rejected: "neg", void: "neutral" };

/** Variation with the module's bookkeeping of what an approval changed elsewhere. */
export type VariationX = Variation & {
  submittedAt?: string;
  rejectedReason?: string;
  note?: string;
  /** set once the approval has been applied to the budget / installments (idempotent) */
  appliedAt?: string;
  budgetApplied?: { costCode: CostCode; amount: number }[];
  installmentApplied?: { id: string; delta: number }[];
};
export type VoLine = Variation["lines"][number];

// ---------- settings and per-project contract terms ----------

/** Company-wide defaults. Legal numbers are configurable: ตรวจสอบกับประกาศ/สัญญาล่าสุด. */
export type ContractSettings = {
  id: "settings";
  retentionPct: number; // % of each certificate held as retention
  retentionCapPct: number; // retention stops once it reaches this % of the contract value
  clientWhtRate: number; // % juristic clients withhold on certificates
  subWhtRate: number; // % we withhold from subcontractors (ค่าจ้างทำของ)
  vatRate: number;
  defectsMonths: number; // defects liability period after handover before retention is released
  certPayDays: number; // payment term of a client certificate
  voApprovalDays: number; // variation waiting for the client longer than this → notification
  insuranceWarnDays: number;
  advanceRecovery: "prorata";
};
export const DEFAULT_SETTINGS: ContractSettings = {
  id: "settings",
  retentionPct: 5,
  retentionCapPct: 5,
  clientWhtRate: 3,
  subWhtRate: 3,
  vatRate: 7,
  defectsMonths: 12,
  certPayDays: 30,
  voApprovalDays: 7,
  insuranceWarnDays: 30,
  advanceRecovery: "prorata",
};

export type Billing = "installments" | "measured";
export const BILLING_LABEL: Record<Billing, string> = { installments: "งวดตามสัญญา", measured: "เบิกตามผลงาน (IPC)" };

export type RetentionRelease = { date: string; amount: number; releaseVat: number; invoiceNo?: string; paidDate?: string; by?: string };

/** Contract terms of one project (record id CT-<projectId>). Projects without a record use the defaults. */
export type ContractTerms = {
  id: string;
  projectId: string;
  billing: Billing;
  contractNo?: string;
  signedAt?: string;
  retentionPct: number;
  retentionCapPct: number;
  advancePct: number;
  advanceDate?: string; // advance invoiced
  advancePaidDate?: string;
  advanceInvoiceNo?: string;
  whtRate: number; // client withholding
  customerName?: string;
  customerTaxId?: string;
  customerBranch?: string;
  customerAddress?: string;
  defectsMonths: number;
  certPayDays: number;
  /** liquidated damages per day (baht) — ค่าปรับตามสัญญา */
  ldPerDay?: number;
  retentionRelease?: RetentionRelease;
  note?: string;
};

// ---------- certificates ----------

export const CERT_STATUS_LABEL: Record<PaymentCert["status"], string> = { draft: "ร่าง", submitted: "ส่งขอเบิก", certified: "รับรองแล้ว", paid: "ชำระแล้ว" };
export const CERT_STATUS_TONE: Record<PaymentCert["status"], Tone> = { draft: "neutral", submitted: "warn", certified: "accent", paid: "pos" };

export type BackCharge = { id: string; date: string; reason: string; amount: number; certId?: string };
/** measured quantity to date of one subcontract line */
export type CertLine = { lineId: string; qtyToDate: number };

export type CertX = PaymentCert & {
  /** % complete to date used for a client certificate */
  pctToDate?: number;
  basis?: "wbs" | "actual" | "manual";
  /** contract value incl. approved variations at the time of the certificate */
  contractValue?: number;
  retentionPct?: number;
  whtRate?: number;
  vatRate?: number;
  lines?: CertLine[];
  backChargeItems?: BackCharge[];
  dueDate?: string;
  submittedAt?: string;
  certifiedAt?: string;
  invoiceNo?: string;
  receiptNo?: string;
  billId?: string;
  note?: string;
};

// ---------- subcontractors and subcontracts ----------

export const PREQUAL_LABEL: Record<Subcontractor["prequal"], string> = { pending: "รอประเมิน", approved: "ผ่านการคัดเลือก", suspended: "ระงับชั่วคราว", blacklisted: "ห้ามใช้" };
export const PREQUAL_TONE: Record<Subcontractor["prequal"], Tone> = { pending: "warn", approved: "pos", suspended: "warn", blacklisted: "neg" };

export const PREQUAL_CRITERIA = [
  { key: "experience", label: "ประสบการณ์และผลงาน", max: 30 },
  { key: "financial", label: "ฐานะการเงิน", max: 25 },
  { key: "safety", label: "ประวัติความปลอดภัย", max: 25 },
  { key: "references", label: "การอ้างอิงจากผู้ว่าจ้างเดิม", max: 20 },
] as const;
export type PrequalKey = (typeof PREQUAL_CRITERIA)[number]["key"];
export type Prequal = Record<PrequalKey, number>;

export type SubRating = { subcontractId: string; date: string; quality: number; time: number; safety: number; cooperation: number; note?: string; by: string };

export type SubcontractorX = Subcontractor & {
  prequalChecklist?: Prequal;
  prequalDate?: string;
  compFundExpiry?: string; // กองทุนเงินทดแทน
  address?: string;
  email?: string;
  since?: string;
  ratings?: SubRating[];
};

export const SC_STATUS_LABEL: Record<Subcontract["status"], string> = { draft: "ร่าง", active: "ดำเนินการ", completed: "แล้วเสร็จ", terminated: "บอกเลิก" };
export const SC_STATUS_TONE: Record<Subcontract["status"], Tone> = { draft: "neutral", active: "accent", completed: "pos", terminated: "neg" };

export type SubcontractX = Subcontract & {
  costCode?: CostCode;
  backCharges?: BackCharge[];
  advanceBillId?: string;
  retentionReleaseBillId?: string;
  completedAt?: string;
  defectsMonths?: number;
  note?: string;
  attachments?: MediaRef[];
};

export const TRADES = ["งานฐานราก/เสาเข็ม", "งานโครงสร้าง", "งานก่ออิฐ/ฉาบ", "งานหลังคา", "งานไฟฟ้า", "งานประปา/สุขาภิบาล", "งานปรับอากาศ", "งานกระเบื้อง", "งานสี", "งานฝ้า/ผนังเบา", "งานอลูมิเนียม/กระจก", "งานกันซึม", "งานภายนอก/ถนน"];
