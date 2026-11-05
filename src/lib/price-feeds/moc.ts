// MOC (สนค. กระทรวงพาณิชย์) open-data feeds — pure helpers, no React, no "@/" imports.
//
//   GET https://dataapi.moc.go.th/csi-product-indexes?com_code=&province_code=&from_year=&to_year=
//       ราคาวัสดุก่อสร้างรายสินค้า รายจังหวัด รายเดือน → [{ com_code, com_name_th, province_code,
//       province_name, year, month, units, price }]
//   GET https://dataapi.moc.go.th/csi-indexes?index_id=&from_year=&to_year=
//       ดัชนีราคาวัสดุก่อสร้าง (CMI) รายหมวด → [{ index_id, index_description, base_year, year,
//       month, price_index, mon, yoy, aoa }]   ("mon" is the month-on-month change, the docs say "mom")
//   GET https://data.moc.go.th/OpenData/getCSIProducts → [{ id, name: "<code> - <name> (<unit>)" }]
//
// Years are Christian era (ค.ศ.). Unit-tested in tests/prices.

import type { PriceObs } from "../sales/prices-data";

export const MOC_API = "https://dataapi.moc.go.th";
export const MOC_PRODUCTS_URL = "https://data.moc.go.th/OpenData/getCSIProducts";

/** province_code → name, as listed on data.moc.go.th (names normalised to the app's spelling) */
export const MOC_PROVINCES: [code: string, name: string][] = [
  ["10", "กรุงเทพฯ"], ["11", "สมุทรปราการ"], ["12", "นนทบุรี"], ["13", "ปทุมธานี"], ["14", "พระนครศรีอยุธยา"], ["15", "อ่างทอง"], ["16", "ลพบุรี"], ["17", "สิงห์บุรี"], ["18", "ชัยนาท"], ["19", "สระบุรี"],
  ["20", "ชลบุรี"], ["21", "ระยอง"], ["22", "จันทบุรี"], ["23", "ตราด"], ["24", "ฉะเชิงเทรา"], ["25", "ปราจีนบุรี"], ["26", "นครนายก"], ["27", "สระแก้ว"],
  ["30", "นครราชสีมา"], ["31", "บุรีรัมย์"], ["32", "สุรินทร์"], ["33", "ศรีสะเกษ"], ["34", "อุบลราชธานี"], ["35", "ยโสธร"], ["36", "ชัยภูมิ"], ["37", "อำนาจเจริญ"], ["38", "บึงกาฬ"], ["39", "หนองบัวลำภู"],
  ["40", "ขอนแก่น"], ["41", "อุดรธานี"], ["42", "เลย"], ["43", "หนองคาย"], ["44", "มหาสารคาม"], ["45", "ร้อยเอ็ด"], ["46", "กาฬสินธุ์"], ["47", "สกลนคร"], ["48", "นครพนม"], ["49", "มุกดาหาร"],
  ["50", "เชียงใหม่"], ["51", "ลำพูน"], ["52", "ลำปาง"], ["53", "อุตรดิตถ์"], ["54", "แพร่"], ["55", "น่าน"], ["56", "พะเยา"], ["57", "เชียงราย"], ["58", "แม่ฮ่องสอน"],
  ["60", "นครสวรรค์"], ["61", "อุทัยธานี"], ["62", "กำแพงเพชร"], ["63", "ตาก"], ["64", "สุโขทัย"], ["65", "พิษณุโลก"], ["66", "พิจิตร"], ["67", "เพชรบูรณ์"],
  ["70", "ราชบุรี"], ["71", "กาญจนบุรี"], ["72", "สุพรรณบุรี"], ["73", "นครปฐม"], ["74", "สมุทรสาคร"], ["75", "สมุทรสงคราม"], ["76", "เพชรบุรี"], ["77", "ประจวบคีรีขันธ์"],
  ["80", "นครศรีธรรมราช"], ["81", "กระบี่"], ["82", "พังงา"], ["83", "ภูเก็ต"], ["84", "สุราษฎร์ธานี"], ["85", "ระนอง"], ["86", "ชุมพร"],
  ["90", "สงขลา"], ["91", "สตูล"], ["92", "ตรัง"], ["93", "พัทลุง"], ["94", "ปัตตานี"], ["95", "ยะลา"], ["96", "นราธิวาส"],
];
const PROV_BY_CODE = new Map(MOC_PROVINCES);
const PROV_BY_NAME = new Map(MOC_PROVINCES.map(([c, n]) => [n, c]));

