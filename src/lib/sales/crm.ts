// Sales CRM: leads, estimates and quotations (collections + demo seeds + actions).
//
//   leads      ลีด/ลูกค้ามุ่งหวัง พร้อมกิจกรรมติดตาม
//   estimates  ประมาณราคา/BOQ ที่บันทึกไว้ (snapshot ของบรรทัด BOQ)
//   quotes     ใบเสนอราคา พร้อมงวดชำระและประวัติการแก้ไข
//
// signQuote() turns an approved quotation into a project (planning), its installments
// and its budget (shared collections in lib/biz.ts).

import { getHouseModel, houseModels, projects, seeded, team, TODAY } from "../data";
import { budgets, installments, type CostCode } from "../biz";
import { createCollection } from "../collection";
import { addProject, PROVINCES } from "../projects-store";
import { budgetLinesFrom, computeBoq, DEFAULT_MARGIN, DEFAULT_OVERHEAD, type BoqResult } from "./boq";
import { sampleBook, type BookChoice, type PriceSource } from "./prices-data";
import { modelBoq } from "./seed-biz";
import { DEFAULT_TERMS, LINKED, scheduleFor, VAT_RATE, type PayTerm } from "./terms";

// ---------- types ----------

export type LeadStage = "new" | "contacted" | "viewing" | "quoted" | "negotiating" | "won" | "lost";
export const STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "ลีดใหม่" },
  { key: "contacted", label: "ติดต่อแล้ว" },
  { key: "viewing", label: "นัดดูแบบ" },
  { key: "quoted", label: "เสนอราคา" },
  { key: "negotiating", label: "ต่อรอง" },
  { key: "won", label: "เซ็นสัญญา" },
  { key: "lost", label: "แพ้" },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<LeadStage, string>;
/** probability used for the weighted pipeline value */
export const STAGE_WEIGHT: Record<LeadStage, number> = { new: 0.05, contacted: 0.1, viewing: 0.25, quoted: 0.4, negotiating: 0.65, won: 1, lost: 0 };

export type LeadSource = "facebook" | "line" | "web" | "fair" | "walkin" | "referral";
export const SOURCE_LABEL: Record<LeadSource, string> = {
  facebook: "Facebook",
  line: "LINE",
  web: "เว็บไซต์",
  fair: "งานบ้านและสวน",
  walkin: "Walk-in",
  referral: "แนะนำ",
};
export const LEAD_SOURCES = Object.keys(SOURCE_LABEL) as LeadSource[];

export type ActivityKind = "call" | "line" | "meeting" | "visit" | "note" | "quote" | "stage";
export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  call: "โทร",
  line: "LINE",
  meeting: "นัดพบ",
  visit: "ดูที่ดิน/บ้านตัวอย่าง",
  note: "บันทึก",
  quote: "ใบเสนอราคา",
  stage: "เปลี่ยนสถานะ",
};
export type Activity = { id: string; date: string; kind: ActivityKind; text: string; by: string };

export type Lead = {
  id: string;
  name: string;
  phone: string;
  lineId?: string;
  email?: string;
  source: LeadSource;
  budget: number; // million baht
  province: string;
  landSize?: number; // ตารางวา
  models: string[];
  owner: string;
  stage: LeadStage;
  nextFollowUp?: string;
  created: string;
  updated: string;
  notes?: string;
  lostReason?: string;
  projectId?: string;
  activities: Activity[];
};

export type EstimateLine = { key: string; costCode: CostCode; name: string; qty: number; unit: string; material: number; labour: number; amount: number; source: PriceSource | "rate"; sample: boolean };
export type Estimate = {
  id: string;
  name: string;
  modelCode: string;
  projectId?: string;
  leadId?: string;
  date: string;
  by: string;
  choice: BookChoice;
  province?: string;
  overheadPct: number;
  marginPct: number;
  grade: number;
  area: number;
  lines: EstimateLine[];
  byCode: { costCode: CostCode; material: number; labour: number; amount: number }[];
  direct: number;
  overhead: number;
  cost: number;
  selling: number;
  perM2: number;
  sampleShare: number;
};

