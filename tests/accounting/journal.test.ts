// Journal engine: every derived entry balances, trial balance and balance sheet balance,
// posting rules for invoices / receipts / bills / payroll / VAT, and period locks.
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver before any accounting module is imported (URL import keeps tsc happy without a .ts specifier)
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { buildBooks, assignNumbers, isBalanced, vatReturns, whtSummary, closingEntry, collectedVat } = await lib("journal");
const { trialBalance, balanceSheet, plByProject, generalLedger, aging, toCsv } = await lib("reports");
const { DEFAULT_ACCOUNTS } = await lib("coa");
const { SEED_ASSETS, SEED_EXPENSES, SEED_MANUAL, SEED_TODAY } = await lib("seed");
const { depreciationSchedule } = await lib("assets");
const { satang } = await lib("money");

type Line = { account: string; debit: number; credit: number; projectId?: string };
type Entry = { key: string; id: string; date: string; period: string; source: string; ref: string; lines: Line[]; tax?: { kind: string; vat: number; base: number }[]; wht?: { form: string; amount: number; base: number }[] };

const projects = [
  { id: "P1", name: "บ้านคุณเอ", owner: "เอ ใจดี" },
  { id: "P2", name: "โฮมออฟฟิศ", owner: "บริษัท ทีเค อินเตอร์เทรด จำกัด" },
];
const inst = (id: string, projectId: string, amount: number, dueDate: string, extra = {}) => ({
  id,
  projectId,
  no: 1,
  title: `งวด ${id}`,
  milestone: "",
  percent: 10,
  amount,
  vat: Math.round(amount * 7) / 100,
  dueDate,
  status: "scheduled",
  ...extra,
});
const installments = [
  inst("I1", "P1", 500000, "2026-03-10", { status: "paid", invoiceNo: "IV-OLD-1", paidDate: "2026-03-20" }),
  inst("I2", "P1", 750000, "2026-08-01", { status: "invoiced", invoiceNo: "IV-OLD-2" }),
  inst("I3", "P2", 1000000, "2026-09-15"),
  inst("I4", "P1", 300000, "2025-12-10", { status: "paid", invoiceNo: "IV-2568", paidDate: "2026-01-12" }),
  inst("I5", "P2", 400000, "2026-12-01"),
];
const arDocs = [
  { id: "IV-6909-0001", kind: "invoice", installmentId: "I3", projectId: "P2", date: "2026-09-15", dueDate: "2026-09-30", customerName: "บริษัท ทีเค อินเตอร์เทรด จำกัด", customerTaxId: "0105556012345", description: "งวด 3", amount: 1000000, vat: 70000, retention: 50000, taxPoint: "receipt" },
  { id: "RC-6910-0001", kind: "receipt", installmentId: "I3", projectId: "P2", invoiceNo: "IV-6909-0001", date: "2026-10-05", account: "1112", whtRate: 3, wht: 28500, received: 991500 },
];
const bill = (id: string, extra = {}) => ({ id, supplierId: "S1", supplierName: "บริษัท ปูนดี จำกัด", supplierTaxId: "0105556012345", date: "2026-05-02", dueDate: "2026-06-01", subtotal: 100000, vat: 7000, whtRate: 0, status: "open", lines: [], projectId: "P1", costCode: "03", ...extra });
const bills = [
  bill("B1"),
  bill("B2", { whtRate: 3, status: "paid", paidDate: "2026-06-05", supplierName: "นายช่าง ประปา", supplierTaxId: "3101200456789", vat: 0, costCode: "07" }),
  bill("B3", { whtRate: 3, status: "approved", vat: 3500, subtotal: 50000, costCode: undefined, projectId: undefined }),
  bill("B4", { date: "2025-11-20", status: "paid", paidDate: "2026-01-10" }),
];
const apPayments = [{ id: "PV-6911-0001", billId: "B3", date: "2026-11-02", account: "1112", whtRate: 3, wht: 1500, paid: 52000 }];
const payroll = [
  {
    id: "PAY-2026-10",
    period: "2026-10",
    kind: "monthly",
    payDate: "2026-10-31",
    status: "paid",
    employerSso: 1500,
    lines: [
      { employeeId: "E1", name: "ศิริพร", kind: "monthly", gross: 45000, ot: 0, sso: 750, wht: 1800, net: 42450 },
      { employeeId: "E2", name: "วิศวกร", kind: "monthly", projectId: "P1", gross: 32000, ot: 2000, sso: 750, wht: 600, net: 32650 },
    ],
  },
  { id: "PAY-2026-11-DRAFT", period: "2026-11", kind: "daily", payDate: "2026-11-07", status: "draft", employerSso: 0, lines: [{ employeeId: "D1", name: "แรงงาน", kind: "daily", gross: 3500, ot: 0, sso: 0, wht: 0, net: 3500 }] },
];
const filings = [
  { id: "TAX-pp30-2026-05", kind: "pp30", period: "2026-05", paidDate: "2026-06-15", amount: 0, account: "1112" },
  { id: "TAX-pnd1-2026-10", kind: "pnd1", period: "2026-10", paidDate: "2026-11-07", amount: 2400, account: "1112" },
];

