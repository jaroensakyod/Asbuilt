// Journal engine. Every entry is derived deterministically from source documents
// (installments, supplier bills, payroll runs, expenses, fixed assets, tax filings) plus manual journals,
// then closed periods are replaced by their frozen snapshot, then JV numbers are attached from the register.
// Every entry must balance; an unbalanced one is reported in `problems` and left out.
// Pure: no React, no "@/" imports (shared biz shapes are type-only imports).
import type { Installment, PayrollRun, SupplierBill } from "../biz";
import { A, type Account } from "./coa";
import { accumAccount, accumulatedAt, depreciationSchedule } from "./assets";
import { buildExpenseJournal, incomeTypeForRate } from "./ledger";
import { BOOKS_START, jvPrefix, monthEnd, periodOf, periodsBetween, r2, satang, sum } from "./money";
import { isJuristic, whtForm } from "./tax";
import type {
  ApPayment,
  ArDoc,
  ArInvoice,
  ArReceipt,
  Expense,
  FixedAsset,
  JournalEntry,
  JournalLine,
  JvNumber,
  ManualJournal,
  PeriodLock,
  ProjectRef,
  Source,
  TaxFiling,
  TaxMeta,
  WhtFormName,
  WhtMeta,
} from "./types";

export type BooksInput = {
  today: string;
  accounts: Account[];
  projects: ProjectRef[];
  installments: Installment[];
  arDocs: ArDoc[];
  bills: SupplierBill[];
  apPayments: ApPayment[];
  payroll: PayrollRun[];
  expenses: Expense[];
  assets: FixedAsset[];
  manual: ManualJournal[];
  filings: TaxFiling[];
  locks: PeriodLock[];
  register: JvNumber[];
};

export type Problem = { key: string; text: string };
export type Books = {
  entries: JournalEntry[];
  problems: Problem[];
  /** documents dated in a closed period that are not in its snapshot, or changed after closing */
  late: Problem[];
  closed: Set<string>;
};

// ---------- balance ----------

export const entryTotals = (lines: JournalLine[]) => ({
  debit: sum(lines.map((l) => l.debit)),
  credit: sum(lines.map((l) => l.credit)),
});
export function isBalanced(lines: JournalLine[]) {
  const d = lines.reduce((s, l) => s + satang(l.debit), 0),
    c = lines.reduce((s, l) => s + satang(l.credit), 0);
  return d === c && d > 0 && lines.every((l) => l.debit >= 0 && l.credit >= 0);
}
export function assertBalanced(e: Pick<JournalEntry, "key" | "lines">) {
  if (!isBalanced(e.lines)) {
    const t = entryTotals(e.lines);
    throw new Error(`รายการ ${e.key} ไม่สมดุล: เดบิต ${t.debit} เครดิต ${t.credit}`);
  }
}

/** Drop zero lines, round to satang, merge same account/project/cost-code lines on the same side. */
function tidy(lines: JournalLine[]): JournalLine[] {
  const out: JournalLine[] = [];
  for (const l of lines) {
    const debit = r2(l.debit),
      credit = r2(l.credit);
    if (!debit && !credit) continue;
    const same = out.find((o) => o.account === l.account && o.projectId === l.projectId && o.costCode === l.costCode && !o.memo && !l.memo && (o.debit > 0) === (debit > 0));
    if (same) {
      same.debit = r2(same.debit + debit);
      same.credit = r2(same.credit + credit);
    } else out.push({ ...l, debit, credit });
  }
  return out;
}

const dr = (account: string, amount: number, tag: Partial<JournalLine> = {}): JournalLine => ({ account, debit: amount, credit: 0, ...tag });
const cr = (account: string, amount: number, tag: Partial<JournalLine> = {}): JournalLine => ({ account, debit: 0, credit: amount, ...tag });

function entry(source: Source, ref: string, date: string, memo: string, lines: JournalLine[], extra: Partial<JournalEntry> = {}): JournalEntry {
  return { id: "", key: `${source}:${ref}`, date, period: periodOf(date), source, ref, memo, lines: tidy(lines), posted: true, ...extra };
}

// ---------- AR: invoices and receipts per installment ----------

