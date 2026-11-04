"use client";
// Accounting collections and the live books hook. This is the module's data file
// (import it from src/lib/modules.ts so the collections register before a company loads).

import { useEffect, useMemo } from "react";
import { createCollection } from "@/lib/collection";
import { installments, payrollRuns, supplierBills } from "@/lib/biz";
import { projects as seedProjects, TODAY } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useMe } from "@/lib/use-me";
import { canApprove, canEdit } from "@/lib/permissions";
import { DEFAULT_ACCOUNTS, type Account } from "./coa";
import { assignNumbers, buildBooks, closingEntry, type BooksInput } from "./journal";
import { BOOKS_START, addMonths, periodOf } from "./money";
import { SEED_ASSETS, SEED_EXPENSES, SEED_MANUAL } from "./seed";
import type { ApPayment, ArDoc, BankMatch, BankStatement, Expense, FixedAsset, JvNumber, ManualJournal, PeriodLock, ProjectRef, TaxFiling, WhtCertificate } from "./types";

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
  const inst = installments.use();
  const bills = supplierBills.use();
  const payroll = payrollRuns.use();
  const projects = useProjectRefs();
  const { edit } = useAccess();

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
