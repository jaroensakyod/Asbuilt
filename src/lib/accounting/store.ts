"use client";
// Accounting collections and the live books hook. This is the module's data file
// (import it from src/lib/modules.ts so the collections register before a company loads).

import { useEffect, useMemo } from "react";
import { createCollection } from "@/lib/collection";
import { budgets, installments, paymentCerts, payrollRuns, supplierBills, type Installment } from "@/lib/biz";
import { billableInstallments, contractBillingItems } from "@/lib/contracts/billing";
import { contractTerms } from "@/lib/contracts/settings";
import type { CertX } from "@/lib/contracts/types";
import { projects as seedProjects, TODAY } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useMe } from "@/lib/use-me";
import { canApprove, canEdit } from "@/lib/permissions";
import { DEFAULT_ACCOUNTS, type Account } from "./coa";
import { assignNumbers, buildBooks, closingEntry, type BooksInput } from "./journal";
import { BOOKS_START, addMonths, periodOf } from "./money";
import { SEED_ASSETS, SEED_EXPENSES, SEED_MANUAL } from "./seed";
import type { ApPayment, ArDoc, BankMatch, BillingItem, BankStatement, Expense, FixedAsset, JvNumber, ManualJournal, PeriodLock, ProjectRef, TaxFiling, WhtCertificate } from "./types";

export const accountsCol = createCollection<Account>("accounts", DEFAULT_ACCOUNTS);
export const manualCol = createCollection<ManualJournal>("journals_manual", SEED_MANUAL);
export const expensesCol = createCollection<Expense>("acc_expenses", SEED_EXPENSES);
export const assetsCol = createCollection<FixedAsset>("acc_fixed_assets", SEED_ASSETS);
export const arDocsCol = createCollection<ArDoc>("acc_ar_docs", []);
export const apPaymentsCol = createCollection<ApPayment>("acc_ap_payments", []);
export const filingsCol = createCollection<TaxFiling>("acc_tax_filings", []);
export const locksCol = createCollection<PeriodLock>("acc_periods", []);
export const registerCol = createCollection<JvNumber>("acc_jv_register", []);
export const certsCol = createCollection<WhtCertificate>("acc_wht_certs", []);
export const bankMatchCol = createCollection<BankMatch>("acc_bank_matches", []);
export const statementsCol = createCollection<BankStatement>("acc_bank_statements", []);

export const ACC_TODAY = TODAY;

export function useProjectRefs(): ProjectRef[] {
  const local = useLocalProjects();
  return useMemo(() => [...local, ...seedProjects].map((p) => ({ id: p.id, name: p.name, owner: p.owner, address: p.address })), [local]);
}

export function useAccess() {
  const me = useMe();
  return { me, edit: canEdit(me.role, "accounting"), approve: canApprove(me.role, "accounting") };
}

/** All accounting inputs, the derived books, and JV numbering kept up to date in the background. */
export function useBooks() {
  const accounts = accountsCol.use();
  const manual = manualCol.use();
  const expenses = expensesCol.use();
  const assets = assetsCol.use();
  const arDocs = arDocsCol.use();
  const apPayments = apPaymentsCol.use();
  const filings = filingsCol.use();
  const locks = locksCol.use();
  const register = registerCol.use();
  const salesInst = installments.use();
  const certs = paymentCerts.use();
  const terms = contractTerms.use();
  const budgetList = budgets.use();
  const bills = supplierBills.use();
  const payroll = payrollRuns.use();
  const projects = useProjectRefs();
  const { edit } = useAccess();
  const inst = useMemo(() => billingItemsOf(salesInst, terms, certs as CertX[], budgetList), [salesInst, terms, certs, budgetList]);

  const input: BooksInput = useMemo(
    () => ({ today: ACC_TODAY, accounts, projects, installments: inst, arDocs, bills, apPayments, payroll, expenses, assets, manual, filings, locks, register }),
    [accounts, projects, inst, arDocs, bills, apPayments, payroll, expenses, assets, manual, filings, locks, register],
  );
  const books = useMemo(() => buildBooks(input), [input]);

  // give every new entry its permanent JV number (sequential per year, never reused)
  useEffect(() => {
    if (!edit) return;
    const add = assignNumbers(books.entries, register);
    if (add.length) registerCol.upsertMany(add);
  }, [books, register, edit]);

  const projectName = (id?: string) => (id ? (projects.find((p) => p.id === id)?.name ?? id) : "");
  return { input, books, ...books, accounts, projects, projectName, locks, register };
}

