"use client";
// Contracts module: typed views of the shared collections it owns, project contract summaries and the
// actions that keep other modules in step (budgets, installments, AR invoices, supplier bills, cost entries).

import { useEffect, useMemo } from "react";
import type { Collection } from "@/lib/collection";
import { budgets, costEntries, installments, paymentCerts, subcontractors, subcontracts, supplierBills, variations, wbsTasks, type CostCode, type Installment } from "@/lib/biz";
import { getProject, projects as seedProjects, TODAY, type Project } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { canApprove, canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { isLiveReady, useWorkspace } from "@/lib/workspace";
import { suppliers, nextSupplierId, type Category, type Supplier } from "@/lib/procurement";
import { arDocsCol, isLockedDate, locksCol } from "@/lib/accounting/store";
import { docPrefix, r2, sum } from "@/lib/accounting/money";
import type { ArInvoice, BillX } from "@/lib/accounting/types";
import { absorbOmission, addDaysIso, certCalc, contractValueOf, costByCode, measuredGross, mergeBudgetLines, priorTotals, retentionDueDate, weightedProgress } from "./calc";
import { advanceAmount, certBase, certItem, isMeasured, releaseItem, retentionHeld, retentionReleaseVat } from "./billing";
import { contractTerms, getContractSettings, termsFor, useContractSettings } from "./settings";
import type { CertX, ContractSettings, ContractTerms, SubcontractorX, SubcontractX, VariationX } from "./types";


export const voCol = variations as unknown as Collection<VariationX>;
export const subCol = subcontractors as unknown as Collection<SubcontractorX>;
export const scCol = subcontracts as unknown as Collection<SubcontractX>;
export const certCol = paymentCerts as unknown as Collection<CertX>;

export function useAccess() {
  const me = useMe();
  return { me, edit: canEdit(me.role, "contracts"), approve: canApprove(me.role, "contracts") };
}

export function useAllProjects(): Project[] {
  const local = useLocalProjects();
  return useMemo(() => [...local, ...seedProjects.filter((p) => !local.some((l) => l.id === p.id))], [local]);
}
export const projectName = (id: string, list?: Project[]) => (list?.find((p) => p.id === id) ?? getProject(id))?.name ?? id;

// ---------- contract value ----------

/** Original contract value (excl. VAT): the approved budget's contract value, else the project value. */
export function baseContractValue(projectId: string, budgetList = budgets.all(), project = getProject(projectId)) {
  const b = budgetList.find((x) => x.projectId === projectId);
  return b?.contractValue ?? Math.round((project?.value ?? 0) * 1e6);
}
/** Contract value including approved variations (excl. VAT). Reads the current collections. */
export function contractValueWithVariations(projectId: string) {
  return contractValueOf(baseContractValue(projectId), voCol.all(), projectId);
}

/** % complete for certificates: value-weighted WBS progress when the schedule has tasks, else the project's actual %. */
export function progressOf(projectId: string, tasks = wbsTasks.all(), project = getProject(projectId)) {
  const mine = tasks.filter((t) => t.projectId === projectId);
  const w = weightedProgress(mine);
  return w !== undefined ? { pct: w, basis: "wbs" as const } : { pct: project?.actual ?? 0, basis: "actual" as const };
}

// ---------- project contract summary ----------

export type ContractSummary = {
  project: Project;
  terms: ContractTerms;
  base: number;
  approvedVo: number;
  pendingVo: number;
  voCount: number;
  contractValue: number;
  /** work certified / installments invoiced to date (excl. VAT) */
  certified: number;
  certifiedPct: number;
  retentionHeld: number;
  retentionReleased: number;
  advance: number;
  advanceRecovered: number;
  advanceOutstanding: number;
  /** cash received incl. VAT, after the customer's withholding */
  received: number;
  /** invoiced and not yet received (incl. VAT, after retention) */
  receivable: number;
  retentionDue?: string;
  lastCert?: CertX;
  openCert?: CertX;
};

export function summarize(p: Project, ctx: { terms: ContractTerms[]; settings: ContractSettings; vos: VariationX[]; certs: CertX[]; inst: Installment[]; budgetList: ReturnType<typeof budgets.all> }): ContractSummary {
  const terms = termsFor(ctx.terms, p.id, ctx.settings);
  const base = baseContractValue(p.id, ctx.budgetList, p);
  const mineVo = ctx.vos.filter((v) => v.projectId === p.id);
  const approvedVo = sum(mineVo.filter((v) => v.status === "approved").map((v) => v.amount));
  const pendingVo = sum(mineVo.filter((v) => v.status === "submitted" || v.status === "priced").map((v) => v.amount));
  const contractValue = r2(base + approvedVo);
  const out: ContractSummary = { project: p, terms, base, approvedVo, pendingVo, voCount: mineVo.filter((v) => v.status !== "void").length, contractValue, certified: 0, certifiedPct: 0, retentionHeld: 0, retentionReleased: 0, advance: 0, advanceRecovered: 0, advanceOutstanding: 0, received: 0, receivable: 0 };
  if (terms.billing === "measured") {
    const certs = ctx.certs.filter((c) => c.projectId === p.id && c.side === "client").sort((a, b) => a.no - b.no);
    const billed = certs.filter((c) => c.status === "certified" || c.status === "paid");
    out.lastCert = billed.at(-1);
    out.openCert = certs.find((c) => c.status === "draft" || c.status === "submitted");
    out.certified = out.lastCert?.grossToDate ?? 0;
    out.retentionHeld = retentionHeld(certs, p.id);
    const rel = terms.retentionRelease;
    out.retentionReleased = rel ? rel.amount : 0;
    out.advance = terms.advanceDate ? advanceAmount(terms, base) : 0;
    out.advanceRecovered = sum(billed.map((c) => c.advanceRecovery));
    out.advanceOutstanding = r2(out.advance - out.advanceRecovered);
    const advItem = terms.advanceDate ? r2(out.advance * (1 + ctx.settings.vatRate / 100) - (out.advance * terms.whtRate) / 100) : 0;
    out.received = r2(sum(billed.filter((c) => c.status === "paid").map((c) => c.net)) + (terms.advancePaidDate ? advItem : 0) + (rel?.paidDate ? r2(rel.amount * (1 - terms.whtRate / 100)) : 0));
    out.receivable = r2(sum(billed.filter((c) => c.status === "certified").map((c) => c.net + c.wht)) + (terms.advanceDate && !terms.advancePaidDate ? advItem : 0) + (rel && !rel.paidDate ? rel.amount : 0));
  } else {
    const mine = ctx.inst.filter((i) => i.projectId === p.id);
    const billed = mine.filter((i) => i.status === "invoiced" || i.status === "paid" || i.status === "overdue" || !!i.invoiceNo);
    out.certified = sum(billed.map((i) => i.amount));
    out.received = sum(mine.filter((i) => i.status === "paid").map((i) => i.amount + i.vat));
    out.receivable = sum(billed.filter((i) => i.status !== "paid").map((i) => i.amount + i.vat));
  }
  out.certifiedPct = contractValue ? r2((out.certified / contractValue) * 100) : 0;
  const handed = p.handedOver ?? (p.status === "delivered" ? p.finish : undefined);
  if (out.retentionHeld > out.retentionReleased) out.retentionDue = retentionDueDate(handed, terms.defectsMonths);
  return out;
}

export function useContractSummaries() {
  const list = useAllProjects();
  const terms = contractTerms.use();
  const settings = useContractSettings();
  const vos = voCol.use();
  const certs = certCol.use();
  const inst = installments.use();
  const budgetList = budgets.use();
  return useMemo(() => list.map((p) => summarize(p, { terms, settings, vos, certs, inst, budgetList })), [list, terms, settings, vos, certs, inst, budgetList]);
}

// ---------- variations ----------

export function nextVoNo(projectId: string) {
  return Math.max(0, ...voCol.all().filter((v) => v.projectId === projectId).map((v) => v.no)) + 1;
}

/** Push an approved variation into the budget and, for installment-billed projects, the payment schedule. Idempotent. */
export function applyVariation(vo: VariationX) {
  if (vo.status !== "approved" || vo.appliedAt) return;
  const add = costByCode<CostCode>(vo.lines, "90");
  const b = budgets.all().find((x) => x.projectId === vo.projectId);
  if (b && add.length) budgets.upsert({ ...b, lines: mergeBudgetLines(b.lines, add) });
  const applied: { id: string; delta: number }[] = [];
  if (!isMeasured(contractTerms.all(), vo.projectId) && vo.amount) {
    const vat = getContractSettings().vatRate;
    const mine = installments.all().filter((i) => i.projectId === vo.projectId).sort((a, b2) => a.no - b2.no);
    const open = mine.filter((i) => i.status === "scheduled" || i.status === "due");
    const cv = contractValueWithVariations(vo.projectId) || 1;
    if (vo.amount > 0) {
      const id = `INS-${vo.id}`;
      const due = open[0]?.dueDate ?? addDaysIso(vo.approvedAt ?? TODAY, 30);
      installments.upsert({
        id,
        projectId: vo.projectId,
        no: Math.max(0, ...mine.map((i) => i.no)) + 1,
        title: `งานเพิ่ม ${vo.id} · ${vo.title}`,
        milestone: "งานเปลี่ยนแปลง",
        percent: r2((vo.amount / cv) * 100),
        amount: r2(vo.amount),
        vat: r2((vo.amount * vat) / 100),
        dueDate: due < TODAY ? TODAY : due,
        status: "scheduled",
      });
      applied.push({ id, delta: vo.amount });
    } else {
      const { deltas } = absorbOmission(
        open.map((i) => ({ id: i.id, amount: i.amount })),
        vo.amount,
      );
      for (const d of deltas) {
        const i = installments.get(d.id);
        if (!i) continue;
        const amount = r2(i.amount + d.delta);
        installments.upsert({ ...i, amount, vat: r2((amount * vat) / 100), title: i.title.includes(vo.id) ? i.title : `${i.title} (หักงานลด ${vo.id})` });
      }
      applied.push(...deltas);
    }
  }
  voCol.upsert({ ...vo, appliedAt: TODAY, budgetApplied: add, installmentApplied: applied });
}

// ---------- client certificates ----------

export const clientCertsOf = (certs: CertX[], projectId: string) => certs.filter((c) => c.side === "client" && c.projectId === projectId).sort((a, b) => a.no - b.no);

/** Figures of a client certificate at `pct` % complete, chained to the certificates before it. */
export function computeClientCert(projectId: string, no: number, pct: number, ctx: { certs: CertX[]; terms: ContractTerms; settings: ContractSettings; base: number; contractValue: number }) {
  const prior = priorTotals(clientCertsOf(ctx.certs, projectId), no);
  const gross = Math.round((ctx.contractValue * Math.min(100, Math.max(0, pct))) / 100);
  return certCalc({
    grossToDate: gross,
    previous: prior.previous,
    contractValue: ctx.contractValue,
    retentionPct: ctx.terms.retentionPct,
    retentionCapPct: ctx.terms.retentionCapPct,
    retentionBefore: prior.retention,
    advance: ctx.terms.advanceDate ? advanceAmount(ctx.terms, ctx.base) : 0,
    advanceBefore: prior.advance,
    vatRate: ctx.settings.vatRate,
    whtRate: ctx.terms.whtRate,
  });
}

export const LOCKED = "งวดบัญชีของวันที่นี้ปิดแล้ว เลือกวันที่ในงวดที่ยังเปิดอยู่";

/** Certify a client certificate: it becomes an AR invoice (ใบแจ้งหนี้) with retention and advance recovery. */
export function certifyClientCert(c: CertX, by: string, date = TODAY): string | undefined {
  if (isLockedDate(date, locksCol.all())) return LOCKED;
  const t = termsFor(contractTerms.all(), c.projectId);
  const due = addDaysIso(date, t.certPayDays || 30);
  const next: CertX = { ...c, status: "certified", certifiedBy: by, certifiedAt: date, date, dueDate: due };
  const item = certItem(next, t);
  const id = arDocsCol.nextId(docPrefix("IV", date));
  const p = getProject(c.projectId);
  const inv: ArInvoice = {
    id,
    kind: "invoice",
    installmentId: c.id,
    projectId: c.projectId,
    date,
    dueDate: due,
    customerName: t.customerName ?? p?.owner ?? c.projectId,
    customerTaxId: t.customerTaxId,
    customerBranch: t.customerBranch,
    customerAddress: t.customerAddress ?? p?.address,
    description: item.title,
    amount: item.amount,
    vat: item.vat,
    retention: r2(c.retention),
    taxPoint: "receipt",
    origin: "ipc",
    advanceRecovery: r2(c.advanceRecovery),
  };
  arDocsCol.upsert(inv);
  certCol.upsert({ ...next, invoiceNo: id });
}

/** Invoice the contract advance (เงินล่วงหน้า). */
export function invoiceAdvance(t: ContractTerms, base: number, date = TODAY): string | undefined {
  if (isLockedDate(date, locksCol.all())) return LOCKED;
  const amount = advanceAmount(t, base);
  if (!(amount > 0)) return "ยังไม่ได้กำหนด % เงินล่วงหน้า";
  const p = getProject(t.projectId);
  const id = arDocsCol.nextId(docPrefix("IV", date));
  const vat = r2((amount * getContractSettings().vatRate) / 100);
  arDocsCol.upsert({ id, kind: "invoice", installmentId: `ADV-${t.projectId}`, projectId: t.projectId, date, dueDate: addDaysIso(date, 15), customerName: t.customerName ?? p?.owner ?? t.projectId, customerTaxId: t.customerTaxId, customerBranch: t.customerBranch, customerAddress: t.customerAddress ?? p?.address, description: `เงินล่วงหน้าค่าก่อสร้าง ${t.advancePct}%`, amount, vat, retention: 0, taxPoint: "receipt", origin: "advance" });
  contractTerms.upsert({ ...t, advanceDate: date, advanceInvoiceNo: id });
}

/** Release the retention the customer holds: an AR invoice that moves 1135 to 1130 (and its deferred VAT at receipt). */
export function releaseClientRetention(t: ContractTerms, by: string, date = TODAY): string | undefined {
  if (isLockedDate(date, locksCol.all())) return LOCKED;
  const certs = certCol.all();
  const amount = retentionHeld(certs, t.projectId);
  if (!(amount > 0)) return "ไม่มีเงินประกันผลงานคงค้าง";
  const releaseVat = retentionReleaseVat(certs, t.projectId);
  const id = arDocsCol.nextId(docPrefix("IV", date));
  const next: ContractTerms = { ...t, retentionRelease: { date, amount, releaseVat, invoiceNo: id, by } };
  const item = releaseItem(next)!;
  const p = getProject(t.projectId);
  arDocsCol.upsert({ id, kind: "invoice", installmentId: item.id, projectId: t.projectId, date, dueDate: item.dueDate, customerName: t.customerName ?? p?.owner ?? t.projectId, customerTaxId: t.customerTaxId, customerBranch: t.customerBranch, customerAddress: t.customerAddress ?? p?.address, description: item.title, amount, vat: 0, retention: 0, taxPoint: "receipt", origin: "retention", releaseVat });
  contractTerms.upsert(next);
}

// ---------- subcontracts ----------

export const subCertsOf = (certs: CertX[], scId: string) => certs.filter((c) => c.side === "sub" && c.subcontractId === scId).sort((a, b) => a.no - b.no);

export function computeSubCert(sc: SubcontractX, no: number, measured: { lineId: string; qtyToDate: number }[], backCharges: number, certs: CertX[]) {
  const prior = priorTotals(subCertsOf(certs, sc.id), no);
  const gross = Math.round(measuredGross(sc.lines, measured) * 100) / 100;
  return certCalc({ grossToDate: gross, previous: prior.previous, contractValue: sc.value, retentionPct: sc.retentionPct, retentionCapPct: sc.retentionPct, retentionBefore: prior.retention, advance: sc.advance, advanceBefore: prior.advance, backCharges, vatRate: sc.vat ? getContractSettings().vatRate : 0, whtRate: sc.whtRate, whtOnRetention: true });
}

const TRADE_CAT: [RegExp, Category][] = [
  [/ไฟฟ้า/, "sub_elec"],
  [/ประปา|สุขาภิบาล/, "sub_plumb"],
  [/หลังคา|กันซึม/, "sub_roof"],
  [/ปรับอากาศ|แอร์/, "sub_hvac"],
  [/ก่อ|ฉาบ|กระเบื้อง|สี|ฝ้า/, "sub_finish"],
];
/** The procurement supplier record used to bill and pay a subcontractor; created when missing. */
export function ensureSupplier(s: SubcontractorX): Supplier {
  const linked = s.supplierId ? suppliers.get(s.supplierId) : undefined;
  if (linked) return linked;
  const cats = [...new Set(s.trades.map((t) => TRADE_CAT.find(([re]) => re.test(t))?.[1] ?? "sub_struct"))];
  const juristic = (s.taxId ?? "").startsWith("0");
  const sup: Supplier = {
    id: nextSupplierId(),
    name: s.name,
    taxId: s.taxId ?? "",
    branch: juristic ? "สำนักงานใหญ่" : "-",
    juristic,
    vatRegistered: juristic,
    address: s.address ?? "",
    contact: s.contact,
    phone: s.phone,
    email: s.email,
    categories: cats.length ? cats : ["sub_struct"],
    paymentTerms: 30,
    whtRate: getContractSettings().subWhtRate,
    bank: { bank: "", account: "", name: s.name },
    rating: { quality: 3, onTime: 3, price: 3 },
    status: "active",
    note: `สร้างจากทะเบียนผู้รับเหมาช่วง ${s.id}`,
    since: TODAY,
  };
  suppliers.upsert(sup);
  subCol.upsert({ ...s, supplierId: sup.id });
  return sup;
}

const billOf = (id: string) => supplierBills.get(id) as BillX | undefined;
const scCostCode = (sc: SubcontractX): CostCode => sc.costCode ?? sc.lines[0]?.costCode ?? "90";

/** A certified subcontract certificate becomes an approved supplier bill (WHT 3%) and a job-cost line. */
export function postSubCert(c: CertX, by?: string) {
  const sc = scCol.get(c.subcontractId ?? "");
  const s = sc ? subCol.get(sc.subcontractorId) : undefined;
  if (!sc || !s) return;
  const billId = `BILL-${c.id}`;
  if (billOf(billId)) return;
  const sup = ensureSupplier(s);
  const date = c.certifiedAt ?? c.date;
  const base = certBase(c);
  const costCode = scCostCode(sc);
  const bill: BillX & { approvedBy?: string } = {
    id: billId,
    supplierId: sup.id,
    supplierName: sup.name,
    supplierTaxId: sup.taxId || undefined,
    projectId: sc.projectId,
    costCode,
    date,
    dueDate: c.dueDate ?? addDaysIso(date, 30),
    subtotal: base,
    vat: r2(c.vat),
    whtRate: sc.whtRate,
    status: c.status === "paid" ? "paid" : "approved",
    paidDate: c.status === "paid" ? c.paidDate : undefined,
    lines: [{ description: `${sc.title} · เบิกงวดที่ ${c.no} (${sc.id})`, qty: 1, unit: "งวด", unitPrice: base }],
    retention: r2(c.retention),
    advanceRecovery: r2(c.advanceRecovery),
    certId: c.id,
    approvedBy: by ?? c.certifiedBy,
  };
  supplierBills.upsert(bill);
  costEntries.upsert({ id: `CE-${billId}`, projectId: sc.projectId, costCode, date, source: "subcontract", ref: billId, description: `${sc.title} งวดที่ ${c.no} · ${s.name}`, amount: r2(c.thisPeriod - c.backCharges) });
  certCol.upsert({ ...c, billId });
}

export function certifySubCert(c: CertX, by: string, date = TODAY): string | undefined {
  if (isLockedDate(date, locksCol.all())) return LOCKED;
  const next: CertX = { ...c, status: "certified", certifiedBy: by, certifiedAt: date, date, dueDate: addDaysIso(date, 30) };
  certCol.upsert(next);
  postSubCert(next, by);
}

/** Advance payment to a subcontractor: a supplier bill debited to 1160, recovered pro rata on later certificates. */
export function postSubAdvance(sc: SubcontractX, paidAlready = false) {
  if (!(sc.advance > 0) || !sc.signedAt) return;
  const id = `BILL-ADV-${sc.id}`;
  if (billOf(id)) return;
  const s = subCol.get(sc.subcontractorId);
  if (!s) return;
  const sup = ensureSupplier(s);
  const vat = sc.vat ? r2((sc.advance * getContractSettings().vatRate) / 100) : 0;
  const bill: BillX = {
    id,
    supplierId: sup.id,
    supplierName: sup.name,
    supplierTaxId: sup.taxId || undefined,
    projectId: sc.projectId,
    costCode: scCostCode(sc),
    date: sc.signedAt,
    dueDate: addDaysIso(sc.signedAt, 7),
    subtotal: sc.advance,
    vat,
    whtRate: sc.whtRate,
    status: paidAlready ? "paid" : "approved",
    paidDate: paidAlready ? addDaysIso(sc.signedAt, 7) : undefined,
    lines: [{ description: `เงินล่วงหน้า ${sc.title} (${sc.id})`, qty: 1, unit: "งาน", unitPrice: sc.advance }],
    billKind: "advance",
  };
  supplierBills.upsert(bill);
  scCol.upsert({ ...sc, advanceBillId: id });
}

export const subRetentionHeld = (certs: CertX[], scId: string) => sum(subCertsOf(certs, scId).filter((c) => c.status === "certified" || c.status === "paid").map((c) => c.retention));

/** Return the retention we hold to the subcontractor after the defects period: a bill debited to 2150. */
export function releaseSubRetention(sc: SubcontractX, date = TODAY): string | undefined {
  if (isLockedDate(date, locksCol.all())) return LOCKED;
  const amount = subRetentionHeld(certCol.all(), sc.id);
  if (!(amount > 0)) return "ไม่มีเงินประกันผลงานคงค้าง";
  const s = subCol.get(sc.subcontractorId);
  if (!s) return "ไม่พบผู้รับเหมาช่วง";
  const sup = ensureSupplier(s);
  const id = `BILL-RET-${sc.id}`;
  const bill: BillX = {
    id,
    supplierId: sup.id,
    supplierName: sup.name,
    supplierTaxId: sup.taxId || undefined,
    projectId: sc.projectId,
    date,
    dueDate: addDaysIso(date, 15),
    subtotal: amount,
    vat: 0,
    whtRate: 0,
    status: "approved",
    lines: [{ description: `คืนเงินประกันผลงาน ${sc.title} (${sc.id})`, qty: 1, unit: "งาน", unitPrice: amount }],
    billKind: "retention-release",
  };
  supplierBills.upsert(bill);
  scCol.upsert({ ...sc, retentionReleaseBillId: id });
}

export const subRetentionDue = (sc: SubcontractX) => (sc.completedAt ? retentionDueDate(sc.completedAt, sc.defectsMonths ?? 12) : undefined);

/** Status of a subcontract certificate including what accounting has paid on its bill. */
export function subCertState(c: CertX): CertX["status"] {
  if (c.status === "certified" && c.billId && supplierBills.get(c.billId)?.status === "paid") return "paid";
  return c.status;
}

// ---------- background sync ----------

let synced = false;
/**
 * Bring other modules in step with the contract records once per session: approved variations into budgets and
 * installments, certified subcontract certificates into supplier bills / job cost, subcontract advances into bills.
 * Every write is keyed by a deterministic id, so running it again changes nothing.
 */
export function syncContracts() {
  for (const vo of voCol.all()) if (vo.status === "approved" && !vo.appliedAt) applyVariation(vo);
  for (const sc of scCol.all()) if ((sc.status === "active" || sc.status === "completed") && sc.advance > 0 && sc.signedAt && !billOf(`BILL-ADV-${sc.id}`)) postSubAdvance(sc, sc.signedAt < addDaysIso(TODAY, -7));
  for (const c of certCol.all()) {
    if (c.side !== "sub") continue;
    if ((c.status === "certified" || c.status === "paid") && !billOf(`BILL-${c.id}`)) postSubCert(c);
    const b = billOf(`BILL-${c.id}`);
    if (b && b.status === "paid" && c.status === "certified") certCol.upsert({ ...c, status: "paid", paidDate: b.paidDate, billId: b.id });
  }
}
export function useContractsSync() {
  const ws = useWorkspace();
  const { edit } = useAccess();
  const ready = ws.status === "demo" || isLiveReady();
  useEffect(() => {
    if (!ready || !edit || synced) return;
    synced = true;
    syncContracts();
  }, [ready, edit]);
}

// ---------- misc ----------

export const thb = (n: number) => r2(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mb = (n: number) => (n / 1e6).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
