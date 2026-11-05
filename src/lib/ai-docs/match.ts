// Matching what the AI read against records we already have: suppliers (tax id, then fuzzy Thai name),
// open POs (PO number in any spelling), PR/PO lines (description similarity) and projects.

/** digits only; "0-1055-53004-18-3" → "0105553004183". Returns "" unless 13 digits remain. */
export function normTaxId(s: string | undefined): string {
  const d = (s ?? "").replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50)).replace(/\D/g, "");
  return d.length === 13 ? d : "";
}

const NAME_NOISE = [
  /บริษัท/g,
  /บจก\.?/g,
  /บมจ\.?/g,
  /ห้างหุ้นส่วนจำกัด/g,
  /ห้างหุ้นส่วนสามัญ/g,
  /ห้างหุ้นส่วน/g,
  /หจก\.?/g,
  /\(?มหาชน\)?/g,
  /จำกัด/g,
  /ร้าน/g,
  /สำนักงานใหญ่/g,
  /สาขา\s*\d*/g,
  /\b(company|limited|co\.|ltd\.?|inc\.?|public)/gi,
];

/** company name without legal-form words, spaces and punctuation, lower-case */
export function normName(s: string | undefined): string {
  let x = (s ?? "").normalize("NFC");
  for (const re of NAME_NOISE) x = x.replace(re, " ");
  return x.replace(/[\s.,()'"\-–_/&]+/g, "").toLowerCase();
}

function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice similarity on character bigrams, 0..1 (works for Thai, which has no word spaces) */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a.includes(b) || b.includes(a) ? 0.5 : 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let hit = 0;
  for (const [g, n] of A) hit += Math.min(n, B.get(g) ?? 0);
  const dice = (2 * hit) / (a.length - 1 + (b.length - 1));
  // one name fully inside the other ("ศิลาไทยซีเมนต์" vs "ศิลาไทยซีเมนต์เทรดดิ้ง") counts as strong
  const contained = a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)) ? 0.85 : 0;
  return Math.max(dice, contained);
}

export const nameSimilarity = (a: string, b: string) => similarity(normName(a), normName(b));

export type SupplierLike = { id: string; name: string; taxId?: string; branch?: string; status?: string };
export type SupplierMatch<S> = { supplier: S; by: "taxId" | "name"; score: number };

/**
 * Best supplier for an extracted vendor. Tax id wins (when two branches share a tax id, the closer
 * name/branch wins); otherwise the best fuzzy name ≥ minScore.
 */
export function matchSupplier<S extends SupplierLike>(list: S[], q: { taxId?: string; name?: string; branch?: string }, minScore = 0.6): SupplierMatch<S> | undefined {
  const tax = normTaxId(q.taxId);
  if (tax) {
    const same = list.filter((s) => normTaxId(s.taxId) === tax);
    if (same.length) {
      const brNo = (b?: string) => (b ?? "").replace(/\D/g, "").replace(/^0+/, "") || "hq";
      const best = [...same].sort((a, b) => Number(brNo(b.branch) === brNo(q.branch)) - Number(brNo(a.branch) === brNo(q.branch)) || nameSimilarity(b.name, q.name ?? "") - nameSimilarity(a.name, q.name ?? ""))[0];
      return { supplier: best, by: "taxId", score: 1 };
    }
  }
  if (!q.name?.trim()) return undefined;
  let best: SupplierMatch<S> | undefined;
  for (const s of list) {
    const score = nameSimilarity(s.name, q.name);
    if (score >= minScore && (!best || score > best.score)) best = { supplier: s, by: "name", score };
  }
  return best;
}

