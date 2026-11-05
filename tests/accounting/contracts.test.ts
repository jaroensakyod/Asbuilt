// Partial receipts, partial bill payments, credit notes (ใบลดหนี้), and the contract billing items
// (progress certificates with retention / advance recovery, advance, retention release, subcontract bills).
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { buildBooks, isBalanced, arStatus, billStatus, vatReturns, whtSummary } = await lib("journal");
const { trialBalance, balanceSheet } = await lib("reports");
const { DEFAULT_ACCOUNTS } = await lib("coa");
const { satang } = await lib("money");

type Line = { account: string; debit: number; credit: number };
type Entry = { key: string; source: string; date: string; lines: Line[]; tax?: { kind: string; vat: number; base: number; docNo: string }[]; wht?: { amount: number; base: number }[] };

const projects = [{ id: "P1", name: "อาคาร", owner: "บริษัท ลูกค้า จำกัด" }];
const base = { today: "2026-11-04", accounts: DEFAULT_ACCOUNTS, projects, installments: [], arDocs: [], bills: [], apPayments: [], payroll: [], expenses: [], assets: [], manual: [], filings: [], locks: [], register: [] };
const build = (x: Record<string, unknown>) => buildBooks({ ...base, ...x });
const pairs = (e: Entry) => e.lines.map((l) => [l.account, l.debit, l.credit]);
const find = (entries: Entry[], key: string) => {
  const e = entries.find((x) => x.key === key);
  assert.ok(e, `missing ${key}`);
  return e;
};
const balanced = (b: { entries: Entry[]; problems: unknown[] }) => {
  assert.deepEqual(b.problems, []);
  for (const e of b.entries) assert.ok(isBalanced(e.lines), e.key);
  assert.ok(trialBalance(b.entries, DEFAULT_ACCOUNTS, { to: "2026-12-31" }).balanced, "trial balance");
  for (const d of ["2026-01-31", "2026-06-30", "2026-11-04", "2026-12-31"]) assert.ok(balanceSheet(b.entries, DEFAULT_ACCOUNTS, d).balanced, `balance sheet ${d}`);
};
const bal = (entries: Entry[], account: string) => entries.reduce((s, e) => s + e.lines.filter((l) => l.account === account).reduce((t, l) => t + satang(l.debit) - satang(l.credit), 0), 0) / 100;

const inst = { id: "I1", projectId: "P1", no: 1, title: "งวด 1", milestone: "", percent: 10, amount: 100000, vat: 7000, dueDate: "2026-08-01", status: "invoiced" };
const inv = { id: "IV-6908-0001", kind: "invoice", installmentId: "I1", projectId: "P1", date: "2026-08-01", dueDate: "2026-08-15", customerName: "บริษัท ลูกค้า จำกัด", customerTaxId: "0105556012345", description: "งวด 1", amount: 100000, vat: 7000, retention: 0, taxPoint: "receipt" };

test("partial receipts: VAT moves pro rata, the last receipt takes the remainder, outstanding goes to zero", () => {
  const rc1 = { id: "RC-6908-0001", kind: "receipt", installmentId: "I1", projectId: "P1", invoiceNo: inv.id, date: "2026-08-10", account: "1112", whtRate: 3, wht: 1000, received: 34666.67 };
  const rc2 = { id: "RC-6909-0001", kind: "receipt", installmentId: "I1", projectId: "P1", invoiceNo: inv.id, date: "2026-09-10", account: "1112", whtRate: 3, wht: 2000, received: 69333.33 };
  const partial = build({ installments: [inst], arDocs: [inv, rc1] });
  balanced(partial);
  const st1 = arStatus(inst, [inv, rc1], projects);
  assert.equal(st1.outstanding, 71333.33);
  assert.equal(st1.paid, false);
  const r1 = find(partial.entries, "receipt:RC-6908-0001");
  // 35,666.67 of 107,000 → one third of the VAT
  assert.equal(r1.tax?.[0].vat, 2333.33);
  assert.equal(bal(partial.entries, "1130"), 71333.33);

  const full = build({ installments: [inst], arDocs: [inv, rc1, rc2] });
  balanced(full);
  assert.equal(arStatus(inst, [inv, rc1, rc2], projects).paid, true);
  const r2 = find(full.entries, "receipt:RC-6909-0001");
  assert.equal(r2.tax?.[0].vat, 4666.67);
  assert.equal(bal(full.entries, "1130"), 0);
  assert.equal(bal(full.entries, "2136"), 0, "deferred output VAT fully moved");
  assert.equal(bal(full.entries, "2135"), -7000);
  assert.equal(bal(full.entries, "1157"), 3000);
});

