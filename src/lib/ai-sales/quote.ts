// Quote draft: option lines + Thai cover letter / terms summary / follow-up message (pure).

import type { JsonSchema } from "../ai/types";
import { bookForPrompt, r2, withMarkup, type BookItem, type BookLike } from "./pricing";
import type { CatalogModel, LeadBrief } from "./lead";

/**
 * Company upgrade packages with a fixed sell price (excl. VAT). Same list the sales demo seed uses
 * for quotation add-ons; price-book items are priced from cost + markup instead.
 */
export type Package = { code: string; name: string; unit: string; price: number; costCode: string };
export const UPGRADE_PACKAGES: Package[] = [
  { code: "PK-SOLAR5", name: "ระบบโซลาร์เซลล์ออนกริด 5 kW", unit: "ระบบ", price: 165000, costCode: "06" },
  { code: "PK-SPC", name: "เปลี่ยนพื้นห้องนอนเป็นไม้ SPC กันน้ำ", unit: "ตร.ม.", price: 950, costCode: "10" },
  { code: "PK-SCREEN", name: "มุ้งลวดและม่านม้วนทั้งหลัง", unit: "ชุด", price: 68000, costCode: "09" },
  { code: "PK-FENCE", name: "รั้วหน้าบ้านพร้อมประตูรีโมท", unit: "ม.", price: 6500, costCode: "13" },
  { code: "PK-AC12", name: "เพิ่มเครื่องปรับอากาศ 12,000 BTU", unit: "ชุด", price: 23500, costCode: "08" },
  { code: "PK-KITCHEN", name: "ชุดครัว Built-in พร้อมท็อปควอตซ์", unit: "ชุด", price: 145000, costCode: "10" },
  { code: "PK-CCTV", name: "ระบบกล้องวงจรปิด 4 จุด", unit: "ระบบ", price: 32000, costCode: "06" },
  { code: "PK-TANK", name: "ถังเก็บน้ำใต้ดิน 4,000 ลิตร", unit: "ชุด", price: 38000, costCode: "07" },
  { code: "PK-EV", name: "จุดชาร์จรถยนต์ไฟฟ้า 7.4 kW พร้อมเดินสาย", unit: "จุด", price: 42000, costCode: "06" },
  { code: "PK-CARPORT", name: "หลังคาโรงจอดรถเมทัลชีทโครงเหล็ก", unit: "ตร.ม.", price: 2400, costCode: "05" },
];

export type QuoteOptionAi = { code?: string; name: string; qty: number; unit: string; reason?: string };
export type QuoteDraftAi = { options: QuoteOptionAi[]; coverLetter: string; termsSummary: string; followUp: string; note?: string };

export type DraftOption = {
  key: string;
  code?: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  costCode: string;
  basis: "package" | "book" | "unpriced";
  reason?: string;
};

export const SYSTEM_QUOTE =
  "คุณเป็นพนักงานขายอาวุโสของบริษัทรับสร้างบ้าน ร่างใบเสนอราคาจากข้อมูลลูกค้าและแบบบ้านที่เลือก " +
  "เลือกรายการเสริมจากแพ็กเกจหรือฐานราคาที่ให้เท่านั้น (ใส่รหัส) ห้ามกำหนดราคาเอง " +
  "เขียนจดหมายนำเสนอ สรุปเงื่อนไข และข้อความติดตามเป็นภาษาไทยสุภาพ กระชับ ไม่ใช้อีโมจิ ไม่สัญญาสิ่งที่ไม่มีในข้อมูล";

export const QUOTE_DRAFT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string", description: "รหัสแพ็กเกจ (PK-…) หรือรหัสฐานราคา" },
          name: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          reason: { type: "string", description: "ทำไมเสนอรายการนี้ให้ลูกค้ารายนี้" },
        },
        required: ["name", "qty", "unit"],
      },
    },
    coverLetter: { type: "string", description: "จดหมายนำเสนอราคา 1–2 ย่อหน้า เรียนคุณ…" },
    termsSummary: { type: "string", description: "สรุปเงื่อนไขสำคัญเป็นข้อ ๆ (ยืนราคา งวดเงิน สิ่งที่รวม/ไม่รวม รับประกัน)" },
    followUp: { type: "string", description: "ข้อความสั้นสำหรับส่ง LINE/อีเมลติดตามลูกค้า" },
    note: { type: "string", description: "หมายเหตุที่จะพิมพ์ในใบเสนอราคา 1 บรรทัด (ถ้ามี)" },
  },
  required: ["options", "coverLetter", "termsSummary", "followUp"],
};