/** The tax invoice / invoice of an installment: issued here, or reconstructed when invoiced elsewhere. */
export function invoiceOf(inst: Installment, docs: ArDoc[], projects: ProjectRef[]): ArInvoice | undefined {
  const own = docs.find((d): d is ArInvoice => d.kind === "invoice" && d.installmentId === inst.id);
  if (own) return own;
  if (!(inst.invoiceNo || inst.receiptNo || inst.paidDate || inst.status === "invoiced" || inst.status === "paid")) return undefined;
  const p = projects.find((x) => x.id === inst.projectId);
  const date = inst.paidDate && inst.paidDate < inst.dueDate ? inst.paidDate : inst.dueDate;
  return {
    id: inst.invoiceNo || `(${inst.id})`,
    kind: "invoice",
    installmentId: inst.id,
    projectId: inst.projectId,
    date,
    dueDate: inst.dueDate,
    customerName: p?.owner ?? inst.projectId,
    customerAddress: p?.address,
    description: inst.title,
    amount: r2(inst.amount),
    vat: r2(inst.vat),
    retention: 0,
    taxPoint: "receipt",
    synthetic: true,
  };
}
export function receiptOf(inst: Installment, docs: ArDoc[], inv: ArInvoice | undefined): ArReceipt | undefined {
  const own = docs.find((d): d is ArReceipt => d.kind === "receipt" && d.installmentId === inst.id);
  if (own) return own;
  if (!inv || !(inst.status === "paid" || inst.receiptNo || inst.paidDate)) return undefined;
  const due = r2(inv.amount + inv.vat - inv.retention);
  return {
    id: inst.receiptNo || `(${inst.id}-RC)`,
    kind: "receipt",
    installmentId: inst.id,
    projectId: inst.projectId,
    invoiceNo: inv.id,
    date: inst.paidDate ?? inv.date,
    account: A.bank,
    whtRate: 0,
    wht: 0,
    received: due,
    synthetic: true,
  };
}
/** VAT on the part of the invoice actually collected now (retention VAT stays deferred until released). */
export const collectedVat = (inv: ArInvoice) => (inv.retention > 0 && inv.amount > 0 ? r2((inv.vat * (inv.amount - inv.retention)) / inv.amount) : inv.vat);

function arEntries(inst: Installment, inv: ArInvoice | undefined, rc: ArReceipt | undefined, opening: JournalLine[]): JournalEntry[] {
  if (!inv) return [];
  const out: JournalEntry[] = [];
  const tag = { projectId: inst.projectId };
  const total = r2(inv.amount + inv.vat);
  const arAmt = r2(total - inv.retention);
  const vatAcct = inv.taxPoint === "invoice" ? A.outputVat : A.outputVatDeferred;
  const party = { party: inv.customerName, taxId: inv.customerTaxId, branch: inv.customerBranch };
  if (inv.date < BOOKS_START) {
    // invoiced before the books start: still open at the start → part of the opening balances
    if (!rc || rc.date >= BOOKS_START) {
      opening.push(dr(A.ar, arAmt, tag), dr(A.retention, inv.retention, tag));
      if (inv.taxPoint === "receipt") opening.push(cr(A.outputVatDeferred, inv.vat), cr(A.retained, r2(total - inv.vat)));
      else opening.push(cr(A.retained, total));
    }
  } else {
    out.push(
      entry("installment-invoice", inv.id, inv.date, `${inv.description} · ${inv.customerName}`, [dr(A.ar, arAmt, tag), dr(A.retention, inv.retention, tag), cr(A.revenue, inv.amount, tag), cr(vatAcct, inv.vat, tag)], {
        tax: inv.taxPoint === "invoice" && inv.vat > 0 ? [{ kind: "output", docNo: inv.id, date: inv.date, ...party, base: inv.amount, vat: inv.vat }] : undefined,
      }),
    );
  }
  if (rc && rc.date >= BOOKS_START) {
    const lines = [dr(rc.account || A.bank, rc.received), dr(A.whtPrepaid, rc.wht), cr(A.ar, r2(rc.received + rc.wht), tag)];
    let tax: TaxMeta[] | undefined;
    if (inv.taxPoint === "receipt" && inv.vat > 0) {
      const v = collectedVat(inv);
      lines.push(dr(A.outputVatDeferred, v, tag), cr(A.outputVat, v, tag));
      const base = r2(inv.amount - inv.retention);
      tax = [{ kind: "output", docNo: rc.id, date: rc.date, ...party, base, vat: v }];
    }
    out.push(
      entry("receipt", rc.id, rc.date, `รับชำระ ${inv.id} · ${inv.customerName}`, lines, {
        tax,
        whtSuffered: rc.wht > 0 ? [{ docNo: rc.id, date: rc.date, payer: inv.customerName, base: r2(inv.amount - inv.retention), amount: rc.wht }] : undefined,
      }),
    );
  }
  return out;
}

