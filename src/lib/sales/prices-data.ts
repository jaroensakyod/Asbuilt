// Material / labour price database — pure data and helpers (no React, no collections).
//
// Three price sources per item:
//   moc       ราคาวัสดุก่อสร้าง สำนักงานนโยบายและยุทธศาสตร์การค้า กระทรวงพาณิชย์ (monthly, by province)
//   cgd       ราคากลางงานก่อสร้าง กรมบัญชีกลาง (material + labour rate, updated by quarter)
//   supplier  ใบเสนอราคาผู้ขายที่บริษัทได้รับ
//
// The built-in history is SAMPLE data ("ราคาตัวอย่าง") generated deterministically so the
// screens have something to show. It is not an official price. Imported rows (CSV) replace
// the sample series for that item + source.

import { seeded, TODAY } from "../data";
import type { CostCode } from "../biz";

export type PriceSource = "moc" | "cgd" | "supplier";
export const PRICE_SOURCES: PriceSource[] = ["moc", "cgd", "supplier"];
export const SOURCE_LABEL: Record<PriceSource, string> = {
  moc: "กระทรวงพาณิชย์",
  cgd: "กรมบัญชีกลาง",
  supplier: "ใบเสนอราคาผู้ขาย",
};
export const SOURCE_SHORT: Record<PriceSource, string> = { moc: "พณ.", cgd: "บก.", supplier: "ผู้ขาย" };

export type PriceItem = {
  id: string; // = code
  code: string;
  name: string;
  unit: string;
  category: string;
  costCode: CostCode;
  /** ค่าแรงต่อหน่วย (อ้างอิงบัญชีค่าแรงราคากลาง) */
  labour: number;
  /** latest sample material price (used only to generate the sample history) */
  base: number;
  spec?: string;
  /** created by a CSV import */
  imported?: boolean;
};

/** One price observation. `date` is the first day of the month (YYYY-MM-01). */
export type PriceObs = {
  id: string;
  itemCode: string;
  source: PriceSource;
  date: string;
  price: number;
  province?: string;
  sample?: boolean;
  importedAt?: string;
};

export type CompetitorPrice = {
  id: string;
  company: string;
  model: string;
  area: number; // m²
  floors: number;
  price: number; // baht, as advertised
  date: string;
  source: string;
  note?: string;
  sample?: boolean;
};

type Seed = [code: string, name: string, unit: string, category: string, cc: CostCode, base: number, labour: number, drift: number, jump: number, supplier?: boolean];

