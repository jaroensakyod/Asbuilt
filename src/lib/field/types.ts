// Field (site diary, phone app, punch list) and service (dispatch, van stock,
// service contracts, warranty) record types. Type-only imports so pure calc files stay testable.

import type { MediaRef } from "../media";
import type { SiteDiary, Weather } from "../biz";
import type { SystemKey } from "../data";

export type { Weather };

/** SiteDiary plus a few optional workflow fields kept on the same record */
export type Diary = SiteDiary & {
  submittedAt?: string;
  approvedAt?: string;
  /** reviewer comment when sent back / approved */
  comment?: string;
};

export type DiaryStatus = SiteDiary["status"];
export const DIARY_STATUS_LABEL: Record<DiaryStatus, string> = { draft: "ร่าง", submitted: "รออนุมัติ", approved: "อนุมัติแล้ว" };

// ---------- punch list / defects (ตรวจงาน) ----------

export type PunchStatus = "open" | "fixed" | "verified";
export const PUNCH_STATUS_LABEL: Record<PunchStatus, string> = { open: "ต้องแก้ไข", fixed: "แก้แล้ว รอตรวจ", verified: "ตรวจผ่าน" };
export type PunchItem = {
  id: string; // PUN-<projectId>-<n>
  projectId: string;
  title: string;
  location: string;
  trade: string;
  photos: MediaRef[];
  fixPhotos?: MediaRef[];
  status: PunchStatus;
  by: string;
  date: string;
  due?: string;
  assignee?: string;
  fixedAt?: string;
  verifiedAt?: string;
  lat?: number;
  lng?: number;
};

/** quick issue reported from the phone app; becomes a repair or a punch item */
export type FieldIssue = {
  id: string; // ISS-<n>
  projectId: string;
  kind: "repair" | "defect";
  title: string;
  detail?: string;
  system: SystemKey;
  photos: MediaRef[];
  lat?: number;
  lng?: number;
  by: string;
  at: string;
  repairId?: string;
  punchId?: string;
};

// ---------- work-order field service (extends ops work orders by id) ----------

export type Geo = { at: string; lat?: number; lng?: number; /** metres from the site pin */ dist?: number };
export type PartUsed = { stockId: string; code: string; name: string; unit: string; qty: number; unitPrice: number };
export type WoService = {
  id: string; // same as the work order id
  projectId: string;
  /** dispatch slot on the scheduled day */
  slot?: "am" | "pm";
  checkIn?: Geo;
  checkOut?: Geo;
  checklist: { text: string; done: boolean }[];
  before: MediaRef[];
  after: MediaRef[];
  signature?: MediaRef;
  signer?: string;
  signedAt?: string;
  parts: PartUsed[];
  /** on-site charge (excl. nothing: the customer pays this amount) */
  charge?: { amount: number; note?: string; paid?: boolean; paidAt?: string; method?: "promptpay" | "cash" | "transfer" };
  notes?: string;
};

export type VanStock = {
  id: string; // VAN-<techId>-<code>
  tech: string; // technician name
  code: string;
  name: string;
  unit: string;
  qty: number;
  min: number;
  unitPrice: number; // sell price for chargeable jobs
};
export type VanMove = {
  id: string; // VMV-<n>
  stockId: string;
  tech: string;
  date: string;
  qty: number; // + replenish, − issue
  woId?: string;
  note?: string;
};

export type SurveyRequest = {
  id: string; // SRV-<repairId>
  repairId: string;
  woId?: string;
  projectId: string;
  customer: string;
  phone?: string;
  requestedAt: string;
  by: string;
  channel: "line" | "sms" | "email";
  status: "pending" | "sent" | "answered";
};

// ---------- service contracts ----------

export type ServiceScope = { key: string; label: string; system: SystemKey; cycleMonths: number; units?: number };
export type BillingFreq = "annual" | "semiannual" | "quarterly" | "monthly";
export const BILLING_FREQ_LABEL: Record<BillingFreq, string> = { annual: "รายปี", semiannual: "ทุก 6 เดือน", quarterly: "รายไตรมาส", monthly: "รายเดือน" };
export const BILLS_PER_YEAR: Record<BillingFreq, number> = { annual: 1, semiannual: 2, quarterly: 4, monthly: 12 };
export type ServiceContract = {
  id: string; // SVC-2026-0001
  projectId: string;
  customer: string;
  title: string;
  scopes: ServiceScope[];
  price: number; // per year, excl. VAT
  billing: BillingFreq;
  start: string;
  end: string;
  status: "draft" | "active" | "expired" | "cancelled";
  autoRenew: boolean;
  remindDays: number;
  assignee: string;
  /** first maintenance id of each generated plan */
  planIds?: string[];
  renewedFrom?: string;
  note?: string;
};

// ---------- warranty register ----------

export type WarrantyCategory = "structure" | "roof" | "general" | "system" | "equipment";
export const WARRANTY_CAT_LABEL: Record<WarrantyCategory, string> = {
  structure: "โครงสร้าง",
  roof: "หลังคา/กันซึม",
  general: "งานทั่วไป/สถาปัตย์",
  system: "งานระบบไฟฟ้า/ประปา",
  equipment: "อุปกรณ์ (ผู้ผลิต)",
};
export type WarrantyItem = {
  id: string; // WAR-<projectId>-<n>
  projectId: string;
  category: WarrantyCategory;
  label: string;
  months: number;
  start: string; // usually handover date
  source: "company" | "manufacturer";
  supplier?: string;
  serial?: string;
  system?: SystemKey;
  note?: string;
  /** pre-expiry inspection booked for this item */
  inspectionId?: string;
};
export type WarrantyClaim = {
  id: string; // WCL-<repairId>
  repairId: string;
  projectId: string;
  itemId?: string;
  decision: "in" | "chargeable" | "supplier";
  note?: string;
  by: string;
  date: string;
};

export type FieldSettings = {
  id: "field";
  /** PromptPay id of the company (13-digit tax id or 10-digit phone) */
  promptPayId: string;
  promptPayName: string;
  /** days of the week a diary is expected (0 = Sunday) */
  diaryDays: number[];
  /** jobs per technician per day before "overloaded" */
  maxJobsPerDay: number;
  /** default warranty months by category (contract may differ) */
  warrantyMonths: Record<WarrantyCategory, number>;
  /** days before warranty end to book a pre-expiry inspection */
  preExpiryDays: number;
};
export const FIELD_DEFAULTS: FieldSettings = {
  id: "field",
  promptPayId: "0105557081236",
  promptPayName: "บจ. ตัวอย่างรับสร้างบ้าน",
  diaryDays: [1, 2, 3, 4, 5, 6],
  maxJobsPerDay: 3,
  warrantyMonths: { structure: 60, roof: 24, general: 12, system: 12, equipment: 12 },
  preExpiryDays: 60,
};
