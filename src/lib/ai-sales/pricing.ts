// AI sales & estimating — price-book matching and line pricing (pure, no React, no @/ imports).
//
// Rule: the AI proposes WHAT and HOW MUCH (item code, qty, unit). Unit prices always come from
// the company price book. Lines the AI could not map to a price-book item are marked
// "ต้องสืบราคา" and stay at 0 until someone enters a price by hand.

import type { JsonSchema } from "../ai/types";

/** Minimal price-book item shape (structurally matches sales/prices-data PriceItem). */
export type BookItem = { code: string; name: string; unit: string; costCode: string; category?: string; labour?: number };
/** Minimal price-book shape (structurally matches sales/prices-data PriceBook). */
export type BookLike = {
  item: (code: string) => BookItem | undefined;
  material: (code: string) => { price: number; source: string; sample: boolean } | null;
  labour: (code: string) => number;
};

/** One line as the AI proposes it (no prices). */
export type AiLine = { itemCode?: string; name: string; qty: number; unit: string; costCode?: string; note?: string };

export type PriceStatus = "book" | "fuzzy" | "unpriced" | "manual";
export const PRICE_STATUS_LABEL: Record<PriceStatus, string> = {
  book: "ราคาจากฐานข้อมูล",
  fuzzy: "จับคู่จากชื่อ ตรวจสอบ",
  unpriced: "ต้องสืบราคา",
  manual: "ราคากรอกเอง",
};

export type PricedLine = {
  key: string;
  itemCode?: string;
  name: string;
  qty: number;
  unit: string;
  costCode: string;
  material: number; // per unit
  labour: number; // per unit
  unitCost: number; // material + labour
  amount: number; // qty × unitCost
  status: PriceStatus;
  source?: string;
  sample?: boolean;
  warnings: string[];
  note?: string;
  /** AI filled this line (UI shows a small "AI" pill) */
  ai: boolean;
};

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// ---------- matching ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s.,()\-/×x*:;"'’“”]+/g, "")
    .trim();

function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Dice coefficient on character bigrams — works for Thai, which has no word spaces. */
export function similarity(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const A = bigrams(x);
  const B = bigrams(y);
  let hit = 0;
  for (const [g, n] of A) hit += Math.min(n, B.get(g) ?? 0);
  return (2 * hit) / (x.length - 1 + (y.length - 1));
}

export const FUZZY_THRESHOLD = 0.5;

/** Find the price-book item for an AI line: exact code first, then the closest name (same unit preferred). */
export function matchItem(line: Pick<AiLine, "itemCode" | "name" | "unit">, items: BookItem[]): { item: BookItem; exact: boolean; score: number } | null {
  const code = (line.itemCode ?? "").trim().toUpperCase();
  if (code) {
    const hit = items.find((i) => i.code.toUpperCase() === code);
    if (hit) return { item: hit, exact: true, score: 1 };
  }
  if (!line.name?.trim()) return null;
  let best: { item: BookItem; score: number } | null = null;
  for (const it of items) {
    let s = similarity(line.name, it.name);
    if (line.unit && norm(line.unit) === norm(it.unit)) s += 0.08;
    if (!best || s > best.score) best = { item: it, score: s };
  }
  return best && best.score >= FUZZY_THRESHOLD ? { item: best.item, exact: false, score: Math.min(1, best.score) } : null;
}

// ---------- pricing ----------

