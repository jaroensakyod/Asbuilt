// "ให้ AI อธิบาย" on the price-alert list: we pass only the numbers shown on screen, grouped by
// material category, and ask for a short Thai summary + suggested actions. Pure (prompt + schema).

import type { JsonSchema } from "../ai/types";

export type AlertFact = { code: string; name: string; category: string; unit: string; source: string; prev: number; price: number; change: number; sample: boolean; history: number[] };

export type CategoryMove = { category: string; n: number; avgChange: number; up: number; down: number };

/** average move per material category (largest absolute move first) */
export function categoryMoves(facts: AlertFact[]): CategoryMove[] {
  const m = new Map<string, AlertFact[]>();
  for (const f of facts) m.set(f.category, [...(m.get(f.category) ?? []), f]);
  return [...m.entries()]
    .map(([category, l]) => ({
      category,
      n: l.length,
      avgChange: Math.round((l.reduce((s, f) => s + f.change, 0) / l.length) * 10000) / 10000,
      up: l.filter((f) => f.change > 0).length,
      down: l.filter((f) => f.change < 0).length,
    }))
    .sort((a, b) => Math.abs(b.avgChange) - Math.abs(a.avgChange));
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

export function explainPrompt(facts: AlertFact[], threshold: number, today: string, context: { openQuotes?: number; activeProjects?: number } = {}) {
  const lines = facts
    .slice(0, 40)
    .map((f) => `- ${f.code} ${f.name} [${f.category}] แหล่ง ${f.source}: ${f.prev} → ${f.price} บ./${f.unit} (${pct(f.change)})${f.sample ? " (ราคาตัวอย่าง)" : ""} · 6 เดือน: ${f.history.join(", ")}`)
    .join("\n");
  const cats = categoryMoves(facts)
    .map((c) => `- ${c.category}: ${c.n} รายการ เฉลี่ย ${pct(c.avgChange)} (ขึ้น ${c.up} ลง ${c.down})`)
    .join("\n");
  return {
    system:
      "คุณเป็นผู้ช่วยฝ่ายประมาณราคาและจัดซื้อของบริษัทรับสร้างบ้าน/ผู้รับเหมาในไทย สรุปการเปลี่ยนแปลงราคาวัสดุเป็นภาษาไทย กระชับ " +
      "ใช้เฉพาะตัวเลขที่ให้มาเท่านั้น ห้ามอ้างข่าว สาเหตุภายนอก หรือราคาที่ไม่มีในข้อมูล ถ้าข้อมูลเป็นราคาตัวอย่างให้เตือนว่ายังไม่ใช่ราคาจริง",
    prompt:
      `วันนี้ ${today} · เกณฑ์แจ้งเตือน ${threshold}% เทียบเดือนก่อน\n` +
      (context.openQuotes !== undefined ? `ใบเสนอราคาที่ยังไม่ปิด ${context.openQuotes} ใบ · ` : "") +
      (context.activeProjects !== undefined ? `โครงการที่กำลังก่อสร้าง ${context.activeProjects} โครงการ\n` : "\n") +
      `สรุปตามหมวด:\n${cats}\n\nรายการ:\n${lines}\n\n` +
      "ตอบ: สรุปภาพรวม 2–3 ประโยค, แนวโน้มรายหมวด (เหล็ก ปูน/คอนกรีต สายไฟ ฯลฯ ที่มีในข้อมูล), และข้อเสนอแนะที่ทำได้ เช่น ล็อกราคากับผู้ขาย สั่งล่วงหน้า ปรับราคาในใบเสนอราคาที่ยังไม่เซ็น ทบทวนราคาในฐานข้อมูล",
  };
}

export type Explanation = { summary: string; trends: { category: string; direction: "up" | "down" | "mixed"; note: string }[]; actions: { title: string; detail: string; who?: string }[]; caveat?: string };

export const EXPLAIN_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    trends: {
      type: "array",
      items: { type: "object", properties: { category: { type: "string" }, direction: { type: "string", enum: ["up", "down", "mixed"] }, note: { type: "string" } }, required: ["category", "direction", "note"] },
    },
    actions: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, who: { type: "string", description: "ฝ่ายที่ควรทำ เช่น จัดซื้อ ฝ่ายขาย ประมาณราคา" } }, required: ["title", "detail"] },
    },
    caveat: { type: "string" },
  },
  required: ["summary", "trends", "actions"],
};
