// Map an AI extraction to the draft of a record the user then reviews and saves through the normal path.
// Pure: no React, no collections; callers pass the lists to match against.

import type { BoqLine, TenderMethod, TenderSource } from "../tender/types";
import { billAmounts, r2 } from "./reconcile";
import { guessProject, matchLines, normTaxId, type ProjectLike } from "./match";
import type { InvoiceX, QuoteX, TenderX } from "./types";

const DAY = 86400000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

/** "2569-11-03" (พ.ศ.) → "2026-11-03"; anything not a date → "" */
export function normDate(s: string | undefined): string {
  const m = (s ?? "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return "";
  let y = Number(m[1]);
  if (y > 2400) y -= 543;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const pos = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** fill a missing qty / unit price from the printed amount */
export function cleanLine(l: { description: string; qty: number; unit: string; unitPrice: number; amount: number }) {
  let qty = pos(l.qty);
  let unitPrice = pos(l.unitPrice);
  const amount = pos(l.amount);
  if (!qty && amount && unitPrice) qty = r2(amount / unitPrice);
  if (!qty) qty = 1;
  if (!unitPrice && amount) unitPrice = r2(amount / qty);
  return { description: (l.description ?? "").trim(), qty, unit: (l.unit ?? "").trim(), unitPrice, amount: amount || r2(qty * unitPrice) };
}

// ---------- supplier bill ----------

export type SupplierCtx = { id: string; name: string; taxId?: string; paymentTerms: number; whtRate: number; vatRegistered?: boolean };
export type BillDraft = {
  supplierId: string;
  supplierName: string;
  supplierTaxId: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  lines: { description: string; qty: number; unit: string; unitPrice: number }[];
  subtotal: number;
  vat: number;
  whtRate: number;
};

export const WHT_RATES = [0, 1, 2, 3, 5];

export function billDraft(x: InvoiceX, ctx: { today: string; supplier?: SupplierCtx }): BillDraft {
  const date = normDate(x.date) || ctx.today;
  const credit = pos(x.creditDays) || ctx.supplier?.paymentTerms || 30;
  const due = normDate(x.dueDate);
  const amounts = billAmounts({ ...x, lines: x.lines.map(cleanLine) });
  const toExcl = x.pricesIncludeVat && amounts.vat > 0 ? 100 / (100 + (x.vatRate || 7)) : 1;
  const lines = x.lines.map(cleanLine).map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, unitPrice: r2(l.unitPrice * toExcl) }));
  // a document discount becomes a negative line, so the bill's lines still add up to its subtotal
  if (pos(x.discount) && lines.length) lines.push({ description: "ส่วนลดท้ายบิล", qty: 1, unit: "", unitPrice: -r2(x.discount * toExcl) });
  const wht = WHT_RATES.includes(x.whtRate) && x.whtRate ? x.whtRate : (ctx.supplier?.whtRate ?? 0);
  return {
    supplierId: ctx.supplier?.id ?? "",
    supplierName: ctx.supplier?.name ?? x.vendorName.trim(),
    supplierTaxId: ctx.supplier?.taxId ?? normTaxId(x.vendorTaxId),
    invoiceNo: x.docNo.trim(),
    date,
    dueDate: due && due >= date ? due : addDays(date, credit),
    lines: lines.length ? lines : [{ description: "ตามใบแจ้งหนี้", qty: 1, unit: "งาน", unitPrice: amounts.subtotal }],
    subtotal: amounts.subtotal,
    vat: amounts.vat,
    whtRate: wht,
  };
}

// ---------- expense receipt ----------

export type CategoryLike = { name: string; wht: number };