let seq = 0;
const key = () => `L${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Price one line from the book. `manualUnitCost` is used only when no book item matches. */
export function priceLine(
  l: AiLine & { key?: string; manualUnitCost?: number; ai?: boolean },
  book: BookLike,
  items: BookItem[],
  opts: { fuzzy?: boolean } = {},
): PricedLine {
  const qty = Math.max(0, Number(l.qty) || 0);
  const warnings: string[] = [];
  const m = matchItem(l, items);
  const useMatch = m && (m.exact || opts.fuzzy !== false) ? m : null;
  if (useMatch) {
    const it = useMatch.item;
    const mat = book.material(it.code);
    const material = r2(mat?.price ?? 0);
    const labour = r2(book.labour(it.code));
    if (l.unit && norm(l.unit) !== norm(it.unit)) warnings.push(`หน่วยไม่ตรงกับฐานราคา ใช้หน่วย ${it.unit} ตรวจปริมาณอีกครั้ง`);
    if (!mat) warnings.push("ไม่มีราคาวัสดุในฐานข้อมูล");
    const unitCost = r2(material + labour);
    return {
      key: l.key ?? key(),
      itemCode: it.code,
      name: useMatch.exact ? it.name : l.name || it.name,
      qty,
      unit: it.unit,
      costCode: it.costCode,
      material,
      labour,
      unitCost,
      amount: r2(qty * unitCost),
      status: useMatch.exact ? "book" : "fuzzy",
      source: mat?.source,
      sample: mat?.sample,
      warnings,
      note: l.note,
      ai: l.ai ?? true,
    };
  }
  if (l.itemCode) warnings.push(`ไม่พบรหัส ${l.itemCode} ในฐานราคา`);
  const manual = Math.max(0, Number(l.manualUnitCost) || 0);
  return {
    key: l.key ?? key(),
    itemCode: undefined,
    name: l.name,
    qty,
    unit: l.unit || "งาน",
    costCode: l.costCode || "10",
    material: manual,
    labour: 0,
    unitCost: manual,
    amount: r2(qty * manual),
    status: manual > 0 ? "manual" : "unpriced",
    warnings,
    note: l.note,
    ai: l.ai ?? true,
  };
}

export function priceLines(lines: AiLine[], book: BookLike, items: BookItem[]) {
  return lines.filter((l) => l && l.name?.trim() && Number(l.qty) > 0).map((l) => priceLine(l, book, items));
}

/** Totals with overhead (% of direct) and margin (% of selling price) — same formula as the BOQ (`finish`). */
export function totalsOf(lines: Pick<PricedLine, "amount" | "status" | "costCode">[], overheadPct: number, marginPct: number) {
  const direct = r2(lines.reduce((s, l) => s + l.amount, 0));
  const overhead = r2((direct * Math.max(0, overheadPct)) / 100);
  const cost = r2(direct + overhead);
  const mp = Math.min(Math.max(marginPct, 0), 90);
  const selling = r2(cost / (1 - mp / 100));
  const unpriced = lines.filter((l) => l.status === "unpriced").length;
  const byCode = new Map<string, number>();
  for (const l of lines) byCode.set(l.costCode, r2((byCode.get(l.costCode) ?? 0) + l.amount));
  return { direct, overhead, cost, selling, margin: r2(selling - cost), unpriced, byCode: [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([costCode, amount]) => ({ costCode, amount })) };
}

/** Sell price per unit from a cost and a markup on cost (%). */
export const withMarkup = (unitCost: number, markupPct: number) => r2(unitCost * (1 + (Number(markupPct) || 0) / 100));

/** Compact price-book list for a prompt: code|name|unit|cost code (no prices — the model must not price). */
export function bookForPrompt(items: BookItem[]) {
  return items.map((i) => `${i.code}|${i.name}|${i.unit}|${i.costCode}`).join("\n");
}

export function costCodesForPrompt(codes: Record<string, string>) {
  return Object.entries(codes)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/** Tab-separated table (pastes into Excel / Google Sheets). */
export function linesToTsv(lines: PricedLine[]) {
  const head = ["รหัส", "รายการ", "ปริมาณ", "หน่วย", "หมวด", "วัสดุ/หน่วย", "ค่าแรง/หน่วย", "รวม", "สถานะราคา"];
  return [head, ...lines.map((l) => [l.itemCode ?? "", l.name, l.qty, l.unit, l.costCode, l.material, l.labour, l.amount, PRICE_STATUS_LABEL[l.status]])].map((r) => r.join("\t")).join("\n");
}

// ---------- shared schema pieces ----------

export const AI_LINE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    itemCode: { type: "string", description: "รหัสจากฐานราคาที่ให้ไว้ ถ้าไม่มีรายการที่ตรงให้เว้นว่าง ห้ามแต่งรหัสเอง" },
    name: { type: "string", description: "ชื่อรายการภาษาไทย" },
    qty: { type: "number", description: "ปริมาณ (ตัวเลข) ในหน่วยของฐานราคา" },
    unit: { type: "string" },
    costCode: { type: "string", description: "หมวดต้นทุน 2 หลัก" },
    note: { type: "string", description: "วิธีคิดปริมาณสั้น ๆ เช่น 3×4 ม. = 12 ตร.ม. + เผื่อ 5%" },
  },
  required: ["name", "qty", "unit", "costCode"],
};
