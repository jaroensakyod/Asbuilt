// Defect / repair photo → classification, and the before/after "is it fixed?" check.

import type { JsonSchema } from "../ai/types";
import type { Severity, SystemKey } from "../data";
import { baseSystem, bestMatch, enumLine, oneOf, SEVERITIES, SEVERITY_KEYS, str, SYSTEM_KEYS, SYSTEMS } from "./common";

/** an asset the model may pick (repair form / delivered house) */
export type AssetCandidate = { code: string; name: string; system: SystemKey; location?: string; category?: string };

export type DefectRaw = { title?: string; system?: string; severity?: string; location?: string; detail?: string; cause?: string; fix?: string; trade?: string; assetCode?: string; confidence?: string };
export type DefectSuggestion = {
  title: string;
  system: SystemKey;
  severity: Severity;
  location: string;
  detail: string;
  cause: string;
  fix: string;
  /** punch-list trade (one of `trades` when given) */
  trade?: string;
  asset?: AssetCandidate;
  confidence: "high" | "medium" | "low";
};

export const DEFECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "หัวข้อสั้น ไม่เกิน 60 ตัวอักษร บอกอาการและจุดที่พบ" },
    system: { type: "string", enum: [...SYSTEM_KEYS] },
    severity: { type: "string", enum: [...SEVERITY_KEYS] },
    location: { type: "string", description: "ตำแหน่งถ้าเห็นหรือผู้ใช้บอก ไม่งั้นว่าง" },
    detail: { type: "string", description: "สิ่งที่เห็นในรูป 1–2 ประโยค" },
    cause: { type: "string", description: "สาเหตุที่เป็นไปได้" },
    fix: { type: "string", description: "วิธีแก้ที่แนะนำ เป็นขั้นตอนสั้น" },
    trade: { type: "string", description: "หมวดงานจากรายการที่ให้" },
    assetCode: { type: "string", description: "รหัสอุปกรณ์จากรายการที่ให้ ถ้ามั่นใจว่าเป็นชิ้นนั้น ไม่งั้นว่าง" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["title", "system", "severity", "detail", "cause", "fix", "confidence"],
};