export type QuoteStatus = "draft" | "sent" | "approved" | "lost" | "expired";
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = { draft: "ร่าง", sent: "ส่งแล้ว", approved: "อนุมัติ", lost: "แพ้", expired: "หมดอายุ" };
export type QuoteLine = { id: string; name: string; qty: number; unit: string; unitPrice: number; discount: number; costCode?: CostCode };
export type Quote = {
  id: string;
  leadId?: string;
  projectId?: string;
  estimateId?: string;
  customer: { name: string; phone: string; email?: string; address?: string };
  province: string;
  modelCode: string;
  baseLabel: string;
  basePrice: number; // excl. VAT
  baseCost?: number; // estimate cost (direct + overhead) for margin
  options: QuoteLine[];
  billDiscount: number;
  vatRate: number;
  date: string;
  validDays: number;
  status: QuoteStatus;
  terms: PayTerm[];
  owner: string;
  note?: string;
  rev: number;
  revisions: { rev: number; date: string; total: number; note: string }[];
  signedDate?: string;
  lostReason?: string;
};

// ---------- calculations ----------

/** assumed cost share of add-on lines when no estimate exists for them */
export const OPTION_COST_SHARE = 0.72;

export function quoteTotals(q: Pick<Quote, "basePrice" | "baseCost" | "options" | "billDiscount" | "vatRate">) {
  const optionsNet = q.options.reduce((s, l) => s + l.qty * l.unitPrice - l.discount, 0);
  const lineDiscount = q.options.reduce((s, l) => s + l.discount, 0);
  const gross = q.basePrice + optionsNet;
  const subtotal = Math.max(0, gross - q.billDiscount);
  const vat = Math.round(((subtotal * q.vatRate) / 100) * 100) / 100;
  const cost = q.baseCost !== undefined ? q.baseCost + optionsNet * OPTION_COST_SHARE : undefined;
  return { optionsNet, lineDiscount, gross, subtotal, vat, total: subtotal + vat, cost, margin: cost !== undefined && subtotal ? (subtotal - cost) / subtotal : undefined };
}

export const validUntil = (q: Pick<Quote, "date" | "validDays">) => new Date(Date.parse(q.date) + q.validDays * 86400000).toISOString().slice(0, 10);
/** Display status: a sent quote past its validity counts as expired */
export const quoteStatus = (q: Quote): QuoteStatus => (q.status === "sent" && validUntil(q) < TODAY ? "expired" : q.status);

export function estimateFromBoq(r: BoqResult, meta: { id: string; name: string; date: string; by: string; projectId?: string; leadId?: string; province?: string }): Estimate {
  return {
    ...meta,
    modelCode: r.modelCode,
    choice: r.choice,
    overheadPct: r.overheadPct,
    marginPct: r.marginPct,
    grade: r.grade,
    area: r.q.area,
    lines: r.lines.map((l) => ({ key: l.key, costCode: l.costCode, name: l.name, qty: l.qty, unit: l.unit, material: Math.round(l.material * 100) / 100, labour: Math.round(l.labour * 100) / 100, amount: Math.round(l.amount), source: l.source, sample: l.sample })),
    byCode: r.byCode.map((c) => ({ ...c, material: Math.round(c.material), labour: Math.round(c.labour), amount: Math.round(c.amount) })),
    direct: Math.round(r.direct),
    overhead: Math.round(r.overhead),
    cost: Math.round(r.cost),
    selling: Math.round(r.selling),
    perM2: Math.round(r.perM2),
    sampleShare: r.sampleShare,
  };
}

// ---------- demo seeds ----------

export const SALES_PEOPLE = team.filter((m) => m.role === "sales" || m.role === "exec").map((m) => m.name);
const SALES_MAIN = team.find((m) => m.role === "sales")?.name ?? "ฝ่ายขาย";
const SALES_EXEC = team.find((m) => m.role === "exec")?.name ?? SALES_MAIN;

