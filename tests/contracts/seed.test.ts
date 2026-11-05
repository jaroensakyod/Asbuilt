// Demo data of the contracts module: certificate chains are consistent and, together with every other
// module's seeds, the books still balance with the certificates posted to AR.
import { test } from "node:test";
import assert from "node:assert/strict";
const { src }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const biz = await src("biz");
await src("sales/seed-biz");
await src("procurement/seed");
await src("hr/seed");
const { seedTerms } = await src("contracts/seed");
const { billableInstallments, contractBillingItems, retentionHeld } = await src("contracts/billing");
const { certCalc, contractValueOf } = await src("contracts/calc");
const { buildBooks } = await src("accounting/journal");
const { trialBalance, balanceSheet } = await src("accounting/reports");
const { DEFAULT_ACCOUNTS } = await src("accounting/coa");
const { SEED_ASSETS, SEED_EXPENSES, SEED_MANUAL } = await src("accounting/seed");
const { satang } = await src("accounting/money");
const data = await src("data");

type Cert = { id: string; projectId: string; side: string; subcontractId?: string; no: number; grossToDate: number; previous: number; thisPeriod: number; retention: number; advanceRecovery: number; backCharges: number; vat: number; wht: number; net: number; status: string; date: string };
const certs: Cert[] = biz.paymentCerts.all();
const terms = seedTerms();

test("certificate chains: previous = gross of the one before, net = base + VAT − retention − WHT", () => {
  const groups = new Map<string, Cert[]>();
  for (const c of certs) groups.set(c.subcontractId ?? c.projectId, [...(groups.get(c.subcontractId ?? c.projectId) ?? []), c]);
  for (const list of groups.values()) {
    list.sort((a, b) => a.no - b.no);
    list.forEach((c, i) => {
      assert.equal(c.previous, i ? list[i - 1].grossToDate : 0, c.id);
      assert.equal(satang(c.thisPeriod), satang(c.grossToDate - c.previous), c.id);
      const base = c.thisPeriod - c.advanceRecovery - c.backCharges;
      assert.equal(satang(c.net), satang(base + c.vat - c.retention - c.wht), c.id);
      assert.ok(c.date <= "2026-11-04", `${c.id} dated in the future`);
    });
  }
  assert.ok(certs.some((c) => c.side === "client" && c.status === "certified"));
  assert.ok(certs.some((c) => c.side === "sub" && c.backCharges > 0));
});

test("retention never exceeds its cap; the delivered villa holds 5% for release", () => {
  for (const t of terms) {
    const held = retentionHeld(certs, t.projectId);
    const cv = contractValueOf(Math.round(data.getProject(t.projectId).value * 1e6), biz.variations.all(), t.projectId);
    assert.ok(held > 0 && held <= (cv * t.retentionCapPct) / 100 + 0.01, `${t.projectId}: ${held} > cap`);
  }
  assert.equal(retentionHeld(certs, "HC-2024-05"), 725000);
  const r = certCalc({ grossToDate: 100, previous: 0, contractValue: 100, retentionPct: 5, retentionCapPct: 5, retentionBefore: 0, advance: 0, advanceBefore: 0, vatRate: 7, whtRate: 0 });
  assert.equal(r.retention, 5);
});

test("all demo seeds with contract billing items build balanced books", () => {
  const value = (id: string) => biz.budgets.all().find((b: { projectId: string }) => b.projectId === id)?.contractValue;
  const all = biz.installments.all();
  const items = [...billableInstallments(all, terms), ...contractBillingItems(terms, certs, value)];
  assert.ok(items.length < all.length + 40, "milestone installments of measured projects are replaced");
  assert.ok(!items.some((i: { id: string; projectId: string }) => i.projectId === "HC-2025-03" && i.id.startsWith("INS-PAY-")));
  const b = buildBooks({ today: "2026-11-04", accounts: DEFAULT_ACCOUNTS, projects: data.projects.map((p: { id: string; name: string; owner: string }) => ({ id: p.id, name: p.name, owner: p.owner })), installments: items, arDocs: [], bills: biz.supplierBills.all(), apPayments: [], payroll: biz.payrollRuns.all(), expenses: SEED_EXPENSES, assets: SEED_ASSETS, manual: SEED_MANUAL, filings: [], locks: [], register: [] });
  assert.deepEqual(b.problems, []);
  assert.ok(trialBalance(b.entries, DEFAULT_ACCOUNTS, { to: "2026-12-31" }).balanced);
  for (const d of ["2026-01-31", "2026-06-30", "2026-11-04"]) assert.ok(balanceSheet(b.entries, DEFAULT_ACCOUNTS, d).balanced, d);
  assert.ok(b.entries.some((e: { key: string }) => e.key.startsWith("installment-invoice:INV-2026-9")), "IPC invoices posted");
});