// ---------- AP: supplier bills and payments ----------

/** Services (anything we withhold tax on) get their input VAT when paid; goods when the tax invoice arrives. */
export const isServiceBill = (b: SupplierBill) => (Number(b.whtRate) || 0) > 0;
export const billTotal = (b: SupplierBill) => r2(b.subtotal + b.vat);
export const billWht = (b: SupplierBill) => r2((b.subtotal * (Number(b.whtRate) || 0)) / 100);
export const billDebitAccount = (b: SupplierBill) => (b.costCode ? `51${b.costCode}` : A.inventory);

export function paymentOf(b: SupplierBill, pays: ApPayment[]): ApPayment | undefined {
  const own = pays.find((p) => p.billId === b.id);
  if (own) return own;
  if (b.status !== "paid") return undefined;
  const wht = billWht(b);
  return { id: `(${b.id}-PV)`, billId: b.id, date: b.paidDate ?? b.dueDate, account: A.bank, whtRate: b.whtRate, wht, paid: r2(billTotal(b) - wht), synthetic: true };
}

const whtMeta = (key: string, form: WhtFormName, payee: string, taxId: string | undefined, base: number, rate: number, amount: number, incomeType: string, date: string, docNo: string): WhtMeta => ({
  key,
  form,
  payee,
  taxId,
  base,
  rate,
  amount,
  incomeType,
  date,
  docNo,
});

function apEntries(b: SupplierBill, pay: ApPayment | undefined, opening: JournalLine[]): JournalEntry[] {
  const out: JournalEntry[] = [];
  const service = isServiceBill(b);
  const total = billTotal(b);
  const tag = { projectId: b.projectId, costCode: b.costCode };
  const party = { party: b.supplierName, taxId: b.supplierTaxId };
  if (b.date < BOOKS_START) {
    if (!pay || pay.date >= BOOKS_START) {
      opening.push(cr(A.ap, total));
      if (service) opening.push(dr(A.inputVatDeferred, b.vat), dr(A.retained, b.subtotal));
      else opening.push(dr(A.retained, total));
    }
  } else {
    out.push(
      entry("supplier-bill", b.id, b.date, `${b.supplierName}${b.lines?.[0] ? " · " + b.lines[0].description : ""}`, [dr(billDebitAccount(b), b.subtotal, tag), dr(service ? A.inputVatDeferred : A.inputVat, b.vat), cr(A.ap, total)], {
        tax: !service && b.vat > 0 ? [{ kind: "input", docNo: b.id, date: b.date, ...party, base: b.subtotal, vat: b.vat }] : undefined,
      }),
    );
  }
  if (pay && pay.date >= BOOKS_START) {
    const lines = [dr(A.ap, total), cr(pay.account || A.bank, pay.paid), cr(A.whtPayable, pay.wht)];
    if (service && b.vat > 0) lines.push(dr(A.inputVat, b.vat), cr(A.inputVatDeferred, b.vat));
    const key = `bill-payment:${pay.id}`;
    out.push(
      entry("bill-payment", pay.id, pay.date, `จ่ายชำระ ${b.id} · ${b.supplierName}`, lines, {
        tax: service && b.vat > 0 ? [{ kind: "input", docNo: b.id, date: pay.date, ...party, base: b.subtotal, vat: b.vat }] : undefined,
        wht: pay.wht > 0 ? [whtMeta(key, whtForm(b.supplierTaxId, pay.whtRate || 3) as WhtFormName, b.supplierName, b.supplierTaxId, b.subtotal, pay.whtRate, pay.wht, incomeTypeForRate(pay.whtRate), pay.date, pay.id)] : undefined,
      }),
    );
  }
  return out;
}