const FIRST = ["กิตติพงษ์", "สุภาวดี", "ธนากร", "ปิยะพร", "ณัฐพล", "วรรณิสา", "อรรถพล", "ศศิธร", "ภานุวัฒน์", "จิตรลดา", "ชาญวิทย์", "พิมพ์ชนก", "ธีรพงศ์", "กาญจนา", "วสันต์", "ดารุณี", "อภิชาติ", "นริศรา", "สมพงษ์", "เพ็ญศรี", "ปรีชา", "รุ่งนภา", "เอกชัย", "มาลัย", "ธวัชชัย", "สิริกร", "บุญชัย", "อัมพร", "ไชยา", "ณิชา", "ศักดิ์ชัย", "ปวีณา"];
const LAST = ["สุวรรณรัตน์", "ทองประเสริฐ", "ศรีวิไล", "บุญญาศิริ", "วงศ์สวัสดิ์", "จันทร์แก้ว", "พึ่งบุญ", "ชัยมงคล", "แสงอรุณ", "รัตนพันธ์", "เกษมสุข", "อินทร์แก้ว", "นาคสุข", "ปัญญาดี", "ศิริมงคล", "บุญรอด"];
const LOST_REASONS = ["ราคาสูงกว่าคู่แข่ง", "เลื่อนการสร้างบ้านออกไป", "เลือกผู้รับเหมารายย่อย", "สินเชื่อไม่ผ่าน", "ซื้อบ้านจัดสรรแทน"];
const OPTION_POOL: { name: string; unit: string; price: number; qty: [number, number]; cc: CostCode }[] = [
  { name: "ระบบโซลาร์เซลล์ออนกริด 5 kW", unit: "ระบบ", price: 165000, qty: [1, 1], cc: "06" },
  { name: "เปลี่ยนพื้นห้องนอนเป็นไม้ SPC กันน้ำ", unit: "ตร.ม.", price: 950, qty: [45, 90], cc: "10" },
  { name: "มุ้งลวดและม่านม้วนทั้งหลัง", unit: "ชุด", price: 68000, qty: [1, 1], cc: "09" },
  { name: "รั้วหน้าบ้านพร้อมประตูรีโมท", unit: "ม.", price: 6500, qty: [14, 22], cc: "13" },
  { name: "เพิ่มเครื่องปรับอากาศ 12,000 BTU", unit: "ชุด", price: 23500, qty: [1, 2], cc: "08" },
  { name: "ชุดครัว Built-in พร้อมท็อปควอตซ์", unit: "ชุด", price: 145000, qty: [1, 1], cc: "10" },
  { name: "ระบบกล้องวงจรปิด 4 จุด", unit: "ระบบ", price: 32000, qty: [1, 1], cc: "06" },
  { name: "ถังเก็บน้ำใต้ดิน 4,000 ลิตร", unit: "ชุด", price: 38000, qty: [1, 1], cc: "07" },
];

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);
const ri = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const phoneOf = (r: () => number) => `0${pick(r, ["8", "9", "6"])}${ri(r, 0, 9)}-${ri(r, 100, 999)}-${ri(r, 1000, 9999)}`;
const HOUSE_CODES = houseModels.filter((m) => m.type === "house" || m.type === "townhome").map((m) => m.code);

type SeedBundle = { leads: Lead[]; quotes: Quote[]; estimates: Estimate[] };
let bundle: SeedBundle | null = null;

function makeOptions(r: () => number, n: number, idPrefix: string): QuoteLine[] {
  const pool = [...OPTION_POOL];
  const out: QuoteLine[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const o = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const qty = ri(r, o.qty[0], o.qty[1]);
    out.push({ id: `${idPrefix}-L${i + 1}`, name: o.name, qty, unit: o.unit, unitPrice: o.price, discount: r() < 0.3 ? Math.round((o.price * qty * 0.05) / 100) * 100 : 0, costCode: o.cc });
  }
  return out;
}

