// Ported from ZettaFlow tests/tax.test.ts (adapted to the construction categories and chart of accounts).
import { test } from "node:test";
import assert from "node:assert/strict";
// load.ts registers the resolver before any accounting module is imported (URL import keeps tsc happy without a .ts specifier)
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { computeExpense, whtForm, expenseSummary, linesTotal, linesMismatch, validTaxId, afterDiscount } = await lib("tax");
const { buildExpenseJournal } = await lib("ledger");
const { DEFAULT_ACCOUNTS } = await lib("coa");
const { bahtText, r2, docPrefix } = await lib("money");

test("VAT included / excluded / none with withholding on the pre-VAT base", () => {
  assert.deepEqual(computeExpense(10700, "included", 3), { base: 10000, vat: 700, gross: 10700, wht: 300, net: 10400, claimable: 700, cost: 10000 });
  assert.deepEqual(computeExpense(10000, "excluded", 3), { base: 10000, vat: 700, gross: 10700, wht: 300, net: 10400, claimable: 700, cost: 10000 });
  assert.deepEqual(computeExpense(5000, "none", 1), { base: 5000, vat: 0, gross: 5000, wht: 50, net: 4950, claimable: 0, cost: 5000 });
  assert.deepEqual(computeExpense(2000, "excluded", 5), { base: 2000, vat: 140, gross: 2140, wht: 100, net: 2040, claimable: 140, cost: 2000 });
  assert.equal(computeExpense(-5).gross, 0);
});

test("satang rounding: VAT-included amounts split so base + VAT equals the printed total", () => {
  for (const amt of [1, 99.99, 107, 535.5, 1234.56, 999999.99]) {
    const c = computeExpense(amt, "included");
    assert.equal(r2(c.base + c.vat), amt);
  }
  assert.deepEqual(computeExpense(100, "included"), { base: 93.46, vat: 6.54, gross: 100, wht: 0, net: 100, claimable: 6.54, cost: 93.46 });
  assert.equal(computeExpense(0.5, "excluded").vat, 0.04); // 0.035 rounds half up
});

test("an abbreviated tax invoice or plain receipt cannot claim VAT, so the VAT is booked as cost", () => {
  const c = computeExpense(107, "included", 0, "ใบกำกับภาษีอย่างย่อ");
  assert.deepEqual([c.vat, c.claimable, c.cost], [7, 0, 107]);
  assert.equal(computeExpense(107, "included", 0, "ใบเสร็จ").claimable, 0);
});

test("item list total, mismatch warning and document discount", () => {
  const lines = [
    { name: "A4", qty: 2, price: 120 },
    { name: "ปากกา", qty: 3, price: 10.5 },
    { name: "ถุงมือ", qty: 10, price: 25, discount: 10, discountType: "percent" },
  ];
  assert.equal(linesTotal(lines), 496.5);
  assert.equal(linesMismatch(lines, 496.5), false);
  assert.equal(linesMismatch(lines, 300), true);
  assert.equal(linesMismatch([], 300), false);
  assert.deepEqual(afterDiscount(1000, 5, "percent"), { off: 50, after: 950 });
  assert.deepEqual(afterDiscount(100, 150, "amount"), { off: 150, after: 0 });
});

test("WHT form follows payee type", () => {
  assert.equal(whtForm("0105556012345", 3), "ภ.ง.ด.53");
  assert.equal(whtForm("1-1001-00000-00-1", 3), "ภ.ง.ด.3");
  assert.equal(whtForm("0105556012345", 0), "");
  assert.equal(whtForm(undefined, 3), "ภ.ง.ด.3");
});

test("tax id checksum", () => {
  assert.equal(validTaxId("0994000165510"), true);
  assert.equal(validTaxId("0994000165511"), false);
  assert.equal(validTaxId("12345"), false);
});

test("monthly summary: VAT claimable only on full tax invoices, voided rows skipped, all-time project spend", () => {
  const s = expenseSummary(
    [
      { amount: 10700, vatMode: "included", whtRate: 3, docType: "ใบกำกับภาษีเต็มรูป", date: "2026-10-02", projectId: "p1" },
      { amount: 1070, vatMode: "included", docType: "ใบกำกับภาษีอย่างย่อ", date: "2026-10-03" },
      { amount: 999, date: "2026-09-30", projectId: "p1" },
      { amount: 500, date: "2026-10-04", status: "void" },
    ],
    "2026-10",
  );
  assert.deepEqual(s, { total: 11770, vat: 700, wht: 300, byProject: { p1: 11699 } });
});

test("journal: petty cash, payables, cost-code accounts and the chosen chart code", () => {
  const base = { id: "X", date: "2026-10-01", payee: "ร้าน", docType: "ใบกำกับภาษีอย่างย่อ", vatMode: "included", whtRate: 0 };
  const cash = buildExpenseJournal({ ...base, amount: 535, category: "ค่าขนส่งวัสดุ", payStatus: "เงินสดย่อย" }, DEFAULT_ACCOUNTS);
  assert.deepEqual(cash.lines.map((l: { account: string; debit: number; credit: number }) => [l.account, l.debit, l.credit]), [["5140", 535, 0], ["1113", 0, 535]]);
  assert.equal(cash.wht, null);
  const sub = buildExpenseJournal({ ...base, docType: "ใบกำกับภาษีเต็มรูป", vatMode: "excluded", amount: 20000, whtRate: 3, category: "ผู้รับเหมาช่วง", costCode: "06", payStatus: "ยังไม่จ่าย", payeeTaxId: "0105556012345" }, DEFAULT_ACCOUNTS);
  assert.deepEqual(sub.lines.map((l: { account: string; debit: number; credit: number }) => [l.account, l.debit, l.credit]), [["5106", 20000, 0], ["1154", 1400, 0], ["2111", 0, 20800], ["2132", 0, 600]]);
  assert.equal(sub.wht.form, "ภ.ง.ด.53");
  assert.equal(sub.balanced, true);
  assert.equal(buildExpenseJournal({ ...base, amount: 100, category: "ค่าใช้จ่ายอื่น", accountCode: "5410", payStatus: "โอนแล้ว" }, DEFAULT_ACCOUNTS).lines[0].account, "5410");
  assert.equal(buildExpenseJournal({ ...base, amount: 100, category: "ไม่มีหมวดนี้", accountCode: "9999", payStatus: "โอนแล้ว" }, DEFAULT_ACCOUNTS).lines[0].account, "5900");
  assert.equal(buildExpenseJournal({ ...base, amount: 0, category: "ค่าใช้จ่ายอื่น", payStatus: "โอนแล้ว" }, DEFAULT_ACCOUNTS).balanced, false);
});

test("Thai baht text and document numbers", () => {
  assert.equal(bahtText(10700), "หนึ่งหมื่นเจ็ดร้อยบาทถ้วน");
  assert.equal(bahtText(21), "ยี่สิบเอ็ดบาทถ้วน");
  assert.equal(bahtText(101.25), "หนึ่งร้อยเอ็ดบาทยี่สิบห้าสตางค์");
  assert.equal(bahtText(1_000_000), "หนึ่งล้านบาทถ้วน");
  assert.equal(bahtText(12_500_011), "สิบสองล้านห้าแสนสิบเอ็ดบาทถ้วน");
  assert.equal(bahtText(0.5), "ห้าสิบสตางค์");
  assert.equal(docPrefix("IV", "2026-11-04"), "IV-6911-");
});