// ---------- payroll ----------

/** Taxable pay of a payroll line: gross + OT when net is computed that way, else gross. */
export const payrollBase = (l: PayrollRun["lines"][number]) => (Math.abs(l.gross + l.ot - l.sso - l.wht - l.net) < 0.01 ? r2(l.gross + l.ot) : r2(l.gross));

function payrollEntries(run: PayrollRun): JournalEntry[] {
  if (run.status === "draft" || run.payDate < BOOKS_START || !run.lines.length) return [];
  const accrualDate = run.payDate < monthEnd(run.period) ? run.payDate : monthEnd(run.period);
  const lines: JournalLine[] = [];
  const ssoTotal = sum(run.lines.map((l) => l.sso));
  let ssoLeft = r2(run.employerSso || 0);
  run.lines.forEach((l, i) => {
    const site = !!l.projectId || run.kind === "daily";
    lines.push(dr(site ? A.siteLabour : A.salaries, r2(l.net + l.sso + l.wht), { projectId: l.projectId }));
    // employer SSO allocated by each line's employee contribution; last line takes the remainder
    const share = i === run.lines.length - 1 ? ssoLeft : ssoTotal ? r2(((run.employerSso || 0) * l.sso) / ssoTotal) : 0;
    ssoLeft = r2(ssoLeft - share);
    if (share) lines.push(dr(site ? A.siteLabourSso : A.officeSso, share, { projectId: l.projectId }));
  });
  const net = sum(run.lines.map((l) => l.net)),
    wht = sum(run.lines.map((l) => l.wht));
  lines.push(cr(A.salaryPayable, net), cr(A.ssoPayable, r2(ssoTotal + (run.employerSso || 0))), cr(A.whtPayable, wht));
  const key = `payroll:${run.id}`;
  const out = [
    entry("payroll", run.id, accrualDate, `${run.kind === "daily" ? "ค่าแรงรายวัน" : "เงินเดือน"} งวด ${run.period} · ${run.lines.length} คน`, lines, {
      wht: run.lines
        .filter((l) => l.wht > 0)
        .map((l) => whtMeta(`${key}:${l.employeeId}`, "ภ.ง.ด.1", l.name, undefined, payrollBase(l), 0, l.wht, "40(1) เงินเดือน ค่าจ้าง", run.payDate, run.id)),
    }),
  ];
  if (run.status === "paid") out.push(entry("payroll-payment", run.id, run.payDate, `จ่ายเงินเดือน/ค่าแรง ${run.id}`, [dr(A.salaryPayable, net), cr(A.bank, net)]));
  return out;
}

// ---------- expenses ----------

function expenseEntries(x: Expense, accounts: Account[]): JournalEntry[] {
  if (x.status === "void" || x.date < BOOKS_START) return [];
  const j = buildExpenseJournal(x, accounts);
  const key = `expense:${x.id}`;
  const out = [
    entry("expense", x.id, x.date, `${x.category} · ${x.payee}`, j.lines, {
      tax: j.calc.claimable > 0 ? [{ kind: "input", docNo: x.docNo || x.id, date: x.date, party: x.payee, taxId: x.payeeTaxId, branch: x.payeeBranch, base: j.calc.base, vat: j.calc.claimable }] : undefined,
      wht: j.wht ? [whtMeta(key, j.wht.form, j.wht.payee, j.wht.taxId, j.wht.base, j.wht.rate, j.wht.amount, j.wht.incomeType, x.date, x.docNo || x.id)] : undefined,
    }),
  ];
  if (x.payStatus === "ยังไม่จ่าย" && x.paidDate) out.push(entry("expense-payment", x.id, x.paidDate, `จ่ายค่าใช้จ่ายค้างจ่าย ${x.id} · ${x.payee}`, [dr(A.ap, j.calc.net), cr(x.paidAccount || A.bank, j.calc.net)]));
  return out;
}

// ---------- fixed assets ----------