const input = (extra = {}) => ({
  today: SEED_TODAY,
  accounts: DEFAULT_ACCOUNTS,
  projects,
  installments,
  arDocs,
  bills,
  apPayments,
  payroll,
  expenses: SEED_EXPENSES,
  assets: SEED_ASSETS,
  manual: SEED_MANUAL,
  filings,
  locks: [],
  register: [],
  ...extra,
});

const books = buildBooks(input());
const entries: Entry[] = books.entries;
const byKey = (k: string) => {
  const e = entries.find((x) => x.key === k);
  assert.ok(e, `missing ${k}`);
  return e;
};
const pairs = (e: Entry) => e.lines.map((l) => [l.account, l.debit, l.credit]);

test("seed is sizeable and every derived entry balances", () => {
  assert.ok(SEED_EXPENSES.length >= 100 && SEED_EXPENSES.length <= 140, `expenses: ${SEED_EXPENSES.length}`);
  assert.equal(books.problems.filter((p: { key: string }) => !p.key.startsWith("tax-payment")).length, 0, JSON.stringify(books.problems));
  assert.ok(entries.length > 150);
  for (const e of entries) assert.ok(isBalanced(e.lines), `${e.key} unbalanced`);
  assert.equal(new Set(entries.map((e) => e.key)).size, entries.length, "keys unique");
});

test("the empty company (no shared biz data yet) still builds balanced books", () => {
  const b = buildBooks(input({ installments: [], bills: [], payroll: [], arDocs: [], apPayments: [], filings: [] }));
  assert.deepEqual(b.problems, []);
  assert.ok(trialBalance(b.entries, DEFAULT_ACCOUNTS, { to: SEED_TODAY }).balanced);
  assert.ok(balanceSheet(b.entries, DEFAULT_ACCOUNTS, SEED_TODAY).balanced);
  const none = buildBooks(input({ installments: [], bills: [], payroll: [], arDocs: [], apPayments: [], filings: [], expenses: [], assets: [], manual: [] }));
  assert.equal(none.entries.length, 0);
});