export function provinceName(p?: string): string | undefined {
  const t = p?.trim().replace(/^(จังหวัด|จ\.)\s*/, "");
  if (!t) return undefined;
  if (/^(กรุงเทพ(มหานคร|ฯ)?|กทม\.?|bangkok)$/i.test(t)) return "กรุงเทพฯ";
  return PROV_BY_CODE.get(t) ?? t;
}
export const provinceCode = (name?: string) => (name ? PROV_BY_NAME.get(provinceName(name) ?? "") : undefined);

/** CMI groups (index_id) from https://data.moc.go.th/Download/CSIIndex.csv */
export const CMI_GROUPS: [id: string, name: string][] = [
  ["0000000000000000", "ดัชนีรวม"],
  ["1000000000000000", "ไม้และผลิตภัณฑ์ไม้"],
  ["2000000000000000", "ซีเมนต์"],
  ["3000000000000000", "ผลิตภัณฑ์คอนกรีต"],
  ["4000000000000000", "เหล็กและผลิตภัณฑ์เหล็ก"],
  ["5000000000000000", "กระเบื้อง"],
  ["6000000000000000", "วัสดุฉาบผิว"],
  ["7000000000000000", "สุขภัณฑ์"],
  ["8000000000000000", "อุปกรณ์ไฟฟ้าและประปา"],
  ["9000000000000000", "วัสดุก่อสร้างอื่น ๆ"],
];

// ---------- product catalogue ----------

export type MocProduct = {
  code: string;
  name: string;
  unit?: string;
  /** names of the parent groups, outermost first (the leaf names alone are often just "ขนาด 9 มม.") */
  path: string[];
};

/** Raw product list (`getCSIProducts`) or the compact snapshot rows `[code, name, unit?]` → catalogue */
export function buildCatalog(rows: ({ id: string; name: string } | [string, string, string?])[]): MocProduct[] {
  const flat = rows.map((r) => {
    if (Array.isArray(r)) return { code: r[0], name: r[1], unit: r[2] };
    return splitProductName(r.id, r.name);
  });
  const byCode = new Map<string, string>();
  for (const p of flat) if (!byCode.has(p.code)) byCode.set(p.code, p.name);
  const out: MocProduct[] = [];
  const seen = new Set<string>();
  for (const p of flat) {
    if (seen.has(p.code)) continue;
    seen.add(p.code);
    out.push({ ...p, path: ancestors(p.code).map((c) => byCode.get(c)).filter((n): n is string => !!n) });
  }
  return out;
}

/** "0401010100200000 -   ขนาด 9 มม. ยาว 10 เมตร (ตัน)" → code, name, unit */
export function splitProductName(code: string, raw: string): { code: string; name: string; unit?: string } {
  let name = raw.replace(/^\d{16}\s*-\s*/, "").replace(/\s+/g, " ").trim();
  let unit: string | undefined;
  const m = /\(([^()]*)\)\s*$/.exec(name);
  if (m && m[1].trim().length <= 12 && !/\d/.test(m[1])) {
    unit = m[1].trim();
    name = name.slice(0, m.index).trim();
  }
  return { code, name, unit };
}

/** code levels 2-4-6-8-11 digits; a parent is the code with the tail zeroed */
const LEVELS = [2, 4, 6, 8, 11];
export function ancestors(code: string): string[] {
  const out: string[] = [];
  for (const l of LEVELS) {
    const a = code.slice(0, l).padEnd(16, "0");
    if (a !== code && !out.includes(a) && /[1-9]/.test(code.slice(l))) out.push(a);
  }
  return out;
}
export const fullName = (p: Pick<MocProduct, "name" | "path">) => [...p.path, p.name].join(" › ");

// ---------- price rows ----------

