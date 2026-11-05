// Estimating assistant + variation pricing helper — prompts, schemas and mappers (pure).

import type { JsonSchema } from "../ai/types";
import { AI_LINE_SCHEMA, bookForPrompt, costCodesForPrompt, r2, withMarkup, type AiLine, type BookItem, type PricedLine } from "./pricing";

export const SYSTEM_ESTIMATOR =
  "คุณเป็นวิศวกรประมาณราคา (QS) ของบริษัทรับสร้างบ้านในประเทศไทย ถอดปริมาณงานจากคำบรรยายขอบเขตงานเป็นรายการ BOQ " +
  "ใช้รหัสรายการจากฐานราคาที่ให้มาเท่านั้น และใช้หน่วยตามฐานราคา ถ้าไม่มีรายการที่ตรงให้เว้น itemCode ว่างและตั้งชื่อรายการให้ชัดเจน " +
  "ห้ามใส่ราคาต่อหน่วยเด็ดขาด ราคาจะดึงจากฐานข้อมูลของบริษัทเอง ตอบเป็นภาษาไทย";

export type BoqDraft = { title: string; assumptions: string[]; lines: AiLine[]; questions: string[] };

export const BOQ_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "ชื่องานสั้น ๆ" },
    assumptions: { type: "array", items: { type: "string" }, description: "สมมติฐานที่ใช้ถอดปริมาณ" },
    lines: { type: "array", items: AI_LINE_SCHEMA },
    questions: { type: "array", items: { type: "string" }, description: "ข้อมูลที่ควรถามลูกค้า/หน้างานเพิ่ม" },
  },
  required: ["title", "lines"],
};

export function estimatePrompt(scope: string, items: BookItem[], costCodes: Record<string, string>, today: string) {
  return [
    `วันที่วันนี้ ${today}`,
    `ขอบเขตงานจากผู้ใช้:\n"""${scope.trim()}"""`,
    `หมวดต้นทุน: ${costCodesForPrompt(costCodes)}`,
    `ฐานราคา (รหัส|ชื่อ|หน่วย|หมวด):\n${bookForPrompt(items)}`,
    "ถอดเป็นรายการ BOQ ครบทั้งงานโครงสร้าง งานสถาปัตย์ และงานระบบที่เกี่ยวข้อง (รวมงานรื้อถอน/เตรียมพื้นที่ถ้ามี) " +
      "คิดปริมาณจากขนาดที่ให้มา เผื่อเศษวัสดุตามปกติ (กระเบื้อง 5–10% เหล็ก 5%) ใส่วิธีคิดสั้น ๆ ใน note",
    "ค่าแรงรวมอยู่ในราคาฐานแล้ว ไม่ต้องแยกบรรทัดค่าแรงสำหรับรายการที่มีในฐานราคา",
  ].join("\n\n");
}

// ---------- variation ----------

export const SYSTEM_VARIATION =
  "คุณเป็นวิศวกรสัญญา/QS ของบริษัทรับสร้างบ้าน ช่วยตั้งราคางานเปลี่ยนแปลง (Variation Order) จากคำอธิบาย " +
  "เสนอรายการ ปริมาณ หน่วย และหมวดต้นทุน โดยใช้รหัสจากฐานราคาที่ให้มาเท่านั้น งานลดให้ใส่ปริมาณติดลบ " +
  "ห้ามใส่ราคาต่อหน่วย ประเมินวันที่ต้องขยายเวลาโดยดูว่างานนี้อยู่บนสายงานวิกฤตหรือไม่ ตอบเป็นภาษาไทย";

export type VoDraft = { title: string; reason: string; lines: AiLine[]; days: number; daysReason: string; risks: string[] };

export const VO_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "ชื่องานเปลี่ยนแปลงสั้น ๆ" },
    reason: { type: "string", description: "เหตุผล/รายละเอียดสำหรับเอกสาร VO" },
    lines: { type: "array", items: { ...AI_LINE_SCHEMA, properties: { ...AI_LINE_SCHEMA.properties, qty: { type: "number", description: "ปริมาณ งานลดให้ติดลบ" } } } },
    days: { type: "integer", description: "จำนวนวันที่ควรขอขยายเวลา (0 ถ้าไม่กระทบ)" },
    daysReason: { type: "string", description: "เหตุผลของจำนวนวัน" },
    risks: { type: "array", items: { type: "string" } },
  },
  required: ["title", "lines", "days", "daysReason"],
};

export function variationPrompt(o: {
  description: string;
  project?: { id: string; name: string; phase: string; actual: number; finish: string; modelCode?: string; area?: number };
  items: BookItem[];
  costCodes: Record<string, string>;
  today: string;
}) {
  const p = o.project;
  return [
    `วันที่วันนี้ ${o.today}`,
    p ? `โครงการ ${p.id} ${p.name} · ขั้นงานปัจจุบัน ${p.phase} · ความคืบหน้า ${p.actual}% · กำหนดเสร็จ ${p.finish}${p.area ? ` · พื้นที่ ${p.area} ตร.ม.` : ""}` : "ยังไม่ระบุโครงการ",
    `คำอธิบายการเปลี่ยนแปลง:\n"""${o.description.trim()}"""`,
    `หมวดต้นทุน: ${costCodesForPrompt(o.costCodes)}`,
    `ฐานราคา (รหัส|ชื่อ|หน่วย|หมวด):\n${bookForPrompt(o.items)}`,
    "ถ้าเป็นการเปลี่ยนวัสดุ ให้มีทั้งบรรทัดงานลด (ของเดิม ปริมาณติดลบ) และงานเพิ่ม (ของใหม่) " +
      "ถ้าต้องรื้องานที่ทำไปแล้วให้มีบรรทัดรื้อถอน",
  ].join("\n\n");
}

/** Variation line (same shape as Variation["lines"][number]) from a priced line and a markup on cost. */
export function voLineFrom(l: Pick<PricedLine, "name" | "qty" | "unit" | "unitCost" | "costCode">, markupPct: number) {
  return { description: l.name, qty: r2(l.qty), unit: l.unit, unitCost: r2(l.unitCost), unitPrice: withMarkup(l.unitCost, markupPct), costCode: l.costCode };
}

/** Clamp the AI's time estimate to a sane whole number of days. */
export const cleanDays = (d: unknown) => Math.max(0, Math.min(365, Math.round(Number(d) || 0)));

/** Signed lines are allowed for variations (omissions), so price with |qty| and restore the sign. */
export function signedQty(l: AiLine) {
  const q = Number(l.qty) || 0;
  return { line: { ...l, qty: Math.abs(q) }, sign: q < 0 ? -1 : 1 };
}
