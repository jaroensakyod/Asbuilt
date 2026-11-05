// JSON schemas sent with each extraction call (provider-neutral subset, see src/lib/ai/types.ts).
// All keys are required: the prompt tells the model to answer "" / 0 / [] when a value is not printed.

import type { JsonSchema } from "../ai/types";
import { DOC_KINDS } from "./types";

const str = (description?: string): JsonSchema => ({ type: "string", description });
const num = (description?: string): JsonSchema => ({ type: "number", description });
const bool = (description?: string): JsonSchema => ({ type: "boolean", description });
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: "object", properties, required: Object.keys(properties) });
const arr = (items: JsonSchema, description?: string): JsonSchema => ({ type: "array", items, description });
const date = (d: string) => str(`${d} รูปแบบ YYYY-MM-DD ปี ค.ศ. (แปลง พ.ศ. ลบ 543) หรือ "" ถ้าไม่มี`);
const confidence: JsonSchema = { type: "string", enum: ["high", "medium", "low"], description: "ความมั่นใจโดยรวมว่าอ่านถูก" };
const uncertain = arr(str(), "ชื่อคีย์ของช่องที่อ่านไม่ชัดหรือเดา");

const line = obj({
  description: str("ชื่อรายการตามเอกสาร"),
  qty: num("จำนวน (0 ถ้าไม่มี)"),
  unit: str("หน่วย เช่น ถุง ตัน เส้น ลบ.ม. งาน"),
  unitPrice: num("ราคาต่อหน่วยตามที่พิมพ์"),
  amount: num("จำนวนเงินของบรรทัดตามที่พิมพ์"),
});

export function invoiceSchema(categories: string[] = []): JsonSchema {
  return obj({
    docKind: { type: "string", enum: [...DOC_KINDS], description: "ชนิดเอกสาร" },
    vendorName: str("ชื่อผู้ขาย/ผู้ออกเอกสาร (ไม่ใช่ผู้ซื้อ)"),
    vendorTaxId: str("เลขประจำตัวผู้เสียภาษี 13 หลักของผู้ขาย ตัวเลขล้วน"),
    vendorBranch: str('สาขาผู้ขาย เช่น "สำนักงานใหญ่" หรือ "สาขา 00001"'),
    vendorAddress: str(),
    vendorPhone: str(),
    docNo: str("เลขที่เอกสาร/ใบกำกับ"),
    date: date("วันที่เอกสาร"),
    dueDate: date("วันครบกำหนดชำระ"),
    creditDays: num("เครดิต (วัน) ถ้าระบุ"),
    poNumber: str("เลขที่ใบสั่งซื้อ (PO) ที่อ้างถึง"),
    lines: arr(line),
    subtotal: num("รวมเงินก่อนหักส่วนลดและก่อน VAT"),
    discount: num("ส่วนลดท้ายบิล"),
    pricesIncludeVat: bool("ราคาในรายการรวม VAT แล้วหรือไม่"),
    vatRate: num("อัตรา VAT % (7 หรือ 0)"),
    vat: num("ภาษีมูลค่าเพิ่ม"),
    total: num("ยอดรวมทั้งสิ้นที่ต้องชำระ (รวม VAT)"),
    whtRate: num("อัตราหัก ณ ที่จ่าย % ถ้าเอกสารระบุ"),
    whtAmount: num("จำนวนเงินหัก ณ ที่จ่ายถ้าระบุ"),
    projectHint: str("ข้อความที่บอกโครงการ/สถานที่ส่งของ/หมายเหตุ"),
    categoryGuess: categories.length ? { type: "string", enum: ["", ...categories], description: "หมวดค่าใช้จ่ายที่ใกล้เคียงที่สุด" } : str('ใส่ ""'),
    note: str("หมายเหตุสั้น ๆ เช่น ลายมือ ภาพเบลอ"),
    confidence,
    uncertain,
  });
}

