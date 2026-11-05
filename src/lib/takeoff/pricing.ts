// Unit rates per takeoff category from the company price book: material = a small recipe of
// price-book items per category unit; labour = the item's labour rate, or the category's labour
// setting when the book has none. Pure: types only from the sales module.

import type { PriceBook } from "../sales/prices-data";
import { BLOCKS, CATS, type Cat, type TakeoffItem, type TakeoffSettings } from "./types";

export type RatePart = { code: string; name: string; per: number; unit: string; price: number; source?: string; sample: boolean };

export type CatRate = {
  cat: Cat;
  material: number; // baht per category unit
  labour: number;
  total: number;
  parts: RatePart[];
  /** "book": from the price book · "partial": book material + labour setting · "sample": flat sample price */
  status: "book" | "partial" | "sample";
  note: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Price-book items that make one unit of each category (per m², m³ or m). */
function recipe(cat: Cat, s: TakeoffSettings, lines: TakeoffItem[]): { code: string; per: number }[] {
  switch (cat) {
    case "masonry": {
      const blockCode = s.block === "brick" ? "MS-BRICK" : s.block === "cblock" ? "" : "MS-AAC75";
      const scale = s.block === "aac10" ? 10 / 7.5 : 1; // no 10 cm item: price the 7.5 cm block by thickness
      const mortar = s.block === "brick" ? 0.25 : s.block === "cblock" ? 0.2 : 0.11;
      return [...(blockCode ? [{ code: blockCode, per: BLOCKS[s.block].perM2 * scale }] : []), { code: "MS-MORTAR", per: mortar }];
    }
    case "plaster":
      return [{ code: "MS-PLASTER", per: 0.33 }]; // ~1.5 cm, a 50 kg bag covers ~3 m²
    case "paint": {
      const area = lines.reduce((a, x) => a + x.qty, 0) || 1;
      const ext = lines.filter((x) => x.roomIds.includes("")).reduce((a, x) => a + x.qty, 0) / area;
      // primer 1 coat + top 2 coats, ~35 m² per gallon per coat
      return [
        { code: "PT-PRIMER", per: 1 / 35 },
        { code: "PT-INT", per: (2 / 35) * (1 - ext) },
        { code: "PT-EXT", per: (2 / 35) * ext },
      ].filter((p) => p.per > 0);
    }
    case "ties":
      return [{ code: "MS-LINTEL", per: 1 / (s.tieSection * s.tieSection) }]; // metres of tie per m³
    case "floorTile":
      return [
        { code: s.floorTile >= 0.5 ? "FN-GRANITO" : "FN-CERAMIC", per: 1 },
        { code: "FN-GLUE", per: 0.25 },
      ];
    case "wallTile":
      return [
        { code: "FN-WALLTILE", per: 1 },
        { code: "FN-GLUE", per: 0.25 },
      ];
    case "bead":
      return []; // not in the price book
  }
}

/** Rates for every category. Without a book (or in "sample" mode) the flat sample price is used. */
export function catRates(s: TakeoffSettings, book: PriceBook | null, items: TakeoffItem[]): Record<Cat, CatRate> {
  const out = {} as Record<Cat, CatRate>;
  for (const { key } of CATS) {
    const flat = (note: string): CatRate => ({ cat: key, material: Math.max(0, s.price[key] - s.labour[key]), labour: Math.min(s.labour[key], s.price[key]), total: s.price[key], parts: [], status: "sample", note });
    if (s.priceMode === "sample" || !book) {
      out[key] = flat("ราคาตัวอย่างต่อหน่วย (ปรับได้)");
      continue;
    }
    const parts: RatePart[] = [];
    let bookLabour = 0;
    for (const p of recipe(key, s, items.filter((x) => x.cat === key))) {
      const it = book.item(p.code);
      const m = book.material(p.code);
      if (!it || !m) continue;
      parts.push({ code: p.code, name: it.name, per: r2(p.per * 1000) / 1000, unit: it.unit, price: m.price, source: m.source, sample: m.sample });
      bookLabour += book.labour(p.code) * p.per;
    }
    if (!parts.length) {
      out[key] = flat("ไม่มีรายการในบัญชีราคา ใช้ราคาตัวอย่าง");
      continue;
    }
    const material = r2(parts.reduce((a, p) => a + p.per * p.price, 0));
    const fromBook = bookLabour > 0;
    const labour = r2(fromBook ? bookLabour : s.labour[key]);
    out[key] = {
      cat: key,
      material,
      labour,
      total: r2(material + labour),
      parts,
      status: fromBook ? "book" : "partial",
      note: fromBook ? "วัสดุและค่าแรงจากบัญชีราคา" : "วัสดุจากบัญชีราคา · ค่าแรงตามที่ตั้งไว้",
    };
  }
  return out;
}
