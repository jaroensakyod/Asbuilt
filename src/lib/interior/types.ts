// Interior / fit-out and client selections — record types (pure, no React).

import type { CostCode } from "../biz";
import type { MediaRef } from "../media";

// ---------- selections (house finishes + interior choices by the client) ----------

export type SelCategory = "floor" | "wall" | "sanitary" | "faucet" | "lighting" | "door" | "kitchen" | "builtin" | "paint" | "other";
export const SEL_CATEGORY_LABEL: Record<SelCategory, string> = {
  floor: "พื้น",
  wall: "ผนัง",
  sanitary: "สุขภัณฑ์",
  faucet: "ก๊อก/ฝักบัว",
  lighting: "โคมไฟ",
  door: "ประตู/ลูกบิด",
  kitchen: "ครัว",
  builtin: "เฟอร์นิเจอร์บิวท์อิน",
  paint: "สี",
  other: "อื่น ๆ",
};
export const SEL_COST_CODE: Record<SelCategory, CostCode> = {
  floor: "10",
  wall: "10",
  sanitary: "12",
  faucet: "12",
  lighting: "06",
  door: "09",
  kitchen: "10",
  builtin: "10",
  paint: "11",
  other: "10",
};

export type SelectionOption = {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  supplierId?: string;
  productId?: string;
  /** sell price per unit (excl. VAT) */
  price: number;
  /** trade cost per unit (excl. VAT) */
  cost?: number;
  images: MediaRef[];
  /** demo colour chip when there is no photo */
  swatch?: string;
  note?: string;
};

export type SelectionStatus = "pending" | "chosen" | "approved";
export const SEL_STATUS_LABEL: Record<SelectionStatus, string> = { pending: "รอลูกค้าเลือก", chosen: "ลูกค้าเลือกแล้ว รออนุมัติ", approved: "อนุมัติและล็อกแล้ว" };

export type Selection = {
  id: string; // SEL-<projectId>-<nn>
  projectId: string;
  room: string;
  category: SelCategory;
  item: string;
  qty: number;
  unit: string;
  /** allowance in the contract, sell price per unit */
  allowanceUnit: number;
  /** cost per unit assumed in the budget for the allowance (defaults to 80 % of the allowance) */
  allowanceCostUnit?: number;
  options: SelectionOption[];
  deadline: string;
  /** work that waits for this choice, e.g. "ปูกระเบื้องชั้น 2" */
  blocks?: string;
  blocksDate?: string;
  status: SelectionStatus;
  chosenId?: string;
  chosenAt?: string;
  chosenBy?: string;
  clientNote?: string;
  approvedAt?: string;
  approvedBy?: string;
  variationId?: string;
  prId?: string;
};

// ---------- interior projects ----------

export type InteriorStatus = "design" | "procurement" | "install" | "handover" | "closed";
export const INT_STATUS_LABEL: Record<InteriorStatus, string> = { design: "ออกแบบ", procurement: "สั่งซื้อ/ผลิต", install: "ติดตั้ง", handover: "ตรวจรับ/แก้ไข", closed: "ปิดงาน" };

export type FeeMilestone = { id: string; title: string; pct: number; amount: number; due: string; status: "scheduled" | "invoiced" | "paid"; paidAt?: string; installmentId?: string };

export type InteriorProject = {
  id: string; // INT-2026-01
  name: string;
  /** linked house project (portal, installments); empty = standalone client */
  projectId?: string;
  client: string;
  phone?: string;
  address?: string;
  designer: string;
  status: InteriorStatus;
  start: string;
  due: string;
  rooms: { name: string; budget: number }[];
  designFee: number;
  fees: FeeMilestone[];
  handover?: { signedBy: string; signedAt: string; signature?: MediaRef; note?: string };
  note?: string;
};

// ---------- product catalogue ----------

