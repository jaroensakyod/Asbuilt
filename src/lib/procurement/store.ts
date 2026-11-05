// Procurement collections and the actions that move a purchase through
// PR → RFQ → PO → goods receipt → supplier bill, plus inventory moves.
// Every action writes the shared records other modules read:
//   supplierBills (accounting AP) and costEntries (project costs).

import "./seed";
import { createCollection } from "../collection";
import { costEntries, supplierBills, type CostCode, type CostEntry, type SupplierBill } from "../biz";
import { TODAY } from "../data";
import { ITEMS, type StockItem, type Supplier } from "./catalog";
import { addDays, APPROVAL_LIMIT, billStatusFor, generate, r2, VAT_RATE, type ProcBill } from "./gen";
import { avgOf, balKey, replay } from "./stock";
import { locProject, WAREHOUSE, type GoodsReceipt, type PurchaseOrder, type PurchaseRequest, type Quote, type StockMove } from "./types";

export const suppliers = createCollection<Supplier>("suppliers", () => generate().suppliers);
export const stockItems = createCollection<StockItem>("stock_items", ITEMS);
export const purchaseRequests = createCollection<PurchaseRequest>("purchase_requests", () => generate().prs);
export const purchaseOrders = createCollection<PurchaseOrder>("purchase_orders", () => generate().pos);
export const goodsReceipts = createCollection<GoodsReceipt>("goods_receipts", () => generate().receipts);
export const stockMoves = createCollection<StockMove>("stock_moves", () => generate().moves);

export { supplierBills, costEntries };
export const asProcBill = (b: SupplierBill) => b as ProcBill;

const year = (d: string) => d.slice(0, 4);

// ---------- money ----------