function assetEntries(assets: FixedAsset[], today: string): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const a of assets) {
    if (a.paidFrom !== "opening" && a.startDate >= BOOKS_START) {
      const vat = r2(a.vat || 0);
      out.push(
        entry("asset", a.id, a.startDate, `ซื้อสินทรัพย์ ${a.name}`, [dr(a.account, a.cost), dr(A.inputVat, vat), cr(a.paidFrom, r2(a.cost + vat))], {
          tax: vat > 0 ? [{ kind: "input", docNo: a.serial || a.id, date: a.startDate, party: a.name, base: a.cost, vat }] : undefined,
        }),
      );
    }
    if (a.disposedDate && a.disposedDate >= BOOKS_START && a.disposedDate <= today) {
      const accum = accumulatedAt(a, periodOf(a.disposedDate));
      const proceeds = r2(a.proceeds || 0);
      const gain = r2(proceeds - (a.cost - accum));
      out.push(
        entry("asset-disposal", a.id, a.disposedDate, `จำหน่ายสินทรัพย์ ${a.name}`, [
          dr(A.bank, proceeds),
          dr(accumAccount(a.account), accum),
          cr(a.account, a.cost),
          gain > 0 ? cr(A.gainOnDisposal, gain) : dr(A.lossOnDisposal, -gain),
        ]),
      );
    }
  }
  // monthly depreciation, dated at month end, for every month that has ended
  const lastPeriod = monthEnd(periodOf(today)) <= today ? periodOf(today) : prevPeriod(periodOf(today));
  const byPeriod = new Map<string, JournalLine[]>();
  for (const a of assets) {
    for (const row of depreciationSchedule(a)) {
      if (row.period < periodOf(BOOKS_START) || row.period > lastPeriod) continue;
      const list = byPeriod.get(row.period) ?? [];
      list.push(dr(a.site ? A.siteDepreciation : A.officeDepreciation, row.amount, { projectId: a.projectId }), cr(accumAccount(a.account), row.amount));
      byPeriod.set(row.period, list);
    }
  }
  for (const [p, lines] of byPeriod) out.push(entry("depreciation", p, monthEnd(p), `ค่าเสื่อมราคาประจำเดือน ${p}`, lines));
  return out;
}
function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// ---------- manual ----------

const manualEntry = (m: ManualJournal) => entry(m.source === "opening" ? "opening" : "manual", m.id, m.date, m.memo, m.lines.map((l) => ({ ...l })));

// ---------- VAT returns and tax remittance ----------

export type VatReturn = { period: string; output: number; input: number; creditIn: number; net: number; payable: number; creditOut: number };

const movement = (entries: JournalEntry[], account: string, period: string) => {
  let d = 0,
    c = 0;
  for (const e of entries) {
    if (e.period !== period || e.source === "tax-payment" || e.source === "closing") continue;
    for (const l of e.lines) {
      if (l.account !== account) continue;
      d += satang(l.debit);
      c += satang(l.credit);
    }
  }
  return { debit: d / 100, credit: c / 100 };
};

/** ภ.พ.30 chain: output VAT − input VAT − credit brought forward = payable, or a credit carried forward. */
export function vatReturns(entries: JournalEntry[], to: string): VatReturn[] {
  const from = periodOf(BOOKS_START);
  let creditIn = 0;
  const out: VatReturn[] = [];
  for (const period of periodsBetween(from, to)) {
    const o = movement(entries, A.outputVat, period),
      i = movement(entries, A.inputVat, period);
    const output = r2(o.credit - o.debit),
      input = r2(i.debit - i.credit);
    const net = r2(output - input - creditIn);
    const r: VatReturn = { period, output, input, creditIn, net, payable: Math.max(0, net), creditOut: Math.max(0, r2(-net)) };
    out.push(r);
    creditIn = r.creditOut;
  }
  return out;
}

export type WhtSummary = { period: string; form: WhtFormName; items: WhtMeta[]; base: number; amount: number };
export function whtSummary(entries: JournalEntry[], period: string, form: WhtFormName): WhtSummary {
  const items = entries.filter((e) => e.source !== "closing").flatMap((e) => e.wht ?? []).filter((w) => w.form === form && periodOf(w.date) === period);
  return { period, form, items, base: sum(items.map((w) => w.base)), amount: sum(items.map((w) => w.amount)) };
}
/** Social security due for a period: employee + employer contributions credited to 2133 by payroll. */
export function ssoDue(entries: JournalEntry[], period: string) {
  return sum(entries.filter((e) => e.source === "payroll" && e.period === period).flatMap((e) => e.lines.filter((l) => l.account === A.ssoPayable).map((l) => l.credit - l.debit)));
}