// drift: change over the 18 months (0.05 = +5 %), jump: change in the latest month
const ITEMS: Seed[] = [
  // ---- 01 เตรียมการ
  ["PR-SOIL", "ดินถมคัดเลือก", "ลบ.ม.", "ดิน/ทราย", "01", 390, 95, 0.04, 0, true],
  ["PR-SAND", "ทรายหยาบ", "ลบ.ม.", "ดิน/ทราย", "01", 540, 0, 0.03, 0, true],
  // ---- 02 ฐานราก
  ["FD-PILE-I18", "เสาเข็มคอนกรีตอัดแรง I-18 ยาว 6 ม.", "ต้น", "เสาเข็ม", "02", 1480, 420, 0.06, 0, true],
  ["FD-LEAN", "คอนกรีตหยาบ (Lean concrete) 1:3:5", "ลบ.ม.", "คอนกรีต", "02", 1990, 380, 0.04, 0, true],
  ["CN-180", "คอนกรีตผสมเสร็จ 180 ksc (ทรงลูกบาศก์)", "ลบ.ม.", "คอนกรีต", "02", 2230, 420, 0.04, 0.01, true],
  ["CN-240", "คอนกรีตผสมเสร็จ 240 ksc (ทรงลูกบาศก์)", "ลบ.ม.", "คอนกรีต", "03", 2480, 420, 0.05, 0.012, true],
  ["CN-280", "คอนกรีตผสมเสร็จ 280 ksc (ทรงลูกบาศก์)", "ลบ.ม.", "คอนกรีต", "03", 2620, 420, 0.05, 0.012, true],
  // ---- 03 โครงสร้าง
  ["ST-RB9", "เหล็กเส้นกลม RB9 SR24", "กก.", "เหล็กเสริม", "03", 27.4, 4.5, -0.04, 0.058, true],
  ["ST-DB12", "เหล็กข้ออ้อย DB12 SD40", "กก.", "เหล็กเสริม", "03", 25.9, 4.5, -0.05, 0.064, true],
  ["ST-DB16", "เหล็กข้ออ้อย DB16 SD40", "กก.", "เหล็กเสริม", "03", 25.6, 4.5, -0.05, 0.061, true],
  ["ST-WIRE", "ลวดผูกเหล็ก เบอร์ 18", "กก.", "เหล็กเสริม", "03", 46, 0, 0.02, 0, true],
  ["ST-MESH", "ตะแกรงเหล็กไวร์เมช 4 มม. @0.20 ม.", "ตร.ม.", "เหล็กเสริม", "02", 58, 15, -0.03, 0.03, true],
  ["FW-PLY", "ไม้แบบ (ไม้อัดยาง/ไม้เคร่า) รวมค้ำยัน", "ตร.ม.", "ไม้แบบ", "03", 290, 165, 0.03, 0, false],
  ["ST-HSLAB", "แผ่นพื้นสำเร็จรูปอัดแรง หนา 5 ซม.", "ตร.ม.", "พื้นสำเร็จรูป", "03", 395, 65, 0.03, 0, true],
  ["ST-CEMENT", "ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1 (50 กก.)", "ถุง", "ปูนซีเมนต์", "03", 158, 0, 0.04, 0, true],
  // ---- 04 ก่ออิฐ/ฉาบ
  ["MS-AAC75", "อิฐมวลเบา G2 หนา 7.5 ซม. (20×60 ซม.)", "ก้อน", "อิฐ", "04", 24.5, 0, 0.03, 0, true],
  ["MS-BRICK", "อิฐมอญ 3×7×16 ซม.", "ก้อน", "อิฐ", "04", 1.25, 0, 0.06, 0, true],
  ["MS-MORTAR", "ปูนก่ออิฐมวลเบาสำเร็จรูป (50 กก.)", "ถุง", "ปูนสำเร็จรูป", "04", 168, 0, 0.03, 0, true],
  ["MS-PLASTER", "ปูนฉาบสำเร็จรูป (50 กก.)", "ถุง", "ปูนสำเร็จรูป", "04", 138, 0, 0.03, 0, true],
  ["MS-LINTEL", "เสาเอ็น-ทับหลัง คสล. สำเร็จรูป", "ม.", "อิฐ", "04", 88, 45, 0.02, 0, false],
  ["MS-MESH", "ตะแกรงกันร้าวมุมช่องเปิด", "ม.", "อิฐ", "04", 22, 0, 0.0, 0, false],
  // ---- 05 หลังคา
  ["RF-CTILE", "กระเบื้องหลังคาคอนกรีต ลอนสามัญ", "แผ่น", "หลังคา", "05", 17.5, 0, 0.04, 0, true],
  ["RF-METAL", "เมทัลชีทหลังคา หนา 0.35 มม. เคลือบสี", "ตร.ม.", "หลังคา", "05", 215, 70, -0.02, 0.035, true],
  ["RF-STEEL", "เหล็กรูปพรรณโครงหลังคา (C/กล่อง) ทากันสนิม", "กก.", "เหล็กรูปพรรณ", "05", 35.5, 9, -0.04, 0.052, true],
  ["RF-INSUL", "ฉนวนใยแก้วกันความร้อน หนา 3 นิ้ว", "ตร.ม.", "ฉนวน", "05", 98, 25, 0.02, 0, true],
  ["RF-PU", "กันซึมดาดฟ้าโพลียูรีเทน 2 ชั้น", "ตร.ม.", "กันซึม", "05", 290, 85, 0.03, 0, true],
  ["RF-GUTTER", "รางน้ำฝนไวนิล/สังกะสีพร้อมท่อลง", "ม.", "หลังคา", "05", 270, 80, 0.02, 0, true],
  // ---- 06 ไฟฟ้า
  ["EL-THW25", "สายไฟ THW 2.5 ตร.มม.", "ม.", "สายไฟ", "06", 11.8, 0, 0.06, 0.054, true],
  ["EL-THW4", "สายไฟ THW 4 ตร.มม.", "ม.", "สายไฟ", "06", 18.6, 0, 0.06, 0.055, true],
  ["EL-VAF25", "สายไฟ VAF 2×2.5 ตร.มม.", "ม.", "สายไฟ", "06", 23, 0, 0.06, 0.05, true],
  ["EL-CONDUIT", "ท่อร้อยสายไฟ EMT 1/2 นิ้ว พร้อมอุปกรณ์", "ม.", "ท่อร้อยสาย", "06", 19, 38, 0.02, 0, true],
  ["EL-DL", "โคมดาวน์ไลท์ LED 9W", "ชุด", "โคมไฟ", "06", 235, 120, -0.06, 0, true],
  ["EL-SOCKET", "เต้ารับคู่มีกราวด์ พร้อมหน้ากาก", "ชุด", "อุปกรณ์ไฟฟ้า", "06", 148, 150, 0.01, 0, true],
  ["EL-SWITCH", "สวิตช์ทางเดียว พร้อมหน้ากาก", "ชุด", "อุปกรณ์ไฟฟ้า", "06", 98, 120, 0.01, 0, true],
  ["EL-CU", "ตู้คอนซูมเมอร์ยูนิต 12 ช่อง พร้อม RCBO", "ชุด", "อุปกรณ์ไฟฟ้า", "06", 4950, 1500, 0.02, 0, true],
  ["EL-MCB", "เบรกเกอร์ลูกย่อย 1P 16–32A", "ตัว", "อุปกรณ์ไฟฟ้า", "06", 215, 0, 0.01, 0, true],
  ["EL-GROUND", "หลักดินทองแดง 5/8 นิ้ว ยาว 2.4 ม. พร้อมสาย", "ชุด", "อุปกรณ์ไฟฟ้า", "06", 690, 350, 0.04, 0, true],
  // ---- 07 ประปา
  ["PL-PPR20", "ท่อ PPR 20 มม. PN20 พร้อมข้อต่อ", "ม.", "ท่อประปา", "07", 52, 45, 0.03, 0, true],
  ["PL-PVC2", "ท่อ PVC 2 นิ้ว ชั้น 8.5 พร้อมข้อต่อ", "ม.", "ท่อระบาย", "07", 52, 40, 0.04, 0, true],
  ["PL-PVC4", "ท่อ PVC 4 นิ้ว ชั้น 8.5 พร้อมข้อต่อ", "ม.", "ท่อระบาย", "07", 122, 55, 0.04, 0, true],
  ["PL-TANK", "ถังเก็บน้ำบนดิน 2,000 ลิตร", "ใบ", "ระบบน้ำ", "07", 8900, 1200, 0.02, 0, true],
  ["PL-PUMP", "ปั๊มน้ำอัตโนมัติแรงดันคงที่ 300W", "ชุด", "ระบบน้ำ", "07", 8200, 1200, 0.01, 0, true],
  ["PL-SEPTIC", "ถังบำบัดน้ำเสียสำเร็จรูป 1,600 ลิตร", "ใบ", "ระบบน้ำ", "07", 9800, 2500, 0.02, 0, true],
  ["PL-DRAIN", "บ่อพัก คสล. ฝาเหล็กหล่อ", "บ่อ", "ท่อระบาย", "13", 1450, 650, 0.03, 0, false],
  // ---- 08 ปรับอากาศ
  ["AC-12", "เครื่องปรับอากาศ Inverter 12,000 BTU", "ชุด", "เครื่องปรับอากาศ", "08", 16900, 2800, -0.04, 0, true],
  ["AC-18", "เครื่องปรับอากาศ Inverter 18,000 BTU", "ชุด", "เครื่องปรับอากาศ", "08", 26500, 3200, -0.04, 0, true],
  ["AC-24", "เครื่องปรับอากาศ Inverter 24,000 BTU", "ชุด", "เครื่องปรับอากาศ", "08", 35900, 3500, -0.03, 0, true],
  ["AC-PIPE", "ท่อน้ำยาแอร์ทองแดงหุ้มฉนวน พร้อมท่อน้ำทิ้ง", "ม.", "เครื่องปรับอากาศ", "08", 320, 90, 0.07, 0.04, true],
  // ---- 09 ประตู/หน้าต่าง
  ["DW-DOOR", "ประตูไม้ HDF บานทึบ พร้อมวงกบ", "ชุด", "ประตู", "09", 4400, 950, 0.02, 0, true],
  ["DW-MAIN", "ประตูไม้จริงทางเข้าหลัก พร้อมวงกบ", "ชุด", "ประตู", "09", 19500, 2500, 0.03, 0, true],
  ["DW-WIN", "หน้าต่างอะลูมิเนียมบานเลื่อน กระจกเขียวตัดแสง 6 มม.", "ตร.ม.", "หน้าต่าง", "09", 2750, 380, 0.03, 0, true],
  ["DW-HW", "ชุดลูกบิด/มือจับ บานพับ กันชน", "ชุด", "อุปกรณ์ประตู", "09", 690, 0, 0.01, 0, true],
  // ---- 10 พื้น/ผนัง/ฝ้า
  ["FN-GRANITO", "กระเบื้องแกรนิตโต้ 60×60 ซม.", "ตร.ม.", "กระเบื้อง", "10", 430, 230, -0.02, 0, true],
  ["FN-CERAMIC", "กระเบื้องเซรามิกพื้นกันลื่น 30×30 ซม.", "ตร.ม.", "กระเบื้อง", "10", 235, 220, 0.01, 0, true],
  ["FN-WALLTILE", "กระเบื้องผนังห้องน้ำ 30×60 ซม.", "ตร.ม.", "กระเบื้อง", "10", 340, 240, 0.01, 0, true],
  ["FN-LAMINATE", "พื้นไม้ลามิเนต หนา 12 มม. พร้อมโฟมรอง", "ตร.ม.", "พื้นไม้", "10", 640, 130, 0.02, 0, true],
  ["FN-GLUE", "กาวซีเมนต์ปูกระเบื้อง (20 กก.)", "ถุง", "ปูนสำเร็จรูป", "10", 215, 0, 0.03, 0, true],
  ["FN-SCREED", "ปูนทรายปรับระดับพื้น", "ตร.ม.", "ปูนสำเร็จรูป", "10", 85, 95, 0.03, 0, false],
  ["FN-GYPSUM", "ฝ้ายิปซัมบอร์ด 9 มม. ฉาบรอยต่อเรียบ โครงซีไลน์", "ตร.ม.", "ฝ้าเพดาน", "10", 245, 150, 0.02, 0, true],
  // ---- 11 สี
  ["PT-PRIMER", "สีรองพื้นปูนใหม่กันด่าง (3.785 ล.)", "แกลลอน", "สี", "11", 880, 0, 0.03, 0, true],
  ["PT-INT", "สีน้ำอะคริลิกภายใน เกรดพรีเมียม (3.785 ล.)", "แกลลอน", "สี", "11", 1090, 0, 0.03, 0, true],
  ["PT-EXT", "สีน้ำอะคริลิกภายนอก เกรดพรีเมียม (3.785 ล.)", "แกลลอน", "สี", "11", 1480, 0, 0.03, 0, true],
  // ---- 12 สุขภัณฑ์
  ["SN-WC", "สุขภัณฑ์ชักโครกแบบชิ้นเดียว", "ชุด", "สุขภัณฑ์", "12", 7200, 900, 0.02, 0, true],
  ["SN-BASIN", "อ่างล้างหน้าพร้อมก๊อกและท่อน้ำทิ้ง", "ชุด", "สุขภัณฑ์", "12", 3400, 600, 0.02, 0, true],
  ["SN-SHOWER", "ชุดฝักบัวพร้อมวาล์วผสม", "ชุด", "สุขภัณฑ์", "12", 2600, 450, 0.02, 0, true],
  ["SN-HEATER", "เครื่องทำน้ำอุ่น 4,500W", "เครื่อง", "สุขภัณฑ์", "12", 5100, 600, 0.0, 0, true],
  ["SN-SINK", "ซิงค์ล้างจานสเตนเลส 1 หลุม พร้อมก๊อก", "ชุด", "สุขภัณฑ์", "12", 3900, 600, 0.02, 0, true],
  ["SN-ACC", "อุปกรณ์ห้องน้ำ (กระจก ราวแขวน ที่ใส่กระดาษ)", "ชุด", "สุขภัณฑ์", "12", 1900, 300, 0.01, 0, true],
  // ---- 13 ภายนอก
  ["EX-PAVE", "บล็อกปูพื้นลานจอดรถ หนา 6 ซม. พร้อมทรายรองพื้น", "ตร.ม.", "งานภายนอก", "13", 335, 125, 0.03, 0, true],
];