export function poTotals(po: Pick<PurchaseOrder, "lines" | "vatRate" | "whtRate">) {
  const subtotal = r2(po.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  const vat = r2((subtotal * po.vatRate) / 100);
  const wht = r2((subtotal * po.whtRate) / 100);
  return { subtotal, vat, total: r2(subtotal + vat), wht, payable: r2(subtotal + vat - wht) };
}
export function billTotals(b: Pick<SupplierBill, "subtotal" | "vat" | "whtRate">) {
  const wht = r2((b.subtotal * b.whtRate) / 100);
  return { total: r2(b.subtotal + b.vat), wht, payable: r2(b.subtotal + b.vat - wht) };
}

/** who may approve a PO of this grand total */
export const approvalNeeds = (total: number) => (total > APPROVAL_LIMIT ? "ผู้บริหาร" : "จัดซื้อ/ผู้บริหาร");
export const canApproveAmount = (role: string, total: number) => total <= APPROVAL_LIMIT || role === "exec" || role === "admin";

// ---------- receipts ----------

export function receivedByLine(po: PurchaseOrder, grs: GoodsReceipt[]) {
  const got = po.lines.map(() => 0);
  for (const g of grs) if (g.poId === po.id) for (const x of g.lines) got[x.line] = (got[x.line] ?? 0) + x.qty;
  return got;
}
export const receivedValue = (po: PurchaseOrder, grs: GoodsReceipt[]) => receivedByLine(po, grs).reduce((t, q, i) => t + q * po.lines[i].unitPrice, 0);
export const isOpenPO = (po: PurchaseOrder) => po.status === "approved" || po.status === "partial";

// ---------- PR / RFQ ----------

export function newPR(input: Omit<PurchaseRequest, "id" | "status">): PurchaseRequest {
  const pr: PurchaseRequest = { ...input, id: purchaseRequests.nextId(`PR-${year(input.date)}-`), status: "submitted" };
  purchaseRequests.upsert(pr);
  return pr;
}

function nextRfqId(date: string) {
  const prefix = `RFQ-${year(date)}-`;
  let max = 0;
  for (const p of purchaseRequests.all()) if (p.rfq?.id.startsWith(prefix)) max = Math.max(max, Number(p.rfq.id.slice(prefix.length)) || 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function saveQuotes(prId: string, quotes: Quote[]) {
  const pr = purchaseRequests.get(prId);
  if (!pr) return;
  const rfq = pr.rfq ?? { id: nextRfqId(TODAY), date: TODAY, quotes: [] };
  const winner = quotes.some((q) => q.supplierId === rfq.winner) ? rfq.winner : undefined;
  purchaseRequests.upsert({ ...pr, status: pr.status === "submitted" ? "rfq" : pr.status, rfq: { ...rfq, quotes: quotes.slice(0, 3), winner, reason: winner ? rfq.reason : undefined } });
}

export function chooseWinner(prId: string, supplierId: string, reason: string) {
  const pr = purchaseRequests.get(prId);
  if (!pr?.rfq) return;
  purchaseRequests.upsert({ ...pr, rfq: { ...pr.rfq, winner: supplierId, reason } });
}

export function rejectPR(prId: string, note: string) {
  const pr = purchaseRequests.get(prId);
  if (pr) purchaseRequests.upsert({ ...pr, status: "rejected", note: note || pr.note });
}

export const quoteTotal = (pr: PurchaseRequest, q: Quote) => r2(pr.lines.reduce((t, l, i) => t + l.qty * (q.prices[i] ?? 0), 0));

/** PO from the RFQ winner; waits for approval */
export function createPOFromPR(prId: string, by: string): PurchaseOrder | undefined {
  const pr = purchaseRequests.get(prId);
  const q = pr?.rfq?.quotes.find((x) => x.supplierId === pr.rfq?.winner);
  const s = q && suppliers.get(q.supplierId);
  if (!pr || !q || !s) return;
  const needed = pr.lines.map((l) => l.neededBy).sort()[0] ?? addDays(TODAY, q.leadDays);
  const po: PurchaseOrder = {
    id: purchaseOrders.nextId(`PO-${year(TODAY)}-`),
    prId: pr.id,
    projectId: pr.projectId,
    costCode: pr.costCode,
    kind: s.categories.every((c) => c.startsWith("sub_")) ? "service" : "goods",
    supplierId: s.id,
    date: TODAY,
    deliveryDate: needed > TODAY ? needed : addDays(TODAY, q.leadDays),
    lines: pr.lines.map((l, i) => ({ itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit, unitPrice: q.prices[i] ?? 0 })),
    vatRate: s.vatRegistered ? VAT_RATE : 0,
    whtRate: s.whtRate,
    paymentTerms: s.paymentTerms,
    status: "pending",
    requestedBy: by,
  };
  purchaseOrders.upsert(po);
  purchaseRequests.upsert({ ...pr, status: "ordered", poId: po.id });
  return po;
}

// ---------- PO approval ----------

export function approvePO(id: string, me: { name: string; role: string }) {
  const po = purchaseOrders.get(id);
  if (!po || po.status !== "pending") return false;
  if (!canApproveAmount(me.role, poTotals(po).total)) return false;
  purchaseOrders.upsert({ ...po, status: "approved", approvedBy: me.name, approvedRole: me.role, approvedDate: TODAY });
  return true;
}
export function setPOStatus(id: string, status: "rejected" | "cancelled", note?: string) {
  const po = purchaseOrders.get(id);
  if (po) purchaseOrders.upsert({ ...po, status, note: note || po.note });
}

// ---------- goods receipt → stock + cost ----------

export function receivePO(poId: string, input: { date: string; receiver: string; qty: number[]; photos: number; quality?: number; note?: string }) {
  const po = purchaseOrders.get(poId);
  if (!po || !isOpenPO(po)) return;
  const grs = goodsReceipts.all();
  const got = receivedByLine(po, grs);
  const lines = input.qty.map((q, i) => ({ line: i, qty: Math.max(0, Math.min(q, po.lines[i].qty - got[i])) })).filter((x) => x.qty > 0);
  if (!lines.length) return;
  const gr: GoodsReceipt = { id: goodsReceipts.nextId(`GR-${year(input.date)}-`), poId, projectId: po.projectId, date: input.date, receiver: input.receiver, lines, photos: input.photos, quality: input.quality, note: input.note };
  goodsReceipts.upsert(gr);

  if (po.kind === "goods") {
    const loc = po.projectId ? `SITE:${po.projectId}` : WAREHOUSE;
    const moves: StockMove[] = [];
    let mid = stockMoves.nextId(`MV-${year(input.date)}-`, 5);
    for (const x of lines) {
      const l = po.lines[x.line];
      const item = l.itemId ? stockItems.get(l.itemId) : undefined;
      if (!item?.stock) continue;
      moves.push({ id: mid, date: input.date, kind: "receive", itemId: item.id, qty: x.qty, unitCost: l.unitPrice, to: loc, projectId: po.projectId, costCode: po.costCode, ref: gr.id, by: input.receiver });
      mid = bumpId(mid, 5);
    }
    stockMoves.upsertMany(moves);
    // material delivered to a site is charged to the project on receipt
    if (po.projectId) {
      const amount = lines.reduce((t, x) => t + x.qty * po.lines[x.line].unitPrice, 0);
      costEntries.upsert({ id: `CE-${gr.id}`, projectId: po.projectId, costCode: po.costCode, date: input.date, source: "po", ref: gr.id, description: `รับวัสดุตาม ${po.id} · ${suppliers.get(po.supplierId)?.name ?? ""}`, amount: r2(amount) });
    }
  }
  const after = receivedByLine(po, [...grs, gr]);
  const full = po.lines.every((l, i) => after[i] >= l.qty);
  purchaseOrders.upsert({ ...po, status: full ? "received" : "partial" });
  return gr;
}

function bumpId(id: string, pad: number) {
  const m = id.match(/^(.*-)(\d+)$/);
  return m ? `${m[1]}${String(Number(m[2]) + 1).padStart(pad, "0")}` : id;
}

// ---------- supplier bills ----------

export function createBillFromGR(grId: string, input: { date: string; invoiceNo?: string }) {
  const gr = goodsReceipts.get(grId);
  const po = gr && purchaseOrders.get(gr.poId);
  const s = po && suppliers.get(po.supplierId);
  if (!gr || !po || !s) return;
  if (supplierBills.all().some((b) => asProcBill(b).grId === grId)) return;
  const lines = gr.lines.map((x) => ({ description: po.lines[x.line].description, qty: x.qty, unit: po.lines[x.line].unit, unitPrice: po.lines[x.line].unitPrice }));
  const subtotal = r2(lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  const bill: ProcBill = {
    id: supplierBills.nextId(`BILL-${year(input.date)}-`),
    supplierId: s.id,
    supplierName: s.name,
    supplierTaxId: s.taxId,
    poId: po.id,
    grId,
    invoiceNo: input.invoiceNo,
    projectId: po.projectId,
    costCode: po.costCode,
    date: input.date,
    dueDate: addDays(input.date, po.paymentTerms),
    subtotal,
    vat: r2((subtotal * po.vatRate) / 100),
    whtRate: po.whtRate,
    status: "open",
    lines,
  };
  supplierBills.upsert(bill);
  return bill;
}

/** progress claim of a subcontractor without a PO (งวดงานผู้รับเหมาช่วง) */
export function createClaim(input: { supplierId: string; projectId: string; costCode: CostCode; date: string; description: string; amount: number; invoiceNo?: string }) {
  const s = suppliers.get(input.supplierId);
  if (!s || input.amount <= 0) return;
  const subtotal = r2(input.amount);
  const bill: ProcBill = {
    id: supplierBills.nextId(`BILL-${year(input.date)}-`),
    supplierId: s.id,
    supplierName: s.name,
    supplierTaxId: s.taxId,
    projectId: input.projectId,
    costCode: input.costCode,
    date: input.date,
    dueDate: addDays(input.date, s.paymentTerms),
    subtotal,
    vat: s.vatRegistered ? r2((subtotal * VAT_RATE) / 100) : 0,
    whtRate: s.whtRate,
    status: "open",
    invoiceNo: input.invoiceNo,
    lines: [{ description: input.description, qty: 1, unit: "งวด", unitPrice: subtotal }],
  };
  supplierBills.upsert(bill);
  return bill;
}

/**
 * Approve a bill for payment. Goods delivered to a site were already charged at
 * receipt; service POs and subcontract claims are charged here.
 */
export function approveBill(id: string, by: string) {
  const b0 = supplierBills.get(id);
  if (!b0 || b0.status !== "open") return;
  const b = asProcBill(b0);
  supplierBills.upsert({ ...b, status: "approved", approvedBy: by } as ProcBill);
  const po = b.poId ? purchaseOrders.get(b.poId) : undefined;
  const charge = b.projectId && (!po || po.kind === "service");
  if (charge) {
    costEntries.upsert({
      id: `CE-${b.id}`,
      projectId: b.projectId!,
      costCode: b.costCode ?? "90",
      date: b.date,
      source: po ? "bill" : "subcontract",
      ref: b.id,
      description: `${b.lines[0]?.description ?? "ค่าจ้าง"} · ${b.supplierName}`,
      amount: b.subtotal,
    });
  }
}

export const billOfGR = (bills: SupplierBill[], grId: string) => bills.find((b) => asProcBill(b).grId === grId);
export { billStatusFor };

// ---------- inventory ----------

export function stockState(moves: StockMove[]) {
  return replay(moves).bal;
}
export const onHand = (bal: ReturnType<typeof stockState>, loc: string, itemId: string) => bal.get(balKey(loc, itemId)) ?? { qty: 0, value: 0 };

type MoveInput = { date: string; itemId: string; qty: number; by: string; note?: string };

/** Issue from a location. From the warehouse the project is charged at moving-average cost; site stock was charged on receipt. */
export function issueStock(input: MoveInput & { from: string; projectId: string; costCode: CostCode }) {
  const bal = stockState(stockMoves.all());
  const avg = r2(avgOf(bal.get(balKey(input.from, input.itemId))));
  const m: StockMove = { id: stockMoves.nextId(`MV-${year(input.date)}-`, 5), date: input.date, kind: "issue", itemId: input.itemId, qty: input.qty, unitCost: avg, from: input.from, projectId: input.projectId, costCode: input.costCode, by: input.by, note: input.note };
  stockMoves.upsert(m);
  if (input.from === WAREHOUSE) {
    const name = stockItems.get(input.itemId)?.name ?? input.itemId;
    costEntries.upsert({ id: `CE-${m.id}`, projectId: input.projectId, costCode: input.costCode, date: input.date, source: "po", ref: m.id, description: `เบิก${name} จากคลังกลาง`, amount: r2(input.qty * avg) });
  }
  return m;
}

/** Transfer between locations; cost follows the material between projects. */
export function transferStock(input: MoveInput & { from: string; to: string; costCode?: CostCode }) {
  const bal = stockState(stockMoves.all());
  const avg = r2(avgOf(bal.get(balKey(input.from, input.itemId))));
  const src = locProject(input.from);
  const dst = locProject(input.to);
  const m: StockMove = { id: stockMoves.nextId(`MV-${year(input.date)}-`, 5), date: input.date, kind: "transfer", itemId: input.itemId, qty: input.qty, unitCost: avg, from: input.from, to: input.to, projectId: dst ?? src, costCode: input.costCode, by: input.by, note: input.note };
  stockMoves.upsert(m);
  const name = stockItems.get(input.itemId)?.name ?? input.itemId;
  const code = input.costCode ?? stockItems.get(input.itemId)?.costCode ?? "90";
  const amt = r2(input.qty * avg);
  const out: CostEntry[] = [];
  // leaving a site (already charged) credits it; arriving at a site charges it
  if (src) out.push({ id: `CE-${m.id}-OUT`, projectId: src, costCode: code, date: input.date, source: "po", ref: m.id, description: `โอน${name}ออกไป ${dst ?? "คลังกลาง"}`, amount: -amt });
  if (dst) out.push({ id: `CE-${m.id}-IN`, projectId: dst, costCode: code, date: input.date, source: "po", ref: m.id, description: `รับโอน${name}จาก ${src ?? "คลังกลาง"}`, amount: amt });
  costEntries.upsertMany(out);
  return m;
}

/** Stock count adjustment (+/-). New stock found is valued at the current average (or the given cost). */
export function adjustStock(input: MoveInput & { loc: string; unitCost?: number }) {
  const bal = stockState(stockMoves.all());
  const avg = r2(avgOf(bal.get(balKey(input.loc, input.itemId))));
  const m: StockMove = {
    id: stockMoves.nextId(`MV-${year(input.date)}-`, 5),
    date: input.date,
    kind: "adjust",
    itemId: input.itemId,
    qty: input.qty,
    unitCost: input.qty > 0 ? (input.unitCost ?? avg) : avg,
    ...(input.qty >= 0 ? { to: input.loc } : { from: input.loc }),
    by: input.by,
    note: input.note,
  };
  stockMoves.upsert(m);
  return m;
}

/** Manual receipt into a location without a PO (returns, free issue, opening balance). */
export function receiveStock(input: MoveInput & { to: string; unitCost: number }) {
  const m: StockMove = { id: stockMoves.nextId(`MV-${year(input.date)}-`, 5), date: input.date, kind: "receive", itemId: input.itemId, qty: input.qty, unitCost: input.unitCost, to: input.to, projectId: locProject(input.to), by: input.by, note: input.note };
  stockMoves.upsert(m);
  return m;
}

// ---------- suppliers ----------

export type SupplierStats = { pos: number; open: number; spend12: number; onTimePct?: number; quality?: number; priceScore?: number; score: number; lastPO?: string };

export function supplierStats(s: Supplier, pos: PurchaseOrder[], grs: GoodsReceipt[], bills: SupplierBill[], prs: PurchaseRequest[]): SupplierStats {
  const mine = pos.filter((p) => p.supplierId === s.id && p.status !== "rejected" && p.status !== "cancelled");
  const since = addDays(TODAY, -365);
  const spend12 = bills.filter((b) => b.supplierId === s.id && b.date >= since).reduce((t, b) => t + b.subtotal, 0);
  let onTime = 0;
  let measured = 0;
  const qs: number[] = [];
  for (const p of mine) {
    const first = grs.filter((g) => g.poId === p.id).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (first) {
      measured++;
      if (first.date <= p.deliveryDate) onTime++;
    }
    for (const g of grs) if (g.poId === p.id && g.quality) qs.push(g.quality);
  }
  const prices: number[] = [];
  for (const pr of prs) {
    const quotes = pr.rfq?.quotes ?? [];
    if (quotes.length < 2) continue;
    const mineQ = quotes.find((q) => q.supplierId === s.id);
    if (!mineQ) continue;
    const totals = quotes.map((q) => quoteTotal(pr, q));
    const rel = quoteTotal(pr, mineQ) / Math.max(1, Math.min(...totals));
    prices.push(Math.max(1, Math.min(5, 5 - (rel - 1) * 25)));
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined);
  const onTimePct = measured ? (onTime / measured) * 100 : undefined;
  const quality = avg(qs);
  const priceScore = avg(prices);
  const q = quality ?? s.rating.quality;
  const t = onTimePct !== undefined ? 1 + (onTimePct / 100) * 4 : s.rating.onTime;
  const pr = priceScore ?? s.rating.price;
  return {
    pos: mine.length,
    open: mine.filter(isOpenPO).length + mine.filter((p) => p.status === "pending").length,
    spend12,
    onTimePct,
    quality,
    priceScore,
    score: (q + t + pr) / 3,
    lastPO: mine.map((p) => p.date).sort().at(-1),
  };
}

export function nextSupplierId() {
  return suppliers.nextId("SUP-", 3);
}
