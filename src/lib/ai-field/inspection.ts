// QC inspection assistant: one checklist item + its photos → suggested pass/fail and a comment.
// The inspector always decides; this only fills a suggestion they can accept.

import type { JsonSchema } from "../ai/types";
import type { Severity } from "../data";
import { baseSystem, oneOf, SEVERITY_KEYS, str } from "./common";

export type ItemVerdict = "pass" | "fail" | "unsure";
export const ITEM_VERDICT_LABEL: Record<ItemVerdict, string> = { pass: "น่าจะผ่าน", fail: "น่าจะไม่ผ่าน", unsure: "ดูจากรูปไม่ได้" };
export type ItemAssessment = { verdict: ItemVerdict; comment: string; severity: Severity; checks: string[] };

export const ITEM_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "fail", "unsure"] },
    comment: { type: "string", description: "หมายเหตุสั้นสำหรับช่องสิ่งที่พบ อ้างอิงเกณฑ์" },
    severity: { type: "string", enum: [...SEVERITY_KEYS], description: "ถ้าไม่ผ่าน: ความรุนแรงของข้อบกพร่อง" },
    checks: { type: "array", items: { type: "string" }, description: "สิ่งที่ผู้ตรวจควรวัด/ตรวจเพิ่มที่หน้างาน ที่รูปบอกไม่ได้" },
  },
  required: ["verdict", "comment"],
};

export function itemPrompt(o: { today: string; text: string; standard: string; phase: string; location: string; note?: string; photoCount: number }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: ช่วยผู้ตรวจงาน (QC) ประเมินรายการตรวจหนึ่งข้อจากรูปถ่าย เทียบกับเกณฑ์ที่ให้ ถ้ารูปไม่พอจะตัดสินให้ตอบ unsure`,
    prompt: [
      `หมวดการตรวจ: ${o.phase} · ตำแหน่ง ${o.location}`,
      `รายการตรวจ: ${o.text}`,
      `เกณฑ์: ${o.standard}`,
      o.note?.trim() ? `หมายเหตุผู้ตรวจ: ${o.note.trim()}` : "",
      `รูปถ่าย ${o.photoCount} รูป`,
      "สิ่งที่ต้องวัดด้วยเครื่องมือ (ระยะ แรงดัน ค่าฉนวน ความชื้น) ที่รูปบอกไม่ได้ ให้ใส่ใน checks ไม่ใช่เดาผล",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
export function normalizeItem(r: Partial<Record<keyof ItemAssessment, unknown>> | undefined): ItemAssessment {
  return {
    verdict: oneOf(r?.verdict, ["pass", "fail", "unsure"] as const, "unsure"),
    comment: str(r?.comment, 400),
    severity: oneOf(r?.severity, SEVERITY_KEYS, "medium"),
    checks: (Array.isArray(r?.checks) ? r.checks : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 5),
  };
}