const FORM_OF: Record<string, WhtFormName> = { pnd1: "ภ.ง.ด.1", pnd3: "ภ.ง.ด.3", pnd53: "ภ.ง.ด.53" };

function taxEntries(filings: TaxFiling[], base: JournalEntry[], today: string): { entries: JournalEntry[]; problems: Problem[] } {
  const out: JournalEntry[] = [];
  const problems: Problem[] = [];
  const last = filings.reduce((m, f) => (f.period > m ? f.period : m), periodOf(BOOKS_START));
  const returns = vatReturns(base, last > periodOf(today) ? last : periodOf(today));
  for (const f of filings) {
    const ref = f.id;
    if (f.kind === "pp30") {
      const r = returns.find((x) => x.period === f.period);
      if (!r) continue;
      const delta = r2(r.creditOut - r.creditIn);
      const lines = [dr(A.outputVat, r.output), cr(A.inputVat, r.input), delta > 0 ? dr(A.vatCredit, delta) : cr(A.vatCredit, -delta), cr(f.account || A.bank, r.payable)];
      if (Math.abs(r.payable - f.amount) > 0.009) problems.push({ key: `tax-payment:${ref}`, text: `ภ.พ.30 ${f.period}: ยอดที่บันทึกชำระ ${f.amount} ไม่ตรงกับที่คำนวณได้ ${r.payable} (ใช้ยอดที่คำนวณ)` });
      out.push(entry("tax-payment", ref, f.paidDate, `ยื่น ภ.พ.30 งวด ${f.period}`, lines));
    } else if (f.kind === "sso") {
      out.push(entry("tax-payment", ref, f.paidDate, `นำส่งประกันสังคม งวด ${f.period}`, [dr(A.ssoPayable, f.amount), cr(f.account || A.bank, f.amount)]));
    } else {
      out.push(entry("tax-payment", ref, f.paidDate, `นำส่ง ${FORM_OF[f.kind]} งวด ${f.period}`, [dr(A.whtPayable, f.amount), cr(f.account || A.bank, f.amount)]));
    }
  }
  return { entries: out, problems };
}

// ---------- period locks ----------

const sameContent = (a: JournalEntry, b: JournalEntry) => a.date === b.date && JSON.stringify(a.lines) === JSON.stringify(b.lines);

function applyLocks(derived: JournalEntry[], locks: PeriodLock[], pick: (e: JournalEntry) => boolean, late: Problem[]) {
  const closed = new Map(locks.map((l) => [l.id, l]));
  const out: JournalEntry[] = [];
  for (const e of derived) {
    const lock = closed.get(e.period);
    if (!lock) {
      out.push(e);
      continue;
    }
    const snap = lock.entries.find((s) => s.key === e.key);
    if (!snap) late.push({ key: e.key, text: `${e.ref} ลงวันที่ ${e.date} อยู่ในงวด ${e.period} ที่ปิดแล้ว จึงไม่ถูกบันทึกบัญชี` });
    else if (!sameContent(snap, e)) late.push({ key: e.key, text: `${e.ref} ถูกแก้ไขหลังปิดงวด ${e.period} ระบบใช้ยอดตามที่ปิดงวดไว้` });
  }
  for (const l of locks) for (const s of l.entries) if (pick(s)) out.push(s);
  return out;
}

// ---------- the books ----------

const ORDER: Source[] = ["opening", "installment-invoice", "receipt", "supplier-bill", "bill-payment", "expense", "expense-payment", "asset", "asset-disposal", "payroll", "payroll-payment", "depreciation", "tax-payment", "manual", "closing"];
export const sortEntries = (a: JournalEntry, b: JournalEntry) => a.date.localeCompare(b.date) || ORDER.indexOf(a.source) - ORDER.indexOf(b.source) || a.ref.localeCompare(b.ref);

