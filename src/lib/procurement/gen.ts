// Deterministic demo history for procurement: PR → RFQ → PO → goods receipt →
// supplier bill, subcontract progress claims, stock moves and the actual cost
// lines they produce. Pure (no React, no collections): the seed module feeds
// it to the collections, and server pages may import it for static params.
//
// Volumes follow each active project's progress: a cost code's material is
// ordered shortly before its phase starts, delivered as the phase runs and
// billed after delivery; subcontract claims are monthly while the phase runs.

import { projects, seeded, TODAY, type Project } from "../data";
import { COST_CODES, type CostCode, type CostEntry, type SupplierBill } from "../biz";
import { itemById, ITEMS, SEED_SUPPLIERS, type Category, type Supplier } from "./catalog";
import { replay } from "./stock";
import { siteLoc, WAREHOUSE, type GoodsReceipt, type POLine, type PurchaseOrder, type PurchaseRequest, type Quote, type StockMove } from "./types";

// ---------- shared model constants ----------

export const VAT_RATE = 7;
/** POs above this grand total need an executive (or admin) to approve */
export const APPROVAL_LIMIT = 200_000;
/** budget fallback: share of the contract value when no estimate budget exists */
export const BUDGET_RATIO = 0.82;

/** typical share of a house budget per cost code (%) */
export const CODE_WEIGHT: Record<CostCode, number> = { "01": 2, "02": 10, "03": 22, "04": 10, "05": 8, "06": 6, "07": 5, "08": 4, "09": 7, "10": 11, "11": 4, "12": 5, "13": 3, "90": 3 };
/** progress window (% of the whole project) in which each cost code is built */
export const CODE_WINDOW: Record<CostCode, [number, number]> = {
  "01": [0, 4],
  "02": [2, 16],
  "03": [12, 42],
  "04": [36, 58],
  "05": [50, 64],
  "06": [52, 82],
  "07": [52, 82],
  "08": [72, 90],
  "09": [66, 86],
  "10": [74, 96],
  "11": [86, 98],
  "12": [88, 100],
  "13": [90, 100],
  "90": [0, 100],
};
export const CODES = Object.keys(COST_CODES) as CostCode[];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** expected completion (0–1) of a cost code when the project is at `pct` % */
export const codeEarned = (code: CostCode, pct: number) => {
  const [a, b] = CODE_WINDOW[code];
  return clamp01((pct - a) / (b - a));
};

/** part of each cost code done by subcontractors (rest is material) */
const SUB_SHARE: Record<CostCode, number> = { "01": 0, "02": 0.35, "03": 0.4, "04": 0.45, "05": 0.3, "06": 0.4, "07": 0.4, "08": 0.15, "09": 0, "10": 0.4, "11": 0.5, "12": 0.1, "13": 0.5, "90": 0 };
const SUB_CAT: Partial<Record<CostCode, Category>> = { "02": "sub_struct", "03": "sub_struct", "04": "sub_finish", "05": "sub_roof", "06": "sub_elec", "07": "sub_plumb", "08": "sub_hvac", "10": "sub_finish", "11": "sub_finish", "12": "sub_plumb", "13": "sub_struct" };

type Pkg = { share: number; items: [string, number][] };
const PKGS: Partial<Record<CostCode, Pkg[]>> = {
  "02": [
    { share: 0.35, items: [["PILE-I18", 1]] },
    { share: 0.45, items: [["RMC-240", 1]] },
  ],
  "03": [
    { share: 0.5, items: [["RMC-280", 1]] },
    { share: 0.4, items: [["RB-DB16", 0.45], ["RB-DB20", 0.35], ["RB-RB9", 0.2]] },
  ],
  "04": [{ share: 1, items: [["BRK-AAC", 0.5], ["CEM-AAC", 0.15], ["CEM-MRT", 0.3], ["LINTEL", 0.05]] }],
  "05": [{ share: 1, items: [["ROOF-CT", 0.4], ["ROOF-TRS", 0.45], ["ROOF-INS", 0.15]] }],
  "06": [{ share: 1, items: [["EL-THW25", 0.25], ["EL-THW4", 0.12], ["EL-EMT", 0.1], ["EL-DB", 0.08], ["EL-CB", 0.1], ["EL-SW", 0.15], ["EL-LED", 0.2]] }],
  "07": [{ share: 1, items: [["PL-PPR20", 0.15], ["PL-PVC4", 0.12], ["PL-PVC2", 0.1], ["PL-FIT", 0.15], ["PL-SEPTIC", 0.18], ["PL-TANK", 0.15], ["PL-PUMP", 0.15]] }],
  "08": [{ share: 1, items: [["AC-12K", 0.55], ["AC-18K", 0.35], ["AC-PIPE", 0.1]] }],
  "09": [{ share: 1, items: [["DW-ALU", 0.45], ["DW-SLIDE", 0.25], ["DW-WOOD", 0.2], ["DW-UPVC", 0.1]] }],
  "10": [{ share: 0.75, items: [["TL-GR60", 0.55], ["TL-CER", 0.25], ["TL-ADH", 0.1], ["TL-LAM", 0.1]] }],
  "11": [{ share: 1, items: [["PT-PRM", 0.2], ["PT-INT", 0.4], ["PT-EXT", 0.3], ["PT-WP", 0.1]] }],
  "12": [{ share: 1, items: [["SN-WC", 0.35], ["SN-BASIN", 0.2], ["SN-SHOWER", 0.2], ["SN-HEATER", 0.15], ["SN-SINK", 0.1]] }],
  "13": [{ share: 1, items: [["EX-PAVE", 0.5], ["EX-FENCE", 0.35], ["EX-DRAIN", 0.15]] }],
};
/** part of a code's material issued from the central warehouse instead of a PO */
const WH_ISSUE: Partial<Record<CostCode, Pkg>> = {
  "02": { share: 0.2, items: [["RB-DB12", 0.6], ["RB-RB6", 0.25], ["WIRE-TIE", 0.15]] },
  "03": { share: 0.1, items: [["CEM-PC", 0.65], ["FORM-PLY", 0.35]] },
  "10": { share: 0.25, items: [["WD-GYP", 0.7], ["WD-CLINE", 0.3]] },
};

