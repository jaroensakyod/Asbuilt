// Design module record types (pure, no React). Design stages, building permits, specifications,
// plus the customer-portal records (messages, satisfaction surveys) owned by this module.

import type { CostCode } from "../biz";
import type { MediaRef } from "../media";

// ---------- design stages ----------

export type StageKey = "concept" | "schematic" | "dd" | "cd" | "permit";
export const STAGE_KEYS: StageKey[] = ["concept", "schematic", "dd", "cd", "permit"];
export const STAGE_LABEL: Record<StageKey, string> = {
  concept: "แนวคิด",
  schematic: "ร่างแบบ",
  dd: "พัฒนาแบบ",
  cd: "แบบก่อสร้าง",
  permit: "ยื่นขออนุญาต",
};
export const STAGE_EN: Record<StageKey, string> = {
  concept: "Concept",
  schematic: "Schematic design",
  dd: "Design development",
  cd: "Construction documents",
  permit: "Permit submission",
};

export type StageStatus = "not_started" | "in_progress" | "client_review" | "changes_requested" | "approved";
export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  not_started: "ยังไม่เริ่ม",
  in_progress: "กำลังออกแบบ",
  client_review: "รอลูกค้าพิจารณา",
  changes_requested: "ลูกค้าขอแก้ไข",
  approved: "อนุมัติแล้ว",
};

/** fee state of a stage's design-fee milestone */
export type FeeStatus = "in_contract" | "pending" | "ready" | "invoiced" | "paid";
export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  in_contract: "รวมในสัญญาก่อสร้าง",
  pending: "รออนุมัติขั้นตอน",
  ready: "พร้อมออกใบแจ้งหนี้",
  invoiced: "ออกใบแจ้งหนี้แล้ว",
  paid: "รับชำระแล้ว",
};

export type Deliverable = { id: string; text: string; done: boolean; files?: MediaRef[] };

export type ReviewEntry = {
  id: string;
  at: string; // ISO datetime
  by: string;
  side: "client" | "company";
  action: "submitted" | "approved" | "changes" | "comment";
  comment?: string;
  signature?: MediaRef;
};

export type DesignStage = {
  id: string; // DS-<projectId>-<key>
  projectId: string;
  key: StageKey;
  start?: string;
  due: string;
  finishedAt?: string;
  architect: string;
  engineers: string[];
  deliverables: Deliverable[];
  status: StageStatus;
  /** times the client asked for changes on this stage */
  revisions: number;
  submittedAt?: string; // last submission to the client
  approvedAt?: string;
  approvedBy?: string;
  /** design fee of the stage (baht excl. VAT) */
  fee: number;
  feeStatus: FeeStatus;
  installmentId?: string;
  reviews: ReviewEntry[];
  attachments: MediaRef[];
  note?: string;
};

/** Design contract of a project: total fee and the team */
export type DesignJob = {
  id: string; // DJ-<projectId>
  projectId: string;
  feeTotal: number; // baht excl. VAT; 0 = included in the construction contract
  leadArchitect: string;
  structural: string;
  mep: string;
  start: string;
  note?: string;
};

// ---------- permits ----------

export type PermitRoute = "permit" | "m39";
export const ROUTE_LABEL: Record<PermitRoute, string> = { permit: "ขออนุญาต (ข.1 → อ.1)", m39: "แจ้งตาม ม.39 ทวิ" };
export const ROUTE_SHORT: Record<PermitRoute, string> = { permit: "ข.1 → อ.1", m39: "ม.39 ทวิ" };

export type AuthorityKind = "district" | "municipality" | "sao";
export const AUTHORITY_LABEL: Record<AuthorityKind, string> = { district: "สำนักงานเขต (กทม.)", municipality: "เทศบาล", sao: "องค์การบริหารส่วนตำบล (อบต.)" };

export type BuildingUse = "house" | "townhome" | "homeoffice" | "condo" | "commercial";
export const USE_LABEL: Record<BuildingUse, string> = { house: "บ้านเดี่ยว", townhome: "ทาวน์โฮม", homeoffice: "อาคารพาณิชย์/โฮมออฟฟิศ", condo: "อาคารชุด/อยู่อาศัยรวม", commercial: "อาคารสาธารณะ/พาณิชย์" };

export type PermitDocStatus = "missing" | "ready" | "submitted";
export type PermitDoc = { key: string; label: string; required: boolean; status: PermitDocStatus; files: MediaRef[]; note?: string };