test("trial balance totals are equal, for the year and for a single month", () => {
  const year = trialBalance(entries, DEFAULT_ACCOUNTS, { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(year.balanced, true);
  assert.equal(satang(year.totals.debit), satang(year.totals.credit));
  const oct = trialBalance(entries, DEFAULT_ACCOUNTS, { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(oct.balanced, true);
  assert.equal(satang(oct.totals.drBalance), satang(oct.totals.crBalance));
});

test("balance sheet balances (assets = liabilities + equity incl. current-year profit) at every month end", () => {
  for (const d of ["2026-01-31", "2026-03-31", "2026-06-30", "2026-09-30", "2026-10-31", SEED_TODAY]) {
    const bs = balanceSheet(entries, DEFAULT_ACCOUNTS, d);
    assert.ok(bs.balanced, `${d}: ${bs.totalAssets} vs ${bs.totalLiabilities} + ${bs.totalEquity}`);
  }
});

test("installment invoiced elsewhere: AR / revenue / deferred output VAT, receipt moves VAT to 2135", () => {
  const inv = byKey("installment-invoice:IV-OLD-1");
  assert.deepEqual(pairs(inv), [
    ["1130", 535000, 0],
    ["4110", 0, 500000],
    ["2136", 0, 35000],
  ]);
  const rc = entries.find((e) => e.source === "receipt" && e.date === "2026-03-20")!;
  assert.deepEqual(pairs(rc), [
    ["1112", 535000, 0],
    ["1130", 0, 535000],
    ["2136", 35000, 0],
    ["2135", 0, 35000],
  ]);
  assert.equal(rc.tax?.[0].vat, 35000);
});

test("tax invoice with retention and customer withholding 3%", () => {
  const inv = byKey("installment-invoice:IV-6909-0001");
  assert.deepEqual(pairs(inv), [
    ["1130", 1020000, 0],
    ["1135", 50000, 0],
    ["4110", 0, 1000000],
    ["2136", 0, 70000],
  ]);
  const rc = byKey("receipt:RC-6910-0001");
  assert.equal(collectedVat(arDocs[0]), 66500);
  assert.deepEqual(pairs(rc), [
    ["1112", 991500, 0],
    ["1157", 28500, 0],
    ["1130", 0, 1020000],
    ["2136", 66500, 0],
    ["2135", 0, 66500],
  ]);
});

test("installment invoiced before the books start and paid after goes through the opening balances", () => {
  const open = byKey("opening:AR-AP");
  assert.ok(open.lines.some((l) => l.account === "1130" && l.debit === 321000));
  assert.ok(!entries.some((e) => e.key === "installment-invoice:IV-2568"));
  assert.ok(entries.some((e) => e.source === "receipt" && e.date === "2026-01-12"));
  // the pre-start bill B4, paid in January
  assert.ok(open.lines.some((l) => l.account === "2111" && l.credit === 107000));
});

test("supplier bills: goods claim VAT at the bill, services at payment with WHT", () => {
  assert.deepEqual(pairs(byKey("supplier-bill:B1")), [
    ["5103", 100000, 0],
    ["1154", 7000, 0],
    ["2111", 0, 107000],
  ]);
  assert.deepEqual(pairs(byKey("supplier-bill:B3")), [
    ["1190", 50000, 0],
    ["1155", 3500, 0],
    ["2111", 0, 53500],
  ]);
  const pay = byKey("bill-payment:PV-6911-0001");
  assert.deepEqual(pairs(pay), [
    ["2111", 53500, 0],
    ["1112", 0, 52000],
    ["2132", 0, 1500],
    ["1154", 3500, 0],
    ["1155", 0, 3500],
  ]);
  assert.equal(pay.wht?.[0].form, "ภ.ง.ด.53");
  const b2 = entries.find((e) => e.source === "bill-payment" && e.ref.includes("B2"))!;
  assert.deepEqual(pairs(b2), [
    ["2111", 100000, 0],
    ["1112", 0, 97000],
    ["2132", 0, 3000],
  ]);
  assert.equal(b2.wht?.[0].form, "ภ.ง.ด.3");
});

test("payroll: salaries vs site labour, SSO employee + employer, PND1; drafts are not posted", () => {
  const pay = byKey("payroll:PAY-2026-10");
  assert.deepEqual(pairs(pay), [
    ["5210", 45000, 0],
    ["5211", 750, 0],
    ["5150", 34000, 0],
    ["5151", 750, 0],
    ["2140", 0, 75100],
    ["2133", 0, 3000],
    ["2132", 0, 2400],
  ]);
  assert.equal(pay.lines.find((l) => l.account === "5150")?.projectId, "P1");
  assert.deepEqual(pairs(byKey("payroll-payment:PAY-2026-10")), [
    ["2140", 75100, 0],
    ["1112", 0, 75100],
  ]);
  assert.ok(!entries.some((e) => e.ref === "PAY-2026-11-DRAFT"));
  const pnd1 = whtSummary(entries, "2026-10", "ภ.ง.ด.1");
  assert.equal(pnd1.amount, 2400);
  assert.equal(pnd1.items[1].base, 34000);
  // remittance clears the liability
  assert.deepEqual(pairs(byKey("tax-payment:TAX-pnd1-2026-10")), [
    ["2132", 2400, 0],
    ["1112", 0, 2400],
  ]);
});

test("ภ.พ.30 chain: payable or credit carried forward, and the filing entry clears 2135 / 1154", () => {
  const r = vatReturns(entries, "2026-10");
  for (const x of r) {
    assert.equal(satang(x.output - x.input - x.creditIn), satang(x.net));
    assert.ok(x.payable >= 0 && x.creditOut >= 0);
  }
  for (let i = 1; i < r.length; i++) assert.equal(r[i].creditIn, r[i - 1].creditOut);
  const may = r.find((x: { period: string }) => x.period === "2026-05");
  const f = byKey("tax-payment:TAX-pp30-2026-05");
  assert.ok(isBalanced(f.lines));
  assert.equal(f.lines.find((l) => l.account === "2135")?.debit ?? 0, may.output);
  assert.equal(f.lines.find((l) => l.account === "1154")?.credit ?? 0, may.input);
});

test("depreciation: straight line, prorated first month, schedule sums to cost − salvage", () => {
  for (const a of SEED_ASSETS) {
    const s = depreciationSchedule(a);
    if (!a.lifeYears) assert.equal(s.length, 0);
    else if (!a.disposedDate) assert.equal(satang(s[s.length - 1].accum), satang(a.cost - a.salvage), a.id);
  }
  const s = depreciationSchedule({ id: "T", name: "t", account: "1220", cost: 120001, salvage: 1, lifeYears: 1, startDate: "2026-01-16", site: true, paidFrom: "1112" });
  assert.equal(s[0].amount, 5161.29); // 16/31 of 10,000
  assert.equal(s.length, 13);
  assert.equal(s[12].amount, 4838.71);
  const oct = byKey("depreciation:2026-10");
  assert.equal(oct.date, "2026-10-31");
  assert.ok(!entries.some((e) => e.key === "depreciation:2026-11"), "November has not ended yet");
  assert.ok(entries.some((e) => e.source === "asset-disposal"));
});

test("period lock freezes a month: later edits and back-dated documents are reported, not posted", () => {
  const oct = entries.filter((e) => e.period === "2026-10");
  const locks = [{ id: "2026-10", closedAt: "2026-11-03", closedBy: "test", entries: oct }];
  const changed = SEED_EXPENSES.map((x: { date: string; amount: number }) => (x.date.startsWith("2026-10") ? { ...x, amount: x.amount + 100 } : x));
  const late = { id: "EX-LATE", date: "2026-10-15", payee: "ร้าน", category: "ค่าใช้จ่ายอื่น", docType: "ใบเสร็จ", vatMode: "none", whtRate: 0, amount: 500, payStatus: "เงินสด" };
  const b = buildBooks(input({ locks, expenses: [...changed, late] }));
  const after = b.entries.filter((e: Entry) => e.period === "2026-10");
  assert.equal(JSON.stringify(after.map((e: Entry) => e.lines)), JSON.stringify(oct.map((e) => e.lines)));
  assert.ok(b.late.some((p: { key: string }) => p.key === "expense:EX-LATE"));
  assert.ok(b.late.length > 1);
  assert.ok(balanceSheet(b.entries, DEFAULT_ACCOUNTS, SEED_TODAY).balanced);
});

test("JV numbers: sequential per year in date order, never reassigned", () => {
  const reg = assignNumbers(entries, []);
  assert.equal(reg.length, entries.length);
  assert.equal(reg[0].id, "JV-2026-0001");
  assert.equal(new Set(reg.map((r: { id: string }) => r.id)).size, reg.length);
  const b = buildBooks(input({ register: reg }));
  assert.ok(b.entries.every((e: Entry) => e.id.startsWith("JV-2026-")));
  const newer = { id: "EX-NEW", date: "2026-02-01", payee: "x", category: "ค่าใช้จ่ายอื่น", docType: "ใบเสร็จ", vatMode: "none", whtRate: 0, amount: 10, payStatus: "เงินสด" };
  const extra = buildBooks(input({ register: reg, expenses: [...SEED_EXPENSES, newer] }));
  const more = assignNumbers(extra.entries, reg);
  assert.equal(more.length, 1);
  assert.equal(more[0].id, `JV-2026-${String(reg.length + 1).padStart(4, "0")}`);
});

test("year-end closing entry zeroes income and expenses into retained earnings", () => {
  const c = closingEntry(entries, 2026);
  assert.ok(c && isBalanced(c.lines));
  const bs = balanceSheet([...entries, c], DEFAULT_ACCOUNTS, "2026-12-31");
  assert.ok(bs.balanced);
  assert.equal(satang(bs.currentProfit), 0);
});

test("reports: project profitability, GL running balance, aging buckets, CSV", () => {
  const pr = plByProject(entries, { from: "2026-01-01", to: "2026-12-31" });
  const p1 = pr.find((x: { projectId: string }) => x.projectId === "P1");
  assert.equal(p1.revenue, 1250000);
  assert.ok(p1.cost > 0);
  const gl = generalLedger(entries, "1112", { from: "2026-10-01", to: "2026-10-31" });
  const last = gl.rows[gl.rows.length - 1];
  assert.equal(satang(last.balance), satang(gl.opening + gl.debit - gl.credit));
  const items = [
    { d: "2026-11-10", a: 1 },
    { d: "2026-10-20", a: 2 },
    { d: "2026-08-20", a: 4 },
    { d: "2026-07-01", a: 8 },
  ];
  const ag = aging(items, (x: { d: string }) => x.d, (x: { a: number }) => x.a, "2026-11-04");
  assert.deepEqual(ag.totals, [1, 2, 0, 4, 8]);
  assert.equal(toCsv([["a", 'b"c', "1,2"]]), '﻿a,"b""c","1,2"');
});
