// AI table extraction from official price-list files (PDF / photo) → review rows → PriceObs.
// Covers: สนค. ราคาวัสดุก่อสร้างรายจังหวัด, ราคาเฉลี่ยสำหรับราคากลางงานก่อสร้างภาครัฐ,
// กรมบัญชีกลาง บัญชีค่าแรงงาน/ค่าดำเนินการ. The AI only reads the table; matching to our items,
// unit factors and the final import are pure functions here (unit-tested in tests/prices).

import type { JsonSchema } from "../ai/types";
import type { PriceItem, PriceKind, PriceObs, PriceSource } from "../sales/prices-data";
import { prepare, rank, unitFactor } from "./match";
import { provinceName, roundPrice } from "./moc";

export type DocKind = "moc-province" | "moc-gov-avg" | "cgd-labour" | "cgd-material";
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  "moc-province": "ราคาวัสดุก่อสร้างรายจังหวัด (สนค. พณ.)",
  "moc-gov-avg": "ราคาเฉลี่ยสำหรับราคากลางงานก่อสร้างภาครัฐ (สนค.)",
  "cgd-labour": "บัญชีค่าแรงงาน/ค่าดำเนินการ (กรมบัญชีกลาง)",
  "cgd-material": "ราคาวัสดุตามบัญชีราคากลาง (กรมบัญชีกลาง)",
};
export const DOC_SOURCE: Record<DocKind, PriceSource> = { "moc-province": "moc", "moc-gov-avg": "moc", "cgd-labour": "cgd", "cgd-material": "cgd" };
export const DOC_PRICE_KIND: Record<DocKind, PriceKind> = { "moc-province": "material", "moc-gov-avg": "material", "cgd-labour": "labour", "cgd-material": "material" };

/** one row as the model returns it */
export type ExtractedRow = { name: string; spec?: string; unit?: string; price?: number; labour?: number; province?: string; month?: string };
export type Extracted = { title?: string; province?: string; month?: string; rows: ExtractedRow[] };

export const EXTRACT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "ชื่อเอกสาร/ตาราง ตามที่พิมพ์ในไฟล์" },
    province: { type: "string", description: "จังหวัดของตารางทั้งฉบับ ถ้ามี (ไม่ต้องใส่ถ้าไม่ระบุ)" },
    month: { type: "string", description: "เดือนของราคาทั้งฉบับ รูปแบบ YYYY-MM เป็น ค.ศ. (แปลง พ.ศ. ลบ 543)" },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "ชื่อรายการ ตามที่พิมพ์ (รวมหัวข้อกลุ่มถ้าชื่อแถวสั้น เช่น 'เหล็กเส้นกลมผิวข้ออ้อย SD40 ขนาด 12 มม.')" },
          spec: { type: "string", description: "ขนาด/ชั้นคุณภาพ/ยี่ห้อ ถ้าแยกคอลัมน์" },
          unit: { type: "string", description: "หน่วย เช่น ตัน กก. ลบ.ม. ตร.ม. ม. ถุง" },
          price: { type: "number", description: "ราคาวัสดุต่อหน่วย (บาท) ตัวเลขล้วน ไม่มีจุลภาค" },
          labour: { type: "number", description: "ค่าแรงต่อหน่วย (บาท) ถ้าตารางมีคอลัมน์ค่าแรง" },
          province: { type: "string", description: "จังหวัดของแถวนี้ ถ้าตารางมีหลายจังหวัด" },
          month: { type: "string", description: "เดือนของแถวนี้ YYYY-MM (ค.ศ.) ถ้าตารางมีหลายเดือน" },
        },
        required: ["name"],
      },
    },
  },
  required: ["rows"],
};

export function extractPrompt(kind: DocKind, today: string) {
  return {
    system:
      "คุณช่วยอ่านตารางราคาวัสดุก่อสร้างและค่าแรงจากเอกสารราชการไทย ตอบเป็น JSON ตาม schema เท่านั้น " +
      "อ่านตัวเลขตามที่พิมพ์จริง ห้ามคำนวณ ห้ามเดา ห้ามเติมแถวที่ไม่มี ถ้าอ่านตัวเลขไม่ชัดให้เว้นช่องนั้น " +
      "ถ้ามีหลายคอลัมน์ราคา (เช่น ราคาวัสดุ และ ค่าแรง) ให้แยกใส่ price และ labour",
    prompt:
      `เอกสารนี้คือ: ${DOC_KIND_LABEL[kind]}\nวันนี้คือ ${today}\n` +
      "ดึงทุกแถวที่มีราคาออกมา (ข้ามหัวข้อกลุ่มที่ไม่มีราคา แต่ใส่ชื่อหัวข้อนำหน้าชื่อแถวย่อย) " +
      "ระบุจังหวัดและเดือนของตาราง ถ้าเอกสารบอก ปี พ.ศ. ให้แปลงเป็น ค.ศ.",
  };
}

