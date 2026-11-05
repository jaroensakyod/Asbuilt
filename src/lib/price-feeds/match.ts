// Name/unit matching between our price-book items and outside price lists (MOC com_code catalogue,
// rows read from a PDF). Pure, unit-tested in tests/prices. Thai has no word breaks, so the text
// score is character-trigram overlap, plus a bonus when the numbers (sizes, strengths) agree and
// the units can be converted.

import { fullName, type MocProduct } from "./moc";

// ---------- units ----------

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(ม\.?|เมตร|m)$/i, "ม."],
  [/^(ตร\.?\s?ม\.?|ตารางเมตร|m2|ม2)$/i, "ตร.ม."],
  [/^(ลบ\.?\s?ม\.?|ลูกบาศก์เมตร|คิว|m3|ม3)$/i, "ลบ.ม."],
  [/^(กก\.?|กิโลกรัม|kg)$/i, "กก."],
  [/^(ตัน|ton)$/i, "ตัน"],
  [/^(ลบ\.?\s?ฟ\.?|ลูกบาศก์ฟุต)$/i, "ลบ.ฟ."],
  [/^(ตร\.?\s?ฟุต|ตารางฟุต)$/i, "ตร.ฟุต"],
  [/^(ล\.?|ลิตร)$/i, "ลิตร"],
  [/^(วัน|แรง)$/i, "วัน"],
];
export function normUnit(u?: string): string {
  const t = (u ?? "").trim().replace(/\s+/g, "");
  for (const [re, v] of UNIT_ALIASES) if (re.test(t)) return v;
  return t;
}

const firstNum = (re: RegExp, s: string) => {
  const m = re.exec(s);
  return m ? Number(m[1].replace(/,/g, "")) : undefined;
};
const bagKg = (s: string) => firstNum(/(\d+(?:\.\d+)?)\s*(?:กก|kg)/i, s);
const lengthM = (s: string) => firstNum(/ยาว\s*(\d+(?:\.\d+)?)\s*(?:ม\.|เมตร|m\b)/i, s);

/**
 * Factor to turn a price per `fromUnit` (the outside list) into a price per `toUnit` (our item):
 * ourPrice = theirPrice × factor. undefined when the units can't be converted automatically.
 */
export function unitFactor(fromUnit: string | undefined, fromName: string, toUnit: string | undefined, toName = ""): number | undefined {
  const a = normUnit(fromUnit);
  const b = normUnit(toUnit);
  if (!a || !b) return undefined;
  if (a === b) return 1;
  if (a === "ตัน" && b === "กก.") return 0.001;
  if (a === "กก." && b === "ตัน") return 1000;
  if (a === "ตัน" && b === "ถุง") {
    const kg = bagKg(toName) ?? bagKg(fromName);
    return kg ? kg / 1000 : undefined;
  }
  if (a === "ถุง" && b === "กก.") {
    const kg = bagKg(fromName);
    return kg ? 1 / kg : undefined;
  }
  if ((a === "ม้วน" || a === "ขด" || a === "ท่อน" || a === "เส้น") && b === "ม.") {
    const len = lengthM(fromName);
    return len ? Math.round((1 / len) * 1e6) / 1e6 : undefined;
  }
  if (a === "ลบ.ฟ." && b === "ลบ.ม.") return 35.3147;
  if (a === "ตร.ฟุต" && b === "ตร.ม.") return 10.7639;
  if (a === "โหล" && ["ชิ้น", "อัน", "ตัว", "ก้อน"].includes(b)) return 1 / 12;
  return undefined;
}

// ---------- text ----------

const SYNONYMS: [RegExp, string][] = [
  [/\bDB\s?(\d+)/gi, " เหล็กเส้นกลมผิวข้ออ้อย $1 มม. "],
  [/\bRB\s?(\d+)/gi, " เหล็กเส้นกลมผิวเรียบ $1 มม. "],
  [/เหล็กข้ออ้อย/g, "เหล็กเส้นกลมผิวข้ออ้อย"],
  [/(\d+)\s*ksc/gi, "$1 กก./ตร.ซม."],
  [/ไวร์เมช/g, "ตะแกรงเหล็ก"],
  [/\bPVC\b/gi, "พีวีซี"],
  [/\bPPR\b/gi, "พีพีอาร์"],
  [/ทรงลูกบาศก์/g, "รูปลูกบาศก์"],
  [/\bG2\b/gi, ""],
];