/** cost performance per project (1 = on budget) and specific overruns */
const FACTOR: Record<string, number> = { "HC-2025-04": 1.0, "HC-2026-01": 0.97, "HC-2026-02": 1.08, "HC-2026-05": 0.98, "HC-2025-03": 1.05, "HC-2026-04": 1.0, "HC-2026-03": 1.07, "HC-2026-06": 0.95, "HC-2026-07": 1.0, "HC-2026-08": 1.04, "HC-2026-09": 0.96 };
const CODE_FACTOR: Record<string, number> = { "HC-2026-08|02": 1.38, "HC-2026-02|06": 1.28, "HC-2026-03|03": 1.16, "HC-2025-03|05": 1.12, "HC-2026-01|11": 1.1 };
const SUB_OVERRIDE: Record<string, string> = { "HC-2026-01|11": "SUP-025" };

export type ProcBill = SupplierBill & { grId?: string; invoiceNo?: string; approvedBy?: string };

export const isActiveProject = (p: Pick<Project, "status">) => p.status === "building" || p.status === "handover";

export function fallbackBudget(p: Pick<Project, "value">) {
  const total = p.value * 1e6 * BUDGET_RATIO;
  return CODES.map((c) => ({ costCode: c, amount: Math.round((total * CODE_WEIGHT[c]) / 100) }));
}

// ---------- date helpers ----------

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(Date.parse(d) + n * DAY);
const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** calendar date at which the project reached (or will reach) `q` % progress */
export function dateAt(p: Pick<Project, "start" | "finish" | "actual">, q: number) {
  const s = Date.parse(p.start);
  const t = Date.parse(TODAY);
  const f = Date.parse(p.finish);
  if (p.actual <= 0) return TODAY;
  if (q <= p.actual) return iso(s + ((t - s) * q) / p.actual);
  return iso(t + ((f - t) * (q - p.actual)) / Math.max(1, 100 - p.actual));
}

export function billStatusFor(date: string, dueDate: string): Pick<SupplierBill, "status" | "paidDate"> {
  if (dueDate <= addDays(TODAY, -1)) return { status: "paid", paidDate: dueDate };
  if (date <= addDays(TODAY, -5)) return { status: "approved" };
  return { status: "open" };
}

// ---------- generator ----------

export type ProcSeed = {
  suppliers: Supplier[];
  prs: PurchaseRequest[];
  pos: PurchaseOrder[];
  receipts: GoodsReceipt[];
  bills: ProcBill[];
  costs: CostEntry[];
  moves: StockMove[];
};

let cache: ProcSeed | null = null;
export const generate = () => (cache ??= build());

const FOREMAN = "สมศักดิ์ แก้วมณี";
const BUYER = "วิภาวรรณ ทองดี";
const EXEC = "ประเสริฐ อุดมสุข";
const NORTH = new Set(["เชียงใหม่", "ขอนแก่น"]);

type DraftPO = { po: PurchaseOrder; pr?: PurchaseRequest; grs: GoodsReceipt[]; bills: ProcBill[]; moves: StockMove[] };