/** "PO-2026-0012", "po 2026/0012", "PO2026-12", "เลขที่ใบสั่งซื้อ 0012" → matching id from the list */
export function matchPoNumber(text: string | undefined, ids: string[]): string | undefined {
  const raw = (text ?? "").toUpperCase();
  if (!raw.trim()) return undefined;
  const exact = ids.find((id) => raw.includes(id.toUpperCase()));
  if (exact) return exact;
  const groups = raw.match(/\d+/g);
  if (!groups) return undefined;
  const nums = groups.map((g) => Number(g));
  // year + running number
  for (const id of ids) {
    const m = id.match(/(\d{4})\D+(\d+)$/);
    if (!m) continue;
    const [y, n] = [Number(m[1]), Number(m[2])];
    for (let i = 0; i < nums.length - 1; i++) if (nums[i] === y && nums[i + 1] === n) return id;
  }
  // running number alone, only when unambiguous
  const last = nums[nums.length - 1];
  const hits = ids.filter((id) => Number(id.match(/(\d+)$/)?.[1]) === last);
  return hits.length === 1 && groups[groups.length - 1].length >= 3 ? hits[0] : undefined;
}

const descNorm = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s.,()'"\-–_/:×x*]+/g, "");

/** numbers written in a description ("DB12", "4 นิ้ว", "240 ksc") must agree when both sides have them */
const numTokens = (s: string) => new Set((s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));

export function lineSimilarity(a: string, b: string): number {
  let s = similarity(descNorm(a), descNorm(b));
  const na = numTokens(a);
  const nb = numTokens(b);
  if (na.size && nb.size) {
    const shared = [...na].some((n) => nb.has(n));
    s = shared ? Math.min(1, s + 0.1) : s * 0.6;
  }
  // product codes ("DB12", "SD40", "PVC-13") shared by both sides are a strong signal
  const codes = (x: string) => new Set((x.toUpperCase().match(/[A-Z]{1,4}-?\d+/g) ?? []).map((c) => c.replace("-", "")));
  const ca = codes(a);
  if (ca.size && [...codes(b)].some((c) => ca.has(c))) s = Math.max(s, 0.6);
  return s;
}

/**
 * For each target line (PR / PO line) the index of the extracted line that describes it, or -1.
 * Greedy one-to-one assignment by best similarity; positions break ties when the counts are equal.
 */
export function matchLines(targets: string[], found: string[], minScore = 0.35): number[] {
  const pairs: { t: number; f: number; s: number }[] = [];
  for (let t = 0; t < targets.length; t++)
    for (let f = 0; f < found.length; f++) {
      const s = lineSimilarity(targets[t], found[f]) + (targets.length === found.length && t === f ? 0.05 : 0);
      if (s >= minScore) pairs.push({ t, f, s });
    }
  pairs.sort((a, b) => b.s - a.s);
  const out = targets.map(() => -1);
  const used = new Set<number>();
  for (const p of pairs) {
    if (out[p.t] !== -1 || used.has(p.f)) continue;
    out[p.t] = p.f;
    used.add(p.f);
  }
  return out;
}

export type ProjectLike = { id: string; name: string; location?: string; owner?: string };

/** project id written on the document, else a project whose name appears in the text */
export function guessProject<P extends ProjectLike>(text: string | undefined, list: P[]): P | undefined {
  const t = (text ?? "").trim();
  if (!t) return undefined;
  const id = t.toUpperCase().match(/[A-Z]{2,3}-\d{4}-\d{2,3}/)?.[0];
  if (id) {
    const p = list.find((x) => x.id.toUpperCase() === id);
    if (p) return p;
  }
  const nt = descNorm(t);
  let best: { p: P; s: number } | undefined;
  for (const p of list) {
    const nn = descNorm(p.name);
    const s = nn.length >= 4 && nt.includes(nn) ? 1 : similarity(nn, nt) * 0.9;
    if (s >= 0.55 && (!best || s > best.s)) best = { p, s };
  }
  return best?.p;
}

/** Thai 13-digit tax id with a valid check digit (catches a misread digit) */
export function taxIdChecksumOk(s: string | undefined): boolean {
  const d = normTaxId(s);
  if (!d) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}