test("credit note on a tax invoice reverses revenue and output VAT and appears (negative) in the sales VAT report", () => {
  const tinv = { ...inv, taxPoint: "invoice" };
  const cn = { id: "CN-6909-0001", kind: "credit", installmentId: "I1", projectId: "P1", invoiceNo: inv.id, date: "2026-09-05", reason: "ลดราคางานที่ไม่เป็นไปตามแบบ", amount: 10000, vat: 700 };
  const b = build({ installments: [inst], arDocs: [tinv, cn] });
  balanced(b);
  const e = find(b.entries, "credit-note:CN-6909-0001");
  assert.deepEqual(pairs(e), [
    ["4110", 10000, 0],
    ["2135", 700, 0],
    ["1130", 0, 10700],
  ]);
  assert.deepEqual(e.tax?.[0] && [e.tax[0].kind, e.tax[0].base, e.tax[0].vat], ["output", -10000, -700]);
  const sep = vatReturns(b.entries, "2026-09").find((r: { period: string }) => r.period === "2026-09");
  assert.equal(sep.output, -700);
  assert.equal(arStatus(inst, [tinv, cn], projects).outstanding, 96300);
});

test("credit note before payment on a receipt-basis invoice reverses deferred VAT only; later receipt moves the rest", () => {
  const cn = { id: "CN-6908-0001", kind: "credit", installmentId: "I1", projectId: "P1", invoiceNo: inv.id, date: "2026-08-05", reason: "ยกเลิกงานบางรายการ", amount: 20000, vat: 1400 };
  const rc = { id: "RC-6908-0002", kind: "receipt", installmentId: "I1", projectId: "P1", invoiceNo: inv.id, date: "2026-08-20", account: "1112", whtRate: 0, wht: 0, received: 85600 };
  const b = build({ installments: [inst], arDocs: [inv, cn, rc] });
  balanced(b);
  const e = find(b.entries, "credit-note:CN-6908-0001");
  assert.deepEqual(pairs(e), [
    ["4110", 20000, 0],
    ["2136", 1400, 0],
    ["1130", 0, 21400],
  ]);
  assert.equal(e.tax, undefined);
  assert.equal(find(b.entries, "receipt:RC-6908-0002").tax?.[0].vat, 5600);
  assert.equal(bal(b.entries, "2136"), 0);
  assert.equal(bal(b.entries, "1130"), 0);
});

test("partial bill payments: WHT and service input VAT follow each payment, the bill is settled by the last one", () => {
  const bill = { id: "B1", supplierId: "S1", supplierName: "บริษัท ผู้รับเหมา จำกัด", supplierTaxId: "0105556012345", date: "2026-07-01", dueDate: "2026-07-31", subtotal: 100000, vat: 7000, whtRate: 3, status: "approved", lines: [], projectId: "P1", costCode: "03" };
  const p1 = { id: "PV-6907-0001", billId: "B1", date: "2026-07-15", account: "1112", whtRate: 3, wht: 1500, paid: 52000 };
  const p2 = { id: "PV-6908-0001", billId: "B1", date: "2026-08-15", account: "1112", whtRate: 3, wht: 1500, paid: 52000 };
  const half = build({ bills: [bill], apPayments: [p1] });
  balanced(half);
  assert.equal(billStatus(bill, [p1]).outstanding, 53500);
  assert.deepEqual(pairs(find(half.entries, "bill-payment:PV-6907-0001")), [
    ["2111", 53500, 0],
    ["1112", 0, 52000],
    ["2132", 0, 1500],
    ["1154", 3500, 0],
    ["1155", 0, 3500],
  ]);
  const full = build({ bills: [{ ...bill, status: "paid" }], apPayments: [p1, p2] });
  balanced(full);
  assert.equal(billStatus(bill, [p1, p2]).paid, true);
  assert.equal(bal(full.entries, "2111"), 0);
  assert.equal(bal(full.entries, "1155"), 0);
  assert.equal(whtSummary(full.entries, "2026-08", "ภ.ง.ด.53").base, 50000);
});

