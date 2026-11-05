// Contract billing items for the AR engine: progress certificates, the advance and retention release are
// shaped like installments so accounting posts them with the same invoice / receipt machinery.
// Projects billed by measured progress drop the sales module's milestone installments (INS-PAY-…).
// Pure: no React, no "@/" imports.
import type { Installment } from "../biz";
import { collectedVat } from "../accounting/journal";
import { r2, sum } from "../accounting/money";
import type { ArInvoice, BillingItem } from "../accounting/types";
import { addDaysIso } from "./calc";
import type { CertX, ContractTerms } from "./types";

export const termsOf = (terms: ContractTerms[], projectId: string) => terms.find((t) => t.projectId === projectId);
export const isMeasured = (terms: ContractTerms[], projectId: string) => termsOf(terms, projectId)?.billing === "measured";

/** Sales installments that are billed as they are (milestone installments of measured projects are replaced by certificates). */
export function billableInstallments(list: Installment[], terms: ContractTerms[]): Installment[] {
  const measured = new Set(terms.filter((t) => t.billing === "measured").map((t) => t.projectId));
  if (!measured.size) return list;
  return list.filter((i) => !(measured.has(i.projectId) && (i.id.startsWith("INS-PAY-") || i.id.startsWith("INS-VO-"))));
}

const isClientCert = (c: CertX) => c.side === "client" && (c.status === "certified" || c.status === "paid");
export const certBase = (c: Pick<CertX, "thisPeriod" | "advanceRecovery" | "backCharges">) => r2(c.thisPeriod - c.advanceRecovery - (c.backCharges || 0));
/** The AR invoice shape of a certificate (used to split VAT on retention the same way the journal does). */
const invShape = (c: CertX) => ({ amount: certBase(c), vat: c.vat, retention: c.retention }) as ArInvoice;

export function certItem(c: CertX, t?: ContractTerms): BillingItem {
  const base = certBase(c);
  return {
    id: c.id,
    projectId: c.projectId,
    no: c.no,
    title: `เบิกเงินตามผลงานงวดที่ ${c.no} (ผลงานถึง ${c.periodTo})`,
    milestone: "IPC",
    percent: c.pctToDate ?? 0,
    amount: base,
    vat: r2(c.vat),
    invoiceDate: c.date,
    dueDate: c.dueDate ?? addDaysIso(c.date, t?.certPayDays ?? 30),
    status: c.status === "paid" ? "paid" : "invoiced",
    invoiceNo: c.invoiceNo,
    receiptNo: c.receiptNo,
    paidDate: c.status === "paid" ? (c.paidDate ?? c.date) : undefined,
    origin: "ipc",
    retention: r2(c.retention),
    advanceRecovery: r2(c.advanceRecovery),
    wht: r2(c.wht),
    customerName: t?.customerName,
    customerTaxId: t?.customerTaxId,
    customerBranch: t?.customerBranch,
    customerAddress: t?.customerAddress,
  };
}

export const advanceAmount = (t: ContractTerms, contractValue: number) => r2((contractValue * (t.advancePct || 0)) / 100);

export function advanceItem(t: ContractTerms, contractValue: number, vatRate = 7): BillingItem | undefined {
  const amount = advanceAmount(t, contractValue);
  if (!(amount > 0) || !t.advanceDate) return undefined;
  const wht = r2((amount * (t.whtRate || 0)) / 100);
  return {
    id: `ADV-${t.projectId}`,
    projectId: t.projectId,
    no: 0,
    title: `เงินล่วงหน้าค่าก่อสร้าง ${t.advancePct}%`,
    milestone: "เงินล่วงหน้า",
    percent: t.advancePct,
    amount,
    vat: r2((amount * vatRate) / 100),
    invoiceDate: t.advanceDate,
    dueDate: addDaysIso(t.advanceDate, 15),
    status: t.advancePaidDate ? "paid" : "invoiced",
    invoiceNo: t.advanceInvoiceNo,
    paidDate: t.advancePaidDate,
    origin: "advance",
    wht,
    customerName: t.customerName,
    customerTaxId: t.customerTaxId,
    customerBranch: t.customerBranch,
    customerAddress: t.customerAddress,
  };
}

/** Retention withheld by the customer on certified certificates of a project. */
export const retentionHeld = (certs: CertX[], projectId: string) => sum(certs.filter((c) => c.projectId === projectId && isClientCert(c)).map((c) => c.retention));
/** Output VAT left deferred on that retention (moves to 2135 when the release is received). */
export const retentionReleaseVat = (certs: CertX[], projectId: string) =>
  sum(certs.filter((c) => c.projectId === projectId && isClientCert(c)).map((c) => r2(c.vat - collectedVat(invShape(c)))));

export function releaseItem(t: ContractTerms): BillingItem | undefined {
  const r = t.retentionRelease;
  if (!r || !(r.amount > 0)) return undefined;
  return {
    id: `RET-${t.projectId}`,
    projectId: t.projectId,
    no: 99,
    title: "คืนเงินประกันผลงานหลังพ้นระยะประกันความชำรุดบกพร่อง",
    milestone: "คืนเงินประกันผลงาน",
    percent: t.retentionPct,
    amount: r2(r.amount),
    vat: 0,
    invoiceDate: r.date,
    dueDate: addDaysIso(r.date, t.certPayDays || 30),
    status: r.paidDate ? "paid" : "invoiced",
    invoiceNo: r.invoiceNo,
    paidDate: r.paidDate,
    origin: "retention",
    releaseVat: r2(r.releaseVat),
    wht: r2((r.amount * (t.whtRate || 0)) / 100),
    customerName: t.customerName,
    customerTaxId: t.customerTaxId,
    customerBranch: t.customerBranch,
    customerAddress: t.customerAddress,
  };
}

/** Every contract billing item: advance, certified progress certificates and retention releases. */
export function contractBillingItems(terms: ContractTerms[], certs: CertX[], contractValue: (projectId: string) => number, vatRate = 7): BillingItem[] {
  const out: BillingItem[] = [];
  for (const t of terms) {
    if (t.billing !== "measured") continue;
    const adv = advanceItem(t, contractValue(t.projectId), vatRate);
    if (adv) out.push(adv);
    const rel = releaseItem(t);
    if (rel) out.push(rel);
  }
  for (const c of certs) if (isClientCert(c)) out.push(certItem(c, termsOf(terms, c.projectId)));
  return out;
}
