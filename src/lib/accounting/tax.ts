// Ported from ZettaFlow (src/lib/tax.ts + Line helpers from src/lib/catalog.ts).
// Thai expense tax math: VAT (included / excluded / none) and withholding tax on the pre-VAT amount.
// Pure: no React, no "@/" imports.
import { r2, VAT_RATE } from "./money";

export const vatModes = { excluded: "ยังไม่รวม VAT", included: "รวม VAT แล้ว", none: "ไม่มี VAT" } as const;
export type VatMode = keyof typeof vatModes;
export const whtRates = [0, 1, 2, 3, 5] as const;
/** Only a full tax invoice lets the buyer claim input VAT; on anything else the VAT is part of the cost. */
export const FULL_TAX_INVOICE = "ใบกำกับภาษีเต็มรูป";
export const docTypes = ["ใบกำกับภาษีเต็มรูป", "ใบกำกับภาษีอย่างย่อ", "ใบเสร็จ", "ใบแจ้งหนี้", "บิลเงินสด/ใบรับรองแทนใบเสร็จ"] as const;
export const payStatuses = ["โอนแล้ว", "เงินสดย่อย", "เงินสด", "ยังไม่จ่าย"] as const;
export type PayStatus = (typeof payStatuses)[number];

export type Line = {
  name: string;
  qty: number;
  price: number;
  unit?: string;
  discount?: number;
  discountType?: "percent" | "amount";
};
/** qty × price less the row's discount (a percentage or a baht amount), never below zero. */
export const lineAmount = (l: Line) => {
  const gross = (Number(l.qty) || 0) * (Number(l.price) || 0),
    off = l.discountType === "percent" ? (gross * (Number(l.discount) || 0)) / 100 : Number(l.discount) || 0;
  return Math.max(0, r2(gross - off));
};

/** amount = the figure printed on the document; returns base, VAT, WHT, what is paid out, claimable VAT and the booked cost. */
export function computeExpense(amount: number, vatMode: VatMode = "none", whtRate = 0, docType: string = FULL_TAX_INVOICE) {
  const a = Math.max(0, Number(amount) || 0);
  const base = vatMode === "included" ? r2(a / (1 + VAT_RATE)) : r2(a);
  const vat = vatMode === "none" ? 0 : vatMode === "included" ? r2(a - base) : r2(a * VAT_RATE);
  const gross = r2(base + vat);
  const wht = r2((base * (Number(whtRate) || 0)) / 100);
  const claimable = docType === FULL_TAX_INVOICE ? vat : 0;
  return { base, vat, gross, wht, net: r2(gross - wht), claimable, cost: r2(gross - claimable) };
}

/** Sum of an item list as printed (same VAT basis as the document amount). */
export const linesTotal = (lines: Line[] | undefined) => r2((lines || []).reduce((s, l) => s + lineAmount(l), 0));

/** True when the item list does not add up to the document amount (shown as a red warning). */
export const linesMismatch = (lines: Line[] | undefined, amount: number) => !!lines?.length && Math.abs(linesTotal(lines) - (Number(amount) || 0)) > 0.01;

/** Document amount after a document-level discount (baht or %). */
export function afterDiscount(subtotal: number, discount = 0, discountType: "amount" | "percent" = "amount") {
  const off = discountType === "percent" ? (subtotal * (Number(discount) || 0)) / 100 : Number(discount) || 0;
  return { off: r2(off), after: Math.max(0, r2(subtotal - off)) };
}

const digitsOf = (taxId: string | undefined) => String(taxId || "").replace(/\D/g, "");
/** A 13-digit Thai juristic-person tax id starts with 0 (individuals' national ids start with 1–8). */
export const isJuristic = (taxId: string | undefined) => /^0\d{12}$/.test(digitsOf(taxId));
/** Juristic payees are filed on ภ.ง.ด.53, individuals on ภ.ง.ด.3. */
export const whtForm = (taxId: string | undefined, rate: number) => (!rate ? "" : isJuristic(taxId) ? "ภ.ง.ด.53" : "ภ.ง.ด.3");

/** Checksum of a 13-digit Thai tax id / national id (mod 11). */
export function validTaxId(taxId: string | undefined) {
  const d = digitsOf(taxId);
  if (!/^\d{13}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d[i]) * (13 - i);
  return (11 - (s % 11)) % 10 === Number(d[12]);
}

/** Expense-like record as stored (see Expense in journal.ts) */
type ExpenseLike = { amount: number; vatMode?: VatMode; whtRate?: number; docType?: string; date: string; projectId?: string; status?: string };
export const expenseCalc = (d: ExpenseLike) => computeExpense(Number(d.amount), d.vatMode || "none", Number(d.whtRate) || 0, String(d.docType || ""));

/** Summary for one month: spend, input VAT claimable, WHT to remit; all-time spend per project. */
export function expenseSummary(rows: ExpenseLike[], month: string) {
  let total = 0,
    vat = 0,
    wht = 0;
  const byProject: Record<string, number> = {};
  for (const d of rows) {
    if (d.status === "void") continue;
    const c = expenseCalc(d);
    if (d.projectId) byProject[d.projectId] = r2((byProject[d.projectId] || 0) + c.gross);
    if (!d.date.startsWith(month)) continue;
    total += c.gross;
    vat += c.claimable;
    wht += c.wht;
  }
  return { total: r2(total), vat: r2(vat), wht: r2(wht), byProject };
}

/** Split a VAT-exclusive base into VAT and total (output VAT on a sale). */
export const vatOn = (base: number) => r2(base * VAT_RATE);