function activitiesFor(r: () => number, lead: Pick<Lead, "created" | "stage" | "owner" | "source">, until: string, extra: Activity[] = []): Activity[] {
  const hasQuote = extra.some((a) => a.kind === "quote");
  const signed = extra.some((a) => a.kind === "stage");
  const steps: { kind: ActivityKind; text: string }[] = [{ kind: "note", text: `ลีดเข้ามาจาก ${SOURCE_LABEL[lead.source]}` }];
  const order: LeadStage[] = ["contacted", "viewing", "quoted", "negotiating", "won"];
  const reach = lead.stage === "lost" ? ri(r, 1, 3) : Math.max(0, order.indexOf(lead.stage) + 1);
  const texts: Record<string, { kind: ActivityKind; text: string }> = {
    contacted: { kind: "call", text: "โทรแนะนำบริษัท สอบถามงบประมาณและขนาดที่ดิน" },
    viewing: { kind: "meeting", text: "นัดดูแบบบ้านที่สำนักงานขาย และชมบ้านตัวอย่าง" },
    quoted: { kind: "quote", text: "ส่งใบเสนอราคาให้ลูกค้าทาง LINE" },
    negotiating: { kind: "call", text: "ลูกค้าขอปรับส่วนลดและเพิ่มรายการเสริม" },
    won: { kind: "stage", text: "ลูกค้าตกลงเซ็นสัญญา" },
  };
  for (let i = 0; i < reach && i < order.length; i++) {
    if ((order[i] === "quoted" && hasQuote) || (order[i] === "won" && signed)) continue;
    steps.push(texts[order[i]]);
  }
  if (lead.stage !== "new" && lead.stage !== "lost" && lead.stage !== "won" && r() < 0.6) steps.splice(2, 0, { kind: "line", text: "ส่งแบบบ้านและตัวอย่างวัสดุทาง LINE" });
  if (lead.stage === "lost") steps.push({ kind: "stage", text: "ปิดลีด: ลูกค้าไม่ไปต่อ" });
  const span = Math.max(1, (Date.parse(until) - Date.parse(lead.created)) / 86400000);
  const acts = steps.map((s, i) => ({ id: "", date: addDays(lead.created, Math.round((span * i) / Math.max(1, steps.length - 1 || 1))), kind: s.kind, text: s.text, by: lead.owner }));
  return [...acts, ...extra].sort((a, b) => a.date.localeCompare(b.date)).map((a, i) => ({ ...a, id: `A${i + 1}` }));
}

/** Estimate whose finish grade is solved so that its cost lands near a target (cost is linear in grade). */
function boqFor(modelCode: string, targetCost: number): BoqResult {
  const book = sampleBook("cgd");
  const a = computeBoq(modelCode, book, DEFAULT_OVERHEAD, DEFAULT_MARGIN, 1);
  const b = computeBoq(modelCode, book, DEFAULT_OVERHEAD, DEFAULT_MARGIN, 1.2);
  const slope = (b.cost - a.cost) / 0.2;
  const g = slope > 0 ? 1 + (targetCost - a.cost) / slope : 1;
  return computeBoq(modelCode, book, DEFAULT_OVERHEAD, DEFAULT_MARGIN, Math.round(Math.min(3, Math.max(0.5, g)) * 100) / 100);
}

