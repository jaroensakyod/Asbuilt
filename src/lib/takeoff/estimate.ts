// Turn a takeoff summary into a saved estimate (same record the BOQ page saves), so it shows up in
// ประเมินราคา & BOQ → ประมาณการที่บันทึกไว้ and can become a quote or a budget. Pure.

import type { CostCode } from "../biz";
import type { Estimate, EstimateLine } from "../sales/crm";
import type { BookChoice } from "../sales/prices-data";
import { CAT_OF, type Cat, type CatSummary } from "./types";

export const CAT_COST_CODE: Record<Cat, CostCode> = {
  masonry: "04",
  plaster: "04",
  ties: "04",
  bead: "04",
  floorTile: "10",
  wallTile: "10",
  paint: "11",
};

export function estimateFromTakeoff(
  summary: CatSummary[],
  meta: { id: string; name: string; date: string; by: string; projectId: string; modelCode: string; area: number; choice: BookChoice; overheadPct: number; marginPct: number },
): Estimate {
  const lines: EstimateLine[] = summary
    .filter((x) => x.lines > 0)
    .map((x) => ({
      key: `TO-${x.cat}`,
      costCode: CAT_COST_CODE[x.cat],
      name: `${CAT_OF[x.cat].label} (ถอดปริมาณ ${x.lines} รายการ เผื่อ ${x.waste}%)`,
      qty: x.qtyWithWaste,
      unit: CAT_OF[x.cat].unit,
      material: x.unitMaterial,
      labour: x.unitLabour,
      amount: x.cost,
      source: x.priceStatus === "sample" ? "rate" : meta.choice === "lowest" ? "cgd" : meta.choice,
      sample: x.priceStatus === "sample",
    }));
  const codes = new Map<CostCode, { costCode: CostCode; material: number; labour: number; amount: number }>();
  for (const x of summary.filter((s) => s.lines > 0)) {
    const cc = CAT_COST_CODE[x.cat];
    const c = codes.get(cc) ?? { costCode: cc, material: 0, labour: 0, amount: 0 };
    c.material += x.materialCost;
    c.labour += x.labourCost;
    c.amount += x.cost;
    codes.set(cc, c);
  }
  const direct = lines.reduce((a, l) => a + l.amount, 0);
  const overhead = Math.round((direct * meta.overheadPct) / 100);
  const cost = direct + overhead;
  const selling = Math.round(cost / (1 - Math.min(Math.max(meta.marginPct, 0), 90) / 100));
  const sampleAmount = lines.filter((l) => l.sample).reduce((a, l) => a + l.amount, 0);
  return {
    id: meta.id,
    name: meta.name,
    modelCode: meta.modelCode,
    projectId: meta.projectId,
    date: meta.date,
    by: meta.by,
    choice: meta.choice,
    overheadPct: meta.overheadPct,
    marginPct: meta.marginPct,
    grade: 1,
    area: meta.area,
    lines,
    byCode: [...codes.values()].sort((a, b) => a.costCode.localeCompare(b.costCode)),
    direct,
    overhead,
    cost,
    selling,
    perM2: meta.area ? Math.round(selling / meta.area) : 0,
    sampleShare: direct ? sampleAmount / direct : 0,
  };
}
