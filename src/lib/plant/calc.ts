// Pure plant calculations: double booking, usage → monthly cost, certificate intervals and
// status. Type-only imports; unit-tested in tests/plant/calc.test.ts.
import type { Plant, PlantBooking, PlantCert, PlantSettings, PlantUsage, CertKind } from "./types";

export const DEFAULT_PLANT: PlantSettings = {
  id: "plant-settings",
  // ช่วงตรวจปั้นจั่นตามพิกัดยก (ค่าเริ่มต้น ตรวจสอบกับกฎกระทรวงปั้นจั่น 2564 ล่าสุด)
  craneIntervals: [
    { maxT: 3, months: 6 },
    { maxT: 50, months: 3 },
    { maxT: 9999, months: 3 },
  ],
  scaffoldCertHeightM: 21,
  scaffoldCertMonths: 6,
  fuelPrice: 32,
  daysPerMonth: 26,
  warnDays: 30,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** months between periodic inspections for a crane of this capacity */
export function craneIntervalMonths(capacityT: number | undefined, s: PlantSettings = DEFAULT_PLANT) {
  const rows = [...s.craneIntervals].sort((a, b) => a.maxT - b.maxT);
  return (rows.find((r) => (capacityT ?? 0) <= r.maxT) ?? rows[rows.length - 1])?.months ?? 3;
}

/** certificate kinds a plant item must hold */
export function requiredCerts(p: Pick<Plant, "type" | "heightM">, s: PlantSettings = DEFAULT_PLANT): CertKind[] {
  if (p.type === "tower_crane") return ["crane_load_test", "crane_periodic"];
  if (p.type === "mobile_crane" || p.type === "hoist") return ["crane_periodic"];
  if (p.type === "scaffold" && (p.heightM ?? 0) > s.scaffoldCertHeightM) return ["scaffold_engineer"];
  return [];
}

/** suggested expiry for a new certificate */
export function certExpiry(kind: CertKind, issuedAt: string, p: Pick<Plant, "capacityT">, s: PlantSettings = DEFAULT_PLANT) {
  if (kind === "crane_periodic") return addMonths(issuedAt, craneIntervalMonths(p.capacityT, s));
  if (kind === "scaffold_engineer") return addMonths(issuedAt, s.scaffoldCertMonths);
  if (kind === "crane_load_test") return addMonths(issuedAt, 12);
  return addMonths(issuedAt, 12);
}

export type CertState = { kind: CertKind; state: "ok" | "expiring" | "expired" | "missing"; cert?: PlantCert; daysLeft?: number };

/** latest passing certificate of each required kind and its state today */
export function certStates(p: Plant, certs: PlantCert[], today: string, s: PlantSettings = DEFAULT_PLANT): CertState[] {
  return requiredCerts(p, s).map((kind) => {
    const cert = certs.filter((c) => c.plantId === p.id && c.kind === kind && c.result === "pass").sort((a, b) => b.expiry.localeCompare(a.expiry))[0];
    if (!cert) return { kind, state: "missing" };
    const daysLeft = daysBetween(today, cert.expiry);
    return { kind, cert, daysLeft, state: daysLeft < 0 ? "expired" : daysLeft <= s.warnDays ? "expiring" : "ok" };
  });
}

// ---------- bookings ----------

export const overlaps = (a: Pick<PlantBooking, "from" | "to">, b: Pick<PlantBooking, "from" | "to">) => a.from <= b.to && b.from <= a.to;

/** pairs of active bookings of the same plant whose dates overlap */
export function doubleBookings(bookings: PlantBooking[]): [PlantBooking, PlantBooking][] {
  const live = bookings.filter((b) => b.status === "booked").sort((a, b) => a.from.localeCompare(b.from));
  const out: [PlantBooking, PlantBooking][] = [];
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) if (live[i].plantId === live[j].plantId && overlaps(live[i], live[j])) out.push([live[i], live[j]]);
  return out;
}

/** bookings a new / edited booking would clash with */
export const clashes = (b: Pick<PlantBooking, "id" | "plantId" | "from" | "to">, all: PlantBooking[]) => all.filter((x) => x.status === "booked" && x.id !== b.id && x.plantId === b.plantId && overlaps(x, b));

// ---------- usage → cost ----------

export type UsageCost = { plantId: string; projectId: string; period: string; hours: number; days: number; fuelL: number; hire: number; fuel: number; total: number };

/**
 * Cost of a plant item on a project in a month:
 * hour basis → hours × rate; day basis → days used × rate; month basis → rate × days used / days per month (max one month).
 * Fuel used is added at the fuel price.
 */
export function usageCost(p: Pick<Plant, "id" | "rate" | "rateBasis">, usage: PlantUsage[], projectId: string, period: string, s: PlantSettings = DEFAULT_PLANT): UsageCost {
  const rows = usage.filter((u) => u.plantId === p.id && u.projectId === projectId && u.date.startsWith(period));
  const hours = r2(rows.reduce((t, u) => t + u.hours, 0));
  const days = new Set(rows.filter((u) => u.hours > 0).map((u) => u.date)).size;
  const fuelL = r2(rows.reduce((t, u) => t + u.fuelL, 0));
  const hire = r2(p.rateBasis === "hour" ? hours * p.rate : p.rateBasis === "day" ? days * p.rate : p.rate * Math.min(1, days / s.daysPerMonth));
  const fuel = r2(fuelL * s.fuelPrice);
  return { plantId: p.id, projectId, period, hours, days, fuelL, hire, fuel, total: r2(hire + fuel) };
}

/** all (plant, project) costs of a month that have usage */
export function monthCosts(plants: Plant[], usage: PlantUsage[], period: string, s: PlantSettings = DEFAULT_PLANT): UsageCost[] {
  const keys = new Set(usage.filter((u) => u.date.startsWith(period)).map((u) => `${u.plantId}|${u.projectId}`));
  const out: UsageCost[] = [];
  for (const k of keys) {
    const [plantId, projectId] = k.split("|");
    const p = plants.find((x) => x.id === plantId);
    if (p) out.push(usageCost(p, usage, projectId, period, s));
  }
  return out.sort((a, b) => a.projectId.localeCompare(b.projectId) || a.plantId.localeCompare(b.plantId));
}

/** stable cost-entry id for a month's plant cost on a project */
export const plantCostId = (c: Pick<UsageCost, "projectId" | "period" | "plantId">) => `CE-PLANT-${c.projectId}-${c.period}-${c.plantId}`;

/** engine hours left before the next service (undefined when serviced by date only) */
export function hoursToService(p: Pick<Plant, "meterHours" | "serviceEveryHours">, lastServiceHours: number | undefined) {
  if (!p.serviceEveryHours || p.meterHours === undefined) return undefined;
  const last = lastServiceHours ?? Math.floor(p.meterHours / p.serviceEveryHours) * p.serviceEveryHours;
  return r2(last + p.serviceEveryHours - p.meterHours);
}