function buildSeed(): SeedBundle {
  const r = seeded(4404);
  const leads: Lead[] = [];
  const quotes: Quote[] = [];
  const estimates: Estimate[] = [];
  const leadSeq: Record<string, number> = {};
  const leadId = (created: string) => {
    const y = created.slice(0, 4);
    leadSeq[y] = (leadSeq[y] ?? 0) + 1;
    return `LD-${y}-${String(leadSeq[y]).padStart(4, "0")}`;
  };

  // 1) won leads linked to existing projects
  type Draft = Omit<Lead, "id">;
  const drafts: { d: Draft; link?: (typeof LINKED)[number]; quote?: Partial<Quote> & { status: QuoteStatus; date: string } }[] = [];
  for (const l of LINKED) {
    const p = projects.find((x) => x.id === l.projectId)!;
    const created = addDays(l.estimateDate, -ri(r, 20, 70));
    const owner = p.value >= 9 ? SALES_EXEC : SALES_MAIN;
    const src = pick(r, LEAD_SOURCES);
    drafts.push({
      link: l,
      d: {
        name: p.owner,
        phone: p.phone ?? phoneOf(r),
        lineId: r() < 0.7 ? `line_${p.id.slice(-2)}${ri(r, 10, 99)}` : undefined,
        source: src,
        budget: Math.round(p.value * 10) / 10,
        province: p.province,
        landSize: ri(r, 60, 140),
        models: [p.modelCode],
        owner,
        stage: "won",
        created,
        updated: p.contractDate ?? l.quoteDate,
        projectId: p.id,
        activities: [],
      },
    });
  }

  // 2) open and lost leads
  const plan: LeadStage[] = [
    ...Array<LeadStage>(7).fill("new"),
    ...Array<LeadStage>(6).fill("contacted"),
    ...Array<LeadStage>(5).fill("viewing"),
    ...Array<LeadStage>(5).fill("quoted"),
    ...Array<LeadStage>(3).fill("negotiating"),
    ...Array<LeadStage>(6).fill("lost"),
  ];
  plan.forEach((stage, i) => {
    const first = FIRST[(i * 7 + 3) % FIRST.length];
    const last = LAST[(i * 5 + 1) % LAST.length];
    const ageMax = stage === "new" ? 28 : stage === "lost" ? 300 : 140;
    const ageMin = stage === "new" ? 0 : stage === "contacted" ? 10 : 25;
    const created = addDays(TODAY, -ri(r, ageMin, ageMax));
    const model = pick(r, HOUSE_CODES);
    const m = getHouseModel(model)!;
    const models = r() < 0.4 ? [model, pick(r, HOUSE_CODES.filter((c) => c !== model))] : [model];
    const follow = stage === "lost" ? undefined : addDays(TODAY, [-3, -1, 0, 0, 1, 2, 4, 7, 10][ri(r, 0, 8)]);
    drafts.push({
      d: {
        name: `${first} ${last}`,
        phone: phoneOf(r),
        lineId: r() < 0.6 ? `${["k", "p", "n", "s", "t"][i % 5]}${first.length}${ri(r, 100, 999)}` : undefined,
        email: r() < 0.3 ? `customer${i + 1}@example.com` : undefined,
        source: pick(r, LEAD_SOURCES),
        budget: Math.round((m.priceMin + (m.priceMax - m.priceMin) * r()) * (0.85 + r() * 0.25) * 10) / 10,
        province: pick(r, PROVINCES),
        landSize: r() < 0.8 ? ri(r, 50, 160) : undefined,
        models,
        owner: r() < 0.8 ? SALES_MAIN : SALES_EXEC,
        stage,
        nextFollowUp: follow,
        created,
        updated: created,
        lostReason: stage === "lost" ? pick(r, LOST_REASONS) : undefined,
        notes: r() < 0.5 ? pick(r, ["มีที่ดินแล้ว รอโฉนดแบ่งแยก", "ต้องการเริ่มสร้างต้นปีหน้า", "สนใจบ้านชั้นเดียวสำหรับผู้สูงอายุ", "เปรียบเทียบกับบริษัทอื่นอีก 2 ราย", "ต้องการห้องทำงานที่บ้าน", "ขอสินเชื่อปลูกสร้างกับธนาคาร"]) : undefined,
        activities: [],
      },
      quote:
        stage === "quoted" || stage === "negotiating" || (stage === "lost" && i % 3 === 0)
          ? { status: stage === "lost" ? "lost" : "sent", date: addDays(TODAY, -ri(r, stage === "quoted" ? 3 : 8, stage === "lost" ? 120 : 40)) }
          : undefined,
    });
  });

  // ids are assigned in creation order so numbering follows the calendar
  drafts.sort((a, b) => a.d.created.localeCompare(b.d.created));
  const qSeq: Record<string, number> = {};
  const eSeq: Record<string, number> = {};
  for (const l of LINKED) {
    const qy = l.quoteId.slice(3, 7);
    const ey = l.estimateId.slice(4, 8);
    qSeq[qy] = Math.max(qSeq[qy] ?? 0, Number(l.quoteId.slice(-4)));
    eSeq[ey] = Math.max(eSeq[ey] ?? 0, Number(l.estimateId.slice(-4)));
  }
  const nextQ = (date: string) => {
    const y = date.slice(0, 4);
    qSeq[y] = (qSeq[y] ?? 0) + 1;
    return `QT-${y}-${String(qSeq[y]).padStart(4, "0")}`;
  };
  const nextE = (date: string) => {
    const y = date.slice(0, 4);
    eSeq[y] = (eSeq[y] ?? 0) + 1;
    return `EST-${y}-${String(eSeq[y]).padStart(4, "0")}`;
  };

  for (const { d, link, quote } of drafts) {
    const id = leadId(d.created);
    const extra: Activity[] = [];
    if (link || quote) {
      const modelCode = d.models[0];
      const m = getHouseModel(modelCode)!;
      const p = link ? projects.find((x) => x.id === link.projectId)! : undefined;
      const qDate = link?.quoteDate ?? quote!.date;
      const eDate = link?.estimateDate ?? addDays(qDate, -3);
      const estId = link?.estimateId ?? nextE(eDate);
      const qId = link?.quoteId ?? nextQ(qDate);
      const options = makeOptions(r, ri(r, 1, 3), qId);
      const optNet = options.reduce((s, o) => s + o.qty * o.unitPrice - o.discount, 0);
      const billDiscount = Math.round((r() < 0.6 ? ri(r, 1, 6) * 25000 : 0) / 1000) * 1000;
      // linked quotes must add up to the project's contract value
      const target = p ? Math.round(p.value * 1e6) : Math.round(((m.priceMin + m.priceMax) / 2) * 1e6 * (0.97 + r() * 0.06) / 10000) * 10000;
      const basePrice = Math.max(0, target - optNet + billDiscount);
      // the agreed finish grade is what makes the estimate meet the quoted price at a normal margin
      const boq = boqFor(modelCode, (basePrice - billDiscount) * (1 - ri(r, 15, 23) / 100));
      const est = estimateFromBoq(boq, { id: estId, name: `${m.name} · ${d.name}`, date: eDate, by: team.find((t) => t.role === "engineer")?.name ?? d.owner, projectId: p?.id, leadId: id, province: d.province });
      estimates.push(est);
      const rev = link ? ri(r, 1, 2) : d.stage === "negotiating" ? 2 : 1;
      const revisions = rev > 1 ? [{ rev: 1, date: addDays(qDate, -9), total: Math.round((target + 180000) * 1.07), note: "ฉบับแรก ก่อนปรับส่วนลด" }] : [];
      const status: QuoteStatus = link ? "approved" : quote!.status;
      quotes.push({
        id: qId,
        leadId: id,
        projectId: p?.id,
        estimateId: est.id,
        customer: { name: d.name, phone: d.phone, email: d.email, address: p?.address ?? `${d.province}` },
        province: d.province,
        modelCode,
        baseLabel: `ก่อสร้างบ้านแบบ ${m.name} (${m.code}) พื้นที่ใช้สอย ${m.area} ตร.ม. ตามรายการวัสดุมาตรฐาน`,
        basePrice,
        baseCost: est.cost,
        options,
        billDiscount,
        vatRate: VAT_RATE,
        date: qDate,
        validDays: 30,
        status,
        terms: DEFAULT_TERMS,
        owner: d.owner,
        rev,
        revisions,
        signedDate: p?.contractDate,
        lostReason: status === "lost" ? d.lostReason : undefined,
      });
      extra.push({ id: "", date: qDate, kind: "quote", text: `ออกใบเสนอราคา ${qId}${rev > 1 ? ` (ฉบับแก้ไขที่ ${rev})` : ""}`, by: d.owner });
      if (p?.contractDate) extra.push({ id: "", date: p.contractDate, kind: "stage", text: p.contractDate > TODAY ? `นัดเซ็นสัญญา · โครงการ ${p.id}` : `เซ็นสัญญาก่อสร้าง · โครงการ ${p.id}`, by: d.owner });
    }
    const until = d.stage === "won" ? (link?.quoteDate ?? d.created) : d.stage === "new" ? d.created : addDays(TODAY, -ri(r, 0, 6));
    const acts = activitiesFor(r, d, until < d.created ? d.created : until, extra);
    leads.push({ ...d, id, activities: acts, updated: acts[acts.length - 1]?.date ?? d.created });
  }
  return { leads, quotes, estimates };
}
const seed = () => (bundle ??= buildSeed());