const CATEGORY_WORDS: [RegExp, string][] = [
  [/น้ำมัน|ดีเซล|แก๊สโซฮอล์|เบนซิน|ปตท|บางจาก|เชลล์|คาลเท็กซ์|ทางด่วน|ค่าทางพิเศษ|จอดรถ/i, "ค่าน้ำมัน/ค่าเดินทาง"],
  [/ปูน|เหล็ก|อิฐ|ทราย|หิน|คอนกรีต|ไม้|ท่อ|สายไฟ|กระเบื้อง|สี|ยิปซัม|ตะปู|ลวด|เสาเข็ม|หลังคา/i, "วัสดุก่อสร้าง"],
  [/สว่าน|ใบตัด|ถุงมือ|เทป|แปรง|ค้อน|อุปกรณ์|เครื่องมือ|หมวกนิรภัย|รองเท้าเซฟตี้/i, "วัสดุสิ้นเปลือง/เครื่องมือเล็ก"],
  [/ขนส่ง|รถรับจ้าง|ค่ารถ|เกรียร์|lalamove|ไลน์แมน/i, "ค่าขนส่งวัสดุ"],
  [/เช่า.*(นั่งร้าน|เครน|เครื่อง|รถ)/i, "ค่าเช่าเครื่องจักร/นั่งร้าน"],
  [/กระดาษ|ปากกา|หมึก|เครื่องเขียน|แฟ้ม/i, "วัสดุสำนักงาน/เครื่องเขียน"],
  [/ไฟฟ้า|การไฟฟ้า|ประปา|การประปา/i, "ค่าไฟฟ้า/ประปาหน้างาน"],
  [/โทรศัพท์|อินเทอร์เน็ต|ais|true|dtac|3bb/i, "โทรศัพท์/อินเทอร์เน็ต"],
  [/อาหาร|ร้านอาหาร|กาแฟ|เครื่องดื่ม|ภัตตาคาร/i, "ค่ารับรองลูกค้า"],
  [/ทดสอบ|แล็บ|lab|ตรวจสอบวัสดุ/i, "ค่าทดสอบ/ตรวจสอบวัสดุ"],
  [/ธรรมเนียม|ใบอนุญาต|เขต|เทศบาล|อบต/i, "ค่าใบอนุญาต/ธรรมเนียมราชการ"],
];

export function guessCategory(x: Pick<InvoiceX, "categoryGuess" | "vendorName" | "lines">, cats: CategoryLike[]): string {
  const names = new Set(cats.map((c) => c.name));
  if (x.categoryGuess && names.has(x.categoryGuess)) return x.categoryGuess;
  const text = `${x.vendorName} ${x.lines.map((l) => l.description).join(" ")}`;
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(text) && names.has(cat)) return cat;
  return names.has("ค่าใช้จ่ายอื่น") ? "ค่าใช้จ่ายอื่น" : (cats[0]?.name ?? "");
}

const DOC_TYPE_OF: Record<string, string> = {
  tax_invoice_full: "ใบกำกับภาษีเต็มรูป",
  tax_invoice_abb: "ใบกำกับภาษีอย่างย่อ",
  receipt: "ใบเสร็จ",
  cash_bill: "บิลเงินสด/ใบรับรองแทนใบเสร็จ",
  invoice: "ใบแจ้งหนี้",
};

export type ExpenseDraft = {
  date: string;
  payee: string;
  payeeTaxId?: string;
  payeeBranch?: string;
  docType: string;
  docNo?: string;
  vatMode: "excluded" | "included" | "none";
  whtRate: number;
  category: string;
  projectId?: string;
  discount: number;
  discountType: "amount";
  lines: { name: string; qty: number; price: number; unit: string; discount: number; discountType: "percent" }[];
};

export function expenseDraft(x: InvoiceX, ctx: { today: string; categories: CategoryLike[]; projects: ProjectLike[] }): ExpenseDraft {
  const tax = normTaxId(x.vendorTaxId);
  const hasVat = x.vat > 0 || x.vatRate > 0;
  let docType = DOC_TYPE_OF[x.docKind] ?? "ใบเสร็จ";
  // a "full" tax invoice needs the seller's tax id; without it the input VAT cannot be claimed
  if (docType === "ใบกำกับภาษีเต็มรูป" && !tax) docType = "ใบกำกับภาษีอย่างย่อ";
  const lines = x.lines.map(cleanLine).map((l) => ({ name: l.description || "ค่าใช้จ่าย", qty: l.qty, price: l.unitPrice, unit: l.unit, discount: 0, discountType: "percent" as const }));
  const total = pos(x.total);
  const project = guessProject(`${x.projectHint} ${x.note}`, ctx.projects);
  return {
    date: normDate(x.date) || ctx.today,
    payee: x.vendorName.trim(),
    payeeTaxId: tax || undefined,
    payeeBranch: x.vendorBranch.trim() || undefined,
    docType,
    docNo: x.docNo.trim() || undefined,
    vatMode: !hasVat ? "none" : x.pricesIncludeVat ? "included" : "excluded",
    whtRate: WHT_RATES.includes(x.whtRate) ? x.whtRate : 0,
    category: guessCategory(x, ctx.categories),
    projectId: project?.id,
    discount: pos(x.discount),
    discountType: "amount",
    lines: lines.length ? lines : [{ name: x.vendorName.trim() || "ค่าใช้จ่าย", qty: 1, price: total, unit: "", discount: 0, discountType: "percent" }],
  };
}

// ---------- supplier quotation → RFQ prices ----------

