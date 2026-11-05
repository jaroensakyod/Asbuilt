// Amount checks on what the AI read: lines add up, subtotal − discount + VAT = total, VAT is 7 %,
// and a bill agrees with its PO / goods receipt. Everything returns Thai messages for the review form.

import type { Issue, XLine } from "./types";
import { matchLines } from "./match";

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

export type Totals = { base: number; vat: number; total: number };

/** split a VAT-inclusive amount, or add VAT to an exclusive one */
export function vatSplit(amount: number, rate: number, included: boolean): Totals {
  if (!rate) return { base: r2(amount), vat: 0, total: r2(amount) };
  if (included) {
    const base = r2((amount * 100) / (100 + rate));
    return { base, vat: r2(amount - base), total: r2(amount) };
  }
  const vat = r2((amount * rate) / 100);
  return { base: r2(amount), vat, total: r2(amount + vat) };
}

export const linesSum = (lines: Pick<XLine, "qty" | "unitPrice" | "amount">[]) => r2(lines.reduce((t, l) => t + (l.amount || l.qty * l.unitPrice), 0));

export type AmountInput = {
  lines: XLine[];
  subtotal: number;
  discount: number;
  vatRate: number;
  vat: number;
  total: number;
  pricesIncludeVat: boolean;
  whtRate?: number;
  whtAmount?: number;
};

/**
 * Consistency checks with a tolerance (baht) for rounding. A document can be internally
 * inconsistent because the AI misread a digit, so every failed check is shown to the user.
 */
export function checkAmounts(x: AmountInput, tol = 1): Issue[] {
  const out: Issue[] = [];
  x.lines.forEach((l, i) => {
    if (l.qty && l.unitPrice && l.amount && !near(r2(l.qty * l.unitPrice), l.amount, Math.max(tol, l.amount * 0.001)))
      out.push({ field: `lines.${i}`, tone: "warn", msg: `บรรทัด ${i + 1}: ${l.qty} × ${fmt(l.unitPrice)} = ${fmt(r2(l.qty * l.unitPrice))} ไม่ตรงกับ ${fmt(l.amount)}` });
  });
  const sum = linesSum(x.lines);
  if (x.lines.length && x.subtotal && !near(sum, x.subtotal, tol)) out.push({ field: "subtotal", tone: "warn", msg: `รวมรายการ ${fmt(sum)} ไม่ตรงกับยอดรวม ${fmt(x.subtotal)} ในเอกสาร` });
  const gross = r2((x.subtotal || sum) - (x.discount || 0));
  if (x.total) {
    const expect = x.pricesIncludeVat ? gross : r2(gross + (x.vat || 0));
    if (!near(expect, x.total, tol)) out.push({ field: "total", tone: "neg", msg: `ยอดก่อน VAT − ส่วนลด + VAT = ${fmt(expect)} ไม่ตรงกับยอดรวมทั้งสิ้น ${fmt(x.total)}` });
  }
  if (x.vat && x.vatRate) {
    const base = x.pricesIncludeVat ? r2(gross - x.vat) : gross;
    const expectVat = r2((base * x.vatRate) / 100);
    if (!near(expectVat, x.vat, Math.max(tol, 0.02 * x.vatRate))) out.push({ field: "vat", tone: "warn", msg: `VAT ${x.vatRate}% ของ ${fmt(base)} ควรเป็น ${fmt(expectVat)} แต่เอกสารระบุ ${fmt(x.vat)}` });
  }
  if (x.vat && !x.vatRate) out.push({ field: "vatRate", tone: "warn", msg: "เอกสารมี VAT แต่ไม่ระบุอัตรา ใช้ 7%" });
  if (x.whtAmount && x.whtRate) {
    const base = x.pricesIncludeVat ? r2(gross - (x.vat || 0)) : gross;
    const expect = r2((base * x.whtRate) / 100);
    if (!near(expect, x.whtAmount, tol)) out.push({ field: "whtAmount", tone: "warn", msg: `หัก ณ ที่จ่าย ${x.whtRate}% ควรเป็น ${fmt(expect)} แต่เอกสารระบุ ${fmt(x.whtAmount)}` });
  }
  return out;
}

/** base (excl. VAT, after discount) and VAT the bill should carry */
export function billAmounts(x: AmountInput): { subtotal: number; vat: number; total: number } {
  const sum = linesSum(x.lines);
  const gross = r2((x.subtotal || sum) - (x.discount || 0));
  const rate = x.vatRate || (x.vat ? 7 : 0);
  if (x.pricesIncludeVat) {
    const vat = x.vat || vatSplit(gross, rate, true).vat;
    return { subtotal: r2(gross - vat), vat: r2(vat), total: gross };
  }
  const vat = x.vat || vatSplit(gross, rate, false).vat;
  return { subtotal: gross, vat: r2(vat), total: r2(gross + vat) };
}

export type RefLine = { description: string; qty: number; unit: string; unitPrice: number };
export type LineDiff = {
  ref: number; // index into reference (PO) lines
  found: number; // index into bill lines, -1 = not on the bill
  qtyRef: number;
  qty: number;
  priceRef: number;
  price: number;
  issue?: string;
};

/**
 * Compare bill lines with the PO (or the goods receipt quantities). `refQty` overrides the PO
 * quantities, e.g. with what was actually received.
 */
export function compareWithPO(ref: RefLine[], bill: Pick<XLine, "description" | "qty" | "unitPrice">[], opts: { refQty?: number[]; priceTolPct?: number; matched?: number[] } = {}) {
  const tolPct = opts.priceTolPct ?? 0.5;
  const map = opts.matched ?? matchLines(ref.map((l) => l.description), bill.map((l) => l.description));
  const lines: LineDiff[] = ref.map((l, i) => {
    const f = map[i];
    const qtyRef = opts.refQty?.[i] ?? l.qty;
    if (f < 0) return { ref: i, found: -1, qtyRef, qty: 0, priceRef: l.unitPrice, price: 0, issue: qtyRef > 0 ? "ไม่พบในบิล" : undefined };
    const b = bill[f];
    const issues: string[] = [];
    if (Math.abs(b.qty - qtyRef) > 1e-6) issues.push(b.qty > qtyRef ? `จำนวนเกิน ${r2(b.qty - qtyRef)} ${l.unit}` : `จำนวนขาด ${r2(qtyRef - b.qty)} ${l.unit}`);
    if (l.unitPrice && Math.abs(b.unitPrice - l.unitPrice) > (l.unitPrice * tolPct) / 100) issues.push(b.unitPrice > l.unitPrice ? `ราคาสูงกว่า PO ${fmt(r2(b.unitPrice - l.unitPrice))}/หน่วย` : `ราคาต่ำกว่า PO ${fmt(r2(l.unitPrice - b.unitPrice))}/หน่วย`);
    return { ref: i, found: f, qtyRef, qty: b.qty, priceRef: l.unitPrice, price: b.unitPrice, issue: issues.join(" · ") || undefined };
  });
  const usedSet = new Set(map.filter((x) => x >= 0));
  const extra = bill.map((_, j) => j).filter((j) => !usedSet.has(j));
  const refTotal = r2(ref.reduce((t, l, i) => t + (opts.refQty?.[i] ?? l.qty) * l.unitPrice, 0));
  const billTotal = r2(bill.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  return { lines, extra, refTotal, billTotal, diff: r2(billTotal - refTotal), ok: lines.every((l) => !l.issue) && !extra.length && near(billTotal, refTotal, 1) };
}