export const leads = createCollection<Lead>("leads", () => seed().leads);
export const quotes = createCollection<Quote>("quotes", () => seed().quotes);
export const estimates = createCollection<Estimate>("estimates", () => seed().estimates);

// ---------- actions ----------

const actId = () => `A${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export function addActivity(lead: Lead, a: Omit<Activity, "id">, patch: Partial<Lead> = {}) {
  leads.upsert({ ...lead, ...patch, activities: [...lead.activities, { ...a, id: actId() }], updated: a.date });
}

export function setStage(lead: Lead, stage: LeadStage, by: string, reason?: string) {
  if (lead.stage === stage) return;
  addActivity(lead, { date: TODAY, kind: "stage", text: `${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[stage]}${reason ? ` · ${reason}` : ""}`, by }, { stage, lostReason: stage === "lost" ? reason : lead.lostReason });
}

export function newLeadId(created = TODAY) {
  return leads.nextId(`LD-${created.slice(0, 4)}-`);
}

/** Draft quotation for a lead (or blank), priced from an estimate or the catalog midpoint. */
export function createQuote(input: { lead?: Lead; modelCode: string; estimate?: Estimate; owner: string }): Quote {
  const m = getHouseModel(input.modelCode);
  const id = quotes.nextId(`QT-${TODAY.slice(0, 4)}-`);
  const catalog = m ? Math.round(((m.priceMin + m.priceMax) / 2) * 1e6) : 0;
  const q: Quote = {
    id,
    leadId: input.lead?.id,
    estimateId: input.estimate?.id,
    customer: { name: input.lead?.name ?? "", phone: input.lead?.phone ?? "", email: input.lead?.email, address: input.lead?.province ?? "" },
    province: input.lead?.province ?? "กรุงเทพฯ",
    modelCode: input.modelCode,
    baseLabel: m ? `ก่อสร้างบ้านแบบ ${m.name} (${m.code}) พื้นที่ใช้สอย ${m.area} ตร.ม. ตามรายการวัสดุมาตรฐาน` : "ก่อสร้างบ้านตามแบบ",
    basePrice: input.estimate ? Math.round(input.estimate.selling / 1000) * 1000 : catalog,
    baseCost: input.estimate?.cost ?? (m ? Math.round(modelBoq(m.code).cost) : undefined),
    options: [],
    billDiscount: 0,
    vatRate: VAT_RATE,
    date: TODAY,
    validDays: 30,
    status: "draft",
    terms: DEFAULT_TERMS,
    owner: input.owner,
    rev: 1,
    revisions: [],
  };
  quotes.upsert(q);
  if (input.lead) addActivity(input.lead, { date: TODAY, kind: "quote", text: `สร้างใบเสนอราคา ${id} (ร่าง)`, by: input.owner }, input.lead.stage === "won" || input.lead.stage === "lost" || input.lead.stage === "negotiating" ? {} : { stage: "quoted" });
  return q;
}

/** Start a new revision: keeps the history line and returns the quote to draft. */
export function reviseQuote(q: Quote, note: string) {
  const t = quoteTotals(q);
  const next: Quote = { ...q, rev: q.rev + 1, status: "draft", date: TODAY, revisions: [...q.revisions, { rev: q.rev, date: q.date, total: Math.round(t.total), note: note || `ฉบับที่ ${q.rev}` }] };
  quotes.upsert(next);
  return next;
}

/**
 * "เซ็นสัญญา": project (planning) + installments + budget, quote approved, lead won.
 */
export function signQuote(q: Quote, input: { start: string; pm: string; by: string }) {
  const t = quoteTotals(q);
  const project = addProject(
    {
      owner: q.customer.name,
      phone: q.customer.phone,
      modelCode: q.modelCode,
      province: q.province,
      address: q.customer.address ?? q.province,
      start: input.start,
      value: Math.round((t.subtotal / 1e6) * 100) / 100,
      pm: input.pm,
    },
    projects.map((p) => p.id),
  );
  installments.upsertMany(scheduleFor({ projectId: project.id, quoteId: q.id, contractValue: Math.round(t.subtotal), contractDate: TODAY, start: project.start, finish: project.finish, terms: q.terms }));

  const est = q.estimateId ? estimates.get(q.estimateId) : undefined;
  let lines: { costCode: CostCode; amount: number }[];
  if (est) {
    lines = budgetLinesFrom({ byCode: est.byCode, direct: est.direct, overhead: est.overhead });
  } else {
    const boq = modelBoq(q.modelCode);
    lines = budgetLinesFrom(boq, (t.subtotal - t.optionsNet) * (1 - DEFAULT_MARGIN / 100));
  }
  // add-on lines are budgeted at their assumed cost under their own cost code
  for (const o of q.options) {
    const cc = o.costCode ?? "10";
    const amt = Math.round((o.qty * o.unitPrice - o.discount) * OPTION_COST_SHARE);
    const hit = lines.find((l) => l.costCode === cc);
    if (hit) hit.amount += amt;
    else lines.push({ costCode: cc, amount: amt });
  }
  lines.sort((a, b) => a.costCode.localeCompare(b.costCode));
  budgets.upsert({ id: `BUD-${project.id}`, projectId: project.id, estimateId: est?.id, lines, contractValue: Math.round(t.subtotal), approvedDate: TODAY });

  quotes.upsert({ ...q, status: "approved", projectId: project.id, signedDate: TODAY });
  if (est) estimates.upsert({ ...est, projectId: project.id });
  const lead = q.leadId ? leads.get(q.leadId) : undefined;
  if (lead)
    addActivity(lead, { date: TODAY, kind: "stage", text: `เซ็นสัญญาก่อสร้าง ${q.id} · โครงการ ${project.id}`, by: input.by }, { stage: "won", projectId: project.id, nextFollowUp: undefined });
  return project;
}