export const quoteSchema: JsonSchema = obj({
  vendorName: str("ชื่อผู้เสนอราคา"),
  vendorTaxId: str("เลขประจำตัวผู้เสียภาษีของผู้เสนอราคา"),
  docNo: str(),
  date: date("วันที่ใบเสนอราคา"),
  validUntil: date("ยืนราคาถึงวันที่"),
  validDays: num("ยืนราคากี่วัน ถ้าระบุเป็นจำนวนวัน"),
  leadDays: num("ระยะเวลาส่งของ (วัน)"),
  creditDays: num("เครดิต (วัน)"),
  pricesIncludeVat: bool("ราคาต่อหน่วยรวม VAT แล้วหรือไม่"),
  lines: arr(line),
  subtotal: num(),
  vat: num(),
  total: num(),
  note: str("เงื่อนไขสำคัญ เช่น ไม่รวมค่าขนส่ง"),
  confidence,
  uncertain,
});

export const tenderSchema: JsonSchema = obj({
  title: str("ชื่องาน/โครงการที่ประกวดราคา"),
  client: str("หน่วยงาน/ผู้ว่าจ้าง"),
  province: str("จังหวัดที่ตั้งโครงการ"),
  source: { type: "string", enum: ["egp", "private"], description: "egp = งานภาครัฐ" },
  method: { type: "string", enum: ["e-bidding", "selection", "specific", "invitation"] },
  egpNo: str("เลขที่โครงการ e-GP"),
  budget: num("วงเงินงบประมาณ (บาท)"),
  medianPrice: num("ราคากลาง (บาท รวม VAT)"),
  announced: date("วันประกาศ"),
  siteVisit: date("วันดูสถานที่"),
  questionsDue: date("วันสุดท้ายส่งคำถาม/ขอคำชี้แจง"),
  submitDue: date("วันยื่นเอกสารเสนอราคา"),
  openDate: date("วันเปิดซอง/พิจารณาผล"),
  bidBondAmount: num("หลักประกันการเสนอราคา (บาท)"),
  bidBondPct: num("หลักประกันการเสนอราคาเป็น % ถ้าระบุ"),
  durationDays: num("ระยะเวลาก่อสร้าง (วัน)"),
  penaltyRatePct: num("ค่าปรับรายวันเป็น % ของค่าจ้าง"),
  warrantyMonths: num("ระยะเวลารับประกันความชำรุดบกพร่อง (เดือน)"),
  summary: str("สรุปงานภาษาไทย 3–6 ประโยค"),
  qualifications: arr(str(), "คุณสมบัติผู้เสนอราคา เช่น ผลงาน ทุนจดทะเบียน ทะเบียนผู้รับเหมา"),
  risks: arr(str(), "ความเสี่ยง/ค่าปรับ/เงื่อนไขที่ต้องระวัง"),
  boq: arr(
    obj({
      group: str("หมวดงาน"),
      description: str(),
      qty: num(),
      unit: str(),
      material: num("ค่าวัสดุต่อหน่วย (0 ถ้าไม่แยก)"),
      labour: num("ค่าแรงต่อหน่วย (0 ถ้าไม่แยก)"),
      unitPrice: num("ราคาต่อหน่วยรวม ถ้าไม่แยกวัสดุ/ค่าแรง"),
    }),
    "รายการ BOQ ถ้ามีในเอกสาร",
  ),
  confidence,
  uncertain,
});

export const docSummarySchema: JsonSchema = obj({
  kind: { type: "string", enum: ["contract", "permit", "spec", "drawing", "report", "warranty", "other"] },
  title: str("ชื่อเอกสาร"),
  summary: str("สรุปภาษาไทย 3–8 ประโยค"),
  facts: arr(obj({ label: str(), value: str() }), "ข้อเท็จจริงสำคัญเป็นคู่หัวข้อ/ค่า"),
  keyDates: arr(obj({ label: str(), date: date("วันที่") })),
  risks: arr(str(), "ข้อควรระวัง/ความเสี่ยง"),
  confidence,
});