export function buildBooks(input: BooksInput): Books {
  const problems: Problem[] = [];
  const late: Problem[] = [];
  const opening: JournalLine[] = [];
  const derived: JournalEntry[] = [];

  for (const inst of input.installments) {
    const inv = invoiceOf(inst, input.arDocs, input.projects);
    derived.push(...arEntries(inst, inv, receiptOf(inst, input.arDocs, inv), opening));
  }
  for (const b of input.bills) derived.push(...apEntries(b, paymentOf(b, input.apPayments), opening));
  for (const run of input.payroll) derived.push(...payrollEntries(run));
  for (const x of input.expenses) derived.push(...expenseEntries(x, input.accounts));
  derived.push(...assetEntries(input.assets, input.today));
  for (const m of input.manual) derived.push(manualEntry(m));
  if (opening.length) derived.push(entry("opening", "AR-AP", BOOKS_START, "ยอดยกมาลูกหนี้/เจ้าหนี้ที่ค้างอยู่ ณ วันเริ่มระบบ", opening));

  const balanced = (list: JournalEntry[]) =>
    list.filter((e) => {
      try {
        assertBalanced(e);
        return true;
      } catch (err) {
        problems.push({ key: e.key, text: (err as Error).message });
        return false;
      }
    });

  const closedSet = new Set(input.locks.map((l) => l.id));
  const pass1 = applyLocks(balanced(derived), input.locks, (e) => e.source !== "tax-payment", late);
  const tax = taxEntries(input.filings, pass1, input.today);
  problems.push(...tax.problems);
  const pass2 = applyLocks(balanced(tax.entries), input.locks, (e) => e.source === "tax-payment", late);

  const numbers = new Map(input.register.map((r) => [r.key, r.id]));
  const entries = [...pass1, ...pass2].map((e) => (e.id ? e : { ...e, id: numbers.get(e.key) ?? "" })).sort(sortEntries);
  return { entries, problems, late, closed: closedSet };
}

/** JV numbers for entries that have none yet, in date order, continuing each year's sequence. */
export function assignNumbers(entries: JournalEntry[], register: JvNumber[]): JvNumber[] {
  const used = new Set(register.map((r) => r.key));
  const max = new Map<string, number>();
  for (const r of register) {
    const prefix = r.id.slice(0, 8);
    max.set(prefix, Math.max(max.get(prefix) ?? 0, Number(r.id.slice(8)) || 0));
  }
  const out: JvNumber[] = [];
  for (const e of [...entries].sort(sortEntries)) {
    if (e.id || used.has(e.key)) continue;
    const prefix = jvPrefix(e.date);
    const n = (max.get(prefix) ?? 0) + 1;
    max.set(prefix, n);
    used.add(e.key);
    out.push({ id: `${prefix}${String(n).padStart(4, "0")}`, key: e.key });
  }
  return out;
}

/** Year-end closing: income and expense balances of the year into 3200 กำไรสะสม. */
export function closingEntry(entries: JournalEntry[], year: number): JournalEntry | null {
  const bal = new Map<string, number>();
  for (const e of entries) {
    if (!e.date.startsWith(String(year)) || e.source === "closing") continue;
    for (const l of e.lines) if (/^[45]/.test(l.account)) bal.set(l.account, (bal.get(l.account) ?? 0) + satang(l.debit) - satang(l.credit));
  }
  const lines: JournalLine[] = [];
  let net = 0;
  for (const [account, s] of bal) {
    if (!s) continue;
    net += s;
    lines.push(s > 0 ? cr(account, s / 100) : dr(account, -s / 100));
  }
  if (!lines.length) return null;
  lines.push(net > 0 ? dr(A.retained, net / 100) : cr(A.retained, -net / 100));
  return entry("closing", String(year), `${year}-12-31`, `ปิดบัญชีรายได้และค่าใช้จ่ายปี ${year + 543} เข้ากำไรสะสม`, lines);
}

/** Customer is a juristic person (likely withholds 3% on the hire-of-work payment). */
export const customerWithholds = (name: string, taxId?: string) => isJuristic(taxId) || /^(บริษัท|บจก|หจก|ห้างหุ้นส่วน|นิติบุคคล)/.test(name.trim());