test("progress certificate: retention to 1135, advance recovery reduces 2120, revenue = work this period", () => {
  const adv = { id: "ADV-P1", projectId: "P1", no: 0, title: "เงินล่วงหน้า", milestone: "", percent: 10, amount: 1000000, vat: 70000, invoiceDate: "2026-02-01", dueDate: "2026-02-15", status: "paid", paidDate: "2026-02-10", origin: "advance", wht: 10000, customerName: "บริษัท ลูกค้า จำกัด" };
  // work this period 2,000,000; advance recovery 200,000 → base 1,800,000; retention 100,000; VAT 126,000; WHT 1% of 1,700,000
  const ipc = { id: "IPC-P1-1", projectId: "P1", no: 1, title: "IPC 1", milestone: "IPC", percent: 20, amount: 1800000, vat: 126000, invoiceDate: "2026-03-05", dueDate: "2026-04-05", status: "paid", paidDate: "2026-03-30", origin: "ipc", retention: 100000, advanceRecovery: 200000, wht: 17000, customerName: "บริษัท ลูกค้า จำกัด" };
  const b = build({ installments: [adv, ipc] });
  balanced(b);
  assert.deepEqual(pairs(find(b.entries, "installment-invoice:(ADV-P1)")), [
    ["1130", 1070000, 0],
    ["2120", 0, 1000000],
    ["2136", 0, 70000],
  ]);
  assert.deepEqual(pairs(find(b.entries, "installment-invoice:(IPC-P1-1)")), [
    ["1130", 1826000, 0],
    ["1135", 100000, 0],
    ["2120", 200000, 0],
    ["4110", 0, 2000000],
    ["2136", 0, 126000],
  ]);
  const rc = find(b.entries, "receipt:(IPC-P1-1-RC)");
  assert.equal(rc.lines.find((l) => l.account === "1112")?.debit, 1809000);
  assert.equal(rc.lines.find((l) => l.account === "1157")?.debit, 17000);
  assert.equal(bal(b.entries, "2120"), -800000, "advance still to recover");
  assert.equal(bal(b.entries, "1135"), 100000);
  assert.equal(bal(b.entries, "2136"), -7000, "VAT on the retention stays deferred");

  // retention release: 1135 → 1130, deferred VAT moves when received
  const rel = { id: "RET-P1", projectId: "P1", no: 99, title: "คืนเงินประกัน", milestone: "", percent: 5, amount: 100000, vat: 0, invoiceDate: "2026-10-01", dueDate: "2026-10-31", status: "paid", paidDate: "2026-10-20", origin: "retention", releaseVat: 7000, wht: 1000, customerName: "บริษัท ลูกค้า จำกัด" };
  const b2 = build({ installments: [adv, ipc, rel] });
  balanced(b2);
  assert.deepEqual(pairs(find(b2.entries, "installment-invoice:(RET-P1)")), [
    ["1130", 100000, 0],
    ["1135", 0, 100000],
  ]);
  const rrc = find(b2.entries, "receipt:(RET-P1-RC)");
  assert.equal(rrc.tax?.[0].vat, 7000);
  assert.equal(bal(b2.entries, "1135"), 0);
  assert.equal(bal(b2.entries, "2136"), 0);
  assert.equal(bal(b2.entries, "1130"), 0);
});