export type PermitQuery = { id: string; date: string; officer: string; text: string; reply?: string; repliedAt?: string; files?: MediaRef[] };
export type PermitExtension = { id: string; requestedAt: string; approvedAt?: string; newExpiry?: string; note?: string };

export type PermitStatus = "preparing" | "submitted" | "query" | "approved" | "rejected" | "completion" | "completed";
export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  preparing: "เตรียมเอกสาร",
  submitted: "ยื่นแล้ว รอพิจารณา",
  query: "เจ้าหน้าที่ขอข้อมูลเพิ่ม",
  approved: "ได้รับใบอนุญาต/ใบรับแจ้ง",
  rejected: "ไม่อนุญาต",
  completion: "แจ้งก่อสร้างเสร็จ",
  completed: "ปิดเรื่อง (เปิดใช้อาคารได้)",
};

export type CompletionKind = "a6" | "notice";
export const COMPLETION_LABEL: Record<CompletionKind, string> = { a6: "ใบรับรองการก่อสร้าง (อ.6)", notice: "แจ้งการก่อสร้างเสร็จ/แจ้งเปิดใช้อาคาร" };

export type Permit = {
  id: string; // PMT-<projectId>
  projectId: string;
  route: PermitRoute;
  authorityKind: AuthorityKind;
  authorityName: string;
  officer?: string;
  use: BuildingUse;
  height: number; // m, to the highest point of the roof
  floorArea: number; // m², all floors
  units?: number; // dwelling units (condo)
  ownerIsApplicant: boolean;
  docs: PermitDoc[];
  submittedAt?: string;
  queries: PermitQuery[];
  status: PermitStatus;
  permitNo?: string;
  issuedAt?: string;
  expiresAt?: string;
  extensions: PermitExtension[];
  completionKind: CompletionKind;
  completionSubmittedAt?: string;
  completionIssuedAt?: string;
  completionRef?: string;
  fee?: number;
  note?: string;
};

// ---------- specifications ----------

export type SpecClause = {
  id: string; // SPC-03-01
  code: string; // "03.01"
  title: string;
  text: string;
  brands: string[];
  /** "หรือเทียบเท่า" allowed */
  equivalents: boolean;
  costCode?: CostCode;
};
export type SpecSection = { id: string; code: string; name: string; costCode?: CostCode; clauses: SpecClause[] };

export type SpecSet = {
  id: string; // SPEC-<projectId>
  projectId: string;
  title: string;
  revision: number;
  issuedAt: string;
  preparedBy: string;
  sectionIds: string[];
  excluded: string[]; // clause ids left out of this project
  overrides: Record<string, { text?: string; brands?: string[] }>;
  note?: string;
};

// ---------- settings ----------

export type DesignSettings = {
  id: "design";
  feePct: Record<StageKey, number>;
  autoInstallment: boolean;
  installmentDueDays: number;
  vatRate: number;
  reviewAlertDays: number;
  permitPendingDays: number;
  permitExpiryDays: number;
  permitValidityDays: number;
  permitReviewDays: number;
  m39ReviewDays: number;
  eiaHeightM: number;
  eiaAreaM2: number;
  eiaCondoUnits: number;
  largeBuildingM2: number;
};

// ---------- customer portal records ----------

export type PortalMessage = {
  id: string; // MSG-<projectId>-<n>
  projectId: string;
  side: "customer" | "company";
  author: string;
  text: string;
  at: string; // ISO datetime
  attachments?: MediaRef[];
  /** staff opened it (customer messages) */
  readAt?: string;
};

export type SurveyAspect = "quality" | "onTime" | "communication" | "afterSales";
export const SURVEY_ASPECTS: SurveyAspect[] = ["quality", "onTime", "communication", "afterSales"];
export const ASPECT_LABEL: Record<SurveyAspect, string> = { quality: "คุณภาพงาน", onTime: "ตรงเวลา", communication: "การสื่อสาร", afterSales: "บริการหลังการขาย" };

export type SurveyResponse = {
  id: string; // SRV-<projectId>-handover | SRV-<projectId>-<repairId>
  projectId: string;
  trigger: "handover" | "repair";
  repairId?: string;
  at: string; // ISO date
  by: string;
  scores: Partial<Record<SurveyAspect, number>>; // 1–5
  comments: Partial<Record<SurveyAspect, string>>;
  general?: string;
  /** staff followed up a low score */
  followedUp?: string;
};
