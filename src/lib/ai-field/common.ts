// Shared pure helpers for the AI field assistant: enum tables, text matching, value guards.
// No React, no "@/" runtime imports, so node --test can load it.

import type { Severity, SystemKey } from "../data";

/** same keys/labels as SYSTEM_LABEL in lib/data (checked by `satisfies`) */
export const SYSTEMS = { struct: "โครงสร้าง", arch: "สถาปัตย์", elec: "ไฟฟ้า", plumb: "ประปา & สุขภัณฑ์", hvac: "ปรับอากาศ", ext: "ภายนอก" } satisfies Record<SystemKey, string>;
export const SYSTEM_KEYS = Object.keys(SYSTEMS) as SystemKey[];
export const SEVERITIES = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" } satisfies Record<Severity, string>;
export const SEVERITY_KEYS = Object.keys(SEVERITIES) as Severity[];

/** "a=ป้าย, b=ป้าย" list for prompts */
export const enumLine = (t: Record<string, string>) =>
  Object.entries(t)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
export const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const num = (v: unknown, min = 0, max = Number.POSITIVE_INFINITY) => {
  const digits = typeof v === "string" ? v.replace(/[^\d.-]/g, "") : "";
  const n = typeof v === "number" ? v : digits ? Number(digits) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};
export const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const strList = (v: unknown, maxItems = 30, maxLen = 400) => (Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : []);

// ---------- fuzzy matching (Thai-friendly: no word boundaries, so compare character bigrams) ----------

/** lowercase, Thai digits → arabic, strip spaces/punctuation */
export function normKey(s: string) {
  return s
    .toLowerCase()
    .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50))
    .replace(/[\s.,;:!?'"()[\]{}\-–—_/\\·•*+=]+/g, "");
}
function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    out.set(b, (out.get(b) ?? 0) + 1);
  }
  return out;
}
/** Dice similarity 0..1 of character bigrams; a containment counts high */
export function similarity(a: string, b: string) {
  const x = normKey(a);
  const y = normKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x))) return 0.6 + 0.4 * (Math.min(x.length, y.length) / Math.max(x.length, y.length));
  const A = bigrams(x);
  const B = bigrams(y);
  let inter = 0;
  for (const [k, n] of A) inter += Math.min(n, B.get(k) ?? 0);
  const total = Math.max(1, x.length - 1) + Math.max(1, y.length - 1);
  return (2 * inter) / total;
}
/** best match above `min`, or undefined */
export function bestMatch<T>(query: string, rows: readonly T[], key: (r: T) => string | string[], min = 0.45): { row: T; score: number } | undefined {
  if (!query.trim()) return undefined;
  let best: { row: T; score: number } | undefined;
  for (const r of rows) {
    const ks = key(r);
    for (const k of Array.isArray(ks) ? ks : [ks]) {
      const s = similarity(query, k);
      if (s >= min && (!best || s > best.score)) best = { row: r, score: s };
    }
  }
  return best;
}

/** common rules sent with every field-assistant prompt */
export function baseSystem(today: string) {
  return [
    "คุณเป็นผู้ช่วยวิศวกร/โฟร์แมนหน้างานก่อสร้างของบริษัทรับสร้างบ้านและผู้รับเหมาในประเทศไทย",
    `วันนี้คือ ${today} (ปี ค.ศ.)`,
    "ตอบเป็นภาษาไทย กระชับ เป็นภาษาหน้างานที่วิศวกรไทยใช้",
    "ห้ามแต่งข้อมูลที่ไม่มีในข้อความหรือรูป ถ้าไม่แน่ใจให้เว้นว่างหรือบอกว่าไม่แน่ใจ",
    "วันที่ทุกช่องใช้รูปแบบ YYYY-MM-DD (ค.ศ.)",
  ].join("\n");
}