export type ProductCat = "furniture" | "builtin" | "lighting" | "fabric" | "rug" | "decor" | "sanitary" | "surface" | "wallcover" | "appliance";
export const PRODUCT_CAT_LABEL: Record<ProductCat, string> = {
  furniture: "เฟอร์นิเจอร์ลอยตัว",
  builtin: "เฟอร์นิเจอร์บิวท์อิน",
  lighting: "โคมไฟ",
  fabric: "ผ้าม่าน/ผ้าบุ",
  rug: "พรม",
  decor: "ของตกแต่ง",
  sanitary: "สุขภัณฑ์/ก๊อก",
  surface: "วัสดุปูพื้น/ผิว",
  wallcover: "วอลเปเปอร์/วัสดุผนัง",
  appliance: "เครื่องใช้ไฟฟ้า",
};

export type Product = {
  id: string; // PRD-0001
  sku: string;
  name: string;
  supplierId?: string; // procurement supplier
  supplierName?: string; // maker not in the supplier register
  category: ProductCat;
  dims?: string; // W×D×H mm
  finish?: string;
  colour?: string;
  swatch?: string; // demo colour chip
  leadDays: number;
  images: MediaRef[];
  tradeCost: number; // excl. VAT
  markupPct: number;
  clientPrice: number; // excl. VAT
  unit: string;
  note?: string;
};

// ---------- boards, FF&E, samples, installation, punch list ----------

export type BoardTile = { id: string; productId?: string; image?: MediaRef; caption?: string };
export type MoodBoard = {
  id: string; // MB-<interiorId>-<n>
  interiorId: string;
  projectId?: string;
  room: string;
  title: string;
  tiles: BoardTile[];
  notes?: string;
  shared: boolean;
  sharedAt?: string;
  clientComment?: string;
  clientCommentAt?: string;
  clientLiked?: boolean;
};

export type FfeStatus = "specified" | "ordered" | "confirmed" | "shipped" | "received" | "installed";
export const FFE_STATUSES: FfeStatus[] = ["specified", "ordered", "confirmed", "shipped", "received", "installed"];
export const FFE_STATUS_LABEL: Record<FfeStatus, string> = { specified: "ระบุในแบบ", ordered: "สั่งแล้ว", confirmed: "ผู้ขายยืนยัน", shipped: "จัดส่งแล้ว", received: "รับของแล้ว", installed: "ติดตั้งแล้ว" };

export type FfeItem = {
  id: string; // FFE-<interiorId>-<nnn>
  interiorId: string;
  projectId?: string;
  room: string;
  code: string; // FF-01 / LT-03 …
  productId?: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  unitSell: number;
  status: FfeStatus;
  orderedAt?: string;
  confirmedAt?: string;
  shippedAt?: string;
  expectedAt?: string;
  receivedAt?: string;
  damage?: { ok: boolean; note?: string; photos: MediaRef[] };
  installedAt?: string;
  prId?: string;
};

export type SampleStatus = "requested" | "received" | "shown" | "returned" | "kept";
export const SAMPLE_STATUS_LABEL: Record<SampleStatus, string> = { requested: "ขอตัวอย่างแล้ว", received: "ได้รับแล้ว", shown: "ให้ลูกค้าดูแล้ว", returned: "คืนแล้ว", kept: "เก็บไว้ (ซื้อ/ไม่ต้องคืน)" };
export type Sample = {
  id: string; // SMP-0001
  interiorId: string;
  productId?: string;
  description: string;
  supplierId?: string;
  supplierName?: string;
  status: SampleStatus;
  requestedAt: string;
  receivedAt?: string;
  shownAt?: string;
  returnBy?: string;
  returnedAt?: string;
  location: string;
  note?: string;
};

export type InstallJob = {
  id: string; // IJ-<interiorId>-<n>
  interiorId: string;
  room: string;
  crew: string;
  start: string;
  end: string;
  ffeIds: string[];
  status: "planned" | "in_progress" | "done";
  note?: string;
};

export type PunchItem = {
  id: string; // PL-<interiorId>-<n>
  interiorId: string;
  room: string;
  text: string;
  assignee?: string;
  photos: MediaRef[];
  status: "open" | "fixed" | "verified";
  createdAt: string;
  by: string;
  fixedAt?: string;
  afterPhotos?: MediaRef[];
};

export type InteriorSettings = {
  id: "interior";
  defaultMarkup: number;
  sampleReturnDays: number;
  vatRate: number;
  /** cost ratio used when an allowance has no budget cost */
  allowanceCostRatio: number;
};
