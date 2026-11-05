// Price database collections (demo: sample seed + localStorage; live: public.records).

import { useMemo } from "react";
import { createCollection } from "../collection";
import { createLocalStore } from "../projects-store";
import { COST_CODES, type CostCode } from "../biz";
import { mergeObs, obsId } from "../price-feeds/merge";
import {
  CURRENT_MONTH,
  makePriceBook,
  SEED_COMPETITORS,
  SEED_PRICE_ITEMS,
  type BookChoice,
  type CompetitorPrice,
  type PriceItem,
  type PriceObs,
  type PriceSource,
} from "./prices-data";

export * from "./prices-data";

export const priceItems = createCollection<PriceItem>("price_items", SEED_PRICE_ITEMS);
/** Imported observations only — the sample history is generated, not stored */
export const priceObs = createCollection<PriceObs>("price_obs", []);
export const competitorPrices = createCollection<CompetitorPrice>("competitor_prices", SEED_COMPETITORS);

/** Price-move alert threshold in % (per browser) */
export const alertThreshold = createLocalStore<number>("asbuilt.prices.threshold.v1", 5);

export function usePriceBook(choice: BookChoice, province?: string) {
  const items = priceItems.use();
  const obs = priceObs.use();
  return useMemo(() => makePriceBook(items, obs, choice, province), [items, obs, choice, province]);
}

// ---------- CSV ----------

export const CSV_HEADER = ["code", "name", "unit", "source", "date", "price", "province"] as const;

const SOURCE_ALIASES: Record<string, PriceSource> = {
  moc: "moc",
  "พณ": "moc",
  "พณ.": "moc",
  "กระทรวงพาณิชย์": "moc",
  cgd: "cgd",
  "บก": "cgd",
  "บก.": "cgd",
  "กรมบัญชีกลาง": "cgd",
  supplier: "supplier",
  "ผู้ขาย": "supplier",
  "ใบเสนอราคา": "supplier",
};

/** Split one CSV line, honouring double quotes */
function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export type CsvRow = {
  line: number;
  code: string;
  name: string;
  unit: string;
  source?: PriceSource;
  date?: string;
  price?: number;
  province?: string;
  costCode?: CostCode;
  errors: string[];
  warnings: string[];
  newItem: boolean;
};

function normDate(s: string): string | undefined {
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(t);
  if (!m) {
    // d/m/yyyy (Thai Buddhist years are converted)
    const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (d) m = [t, d[3], d[2], d[1]] as unknown as RegExpExecArray;
  }
  if (!m) return undefined;
  let y = Number(m[1]);
  if (y > 2400) y -= 543;
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || y < 2000 || y > 2100) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

export function parsePriceCsv(text: string, items: PriceItem[]): CsvRow[] {
  const known = new Map(items.map((i) => [i.code.toUpperCase(), i]));
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const rows: CsvRow[] = [];
  let header: string[] | null = null;
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = splitCsv(raw);
    if (!header && cells[0]?.toLowerCase() === "code") {
      header = cells.map((c) => c.toLowerCase());
      return;
    }
    const get = (k: string, pos: number) => {
      const i = header ? header.indexOf(k) : pos;
      return i >= 0 ? (cells[i] ?? "") : "";
    };
    const code = get("code", 0).toUpperCase();
    const name = get("name", 1);
    const unit = get("unit", 2);
    const srcRaw = get("source", 3).toLowerCase();
    const dateRaw = get("date", 4);
    const priceRaw = get("price", 5).replace(/[,฿\s]/g, "");
    const province = get("province", 6) || undefined;
    const ccRaw = get("cost_code", 7);
    const errors: string[] = [];
    const warnings: string[] = [];
    const item = known.get(code);
    if (!code) errors.push("ไม่มีรหัสรายการ");
    if (!item && (!name || !unit)) errors.push("รหัสใหม่ต้องมีชื่อและหน่วย");
    const source = SOURCE_ALIASES[srcRaw] ?? SOURCE_ALIASES[get("source", 3)];
    if (!source) errors.push(`แหล่งราคาไม่ถูกต้อง "${get("source", 3)}" (ใช้ moc, cgd หรือ supplier)`);
    const date = normDate(dateRaw);
    if (!date) errors.push(`วันที่ไม่ถูกต้อง "${dateRaw}"`);
    else if (date > CURRENT_MONTH) errors.push("วันที่อยู่ในอนาคต");
    const price = Number(priceRaw);
    if (!priceRaw || !Number.isFinite(price) || price <= 0) errors.push(`ราคาไม่ถูกต้อง "${get("price", 5)}"`);
    if (item && unit && unit !== item.unit) warnings.push(`หน่วยต่างจากฐานข้อมูล (${item.unit})`);
    if (item && name && name !== item.name) warnings.push("ชื่อต่างจากฐานข้อมูล ใช้ชื่อเดิม");
    if (source === "moc" && !province) warnings.push("ไม่ระบุจังหวัด");
    let costCode: CostCode | undefined;
    if (ccRaw) {
      const c = ccRaw.padStart(2, "0") as CostCode;
      if (c in COST_CODES) costCode = c;
      else warnings.push(`หมวดต้นทุน "${ccRaw}" ไม่มีในระบบ`);
    }
    if (!item && !errors.length) warnings.push(`รายการใหม่ · หมวดต้นทุน ${costCode ?? "10"}`);
    rows.push({ line: idx + 1, code, name: item?.name ?? name, unit: item?.unit ?? unit, source, date, price: Number.isFinite(price) ? price : undefined, province, costCode, errors, warnings, newItem: !item });
  });
  return rows;
}

/** Write valid rows: new items first, then observations (one per item/source/month/province). */
export function importPriceRows(rows: CsvRow[]) {
  const ok = rows.filter((r) => !r.errors.length);
  const now = new Date().toISOString();
  const newItems = new Map<string, PriceItem>();
  for (const r of ok)
    if (r.newItem && !newItems.has(r.code))
      newItems.set(r.code, { id: r.code, code: r.code, name: r.name, unit: r.unit, category: "นำเข้า", costCode: r.costCode ?? "10", labour: 0, base: r.price!, imported: true });
  if (newItems.size) priceItems.upsertMany([...newItems.values()]);
  priceObs.upsertMany(
    ok.map((r) => ({
      id: obsId({ itemCode: r.code, source: r.source!, date: r.date!, province: r.province }),
      itemCode: r.code,
      source: r.source!,
      date: r.date!,
      price: r.price!,
      province: r.province,
      importedAt: now,
      via: "csv" as const,
    })),
  );
  return { items: newItems.size, obs: ok.length };
}

/** Upsert observations from a feed (MOC sync, AI file import), deduped by item/source/kind/province/month. */
export function importObs(incoming: PriceObs[]) {
  const r = mergeObs(priceObs.all(), incoming);
  if (r.rows.length) priceObs.upsertMany(r.rows);
  return { added: r.added, updated: r.updated, unchanged: r.unchanged };
}

const esc = (s: string | number | undefined) => {
  const v = s === undefined ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
export function toCsv(rows: (string | number | undefined)[][]) {
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
}
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
