// Official index feeds for ค่า K: monthly values by symbol (I, C, M, S, E, F, A, G …) merged into the
// tender settings. Two inputs: the MOC CMI API (csi-indexes, by group) through a symbol → index_id
// map, or the monthly สนค. index announcement read from PDF by AI. Pure, unit-tested in tests/prices.

import type { JsonSchema } from "../ai/types";
import type { MocIndexPoint } from "./moc";

export type Indices = Record<string, Record<string, number>>;
export type IndexChange = { month: string; sym: string; old?: number; value: number };

/** Default symbol → CMI group. Only the groups that mean the same thing; others come from the announcement file. */
export const DEFAULT_K_MAP: Record<string, string> = {
  C: "2000000000000000", // ซีเมนต์
  S: "4000000000000000", // เหล็กและผลิตภัณฑ์เหล็ก
};

/** CMI points → { month: { sym: value } } for the mapped symbols */
export function cmiToIndices(points: MocIndexPoint[], map: Record<string, string>): Indices {
  const bySym = Object.entries(map).filter(([, id]) => id);
  const out: Indices = {};
  for (const p of points)
    for (const [sym, id] of bySym)
      if (p.indexId === id) {
        out[p.month] ??= {};
        out[p.month][sym] = p.value;
      }
  return out;
}

/**
 * Merge incoming monthly values into the current table. Returns the new table and the cells that
 * changed. `suspect` lists symbols where a new value is > 25 % away from the old one in the same
 * month — usually a different base year, which would make It/Io meaningless.
 */
export function mergeIndices(current: Indices, incoming: Indices) {
  const indices: Indices = Object.fromEntries(Object.entries(current).map(([m, v]) => [m, { ...v }]));
  const changes: IndexChange[] = [];
  const suspect = new Set<string>();
  for (const [month, vals] of Object.entries(incoming)) {
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    for (const [sym, value] of Object.entries(vals)) {
      if (!(value > 0)) continue;
      const old = indices[month]?.[sym];
      if (old === value) continue;
      if (old && Math.abs(value - old) / old > 0.25) suspect.add(sym);
      indices[month] = { ...(indices[month] ?? {}), [sym]: value };
      changes.push({ month, sym, old, value });
    }
  }
  return { indices, changes: changes.sort((a, b) => a.month.localeCompare(b.month) || a.sym.localeCompare(b.sym)), suspect: [...suspect].sort() };
}

// ---------- AI: read the monthly index announcement ----------

export type ExtractedIndices = { title?: string; baseYear?: string; months: { month: string; values: { sym: string; value: number }[] }[] };

export const INDEX_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    baseYear: { type: "string", description: "ปีฐานของดัชนี ถ้าเอกสารระบุ" },
    months: {
      type: "array",
      items: {
        type: "object",
        properties: {
          month: { type: "string", description: "YYYY-MM เป็น ค.ศ." },
          values: {
            type: "array",
            items: {
              type: "object",
              properties: { sym: { type: "string", description: "สัญลักษณ์ดัชนีในสูตรค่า K เช่น I C M S E F A G" }, value: { type: "number" } },
              required: ["sym", "value"],
            },
          },
        },
        required: ["month", "values"],
      },
    },
  },
  required: ["months"],
};

export function indexPrompt(labels: Record<string, string>, today: string) {
  const list = Object.entries(labels)
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
  return {
    system: "คุณช่วยอ่านตารางดัชนีราคาที่ใช้คำนวณค่า K (สัญญาแบบปรับราคาได้) จากประกาศของสำนักงานนโยบายและยุทธศาสตร์การค้า ตอบเป็น JSON ตาม schema เท่านั้น อ่านตัวเลขตามที่พิมพ์ ห้ามคำนวณหรือเดา",
    prompt: `วันนี้คือ ${today}\nให้จับคู่ชื่อดัชนีในเอกสารกับสัญลักษณ์ต่อไปนี้ (ใช้เฉพาะที่ตรงความหมายจริง ข้ามดัชนีที่ไม่อยู่ในรายการ):\n${list}\nดึงค่าดัชนีทุกเดือนที่มีในเอกสาร แปลงปี พ.ศ. เป็น ค.ศ.`,
  };
}

export function extractedToIndices(ex: ExtractedIndices, allowed: string[]): Indices {
  const ok = new Set(allowed);
  const out: Indices = {};
  for (const m of ex.months ?? []) {
    const month = normMonth(m.month);
    if (!month) continue;
    for (const v of m.values ?? []) {
      const sym = String(v.sym ?? "").trim().toUpperCase();
      if (!ok.has(sym) || !(Number(v.value) > 0)) continue;
      out[month] ??= {};
      out[month][sym] = Math.round(Number(v.value) * 100) / 100;
    }
  }
  return out;
}

function normMonth(s: string) {
  const m = /^(\d{4})-(\d{1,2})/.exec(String(s ?? "").trim());
  if (!m) return undefined;
  let y = Number(m[1]);
  if (y > 2400) y -= 543;
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? `${y}-${String(mo).padStart(2, "0")}` : undefined;
}