/** lower-case, expand trade abbreviations, drop brand names ("ตรา …") and punctuation */
export function normText(s: string): string {
  let t = ` ${s} `;
  for (const [re, v] of SYNONYMS) t = t.replace(re, v);
  return t
    .replace(/ตรา\s*\S+/g, " ")
    .replace(/[()[\]{}"'“”*,;:/\\|·•–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function trigrams(s: string): Set<string> {
  const t = normText(s).replace(/\s/g, "");
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  if (!out.size && t) out.add(t);
  return out;
}
/**
 * Key tokens that must agree: numbers (fractions kept whole, so 1/2 นิ้ว ≠ 2 นิ้ว) and Latin
 * trade codes of 3+ letters (THW, VAF, EMT, LED …). Grades like SD40/SR24 are ignored — MOC
 * lists rebar by size only.
 */
export function numbers(s: string): string[] {
  let t = ` ${s} `;
  for (const [re, v] of SYNONYMS) t = t.replace(re, v);
  t = t.replace(/ตรา\s*\S+/g, " ").replace(/\b(?:SD|SR)\s?\d+\b/gi, " ");
  const nums = [...t.matchAll(/\d+\s?\/\s?\d+|\d+(?:[.,]\d+)*/g)].map((m) => (m[0].includes("/") ? m[0].replace(/\s/g, "") : String(Number(m[0].replace(/,/g, "")))));
  const words = [...t.matchAll(/\b[A-Za-z]{3,}\b/g)].map((m) => m[0].toLowerCase()).filter((w) => w !== "ksc");
  return [...nums, ...words];
}

/** 0..1: half containment of `a` in `b`, half Dice — long MOC paths don't drown short names */
export function textScore(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return 0.5 * (inter / a.size) + 0.5 * ((2 * inter) / (a.size + b.size));
}
/** share of our numbers (sizes, strengths, lengths) that also appear in the candidate; 0.5 when we have none */
export function numberScore(ours: string[], theirs: string[]) {
  if (!ours.length) return 0.5;
  const set = new Set(theirs);
  return ours.filter((n) => set.has(n)).length / ours.length;
}

export type Scored<T> = { item: T; score: number; factor?: number };
export const MATCH_SURE = 0.62;

type Cand<T> = { item: T; text: string; unit?: string; grams: Set<string>; nums: string[] };
export function prepare<T>(items: T[], text: (t: T) => string, unit: (t: T) => string | undefined): Cand<T>[] {
  return items.map((item) => {
    const t = text(item);
    return { item, text: t, unit: unit(item), grams: trigrams(t), nums: numbers(t) };
  });
}

/**
 * Rank candidates for one query. direction "toQuery": factor converts a candidate price into the
 * query unit (MOC product → our item); "toCandidate": converts the query price into the candidate
 * unit (a PDF row → our item).
 */
export function rank<T>(query: { name: string; unit?: string }, cands: Cand<T>[], k = 5, direction: "toQuery" | "toCandidate" = "toQuery"): Scored<T>[] {
  const qg = trigrams(query.name);
  const qn = numbers(query.name);
  const out: Scored<T>[] = [];
  for (const c of cands) {
    const ts = textScore(qg, c.grams);
    if (ts < 0.12) continue;
    const factor = direction === "toQuery" ? unitFactor(c.unit, c.text, query.unit, query.name) : unitFactor(query.unit, query.name, c.unit, c.text);
    const score = 0.55 * ts + 0.27 * numberScore(qn, c.nums) + (factor !== undefined ? 0.18 : 0);
    out.push({ item: c.item, score: Math.round(score * 1000) / 1000, factor });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/** MOC leaf products (those with a unit) prepared for matching */
export const prepareCatalog = (catalog: MocProduct[]) =>
  prepare(
    catalog.filter((p) => p.unit),
    (p) => fullName(p),
    (p) => p.unit,
  );

/** Best MOC com_code candidates for one price-book item */
export function suggestComCodes(item: { name: string; unit: string; spec?: string }, prepared: Cand<MocProduct>[], k = 5) {
  return rank({ name: item.spec ? `${item.name} ${item.spec}` : item.name, unit: item.unit }, prepared, k, "toQuery");
}