export function quoteDraftPrompt(o: {
  customer: { name: string; province: string; budgetMillion?: number; landSizeWa?: number; notes?: string; activities?: string[] };
  brief?: LeadBrief;
  model: CatalogModel;
  basePrice: number;
  packages: Package[];
  items: BookItem[];
  terms: { no: number; title: string; percent: number }[];
  validDays: number;
  vatRate: number;
  owner: string;
  today: string;
}) {
  const c = o.customer;
  return [
    `วันที่วันนี้ ${o.today} · ผู้เสนอราคา ${o.owner}`,
    `ลูกค้า: คุณ${c.name.replace(/^คุณ/, "")} · จังหวัด ${c.province}${c.budgetMillion ? ` · งบ ${c.budgetMillion} ล้านบาท` : ""}${c.landSizeWa ? ` · ที่ดิน ${c.landSizeWa} ตร.ว.` : ""}`,
    c.notes ? `บันทึก: ${c.notes}` : "",
    c.activities?.length ? `กิจกรรมล่าสุด:\n${c.activities.map((a) => `- ${a}`).join("\n")}` : "",
    o.brief ? `ความต้องการที่สกัดไว้: ${JSON.stringify(o.brief)}` : "",
    `แบบบ้านที่เลือก: ${o.model.code} ${o.model.name} (${o.model.nameTh}) ${o.model.area} ตร.ม. ${o.model.floors} ชั้น ${o.model.beds} นอน ${o.model.baths} น้ำ · ราคาฐาน ${Math.round(o.basePrice).toLocaleString("en-US")} บาท ก่อน VAT · สร้างประมาณ ${o.model.months} เดือน`,
    `งวดชำระ: ${o.terms.map((t) => `งวด ${t.no} ${t.percent}% ${t.title}`).join("; ")}`,
    `ยืนราคา ${o.validDays} วัน · VAT ${o.vatRate}% · รับประกันโครงสร้าง 10 ปี งานระบบและตกแต่ง 2 ปี · ราคารวมค่าขออนุญาตและควบคุมงาน ไม่รวมถมดินเกินระดับ รื้อถอน และค่ามิเตอร์ถาวร`,
    `แพ็กเกจเสริม (รหัส|ชื่อ|หน่วย):\n${o.packages.map((p) => `${p.code}|${p.name}|${p.unit}`).join("\n")}`,
    `ฐานราคาวัสดุ (รหัส|ชื่อ|หน่วย|หมวด) ใช้เมื่อไม่มีแพ็กเกจที่ตรง:\n${bookForPrompt(o.items)}`,
    "เสนอรายการเสริม 1–4 รายการที่ตรงกับความต้องการ/งบของลูกค้า (ถ้าไม่มีที่เหมาะ ให้ส่งรายการว่าง) ปริมาณให้สมเหตุสมผลกับขนาดบ้าน",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Price the AI's option picks: packages at their sell price, book items at cost + markup, others flagged. */
export function priceOptions(opts: QuoteOptionAi[] | undefined, o: { packages: Package[]; book: BookLike; markupPct: number }): DraftOption[] {
  let i = 0;
  return (opts ?? [])
    .filter((x) => x && x.name?.trim() && Number(x.qty) > 0)
    .map((x) => {
      const code = (x.code ?? "").trim().toUpperCase();
      const key = `O${++i}`;
      const qty = r2(Number(x.qty));
      const pk = o.packages.find((p) => p.code.toUpperCase() === code);
      if (pk) return { key, code: pk.code, name: pk.name, qty, unit: pk.unit, unitPrice: pk.price, costCode: pk.costCode, basis: "package" as const, reason: x.reason };
      const it = code ? o.book.item(code) : undefined;
      if (it) {
        const unitCost = (o.book.material(it.code)?.price ?? 0) + o.book.labour(it.code);
        return { key, code: it.code, name: it.name, qty, unit: it.unit, unitPrice: Math.round(withMarkup(unitCost, o.markupPct)), costCode: it.costCode, basis: "book" as const, reason: x.reason };
      }
      return { key, code: undefined, name: x.name.trim(), qty, unit: x.unit || "ชุด", unitPrice: 0, costCode: "10", basis: "unpriced" as const, reason: x.reason };
    });
}

/** Text for the quote's printed note: AI note + terms summary are kept short (one paragraph). */
export function noteFrom(d: Pick<QuoteDraftAi, "note">) {
  return (d.note ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
}

// ---------- follow-up text for an existing quotation ----------

export const SYSTEM_FOLLOWUP =
  "คุณเป็นพนักงานขายของบริษัทรับสร้างบ้าน เขียนข้อความติดตามใบเสนอราคาถึงลูกค้าสำหรับส่งทาง LINE หรืออีเมล " +
  "ภาษาไทยสุภาพ กระชับ 3–6 ประโยค ไม่ใช้อีโมจิ อ้างอิงเลขที่ใบเสนอราคาและยอดรวม เสนอช่วยตอบคำถามหรือนัดคุย ไม่ให้ส่วนลดเพิ่มเอง";

export function followUpPrompt(o: { quoteId: string; customer: string; model: string; total: number; validUntil: string; status: string; options: string[]; lastActivity?: string; channel: "line" | "email"; owner: string; today: string }) {
  return [
    `วันที่วันนี้ ${o.today} · ผู้ส่ง ${o.owner} · ช่องทาง ${o.channel === "line" ? "LINE (สั้น ไม่ต้องมีหัวเรื่อง)" : "อีเมล (มีบรรทัดหัวเรื่องขึ้นต้นว่า หัวเรื่อง:)"}`,
    `ลูกค้า คุณ${o.customer.replace(/^คุณ/, "")} · ใบเสนอราคา ${o.quoteId} · ${o.model} · รวม VAT ${Math.round(o.total).toLocaleString("en-US")} บาท · ยืนราคาถึง ${o.validUntil} · สถานะ ${o.status}`,
    o.options.length ? `รายการเสริม: ${o.options.join(", ")}` : "",
    o.lastActivity ? `กิจกรรมล่าสุดกับลูกค้า: ${o.lastActivity}` : "",
    "ส่งกลับเฉพาะข้อความ",
  ]
    .filter(Boolean)
    .join("\n");
}