test("certificates invoiced before the books start carry retention, deferred VAT and the unrecovered advance into the opening balances", () => {
  const adv = { id: "ADV-P1", projectId: "P1", no: 0, title: "เงินล่วงหน้า", milestone: "", percent: 10, amount: 1000000, vat: 70000, invoiceDate: "2025-10-01", dueDate: "2025-10-15", status: "paid", paidDate: "2025-10-10", origin: "advance" };
  const ipc = { id: "IPC-P1-1", projectId: "P1", no: 1, title: "IPC 1", milestone: "IPC", percent: 20, amount: 1800000, vat: 126000, invoiceDate: "2025-11-05", dueDate: "2025-12-05", status: "paid", paidDate: "2025-11-30", origin: "ipc", retention: 100000, advanceRecovery: 200000 };
  const b = build({ installments: [adv, ipc] });
  balanced(b);
  const open = find(b.entries, "opening:AR-AP");
  const get = (a: string) => open.lines.filter((l) => l.account === a).reduce((s, l) => s + l.debit - l.credit, 0);
  assert.equal(get("1135"), 100000);
  assert.equal(get("2120"), -800000);
  assert.equal(get("2136"), -7000);
  assert.equal(get("1130"), 0);
});

test("subcontract bill: retention held in 2150, advance recovered from 1160, cost = work less back-charges", () => {
  // advance 100,000 paid; certificate: work 300,000, back-charge 10,000, advance recovery 30,000 → subtotal 260,000
  const advBill = { id: "BILL-ADV-SC1", supplierId: "S1", supplierName: "บริษัท ผู้รับเหมา จำกัด", supplierTaxId: "0105556012345", date: "2026-03-01", dueDate: "2026-03-08", subtotal: 100000, vat: 7000, whtRate: 3, status: "paid", paidDate: "2026-03-08", lines: [], projectId: "P1", costCode: "03", billKind: "advance" };
  const certBill = { id: "BILL-SPC-SC1-1", supplierId: "S1", supplierName: "บริษัท ผู้รับเหมา จำกัด", supplierTaxId: "0105556012345", date: "2026-05-04", dueDate: "2026-06-03", subtotal: 260000, vat: 18200, whtRate: 3, status: "paid", paidDate: "2026-05-30", lines: [], projectId: "P1", costCode: "03", retention: 15000, advanceRecovery: 30000 };
  const b = build({ bills: [advBill, certBill] });
  balanced(b);
  assert.deepEqual(pairs(find(b.entries, "supplier-bill:BILL-ADV-SC1")), [
    ["1160", 100000, 0],
    ["1155", 7000, 0],
    ["2111", 0, 107000],
  ]);
  assert.deepEqual(pairs(find(b.entries, "supplier-bill:BILL-SPC-SC1-1")), [
    ["5103", 290000, 0],
    ["1160", 0, 30000],
    ["1155", 18200, 0],
    ["2111", 0, 263200],
    ["2150", 0, 15000],
  ]);
  const pay = b.entries.find((e: Entry) => e.source === "bill-payment" && e.key.includes("BILL-SPC-SC1-1"))!;
  assert.equal(pay.lines.find((l: Line) => l.account === "1112")?.credit, 255400); // 263,200 − 3% of 260,000
  assert.equal(bal(b.entries, "2111"), 0);
  assert.equal(bal(b.entries, "1160"), 70000);
  assert.equal(bal(b.entries, "2150"), -15000);
  // release of the retention we held
  const rel = { id: "BILL-RET-SC1", supplierId: "S1", supplierName: "บริษัท ผู้รับเหมา จำกัด", date: "2026-10-01", dueDate: "2026-10-15", subtotal: 15000, vat: 0, whtRate: 0, status: "approved", lines: [], projectId: "P1", billKind: "retention-release" };
  const b2 = build({ bills: [advBill, certBill, rel] });
  balanced(b2);
  assert.equal(bal(b2.entries, "2150"), 0);
  assert.equal(bal(b2.entries, "2111"), -15000);
});