export function quotePrices(prLines: { description: string }[], x: QuoteX, ctx: { today: string; matched?: number[] }) {
  const found = x.lines.map(cleanLine);
  const matched = ctx.matched ?? matchLines(prLines.map((l) => l.description), found.map((l) => l.description));
  const excl = x.pricesIncludeVat ? 100 / 107 : 1;
  const prices = matched.map((f) => (f >= 0 ? r2(found[f].unitPrice * excl) : 0));
  const date = normDate(x.date) || ctx.today;
  const valid = normDate(x.validUntil) || (pos(x.validDays) ? addDays(date, x.validDays) : addDays(ctx.today, 30));
  return { prices, matched, found, leadDays: Math.round(pos(x.leadDays)) || 7, validUntil: valid, convertedFromVat: x.pricesIncludeVat };
}

// ---------- delivery note → goods receipt quantities ----------

export function deliveryQty(poLines: { description: string }[], remain: number[], x: Pick<InvoiceX, "lines">, matched?: number[]) {
  const found = x.lines.map(cleanLine);
  const map = matched ?? matchLines(poLines.map((l) => l.description), found.map((l) => l.description));
  const want = map.map((f) => (f >= 0 ? found[f].qty : 0));
  const qty = want.map((q, i) => Math.min(q, remain[i] ?? 0));
  const over = want.map((q, i) => (q > (remain[i] ?? 0) ? r2(q - (remain[i] ?? 0)) : 0));
  const used = new Set(map.filter((f) => f >= 0));
  return { qty, want, over, matched: map, found, extra: found.map((_, j) => j).filter((j) => !used.has(j)) };
}

// ---------- tender documents ----------

export type TenderPatch = {
  title?: string;
  client?: string;
  province?: string;
  source?: TenderSource;
  method?: TenderMethod;
  egpNo?: string;
  budget?: number;
  medianPrice?: number;
  announced?: string;
  siteVisit?: string;
  questionsDue?: string;
  submitDue?: string;
  openDate?: string;
  bidBondAmount?: number;
  torNote?: string;
};

export function torNoteOf(x: Pick<TenderX, "summary" | "qualifications" | "risks" | "durationDays" | "penaltyRatePct" | "warrantyMonths">): string {
  const parts: string[] = [];
  if (x.summary.trim()) parts.push(x.summary.trim());
  const terms = [pos(x.durationDays) && `ระยะเวลาก่อสร้าง ${x.durationDays} วัน`, pos(x.penaltyRatePct) && `ค่าปรับ ${x.penaltyRatePct}% ต่อวัน`, pos(x.warrantyMonths) && `รับประกัน ${x.warrantyMonths} เดือน`].filter(Boolean);
  if (terms.length) parts.push(terms.join(" · "));
  if (x.qualifications.length) parts.push(["คุณสมบัติผู้เสนอราคา", ...x.qualifications.map((q) => `- ${q.trim()}`)].join("\n"));
  if (x.risks.length) parts.push(["ข้อควรระวัง / ค่าปรับ", ...x.risks.map((q) => `- ${q.trim()}`)].join("\n"));
  return parts.join("\n\n");
}

export function tenderPatch(x: TenderX): TenderPatch {
  const p: TenderPatch = {};
  const s = (v: string) => v.trim() || undefined;
  p.title = s(x.title);
  p.client = s(x.client);
  p.province = s(x.province.replace(/^จังหวัด/, ""));
  p.source = x.source === "egp" || x.source === "private" ? x.source : undefined;
  p.method = ["e-bidding", "selection", "specific", "invitation"].includes(x.method) ? x.method : undefined;
  p.egpNo = s(x.egpNo);
  p.budget = pos(x.budget) || undefined;
  p.medianPrice = pos(x.medianPrice) || undefined;
  for (const k of ["announced", "siteVisit", "questionsDue", "submitDue", "openDate"] as const) p[k] = normDate(x[k]) || undefined;
  const bondBase = p.medianPrice ?? p.budget ?? 0;
  p.bidBondAmount = pos(x.bidBondAmount) || (pos(x.bidBondPct) && bondBase ? Math.round((bondBase * x.bidBondPct) / 100) : undefined);
  p.torNote = torNoteOf(x) || undefined;
  for (const k of Object.keys(p) as (keyof TenderPatch)[]) if (p[k] === undefined) delete p[k];
  return p;
}

export function boqLines(x: Pick<TenderX, "boq">, startId = 1): BoqLine[] {
  let n = startId;
  let group = "งานทั่วไป";
  return x.boq
    .filter((l) => l.description.trim())
    .map((l) => {
      group = l.group.trim() || group;
      const material = pos(l.material);
      const labour = pos(l.labour);
      return { id: `L${n++}`, group, description: l.description.trim(), qty: pos(l.qty) || 1, unit: l.unit.trim() || "งาน", material: material || labour ? material : pos(l.unitPrice), labour };
    });
}