export function defectPrompt(o: { today: string; note?: string; context: "construction" | "repair"; assets?: readonly AssetCandidate[]; trades?: readonly string[]; location?: string }) {
  const assets = (o.assets ?? []).slice(0, 120).map((a) => `${a.code} | ${a.name} | ${SYSTEMS[a.system]}${a.location ? ` | ${a.location}` : ""}`);
  return {
    system: `${baseSystem(o.today)}\nงานนี้: ดูรูปข้อบกพร่องงานก่อสร้าง/งานซ่อม แล้วจัดประเภท ประเมินความรุนแรง สาเหตุ และวิธีแก้`,
    prompt: [
      o.context === "construction" ? "บริบท: งานระหว่างก่อสร้าง (รายการที่ต้องแก้ก่อนส่งมอบ)" : "บริบท: บ้านที่ส่งมอบแล้ว ลูกค้าแจ้งซ่อม",
      `ระบบงาน (system): ${enumLine(SYSTEMS)}`,
      `ความรุนแรง (severity): ${enumLine(SEVERITIES)} · สูง = อันตราย/กระทบโครงสร้าง/ใช้งานไม่ได้/น้ำรั่วไฟรั่ว, ปานกลาง = ใช้งานได้แต่ต้องแก้เร็ว, ต่ำ = ความสวยงาม`,
      o.trades?.length ? `หมวดงาน (trade) เลือกจาก: ${o.trades.join(", ")}` : "",
      assets.length ? `อุปกรณ์ในบ้านหลังนี้ (รหัส | ชื่อ | ระบบ | ตำแหน่ง):\n${assets.join("\n")}` : "",
      o.location ? `ตำแหน่งที่ผู้ใช้กรอก: ${o.location}` : "",
      o.note?.trim() ? `ข้อความจากผู้แจ้ง: ${o.note.trim()}` : "",
      "ถ้ารูปไม่ชัดหรือไม่ใช่ข้อบกพร่อง ให้ confidence=low และบอกใน detail",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function normalizeDefect(r: DefectRaw, o: { assets?: readonly AssetCandidate[]; trades?: readonly string[] } = {}): DefectSuggestion {
  const system = oneOf(r.system, SYSTEM_KEYS, "arch");
  const assets = o.assets ?? [];
  let asset = assets.find((a) => a.code.toLowerCase() === str(r.assetCode, 40).toLowerCase());
  // the model sometimes writes the name instead of the code
  if (!asset && str(r.assetCode)) asset = bestMatch(str(r.assetCode), assets, (a) => [a.code, a.name], 0.7)?.row;
  const tradeIn = str(r.trade, 60);
  const trade = o.trades?.length ? (o.trades.find((t) => t === tradeIn) ?? bestMatch(tradeIn, o.trades, (t) => t, 0.5)?.row ?? tradeForSystem(system, o.trades)) : tradeIn || undefined;
  return {
    title: str(r.title, 80) || "ข้อบกพร่องจากรูปถ่าย",
    system: asset?.system ?? system,
    severity: oneOf(r.severity, SEVERITY_KEYS, "medium"),
    location: str(r.location, 120),
    detail: str(r.detail, 600),
    cause: str(r.cause, 600),
    fix: str(r.fix, 800),
    trade,
    asset,
    confidence: oneOf(r.confidence, ["high", "medium", "low"] as const, "medium"),
  };
}

const SYSTEM_TRADE: Record<SystemKey, string[]> = {
  struct: ["โครงสร้าง"],
  arch: ["ก่ออิฐ/ฉาบ", "กระเบื้อง", "สี", "ฝ้า", "ประตู/หน้าต่าง", "งานไม้"],
  elec: ["ไฟฟ้า"],
  plumb: ["ประปา", "สุขภัณฑ์"],
  hvac: ["ไฟฟ้า"],
  ext: ["หลังคา", "ก่ออิฐ/ฉาบ"],
};
export function tradeForSystem(s: SystemKey, trades: readonly string[]) {
  return SYSTEM_TRADE[s].find((t) => trades.includes(t)) ?? trades[0];
}

/** text for a "detail" box: what was seen + cause + fix */
export function defectDetailText(s: Pick<DefectSuggestion, "detail" | "cause" | "fix">) {
  return [s.detail, s.cause && `สาเหตุที่เป็นไปได้: ${s.cause}`, s.fix && `แนวทางแก้: ${s.fix}`].filter(Boolean).join("\n");
}

// ---------- before / after ----------

export type FixVerdict = "fixed" | "not_fixed" | "unsure";
export const FIX_VERDICT_LABEL: Record<FixVerdict, string> = { fixed: "ดูเหมือนแก้แล้ว", not_fixed: "ยังไม่เรียบร้อย", unsure: "ดูจากรูปไม่ชัด" };
export type FixCheck = { verdict: FixVerdict; reason: string; remaining: string[] };
export const FIX_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["fixed", "not_fixed", "unsure"] },
    reason: { type: "string", description: "เหตุผลสั้น ๆ จากการเทียบรูป" },
    remaining: { type: "array", items: { type: "string" }, description: "สิ่งที่ยังต้องแก้ ถ้ามี" },
  },
  required: ["verdict", "reason"],
};
export function fixCheckPrompt(o: { today: string; title: string; location?: string; beforeCount: number; afterCount: number }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: เทียบรูปก่อนแก้กับรูปหลังแก้ของรายการแก้ไขงาน แล้วบอกว่าดูเหมือนแก้เรียบร้อยหรือยัง (ผู้ตรวจเป็นคนตัดสินเอง)`,
    prompt: [
      `รายการ: ${o.title}${o.location ? ` · ${o.location}` : ""}`,
      `รูป ${o.beforeCount} รูปแรกคือ "ก่อนแก้" รูป ${o.afterCount} รูปถัดไปคือ "หลังแก้"`,
      "ถ้าไม่แน่ใจว่าเป็นจุดเดียวกันหรือรูปไม่ชัด ให้ verdict=unsure",
    ].join("\n"),
  };
}
export function normalizeFix(r: Partial<FixCheck> | undefined): FixCheck {
  return { verdict: oneOf(r?.verdict, ["fixed", "not_fixed", "unsure"] as const, "unsure"), reason: str(r?.reason, 600), remaining: (Array.isArray(r?.remaining) ? r.remaining : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 8) };
}