function build(): ProcSeed {
  const rnd = seeded(4404);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const supById = new Map(SEED_SUPPLIERS.map((s) => [s.id, s]));

  const eligible = (cats: Category[]) => SEED_SUPPLIERS.filter((s) => s.status === "active" && cats.every((c) => s.categories.includes(c)));
  const chooseSupplier = (cats: Category[], p?: Project) => {
    const list = eligible(cats);
    if (!list.length) return SEED_SUPPLIERS[0];
    if (p && NORTH.has(p.province)) {
      const n = list.find((s) => s.id === "SUP-026");
      if (n) return n;
    }
    const local = list.filter((s) => s.id !== "SUP-026");
    const pool = local.length ? local : list;
    if (p && p.value > 20) {
      const big = pool.find((s) => s.id === "SUP-021" || s.id === "SUP-003");
      if (big && rnd() < 0.8) return big;
    }
    const specialists = [...pool].sort((a, b) => a.categories.length - b.categories.length);
    return rnd() < 0.75 ? specialists[0] : specialists[Math.floor(rnd() * specialists.length)];
  };

  const drafts: DraftPO[] = [];
  const subBills: { bill: ProcBill }[] = [];
  const petty: CostEntry[] = [];
  const whIssues: StockMove[] = [];
  const pendingPRs: PurchaseRequest[] = [];

  const makeLines = (pkg: Pkg, amount: number, pf: number): POLine[] =>
    pkg.items.map(([id, w]) => {
      const item = itemById(id)!;
      const unitPrice = Math.round(item.price * pf * between(0.98, 1.02));
      let qty = Math.max(1, Math.round((amount * w) / unitPrice));
      if (qty > 300) qty = Math.round(qty / 10) * 10;
      return { itemId: id, description: item.name, qty, unit: item.unit, unitPrice };
    });

  const makeQuotes = (lines: POLine[], winner: Supplier, cats: Category[], lead: number, rfqDate: string): { quotes: Quote[]; reason: string } => {
    const others = eligible(cats).filter((s) => s.id !== winner.id);
    const comp: Supplier[] = [];
    while (others.length && comp.length < 2) comp.push(others.splice(Math.floor(rnd() * others.length), 1)[0]);
    const valid = addDays(rfqDate, 30);
    const quotes: Quote[] = [{ supplierId: winner.id, prices: lines.map((l) => l.unitPrice), leadDays: lead, validUntil: valid }];
    let cheaperLater = false;
    for (const c of comp) {
      if (rnd() < 0.25 && !cheaperLater) {
        cheaperLater = true;
        quotes.push({ supplierId: c.id, prices: lines.map((l) => Math.round(l.unitPrice * between(0.96, 0.99))), leadDays: lead + Math.round(between(8, 15)), validUntil: valid, note: "ต้องสั่งผลิต" });
      } else {
        quotes.push({ supplierId: c.id, prices: lines.map((l) => Math.round(l.unitPrice * between(1.02, 1.12))), leadDays: Math.max(3, lead + Math.round(between(-2, 5))), validUntil: valid });
      }
    }
    const reason = !comp.length
      ? "ผู้ขายรายเดียวที่ส่งได้ในพื้นที่ ใช้ราคาตามสัญญาราคาประจำปี"
      : cheaperLater
        ? `ราคาต่ำสุดเป็นของผู้ขายอีกราย แต่ส่งของได้ช้ากว่ากำหนดใช้งาน เลือกรายที่ส่งได้ใน ${lead} วัน`
        : ["ราคารวมต่ำสุด ส่งของได้ตามกำหนด", "ราคาต่ำสุด และมีประวัติส่งของตรงเวลา", "ราคาต่ำสุด เครดิตการชำระเงินยาวกว่า"][Math.floor(rnd() * 3)];
    return { quotes: quotes.sort(() => 0), reason };
  };

  const makeBill = (s: Supplier, d: { date: string; projectId?: string; costCode: CostCode; poId?: string; lines: SupplierBill["lines"] }): ProcBill => {
    const subtotal = r2(d.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));
    const dueDate = addDays(d.date, s.paymentTerms);
    return {
      id: "",
      supplierId: s.id,
      supplierName: s.name,
      supplierTaxId: s.taxId,
      poId: d.poId,
      projectId: d.projectId,
      costCode: d.costCode,
      date: d.date,
      dueDate,
      subtotal,
      vat: s.vatRegistered ? r2((subtotal * VAT_RATE) / 100) : 0,
      whtRate: s.whtRate,
      ...billStatusFor(d.date, dueDate),
      invoiceNo: s.juristic ? `IV${d.date.slice(2, 4)}${d.date.slice(5, 7)}-${String(Math.floor(between(100, 9999))).padStart(4, "0")}` : undefined,
      lines: d.lines,
    };
  };

  // ----- project purchases -----
  const active = projects.filter(isActiveProject);
  for (const p of active) {
    const f = FACTOR[p.id] ?? 1;
    const budget = new Map(fallbackBudget(p).map((l) => [l.costCode, l.amount]));
    const big = p.value > 20;
    const receiverOf = () => (rnd() < 0.7 ? FOREMAN : p.pm);

    for (const code of CODES) {
      const [a, b] = CODE_WINDOW[code];
      const cf = f * (CODE_FACTOR[`${p.id}|${code}`] ?? 1) * between(0.97, 1.03);
      const codeBudget = budget.get(code) ?? 0;
      const earnedCode = codeEarned(code, p.actual);

      // petty / overhead
      if (code === "01" && earnedCode > 0) {
        const amt = codeBudget * cf * earnedCode;
        petty.push({ id: `CE-PC-${p.id}-01A`, projectId: p.id, costCode: "01", date: addDays(p.start, -21), source: "petty", description: "ค่าธรรมเนียมขออนุญาตก่อสร้างและค่าคัดแบบ", amount: r2(amt * 0.55) });
        petty.push({ id: `CE-PC-${p.id}-01B`, projectId: p.id, costCode: "01", date: addDays(p.start, 3), source: "petty", description: "ค่ารังวัด วางผัง และทดสอบดิน", amount: r2(amt * 0.45) });
        continue;
      }
      if (code === "90") {
        const months = Math.max(1, Math.round((Date.parse(p.finish) - Date.parse(p.start)) / (30.4 * DAY)));
        for (let d = new Date(p.start + "T00:00:00Z"); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
          const day = `${iso(d.getTime()).slice(0, 7)}-28`;
          if (day > TODAY) break;
          if (day < p.start) continue;
          petty.push({ id: `CE-PC-${p.id}-${day.slice(0, 7)}`, projectId: p.id, costCode: "90", date: day, source: "petty", description: "ค่าน้ำ-ไฟหน้างาน สำนักงานสนาม และประกันภัยงานก่อสร้าง", amount: r2(((codeBudget * f) / months) * between(0.85, 1.15)) });
        }
        continue;
      }

      const matAmount = codeBudget * cf * (1 - SUB_SHARE[code]);
      const wh = WH_ISSUE[code];

      for (const pkg of PKGS[code] ?? []) {
        const T = big ? 2 : 1;
        const cats = [...new Set(pkg.items.map(([id]) => itemById(id)!.category))];
        for (let t = 0; t < T; t++) {
          const wa = a + ((b - a) * t) / T;
          const wb = a + ((b - a) * (t + 1)) / T;
          const amount = (matAmount * (1 - (wh?.share ?? 0)) * pkg.share) / T;
          if (wa - 6 > p.actual) {
            // upcoming need: a PR waiting for purchasing
            if (wa - 13 <= p.actual && t === 0) {
              const s = chooseSupplier(cats, p);
              const lines = makeLines(pkg, amount, 1);
              const date = addDays(TODAY, -Math.round(between(1, 6)));
              const needed = maxDate(addDays(TODAY, 10), dateAt(p, wa));
              const pr: PurchaseRequest = {
                id: "",
                projectId: p.id,
                costCode: code,
                date,
                requestedBy: rnd() < 0.5 ? FOREMAN : p.pm,
                lines: lines.map((l) => ({ itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit, neededBy: needed })),
                status: "submitted",
                note: `เตรียมวัสดุ${COST_CODES[code]}`,
              };
              if (rnd() < 0.5) {
                const { quotes } = makeQuotes(lines, s, cats, Math.round(between(5, 10)), addDays(date, 1));
                pr.status = "rfq";
                pr.rfq = { id: "", date: minDate(addDays(date, 1), TODAY), quotes };
              }
              pendingPRs.push(pr);
            }
            continue;
          }
          const earned = clamp01((p.actual - wa) / (wb - wa));
          const s = chooseSupplier(cats, p);
          const pf = between(0.96, 1.04);
          const lines = makeLines(pkg, amount, pf);
          const subtotal = lines.reduce((x, l) => x + l.qty * l.unitPrice, 0);
          let rf = earned >= 0.97 ? 1 : earned <= 0 ? 0 : Math.min(1, earned * 1.3 + 0.1);
          if (rf > 0.95) rf = 1;
          const span = wb - wa;
          const lead = Math.round(between(5, 12));
          let poDate: string;
          let deliveryDate: string;
          const grDates: { date: string; part: number }[] = [];
          if (rf > 0) {
            const r1 = minDate(maxDate(dateAt(p, wa + span * 0.08), addDays(p.start, 2)), addDays(TODAY, -1 - Math.round(between(0, 3))));
            const onTime = rnd() < (s.rating.onTime / 5) * 0.97;
            deliveryDate = onTime ? addDays(r1, Math.round(between(0, 3))) : addDays(r1, -Math.round(between(2, 7)));
            poDate = minDate(addDays(deliveryDate, -lead), addDays(r1, -2));
            if (rf === 1 && subtotal > 80000) {
              const r2d = maxDate(minDate(dateAt(p, wa + span * 0.5), addDays(TODAY, -1)), addDays(r1, 3));
              grDates.push({ date: r1, part: 0.6 }, { date: r2d, part: 1 });
            } else grDates.push({ date: r1, part: rf });
          } else {
            deliveryDate = maxDate(dateAt(p, wa), addDays(TODAY, Math.round(between(2, 12))));
            poDate = minDate(addDays(TODAY, -Math.round(between(1, 14))), addDays(deliveryDate, -7));
          }
          const po: PurchaseOrder = {
            id: "",
            projectId: p.id,
            costCode: code,
            kind: "goods",
            supplierId: s.id,
            date: poDate,
            deliveryDate,
            lines,
            vatRate: s.vatRegistered ? VAT_RATE : 0,
            whtRate: s.whtRate,
            paymentTerms: s.paymentTerms,
            status: rf === 1 ? "received" : rf > 0 ? "partial" : "approved",
            requestedBy: BUYER,
            note: big ? `งวดจัดส่งที่ ${t + 1}/${T}` : undefined,
          };
          const total = subtotal * (1 + po.vatRate / 100);
          po.approvedBy = total > APPROVAL_LIMIT ? EXEC : BUYER;
          po.approvedRole = total > APPROVAL_LIMIT ? "exec" : "purchasing";
          po.approvedDate = poDate;
          const prDate = addDays(poDate, -Math.round(between(3, 7)));
          const pr: PurchaseRequest = {
            id: "",
            projectId: p.id,
            costCode: code,
            date: prDate,
            requestedBy: rnd() < 0.5 ? FOREMAN : p.pm,
            lines: lines.map((l) => ({ itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit, neededBy: deliveryDate })),
            status: "ordered",
          };
          if (subtotal >= 30000) {
            const rfqDate = addDays(prDate, 1);
            const { quotes, reason } = makeQuotes(lines, s, cats, lead, rfqDate);
            pr.rfq = { id: "", date: rfqDate, quotes, winner: s.id, reason };
          }
          const d: DraftPO = { po, pr, grs: [], bills: [], moves: [] };

          // receipts, consumption, bills
          let done = lines.map(() => 0);
          const consumeTotal = lines.map((l) => Math.round(l.qty * Math.min(earned, rf) * (earned >= 0.97 ? 0.97 : 1)));
          const consumed = lines.map(() => 0);
          for (const g of grDates) {
            const target = lines.map((l) => Math.round(l.qty * g.part));
            const gl = lines.map((_, i) => ({ line: i, qty: Math.max(0, target[i] - done[i]) })).filter((x) => x.qty > 0);
            done = lines.map((_, i) => Math.max(done[i], target[i]));
            if (!gl.length) continue;
            const gr: GoodsReceipt = { id: "", poId: "", projectId: p.id, date: g.date, receiver: receiverOf(), lines: gl, photos: 1 + Math.floor(rnd() * 3), quality: Math.max(2, Math.min(5, Math.round(s.rating.quality + between(-0.8, 0.6)))) };
            d.grs.push(gr);
            for (const x of gl) {
              const l = lines[x.line];
              const item = itemById(l.itemId!)!;
              if (!item.stock) continue;
              d.moves.push({ id: "", date: g.date, kind: "receive", itemId: item.id, qty: x.qty, unitCost: l.unitPrice, to: siteLoc(p.id), projectId: p.id, costCode: code, ref: "", by: gr.receiver });
              const use = Math.min(x.qty, consumeTotal[x.line] - consumed[x.line]);
              if (use > 0) {
                consumed[x.line] += use;
                d.moves.push({ id: "", date: minDate(addDays(g.date, Math.round(between(3, 12))), TODAY), kind: "issue", itemId: item.id, qty: use, unitCost: 0, from: siteLoc(p.id), projectId: p.id, costCode: code, by: FOREMAN, note: "เบิกใช้หน้างาน" });
              }
            }
            const billDate = addDays(g.date, Math.round(between(0, 6)));
            if (billDate <= TODAY) {
              const bill = makeBill(s, { date: billDate, projectId: p.id, costCode: code, lines: gl.map((x) => ({ description: lines[x.line].description, qty: x.qty, unit: lines[x.line].unit, unitPrice: lines[x.line].unitPrice })) });
              bill.grId = "#" + d.grs.length;
              d.bills.push(bill);
            }
          }
          drafts.push(d);
        }
      }

      // warehouse issues for this code
      if (wh && earnedCode > 0) {
        const amount = matAmount * wh.share * earnedCode;
        const n = earnedCode > 0.6 ? 3 : earnedCode > 0.25 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const q = a + (Math.min(b, p.actual) - a) * ((k + 0.5) / n);
          const date = minDate(dateAt(p, q), addDays(TODAY, -1));
          for (const [id, w] of wh.items) {
            const item = itemById(id)!;
            const qty = Math.max(1, Math.round((amount * w) / n / item.price));
            whIssues.push({ id: "", date, kind: "issue", itemId: id, qty, unitCost: 0, from: WAREHOUSE, projectId: p.id, costCode: code, by: FOREMAN, note: `เบิกจากคลังกลางไป ${p.id}` });
          }
        }
      }

      // subcontract progress claims (no PO, one bill per month)
      const sc = SUB_CAT[code];
      if (sc && earnedCode > 0) {
        const total = codeBudget * cf * SUB_SHARE[code] * earnedCode;
        const ov = SUB_OVERRIDE[`${p.id}|${code}`];
        let s = ov ? supById.get(ov)! : chooseSupplier([sc], p);
        if (big && (sc === "sub_struct" || sc === "sub_elec")) s = supById.get("SUP-021")!;
        const d0 = dateAt(p, a);
        const d1 = minDate(dateAt(p, Math.min(b, p.actual)), addDays(TODAY, -1));
        const dates: string[] = [];
        for (let d = new Date(d0.slice(0, 7) + "-25T00:00:00Z"); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
          const day = iso(d.getTime());
          if (day > d1) break;
          if (day >= addDays(d0, 14)) dates.push(day);
        }
        if (!dates.length || dates[dates.length - 1] < addDays(d1, -20)) dates.push(d1);
        const w = dates.map(() => between(0.8, 1.2));
        const ws = w.reduce((x, y) => x + y, 0);
        dates.forEach((date, i) => {
          const amt = Math.round((total * w[i]) / ws / 100) * 100;
          if (amt <= 0) return;
          const bill = makeBill(s, { date, projectId: p.id, costCode: code, lines: [{ description: `ค่าจ้าง${COST_CODES[code]} งวดที่ ${i + 1} ตามผลงาน`, qty: 1, unit: "งวด", unitPrice: amt }] });
          subBills.push({ bill });
        });
      }
    }
  }

  // planning project: first RFQ for piles
  {
    const p = projects.find((x) => x.status === "planning" && x.id === "HC-2026-10");
    if (p) {
      const pile = itemById("PILE-I18")!;
      pendingPRs.push({
        id: "",
        projectId: p.id,
        costCode: "02",
        date: addDays(TODAY, -4),
        requestedBy: p.pm,
        lines: [{ itemId: pile.id, description: pile.name, qty: 64, unit: pile.unit, neededBy: addDays(p.start, 3) }],
        status: "rfq",
        rfq: {
          id: "",
          date: addDays(TODAY, -3),
          quotes: [
            { supplierId: "SUP-004", prices: [1320], leadDays: 7, validUntil: addDays(TODAY, 27) },
            { supplierId: "SUP-005", prices: [1295], leadDays: 12, validUntil: addDays(TODAY, 27), note: "รวมค่าขนส่งถึงหน้างาน" },
          ],
        },
        note: "เสาเข็มตามแบบฐานราก F1–F3 รอผลทดสอบดิน",
      });
    }
  }

  // ----- central warehouse: opening, replenishment, adjustments -----
  const whItems = ITEMS.filter((i) => i.stock && i.min);
  const OPEN = "2025-08-31";
  const opening: StockMove[] = whItems.map((i) => ({
    id: "",
    date: OPEN,
    kind: "adjust",
    itemId: i.id,
    qty: Math.round(i.min! * (WH_ISSUE_ITEMS.has(i.id) ? 2 : between(0.5, 2.2))),
    unitCost: Math.round(i.price * 0.97),
    to: WAREHOUSE,
    by: BUYER,
    note: "ยอดยกมา",
  }));
  const PERIODS = ["2025-09-01", "2025-11-03", "2026-02-02", "2026-05-04", "2026-08-03", "2026-10-12"];
  const GROUPS: { supplier: string; items: string[] }[] = [
    { supplier: "SUP-002", items: ["RB-DB12", "RB-RB6"] },
    { supplier: "SUP-005", items: ["CEM-PC", "WIRE-TIE"] },
    { supplier: "SUP-015", items: ["FORM-PLY", "WD-GYP", "WD-CLINE"] },
  ];
  const balance = new Map(opening.map((m) => [m.itemId, m.qty]));
  const issuesSorted = [...whIssues].sort((x, y) => x.date.localeCompare(y.date));
  PERIODS.forEach((start, pi) => {
    const end = PERIODS[pi + 1] ?? addDays(TODAY, 1);
    const need = new Map<string, number>();
    for (const m of issuesSorted) if (m.date >= start && m.date < end) need.set(m.itemId, (need.get(m.itemId) ?? 0) + m.qty);
    for (const g of GROUPS) {
      const s = supById.get(g.supplier)!;
      const lines: POLine[] = [];
      for (const id of g.items) {
        const item = itemById(id)!;
        const have = balance.get(id) ?? 0;
        const n = need.get(id) ?? 0;
        const last = pi === PERIODS.length - 1;
        // let a couple of items run low in the current period (re-order alerts)
        const skip = last && (id === "FORM-PLY" || id === "WD-CLINE") && have - n >= 0;
        let qty = 0;
        if (!skip && have - n < item.min! * 0.9) qty = Math.ceil((n + item.min! * between(0.9, 1.5) - have) / 10) * 10;
        balance.set(id, have - n + qty);
        if (qty > 0) lines.push({ itemId: id, description: item.name, qty, unit: item.unit, unitPrice: Math.round(item.price * between(0.95, 1.05) * (1 + pi * 0.008)) });
      }
      if (!lines.length) continue;
      const grDate = addDays(start, -1);
      const poDate = addDays(grDate, -Math.round(between(3, 6)));
      const po: PurchaseOrder = {
        id: "",
        costCode: itemById(lines[0].itemId!)!.costCode,
        kind: "goods",
        supplierId: s.id,
        date: poDate,
        deliveryDate: grDate,
        lines,
        vatRate: VAT_RATE,
        whtRate: s.whtRate,
        paymentTerms: s.paymentTerms,
        status: "received",
        requestedBy: BUYER,
        note: "เติมสต็อกคลังกลาง",
      };
      const total = lines.reduce((x, l) => x + l.qty * l.unitPrice, 0) * 1.07;
      po.approvedBy = total > APPROVAL_LIMIT ? EXEC : BUYER;
      po.approvedRole = total > APPROVAL_LIMIT ? "exec" : "purchasing";
      po.approvedDate = poDate;
      const gr: GoodsReceipt = { id: "", poId: "", date: grDate, receiver: "ชาญชัย คลังดี", lines: lines.map((_, i) => ({ line: i, qty: lines[i].qty })), photos: 1, quality: 4 };
      const moves: StockMove[] = lines.map((l) => ({ id: "", date: grDate, kind: "receive", itemId: l.itemId!, qty: l.qty, unitCost: l.unitPrice, to: WAREHOUSE, ref: "", by: gr.receiver }));
      const bill = makeBill(s, { date: addDays(grDate, 2), costCode: po.costCode, lines: lines.map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice })) });
      bill.grId = "#1";
      drafts.push({ po, grs: [gr], bills: bill.date <= TODAY ? [bill] : [], moves });
    }
  });

  // ----- a few open POs waiting for approval -----
  const openDrafts = drafts.filter((d) => d.po.status === "approved" && d.po.projectId).sort((x, y) => y.po.date.localeCompare(x.po.date));
  for (const d of openDrafts.slice(0, 3)) {
    d.po.status = "pending";
    d.po.approvedBy = d.po.approvedRole = d.po.approvedDate = undefined;
    d.po.date = maxDate(d.po.date, addDays(TODAY, -3));
  }

  // ----- number everything chronologically -----
  const byYear = (prefix: string, pad = 4) => {
    const seq: Record<string, number> = {};
    return (date: string) => {
      const y = date.slice(0, 4);
      seq[y] = (seq[y] ?? 0) + 1;
      return `${prefix}-${y}-${String(seq[y]).padStart(pad, "0")}`;
    };
  };
  const poId = byYear("PO");
  drafts.sort((x, y) => x.po.date.localeCompare(y.po.date));
  for (const d of drafts) d.po.id = poId(d.po.date);

  const prs = [...drafts.flatMap((d) => (d.pr ? [d.pr] : [])), ...pendingPRs].sort((x, y) => x.date.localeCompare(y.date));
  const prId = byYear("PR");
  const rfqId = byYear("RFQ");
  for (const pr of prs) {
    pr.id = prId(pr.date);
  }
  for (const pr of [...prs].filter((x) => x.rfq).sort((x, y) => x.rfq!.date.localeCompare(y.rfq!.date))) pr.rfq!.id = rfqId(pr.rfq!.date);
  for (const d of drafts) {
    if (!d.pr) continue;
    d.pr.poId = d.po.id;
    d.po.prId = d.pr.id;
  }

  const allGr = drafts.flatMap((d) => d.grs.map((g) => ({ g, d }))).sort((x, y) => x.g.date.localeCompare(y.g.date));
  const grId = byYear("GR");
  for (const { g, d } of allGr) {
    g.id = grId(g.date);
    g.poId = d.po.id;
  }
  for (const d of drafts) {
    for (const b of d.bills) {
      const gi = Number(b.grId!.slice(1)) - 1;
      b.grId = d.grs[gi]?.id;
      b.poId = d.po.id;
    }
    // receive moves reference their GR (same date)
    for (const m of d.moves) if (m.kind === "receive") m.ref = d.grs.find((g) => g.date === m.date)?.id ?? d.po.id;
  }

  const bills = [...drafts.flatMap((d) => d.bills), ...subBills.map((x) => x.bill)].sort((x, y) => x.date.localeCompare(y.date) || (x.poId ?? "~").localeCompare(y.poId ?? "~"));
  const billId = byYear("BILL");
  for (const b of bills) b.id = billId(b.date);
  // one overdue bill for AP ageing: approved but not paid after its due date
  const late = bills.find((b) => b.poId && b.status === "paid" && b.dueDate >= addDays(TODAY, -20) && b.dueDate <= addDays(TODAY, -6));
  if (late) {
    late.status = "approved";
    late.paidDate = undefined;
  }
  for (const b of bills) if (b.status !== "open") b.approvedBy = BUYER;

  // ----- stock moves: transfers, counts, then cost by moving average -----
  const extra: StockMove[] = [
    { id: "", date: addDays(TODAY, -12), kind: "transfer", itemId: "TL-GR60", qty: 0, unitCost: 0, from: siteLoc("HC-2025-04"), to: siteLoc("HC-2026-02"), projectId: "HC-2026-02", costCode: "10", by: FOREMAN, note: "โอนกระเบื้องเหลือจากงานใกล้ส่งมอบ" },
    { id: "", date: addDays(TODAY, -26), kind: "transfer", itemId: "BRK-AAC", qty: 0, unitCost: 0, from: siteLoc("HC-2026-01"), to: siteLoc("HC-2026-04"), projectId: "HC-2026-04", costCode: "04", by: FOREMAN, note: "โอนอิฐมวลเบาส่วนเกิน" },
    { id: "", date: "2026-09-30", kind: "adjust", itemId: "CEM-PC", qty: -12, unitCost: 0, from: WAREHOUSE, by: "ชาญชัย คลังดี", note: "ตรวจนับไตรมาส 3 ปูนชื้นจับตัวเสียหาย" },
    { id: "", date: "2026-09-30", kind: "adjust", itemId: "WD-GYP", qty: -6, unitCost: 0, from: WAREHOUSE, by: "ชาญชัย คลังดี", note: "ตรวจนับไตรมาส 3 แผ่นแตกหัก" },
    { id: "", date: "2026-09-30", kind: "adjust", itemId: "EL-SW", qty: 8, unitCost: 0, to: WAREHOUSE, by: "ชาญชัย คลังดี", note: "ตรวจนับไตรมาส 3 พบเกินจากบัญชี" },
  ];
  let moves = [...opening, ...drafts.flatMap((d) => d.moves), ...whIssues, ...extra].sort((x, y) => x.date.localeCompare(y.date));
  // transfers move whatever is left at the source site on that date
  {
    for (const t of extra.filter((m) => m.kind === "transfer")) {
      const before = moves.filter((m) => m.date <= t.date && !(m.kind === "transfer" && m.qty === 0));
      const { bal } = replay(before.map((m, i) => ({ ...m, id: `T${String(i).padStart(6, "0")}` })));
      const left = Math.floor(bal.get(`${t.from}|${t.itemId}`)?.qty ?? 0);
      t.qty = left;
    }
    moves = moves.filter((m) => m.qty !== 0);
  }
  const mvId = byYear("MV", 5);
  moves.sort((x, y) => x.date.localeCompare(y.date) || (x.kind === "receive" || x.kind === "adjust" ? 0 : 1) - (y.kind === "receive" || y.kind === "adjust" ? 0 : 1));
  for (const m of moves) m.id = mvId(m.date);
  moves = replay(moves, true).moves;

  // ----- actual cost lines -----
  const costs: CostEntry[] = [...petty];
  for (const { g, d } of allGr) {
    if (!d.po.projectId) continue;
    const amount = g.lines.reduce((t, x) => t + x.qty * d.po.lines[x.line].unitPrice, 0);
    costs.push({ id: `CE-${g.id}`, projectId: d.po.projectId, costCode: d.po.costCode, date: g.date, source: "po", ref: g.id, description: `รับวัสดุตาม ${d.po.id} · ${supById.get(d.po.supplierId)?.name ?? ""}`, amount: r2(amount) });
  }
  for (const b of bills) {
    if (b.poId || !b.projectId || b.status === "open") continue;
    costs.push({ id: `CE-${b.id}`, projectId: b.projectId, costCode: b.costCode ?? "90", date: b.date, source: "subcontract", ref: b.id, description: `${b.lines[0]?.description ?? "ค่าจ้างเหมาช่วง"} · ${b.supplierName}`, amount: b.subtotal });
  }
  for (const m of moves) {
    if (m.kind === "issue" && m.from === WAREHOUSE && m.projectId) {
      costs.push({ id: `CE-${m.id}`, projectId: m.projectId, costCode: m.costCode ?? "90", date: m.date, source: "po", ref: m.id, description: `เบิก${itemById(m.itemId)?.name ?? m.itemId} จากคลังกลาง`, amount: r2(m.qty * m.unitCost) });
    }
    if (m.kind === "transfer" && m.from && m.to) {
      const amt = r2(m.qty * m.unitCost);
      const src = m.from.slice(5);
      const dst = m.to.slice(5);
      const name = itemById(m.itemId)?.name ?? m.itemId;
      costs.push({ id: `CE-${m.id}-OUT`, projectId: src, costCode: m.costCode ?? "90", date: m.date, source: "po", ref: m.id, description: `โอน${name}ออกไป ${dst}`, amount: -amt });
      costs.push({ id: `CE-${m.id}-IN`, projectId: dst, costCode: m.costCode ?? "90", date: m.date, source: "po", ref: m.id, description: `รับโอน${name}จาก ${src}`, amount: amt });
    }
  }
  costs.sort((x, y) => x.date.localeCompare(y.date));

  return {
    suppliers: SEED_SUPPLIERS,
    prs,
    pos: drafts.map((d) => d.po),
    receipts: allGr.map((x) => x.g),
    bills,
    costs,
    moves,
  };
}

const WH_ISSUE_ITEMS = new Set(Object.values(WH_ISSUE).flatMap((p) => p!.items.map(([id]) => id)));