// ---------- billing items ----------

/**
 * What the AR engine bills: sales installments (milestone installments of projects billed by measured progress are
 * replaced by their certificates) plus contract items — the advance, certified progress certificates, retention release.
 */
export function billingItemsOf(list: Installment[], terms: ReturnType<typeof contractTerms.all>, certs: CertX[], budgetList: ReturnType<typeof budgets.all>): BillingItem[] {
  const value = (projectId: string) => budgetList.find((b) => b.projectId === projectId)?.contractValue ?? Math.round((seedProjects.find((p) => p.id === projectId)?.value ?? 0) * 1e6);
  return [...billableInstallments(list, terms), ...contractBillingItems(terms, certs, value)];
}

/** Record that a billing item was settled (or partly settled) on its source record. */
export function settleBillingItem(item: BillingItem, patch: { status?: Installment["status"]; receiptNo?: string; paidDate?: string; invoiceNo?: string }) {
  const paid = patch.status === "paid";
  if (item.origin === "ipc") {
    const c = paymentCerts.get(item.id) as CertX | undefined;
    if (c) paymentCerts.upsert({ ...c, invoiceNo: c.invoiceNo ?? patch.invoiceNo, ...(paid ? { status: "paid" as const, paidDate: patch.paidDate, receiptNo: patch.receiptNo } : {}) } as CertX);
    return;
  }
  if (item.origin === "advance" || item.origin === "retention") {
    const t = contractTerms.all().find((x) => x.projectId === item.projectId);
    if (!t || !paid) return;
    if (item.origin === "advance") contractTerms.upsert({ ...t, advancePaidDate: patch.paidDate });
    else if (t.retentionRelease) contractTerms.upsert({ ...t, retentionRelease: { ...t.retentionRelease, paidDate: patch.paidDate } });
    return;
  }
  // sales installments are passed through unchanged, so the item is the installment record itself
  installments.upsert({ ...(item as Installment), ...patch });
}

// ---------- period lock ----------

export const isLockedDate = (date: string, locks: PeriodLock[]) => locks.some((l) => l.id === periodOf(date));
export const LOCKED_MSG = "งวดนี้ปิดบัญชีแล้ว แก้ไขเอกสารที่ลงวันที่ในงวดนี้ไม่ได้";

/** Next month that may be closed: months are closed in order from the start of the books. */
export function nextClosable(locks: PeriodLock[]) {
  let p = periodOf(BOOKS_START);
  while (locks.some((l) => l.id === p)) p = addMonths(p, 1);
  return p;
}

export function closePeriod(period: string, input: BooksInput, by: string) {
  const books = buildBooks(input);
  let entries = books.entries.filter((e) => e.period === period);
  if (period.endsWith("-12")) {
    const c = closingEntry(books.entries, Number(period.slice(0, 4)));
    if (c) entries = [...entries, c];
  }
  const add = assignNumbers(entries, input.register);
  if (add.length) registerCol.upsertMany(add);
  const ids = new Map([...input.register, ...add].map((r) => [r.key, r.id]));
  locksCol.upsert({ id: period, closedAt: new Date().toISOString(), closedBy: by, entries: entries.map((e) => ({ ...e, id: e.id || ids.get(e.key) || "" })) });
}
export function reopenPeriod(period: string) {
  locksCol.remove(period);
}
