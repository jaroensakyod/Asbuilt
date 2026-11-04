// Ported from ZettaFlow (src/lib/ledger.ts): double-entry rules for one expense document,
// shared by the journal engine and the live journal preview on the expense form.
//   Dr expense (cost = gross − claimable VAT)   Dr 1154 input VAT (full tax invoice only)
//   Cr 1112 bank / 1113 petty cash / 1111 cash / 2111 AP (net of WHT)   Cr 2132 WHT payable
import { A, type Account } from "./coa";
import { categoryAccount } from "./categories";
import { expenseCalc, whtForm } from "./tax";
import { satang } from "./money";
import type { Expense, JournalLine, WhtFormName } from "./types";

export const PAID_FROM: Record<string, string> = { โอนแล้ว: A.bank, เงินสดย่อย: A.petty, เงินสด: A.cash, ยังไม่จ่าย: A.ap };

/** Income type printed on 50 ทวิ / ภ.ง.ด. for a withholding rate (ท.ป.4/2528). */
export const incomeTypeForRate = (rate: number) =>
  rate === 5 ? "ค่าเช่า" : rate === 1 ? "ค่าขนส่ง/เบี้ยประกันวินาศภัย" : rate === 2 ? "ค่าโฆษณา" : rate === 3 ? "ค่าจ้างทำของ/ค่าบริการ" : "อื่น ๆ";

/**
 * The expense account: the chosen chart code (if active in the chart), else the category default
 * (51xx of the cost code for site categories), else 5900 ค่าใช้จ่ายอื่น.
 */
export function expenseAccount(d: Pick<Expense, "accountCode" | "category" | "costCode">, accounts: Account[]) {
  const has = (code: string | undefined) => !!code && accounts.some((a) => a.code === code && a.active && !a.header);
  if (has(d.accountCode)) return d.accountCode!;
  const mapped = categoryAccount(d.category, d.costCode);
  return has(mapped) ? mapped! : A.otherExpense;
}

/** Double entry for one expense document. Debits always equal credits (amounts are already rounded to satang). */
export function buildExpenseJournal(d: Expense, accounts: Account[]) {
  const c = expenseCalc(d);
  const tag = { projectId: d.projectId || undefined, costCode: d.costCode || undefined };
  const lines: JournalLine[] = [
    { account: expenseAccount(d, accounts), debit: c.cost, credit: 0, ...tag },
    { account: A.inputVat, debit: c.claimable, credit: 0 },
    { account: PAID_FROM[d.payStatus] || A.ap, debit: 0, credit: c.net },
    { account: A.whtPayable, debit: 0, credit: c.wht },
  ].filter((l) => l.debit > 0 || l.credit > 0);
  const debit = lines.reduce((s, l) => s + satang(l.debit), 0),
    credit = lines.reduce((s, l) => s + satang(l.credit), 0);
  const rate = Number(d.whtRate) || 0;
  return {
    calc: c,
    lines,
    balanced: debit === credit && debit > 0,
    wht: rate && c.wht > 0
      ? { form: (whtForm(d.payeeTaxId, rate) as WhtFormName), payee: d.payee, taxId: d.payeeTaxId, base: c.base, rate, amount: c.wht, incomeType: incomeTypeForRate(rate) }
      : null,
  };
}