export const SEED_PRICE_ITEMS: PriceItem[] = ITEMS.map(([code, name, unit, category, costCode, base, labour]) => ({ id: code, code, name, unit, category, costCode, base, labour }));
const SEED_META = new Map(ITEMS.map((s) => [s[0], { drift: s[7], jump: s[8], supplier: s[9] ?? true }]));

// ---------- months ----------

export const HISTORY_MONTHS = 18;
const [TY, TM] = TODAY.split("-").map(Number);
/** "YYYY-MM-01" for i months before the current month (0 = this month) */
export function monthAgo(i: number) {
  const d = new Date(Date.UTC(TY, TM - 1 - i, 1));
  return d.toISOString().slice(0, 10);
}
export const MONTHS: string[] = Array.from({ length: HISTORY_MONTHS }, (_, k) => monthAgo(HISTORY_MONTHS - 1 - k));
export const CURRENT_MONTH = monthAgo(0);

const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function thMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${TH_M[m - 1]} ${String(y + 543).slice(2)}`;
}

const round = (p: number) => (p >= 1000 ? Math.round(p / 10) * 10 : p >= 100 ? Math.round(p) : Math.round(p * 100) / 100);
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ---------- sample history ----------

const sampleCache = new Map<string, PriceObs[]>();

/** Deterministic sample history for one item, all sources (18 months). */
export function sampleHistory(item: Pick<PriceItem, "code" | "base">): PriceObs[] {
  const hit = sampleCache.get(item.code);
  if (hit) return hit;
  const meta = SEED_META.get(item.code);
  if (!meta) {
    sampleCache.set(item.code, []);
    return [];
  }
  const rnd = seeded(hash(item.code));
  const n = HISTORY_MONTHS;
  // build the market series backwards from today's base price
  const series = new Array<number>(n);
  series[n - 1] = item.base;
  series[n - 2] = item.base / (1 + meta.jump);
  const step = meta.drift / (n - 2);
  for (let i = n - 3; i >= 0; i--) series[i] = series[i + 1] / (1 + step + (rnd() - 0.5) * 0.012);
  const out: PriceObs[] = [];
  const supplierFactor = 0.93 + rnd() * 0.05;
  for (let i = 0; i < n; i++) {
    const date = MONTHS[i];
    out.push({ id: `S-${item.code}-moc-${date}`, itemCode: item.code, source: "moc", date, price: round(series[i]), province: "กรุงเทพฯ", sample: true });
    // กรมบัญชีกลาง: quarterly table, 2–4 % above market average
    const q = i - (i % 3);
    out.push({ id: `S-${item.code}-cgd-${date}`, itemCode: item.code, source: "cgd", date, price: round(series[q] * 1.03), sample: true });
    if (meta.supplier && (rnd() > 0.18 || i >= n - 2)) out.push({ id: `S-${item.code}-sup-${date}`, itemCode: item.code, source: "supplier", date, price: round(series[i] * (supplierFactor + (rnd() - 0.5) * 0.03)), sample: true });
  }
  sampleCache.set(item.code, out);
  return out;
}

// ---------- price book ----------

export type PricePoint = { price: number; date: string; source: PriceSource; sample: boolean; province?: string };

/**
 * Series for one item + source: imported observations win over the sample history.
 * Returns one point per month (latest observation in that month), ascending.
 */
export function seriesOf(item: PriceItem, source: PriceSource, imported: PriceObs[], province?: string): PricePoint[] {
  let rows = imported.filter((o) => o.itemCode === item.code && o.source === source);
  let sample = false;
  if (!rows.length) {
    rows = sampleHistory(item).filter((o) => o.source === source);
    sample = true;
  }
  if (province && source === "moc") {
    const inProv = rows.filter((o) => !o.province || o.province === province);
    if (inProv.length) rows = inProv;
  }
  const byMonth = new Map<string, PriceObs>();
  for (const o of [...rows].sort((a, b) => a.date.localeCompare(b.date))) byMonth.set(o.date.slice(0, 7), o);
  return [...byMonth.values()].map((o) => ({ price: o.price, date: o.date.slice(0, 7) + "-01", source, sample: sample || !!o.sample, province: o.province }));
}

export type Latest = { price: number; prev?: number; change?: number; date: string; sample: boolean } | null;
export function latestOf(item: PriceItem, source: PriceSource, imported: PriceObs[], province?: string): Latest {
  const s = seriesOf(item, source, imported, province);
  if (!s.length) return null;
  const last = s[s.length - 1];
  const prev = s.length > 1 ? s[s.length - 2].price : undefined;
  return { price: last.price, prev, change: prev ? (last.price - prev) / prev : undefined, date: last.date, sample: last.sample };
}

export type BookChoice = PriceSource | "lowest";
export const BOOK_LABEL: Record<BookChoice, string> = { ...SOURCE_LABEL, lowest: "ราคาต่ำสุดจากทุกแหล่ง" };

export type PriceBook = {
  choice: BookChoice;
  /** material price per item unit, with the source actually used */
  material: (code: string) => { price: number; source: PriceSource; sample: boolean } | null;
  labour: (code: string) => number;
  item: (code: string) => PriceItem | undefined;
};

/** Build a price book for estimating: one source, or the lowest latest price across sources. */
export function makePriceBook(items: PriceItem[], imported: PriceObs[], choice: BookChoice, province?: string): PriceBook {
  const byCode = new Map(items.map((i) => [i.code, i]));
  const cache = new Map<string, { price: number; source: PriceSource; sample: boolean } | null>();
  return {
    choice,
    item: (code) => byCode.get(code),
    labour: (code) => byCode.get(code)?.labour ?? 0,
    material: (code) => {
      if (cache.has(code)) return cache.get(code)!;
      const it = byCode.get(code);
      let best: { price: number; source: PriceSource; sample: boolean } | null = null;
      if (it) {
        const sources = choice === "lowest" ? PRICE_SOURCES : [choice, ...PRICE_SOURCES.filter((s) => s !== choice)];
        for (const s of sources) {
          const l = latestOf(it, s, imported, province);
          if (!l) continue;
          if (choice !== "lowest") {
            best = { price: l.price, source: s, sample: l.sample };
            break;
          }
          if (!best || l.price < best.price) best = { price: l.price, source: s, sample: l.sample };
        }
        if (!best) best = { price: it.base, source: "moc", sample: true };
      }
      cache.set(code, best);
      return best;
    },
  };
}

/** Price book from the built-in sample data only (used by demo seeds). */
export const sampleBook = (choice: BookChoice = "cgd") => makePriceBook(SEED_PRICE_ITEMS, [], choice);

// ---------- competitor house prices (sample) ----------

const COMP: [string, string, number, number, number, string, string][] = [
  ["บ้านสบาย บิลเดอร์", "Minimal 2 ชั้น 3 ห้องนอน", 168, 2, 3.95, "2026-10-12", "งานบ้านและสวนแฟร์ 2026"],
  ["บ้านสบาย บิลเดอร์", "Tropical 2 ชั้น 4 ห้องนอน", 236, 2, 5.6, "2026-10-12", "งานบ้านและสวนแฟร์ 2026"],
  ["บ้านสบาย บิลเดอร์", "ชั้นเดียว 3 ห้องนอน", 122, 1, 2.75, "2026-07-02", "เว็บไซต์บริษัท"],
  ["ไทยโฮม คอนสตรัคชั่น", "Modern Box 2 ชั้น", 205, 2, 4.85, "2026-09-20", "โบรชัวร์"],
  ["ไทยโฮม คอนสตรัคชั่น", "Nordic 2 ชั้น", 150, 2, 3.55, "2026-09-20", "โบรชัวร์"],
  ["ไทยโฮม คอนสตรัคชั่น", "Luxury 2 ชั้น สระว่ายน้ำ", 420, 2, 12.9, "2026-06-15", "เว็บไซต์บริษัท"],
  ["เรือนดี โฮมดีไซน์", "Japanese 2 ชั้น", 175, 2, 4.4, "2026-10-28", "Facebook Page"],
  ["เรือนดี โฮมดีไซน์", "Lanna ชั้นเดียว", 142, 1, 3.3, "2026-08-08", "Facebook Page"],
  ["เรือนดี โฮมดีไซน์", "Farmhouse 2 ชั้น", 212, 2, 5.15, "2026-10-28", "Facebook Page"],
  ["พรีม่า บ้านและที่ดิน", "Contemporary 2 ชั้น", 270, 2, 7.45, "2026-05-30", "งานบ้านและสวนแฟร์ Select 2026"],
  ["พรีม่า บ้านและที่ดิน", "Classic 2 ชั้น", 360, 2, 9.9, "2026-05-30", "งานบ้านและสวนแฟร์ Select 2026"],
  ["สยามเรสซิเดนซ์ บิลด์", "Compact 2 ชั้น", 128, 2, 2.95, "2026-09-03", "เว็บไซต์บริษัท"],
  ["สยามเรสซิเดนซ์ บิลด์", "Urban 3 ชั้น หน้าแคบ", 290, 3, 6.4, "2026-09-03", "เว็บไซต์บริษัท"],
  ["สยามเรสซิเดนซ์ บิลด์", "Smart Home 2 ชั้น", 192, 2, 4.95, "2026-04-18", "โบรชัวร์"],
  ["บ้านสบาย บิลเดอร์", "Minimal 2 ชั้น 3 ห้องนอน", 168, 2, 3.79, "2025-10-10", "งานบ้านและสวนแฟร์ 2025"],
  ["ไทยโฮม คอนสตรัคชั่น", "Modern Box 2 ชั้น", 205, 2, 4.69, "2025-11-14", "โบรชัวร์"],
];
export const SEED_COMPETITORS: CompetitorPrice[] = COMP.map(([company, model, area, floors, m, date, source], i) => ({
  id: `CMP-${String(i + 1).padStart(3, "0")}`,
  company,
  model,
  area,
  floors,
  price: Math.round(m * 1e6),
  date,
  source,
  sample: true,
}));

/** Median price per m² of competitor houses comparable to an area (±35 %) and floor count */
export function competitorPerM2(list: CompetitorPrice[], area: number, floors?: number) {
  const latestOnly = new Map<string, CompetitorPrice>();
  for (const c of [...list].sort((a, b) => a.date.localeCompare(b.date))) latestOnly.set(`${c.company}|${c.model}`, c);
  let near = [...latestOnly.values()].filter((c) => c.area >= area * 0.65 && c.area <= area * 1.35 && (!floors || c.floors === floors || floors > 2));
  if (near.length < 2) near = [...latestOnly.values()];
  const v = near.map((c) => c.price / c.area).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { median: mid, min: v[0], max: v[v.length - 1], n: v.length };
}