export type MocPrice = {
  comCode: string;
  name: string;
  unit?: string;
  provinceCode?: string;
  province?: string;
  /** YYYY-MM-01 */
  date: string;
  price: number;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
/** year may be Buddhist (พ.ศ.) in some exports */
export const toCE = (y: number) => (y > 2400 ? y - 543 : y);
export const ym = (year: number, month: number) => `${toCE(year)}-${String(month).padStart(2, "0")}-01`;

/** Normalise a csi-product-indexes response (array, or {data: [...]}) into dated prices; drops empty/zero prices */
export function normaliseMocPrices(raw: unknown): MocPrice[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  const out: MocPrice[] = [];
  for (const r of arr as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const price = num(r.price ?? r.price_avg ?? r.avg_price);
    const year = num(r.year);
    const month = num(r.month);
    const comCode = String(r.com_code ?? r.comCode ?? "").trim();
    if (!comCode || !(price > 0) || !(year > 1900) || !(month >= 1 && month <= 12)) continue;
    const pc = r.province_code !== undefined && r.province_code !== null ? String(r.province_code).padStart(2, "0") : undefined;
    out.push({
      comCode,
      name: String(r.com_name_th ?? r.com_name ?? "").replace(/\s+/g, " ").trim(),
      unit: (String(r.units ?? r.unit ?? "").trim() || undefined) as string | undefined,
      provinceCode: pc,
      province: provinceName(String(r.province_name ?? "")) ?? (pc ? PROV_BY_CODE.get(pc) : undefined),
      date: ym(year, month),
      price: Math.round(price * 100) / 100,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.comCode.localeCompare(b.comCode));
}

/** item ↔ com_code link; price per item unit = MOC price × factor */
export type ComLink = { itemCode: string; comCode: string; factor: number };

/** MOC prices → PriceObs (source "moc") for every price-book item linked to the com_code */
export function mocToObs(prices: MocPrice[], links: ComLink[], importedAt: string, via: PriceObs["via"] = "api"): PriceObs[] {
  const byCom = new Map<string, ComLink[]>();
  for (const l of links) if (l.comCode && l.factor > 0) byCom.set(l.comCode, [...(byCom.get(l.comCode) ?? []), l]);
  const out: PriceObs[] = [];
  for (const p of prices)
    for (const l of byCom.get(p.comCode) ?? []) {
      const price = roundPrice(p.price * l.factor);
      out.push({ id: "", itemCode: l.itemCode, source: "moc", date: p.date, price, province: p.province, importedAt, via, ref: p.comCode, rawPrice: p.price, rawUnit: p.unit });
    }
  return out;
}
export const roundPrice = (p: number) => (p >= 1000 ? Math.round(p) : p >= 100 ? Math.round(p * 10) / 10 : Math.round(p * 100) / 100);

/** keep only months within [from, to] (YYYY-MM) */
export const inMonths = <T extends { date: string }>(rows: T[], from: string, to: string) => rows.filter((r) => r.date.slice(0, 7) >= from && r.date.slice(0, 7) <= to);
/** CE years spanned by a YYYY-MM range */
export function yearsOf(from: string, to: string) {
  const a = Number(from.slice(0, 4));
  const b = Number(to.slice(0, 4));
  return { from: Math.min(a, b), to: Math.max(a, b) };
}
/** YYYY-MM list between two months, inclusive */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while ((y < ty || (y === ty && m <= tm)) && out.length < 240) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** one request per (province, com_code) — the API takes a single code each */
export function planRequests(comCodes: string[], provinces: string[]) {
  const codes = [...new Set(comCodes.filter(Boolean))];
  const provs = [...new Set(provinces.map(provinceCode).filter((c): c is string => !!c))];
  return provs.flatMap((p) => codes.map((c) => ({ province: p, comCode: c })));
}

// ---------- CMI index rows ----------

export type MocIndexPoint = { indexId: string; name: string; baseYear?: number; month: string; value: number; mom?: number; yoy?: number };

export function normaliseMocIndex(raw: unknown): MocIndexPoint[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  const out: MocIndexPoint[] = [];
  for (const r of arr as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const value = num(r.price_index ?? r.index ?? r.value);
    const year = num(r.year);
    const month = num(r.month);
    if (!(value > 0) || !(year > 1900) || !(month >= 1 && month <= 12)) continue;
    const mom = num(r.mon ?? r.mom);
    const yoy = num(r.yoy);
    const by = num(r.base_year);
    out.push({
      indexId: String(r.index_id ?? ""),
      name: String(r.index_description ?? "").trim(),
      baseYear: by > 0 ? toCE(by) : undefined,
      month: ym(year, month).slice(0, 7),
      value: Math.round(value * 100) / 100,
      mom: Number.isFinite(mom) ? mom : undefined,
      yoy: Number.isFinite(yoy) ? yoy : undefined,
    });
  }
  return out.sort((a, b) => a.month.localeCompare(b.month) || a.indexId.localeCompare(b.indexId));
}

/** the n months before `today`'s month (MOC publishes a month's prices early the next month) */
export function lastMonths(today: string, n: number) {
  const [y, m] = today.split("-").map(Number);
  const at = (k: number) => new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7);
  return { from: at(Math.max(1, n)), to: at(1) };
}
