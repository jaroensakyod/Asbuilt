// Selections helper: suggest catalogue products for a client selection within the allowance (pure).

import type { JsonSchema } from "../ai/types";

export type SelCat = "floor" | "wall" | "sanitary" | "faucet" | "lighting" | "door" | "kitchen" | "builtin" | "paint" | "other";
export type CatalogProduct = { id: string; sku: string; name: string; category: string; clientPrice: number; tradeCost: number; unit: string; finish?: string; colour?: string; leadDays: number; supplierName?: string };

/** Which product catalogue categories can serve a selection category. */
export const SEL_TO_PRODUCT: Record<SelCat, string[]> = {
  floor: ["surface"],
  wall: ["surface", "wallcover"],
  sanitary: ["sanitary"],
  faucet: ["sanitary"],
  lighting: ["lighting"],
  door: ["builtin", "decor"],
  kitchen: ["builtin", "appliance", "surface"],
  builtin: ["builtin"],
  paint: ["wallcover", "surface"],
  other: ["furniture", "decor", "fabric", "rug", "appliance", "builtin"],
};

/** Candidates for the prompt: matching categories, priced up to 1.5× the allowance, nearest first, at most 30. */
export function candidates(sel: { category: SelCat; allowanceUnit: number }, products: CatalogProduct[], exclude: string[] = []) {
  const cats = SEL_TO_PRODUCT[sel.category] ?? [];
  const pool = products.filter((p) => cats.includes(p.category) && !exclude.includes(p.id));
  const cap = sel.allowanceUnit > 0 ? sel.allowanceUnit * 1.5 : Infinity;
  return pool
    .filter((p) => p.clientPrice <= cap)
    .sort((a, b) => Math.abs(a.clientPrice - sel.allowanceUnit) - Math.abs(b.clientPrice - sel.allowanceUnit))
    .slice(0, 30);
}

export const SYSTEM_SELECTION =
  "คุณเป็นมัณฑนากรของบริษัทรับสร้างบ้าน แนะนำตัวเลือกวัสดุ/สินค้าให้ลูกค้าเลือกจากแค็ตตาล็อกที่ให้มาเท่านั้น " +
  "ให้มีอย่างน้อย 1 ตัวเลือกที่อยู่ในงบมาตรฐาน และเหตุผลสั้น ๆ ภาษาไทยที่ลูกค้าอ่านเข้าใจ (ความทนทาน ดูแลง่าย เข้ากับห้อง)";

export const SELECTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string", description: "id สินค้าจากแค็ตตาล็อก" }, reason: { type: "string" } }, required: ["id", "reason"] },
    },
    advice: { type: "string", description: "คำแนะนำรวม 1 ประโยค" },
  },
  required: ["picks"],
};

export function selectionPrompt(o: { item: string; room: string; categoryLabel: string; qty: number; unit: string; allowanceUnit: number; clientNote?: string; style?: string; existing: string[]; products: CatalogProduct[] }) {
  return [
    `รายการ: ${o.item} · ห้อง ${o.room} · หมวด ${o.categoryLabel} · ${o.qty} ${o.unit}`,
    `งบมาตรฐาน ${o.allowanceUnit.toLocaleString("en-US")} บาท/${o.unit} (ก่อน VAT)`,
    o.style ? `สไตล์บ้าน: ${o.style}` : "",
    o.clientNote ? `ลูกค้าบอกว่า: ${o.clientNote}` : "",
    o.existing.length ? `ตัวเลือกที่มีอยู่แล้ว: ${o.existing.join(", ")}` : "",
    `แค็ตตาล็อก (id|sku|ชื่อ|ราคาขาย/หน่วย|หน่วย|ผิว/สี|รอของ วัน):\n${o.products.map((p) => `${p.id}|${p.sku}|${p.name}|${p.clientPrice}|${p.unit}|${[p.finish, p.colour].filter(Boolean).join(" ")}|${p.leadDays}`).join("\n")}`,
    "เลือก 2–3 รายการ เรียงจากแนะนำที่สุด",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Keep picks that are real candidates, de-duplicated, at most 3; annotate the difference vs allowance. */
export function cleanPicks(picks: { id: string; reason: string }[] | undefined, cands: CatalogProduct[], allowanceUnit: number) {
  const seen = new Set<string>();
  const out: { product: CatalogProduct; reason: string; diffUnit: number; within: boolean }[] = [];
  for (const p of picks ?? []) {
    const prod = cands.find((c) => c.id === String(p?.id ?? "").trim() || c.sku === String(p?.id ?? "").trim());
    if (!prod || seen.has(prod.id)) continue;
    seen.add(prod.id);
    out.push({ product: prod, reason: String(p.reason ?? ""), diffUnit: prod.clientPrice - allowanceUnit, within: prod.clientPrice <= allowanceUnit });
    if (out.length === 3) break;
  }
  return out;
}