// ---------- dates ----------

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-10", "10/2569", "ตุลาคม 2569", "ต.ค. 69" → "2026-10"; undefined when unreadable */
export function parseMonth(s?: string): string | undefined {
  const t = (s ?? "").trim();
  if (!t) return undefined;
  const fix = (y: number, m: number) => {
    if (y < 100) y += y > 60 ? 2500 : 2000; // 2-digit Thai years ("69") are Buddhist
    if (y > 2400) y -= 543;
    return m >= 1 && m <= 12 && y >= 2000 && y <= 2100 ? `${y}-${String(m).padStart(2, "0")}` : undefined;
  };
  let m = /^(\d{4})-(\d{1,2})/.exec(t);
  if (m) return fix(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) return fix(Number(m[2]), Number(m[1]));
  for (let i = 0; i < 12; i++) {
    if (t.includes(TH_MONTHS[i]) || t.includes(TH_SHORT[i]) || t.includes(TH_SHORT[i].replace(/\./g, ""))) {
      const y = /(\d{2,4})\s*$/.exec(t);
      return y ? fix(Number(y[1]), i + 1) : undefined;
    }
  }
  return undefined;
}

// ---------- review rows ----------

export type ReviewRow = {
  key: string;
  name: string;
  unit?: string;
  /** price in the document unit */
  price?: number;
  kind: PriceKind;
  province?: string;
  month?: string;
  /** chosen price-book item ("" = skip) */
  itemCode: string;
  factor: number;
  score: number;
  /** alternatives for the picker */
  options: { code: string; score: number; factor?: number }[];
  errors: string[];
};

/**
 * Turn the model's rows into review rows: one per price column (material and/or labour),
 * matched to our items by name and unit. Rows below `minScore` are left unmatched (skip).
 */
export function toReviewRows(ex: Extracted, kind: DocKind, items: Pick<PriceItem, "code" | "name" | "unit" | "spec">[], opts: { minScore?: number; fallbackMonth?: string } = {}): ReviewRow[] {
  const cands = prepare(items, (i) => (i.spec ? `${i.name} ${i.spec}` : i.name), (i) => i.unit);
  const docMonth = parseMonth(ex.month) ?? opts.fallbackMonth;
  const docProv = provinceName(ex.province);
  const out: ReviewRow[] = [];
  ex.rows.forEach((r, i) => {
    const name = [r.name, r.spec].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!name) return;
    const cols: { kind: PriceKind; price?: number }[] = [];
    if (DOC_PRICE_KIND[kind] === "labour") cols.push({ kind: "labour", price: r.labour ?? r.price });
    else {
      cols.push({ kind: "material", price: r.price });
      if (r.labour && r.labour > 0) cols.push({ kind: "labour", price: r.labour });
    }
    const ranked = rank({ name, unit: r.unit }, cands, 5, "toCandidate");
    const best = ranked[0];
    const ok = best && best.score >= (opts.minScore ?? 0.45);
    for (const c of cols) {
      const month = parseMonth(r.month) ?? docMonth;
      const errors: string[] = [];
      if (!(c.price !== undefined && c.price > 0)) errors.push("ไม่มีราคา");
      if (!month) errors.push("ไม่ทราบเดือน");
      out.push({
        key: `${i}-${c.kind}`,
        name,
        unit: r.unit,
        price: c.price,
        kind: c.kind,
        province: provinceName(r.province) ?? docProv,
        month,
        itemCode: ok ? best.item.code : "",
        factor: ok ? (best.factor ?? 1) : 1,
        score: best?.score ?? 0,
        options: ranked.map((x) => ({ code: x.item.code, score: x.score, factor: x.factor })),
        errors,
      });
    }
  });
  return out;
}

/** factor for a row after the user picks another item */
export const factorFor = (row: Pick<ReviewRow, "unit" | "name">, item: Pick<PriceItem, "unit" | "name">) => unitFactor(row.unit, row.name, item.unit, item.name) ?? 1;

/** accepted review rows → PriceObs (ids are assigned by mergeObs) */
export function reviewToObs(rows: ReviewRow[], source: PriceSource, importedAt: string, ref?: string): PriceObs[] {
  return rows
    .filter((r) => r.itemCode && !r.errors.length && r.price && r.month && r.factor > 0)
    .map((r) => ({
      id: "",
      itemCode: r.itemCode,
      source,
      date: `${r.month}-01`,
      price: roundPrice(r.price! * r.factor),
      province: r.province,
      kind: r.kind,
      importedAt,
      via: "file" as const,
      ref,
      rawPrice: r.price,
      rawUnit: r.unit,
    }));
}
