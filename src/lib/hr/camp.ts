// Pure worker-camp helpers: occupancy, utility cost from meter readings and its allocation.
// Type-only imports; unit-tested in tests/hr/camp.test.ts.
import type { Camp, CampInspection, CampMeter } from "./labour-types";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function occupancy(c: Pick<Camp, "rooms">) {
  const beds = c.rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = c.rooms.reduce((s, r) => s + r.occupants.length, 0);
  const over = c.rooms.filter((r) => r.occupants.length > r.capacity);
  return { beds, occupied, over, pct: beds ? Math.round((occupied / beds) * 100) : 0 };
}

export type MeterCost = { water: number; elec: number; waterCost: number; elecCost: number; total: number };

/** units used (curr − prev, never negative) × the camp's rates */
export function meterCost(m: Pick<CampMeter, "waterPrev" | "waterCurr" | "elecPrev" | "elecCurr">, c: Pick<Camp, "waterRate" | "elecRate">): MeterCost {
  const water = Math.max(0, m.waterCurr - m.waterPrev);
  const elec = Math.max(0, m.elecCurr - m.elecPrev);
  const waterCost = r2(water * c.waterRate);
  const elecCost = r2(elec * c.elecRate);
  return { water, elec, waterCost, elecCost, total: r2(waterCost + elecCost) };
}

/**
 * Split a utility bill over the occupants.
 * per_head → equal share per occupant; per_room → equal share per occupied room, then split inside the room.
 * Returns employee id → share (baht).
 */
export function allocate(c: Pick<Camp, "rooms" | "allocation">, total: number): Map<string, number> {
  const out = new Map<string, number>();
  const rooms = c.rooms.filter((r) => r.occupants.length);
  if (!rooms.length || total <= 0) return out;
  if (c.allocation === "per_head") {
    const heads = rooms.reduce((s, r) => s + r.occupants.length, 0);
    const each = r2(total / heads);
    for (const r of rooms) for (const id of r.occupants) out.set(id, r2((out.get(id) ?? 0) + each));
    return out;
  }
  const perRoom = total / rooms.length;
  for (const r of rooms) {
    const each = r2(perRoom / r.occupants.length);
    for (const id of r.occupants) out.set(id, r2((out.get(id) ?? 0) + each));
  }
  return out;
}

/** % of checklist items that passed */
export const campScore = (items: CampInspection["items"]) => (items.length ? Math.round((items.filter((i) => i.ok).length / items.length) * 100) : 100);

/** next reading starts where the last one ended */
export function nextReading(meters: CampMeter[], campId: string) {
  const last = meters.filter((m) => m.campId === campId).sort((a, b) => b.period.localeCompare(a.period))[0];
  return { waterPrev: last?.waterCurr ?? 0, elecPrev: last?.elecCurr ?? 0, lastPeriod: last?.period };
}
