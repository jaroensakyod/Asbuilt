// Procurement record types (pure, no React).

import type { CostCode } from "../biz";

export type PRLine = { itemId?: string; description: string; qty: number; unit: string; neededBy: string };

export type Quote = {
  supplierId: string;
  prices: number[]; // unit price per PR line, excl. VAT
  leadDays: number;
  validUntil: string;
  note?: string;
};

export type RFQ = {
  id: string; // RFQ-2026-0001
  date: string;
  quotes: Quote[]; // up to 3
  winner?: string; // supplierId
  reason?: string;
};

export type PRStatus = "submitted" | "rfq" | "ordered" | "rejected";
export const PR_STATUS_LABEL: Record<PRStatus, string> = { submitted: "รอจัดซื้อ", rfq: "เปรียบเทียบราคา", ordered: "ออกใบสั่งซื้อแล้ว", rejected: "ไม่อนุมัติ" };

export type PurchaseRequest = {
  id: string; // PR-2026-0001
  projectId?: string; // undefined = replenish central warehouse
  costCode: CostCode;
  date: string;
  requestedBy: string;
  lines: PRLine[];
  status: PRStatus;
  rfq?: RFQ;
  poId?: string;
  note?: string;
};

export type POLine = { itemId?: string; description: string; qty: number; unit: string; unitPrice: number };

export type POStatus = "pending" | "approved" | "partial" | "received" | "rejected" | "cancelled";
export const PO_STATUS_LABEL: Record<POStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว รอรับของ",
  partial: "รับบางส่วน",
  received: "รับครบแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

export type PurchaseOrder = {
  id: string; // PO-2026-0001
  prId?: string;
  projectId?: string; // delivery site; undefined = central warehouse
  costCode: CostCode;
  kind: "goods" | "service"; // service = ใบสั่งจ้าง (no stock, cost booked when the bill is approved)
  supplierId: string;
  date: string;
  deliveryDate: string;
  lines: POLine[];
  vatRate: number; // 7 or 0
  whtRate: number;
  paymentTerms: number;
  status: POStatus;
  requestedBy: string;
  approvedBy?: string;
  approvedRole?: string;
  approvedDate?: string;
  note?: string;
};

export type GoodsReceipt = {
  id: string; // GR-2026-0001
  poId: string;
  projectId?: string;
  date: string;
  receiver: string;
  lines: { line: number; qty: number }[]; // index into PO lines
  photos: number; // photo placeholders attached
  quality?: number; // 1–5 assessment by the receiver
  note?: string;
};

export type MoveKind = "receive" | "issue" | "transfer" | "adjust";
export const MOVE_LABEL: Record<MoveKind, string> = { receive: "รับเข้า", issue: "เบิกใช้", transfer: "โอนย้าย", adjust: "ปรับยอด" };

export type StockMove = {
  id: string; // MV-2026-00001
  date: string;
  kind: MoveKind;
  itemId: string;
  qty: number; // always positive, except adjust (+/-)
  unitCost: number; // receive: purchase price; others: moving average at the source when written
  from?: string; // location id
  to?: string; // location id
  projectId?: string; // project charged (issue) or receiving site
  costCode?: CostCode;
  ref?: string; // GR / PO id
  by: string;
  note?: string;
};

export const WAREHOUSE = "WH";
export const siteLoc = (projectId: string) => `SITE:${projectId}`;
export const locProject = (loc: string) => (loc.startsWith("SITE:") ? loc.slice(5) : undefined);
