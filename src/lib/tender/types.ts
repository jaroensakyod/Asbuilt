// Tender (bid) records and settings. Type-only imports so calc stays testable.

import type { MediaRef } from "../media";

export type TenderSource = "private" | "egp";
export const SOURCE_LABEL: Record<TenderSource, string> = { private: "เอกชน (เชิญประกวดราคา)", egp: "ภาครัฐ (e-GP)" };
export type TenderMethod = "e-bidding" | "selection" | "specific" | "invitation";
export const METHOD_LABEL: Record<TenderMethod, string> = { "e-bidding": "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)", selection: "วิธีคัดเลือก", specific: "วิธีเฉพาะเจาะจง", invitation: "เชิญเสนอราคา (เอกชน)" };

export type TenderStatus = "prospect" | "preparing" | "submitted" | "won" | "lost" | "nobid" | "cancelled";
export const TENDER_STATUS_LABEL: Record<TenderStatus, string> = {
  prospect: "ติดตามโครงการ",
  preparing: "กำลังจัดทำราคา",
  submitted: "ยื่นซองแล้ว",
  won: "ชนะการประมูล",
  lost: "ไม่ได้งาน",
  nobid: "ไม่เข้าร่วม",
  cancelled: "ยกเลิกประกาศ",
};

export type BondType = "bank" | "cash" | "cheque" | "govbond" | "eguarantee";
export const BOND_TYPE_LABEL: Record<BondType, string> = { bank: "หนังสือค้ำประกันธนาคาร", eguarantee: "หนังสือค้ำประกันอิเล็กทรอนิกส์ (e-LG)", cash: "เงินสด", cheque: "แคชเชียร์เช็ค", govbond: "พันธบัตรรัฐบาล" };
export type Bond = { type: BondType; bank?: string; ref?: string; amount: number; issue?: string; expiry?: string; returned?: string };

export type BoqLine = {
  id: string;
  group: string;
  description: string;
  qty: number;
  unit: string;
  /** unit cost of material and of labour (baht, excl. VAT) */
  material: number;
  labour: number;
  /** government estimate: item not multiplied by Factor F (VAT only), e.g. ครุภัณฑ์ */
  noF?: boolean;
};

export type Competitor = { name: string; price: number; winner?: boolean };

export type KInstallment = {
  no: number;
  /** month the work of this installment was delivered (index month t), YYYY-MM */
  month: string;
  amount: number; // installment value excl. VAT
  paidDate?: string;
  /** K claim filed with the agency */
  claimedDate?: string;
};

export type Award = {
  contractNo: string;
  value: number; // contract value incl. VAT
  signDate: string;
  start: string;
  finish: string;
  actualFinish?: string;
  perfBond?: Bond;
  penaltyRatePct: number; // % of contract value per day
  penaltyMinPerDay: number;
  /** ค่า K: price-escalation contract (สัญญาแบบปรับราคาได้) */
  adjustable: boolean;
  kFormulaId?: string;
  /** month the bids were opened (index month o), YYYY-MM */
  kBaseMonth: string;
  installments: KInstallment[];
  projectId?: string;
};

export type Tender = {
  id: string; // TD-2026-0001
  title: string;
  client: string;
  source: TenderSource;
  method: TenderMethod;
  egpNo?: string;
  province: string;
  /** วงเงินงบประมาณ */
  budget?: number;
  /** ราคากลาง announced by the agency (incl. VAT) */
  medianPrice?: number;
  status: TenderStatus;
  owner: string; // estimator in charge
  announced?: string;
  siteVisit?: string;
  questionsDue?: string;
  submitDue: string;
  openDate?: string;
  docs: MediaRef[];
  torNote?: string;
  bidBond?: Bond;
  lines: BoqLine[];
  markupPct: number;
  vatPct: number;
  /** our bid price incl. VAT (defaults to cost × markup) */
  bidPrice?: number;
  result?: { date: string; competitors: Competitor[]; reason?: string };
  award?: Award;
  createdAt: string;
};

export type FactorRow = { cost: number; factor: number };
export type KFormula = { id: string; name: string; constant: number; terms: { sym: string; coef: number }[] };

export type TenderSettings = {
  id: "tender";
  /** Factor F for building work: direct-cost breakpoints (baht) → factor; interpolated between rows */
  factorTable: FactorRow[];
  factorBasis: string;
  kFormulas: KFormula[];
  /** K changes within ± this % are not paid / deducted */
  kThresholdPct: number;
  kDecimals: number;
  /** days after the final installment is paid within which the contractor must file the K claim */
  kClaimDays: number;
  penaltyRatePct: number;
  penaltyMinPerDay: number;
  bidBondPct: number;
  perfBondPct: number;
  /** monthly indices by symbol, e.g. { "2026-04": { I: 109.2, C: 116.1, … } } */
  indices: Record<string, Record<string, number>>;
  /** K symbol → MOC CMI index_id used by "ดึงดัชนีจาก พณ." (e.g. C → ซีเมนต์, S → เหล็ก) */
  kIndexMap?: Record<string, string>;
  /** where official index values came from (latest first) */
  indexLog?: { at: string; via: "moc-api" | "file"; file?: string; cells: number; months: string[]; by: string }[];
};

export const INDEX_LABEL: Record<string, string> = {
  I: "ดัชนีราคาผู้บริโภคทั่วไป",
  C: "ดัชนีราคาซีเมนต์",
  M: "ดัชนีราคาวัสดุก่อสร้าง (ไม่รวมเหล็กและซีเมนต์)",
  S: "ดัชนีราคาเหล็ก",
  E: "ดัชนีราคาเครื่องจักรกลและบริภัณฑ์",
  F: "ดัชนีราคาน้ำมันดีเซล",
  A: "ดัชนีราคาแอสฟัลต์",
  G: "ดัชนีราคาท่อ",
};
