// Data helpers for the Structure 3D viewer and gallery.
// Pure functions only: no React, no three.js.

import { PHASES, assetOf, progressAt, stateAt, type Asset, type BuildingModel, type Element, type Phase, type Room, type Run } from "./house";
import { TODAY, daysBetween, type Project, type Repair } from "./data";

// ---------- systems ----------

export type SysKey = "struct" | "arch" | "elec" | "plumb" | "sanitary" | "hvac" | "ext";

export const SYSTEMS: { key: SysKey; label: string; color: string }[] = [
  { key: "struct", label: "โครงสร้าง", color: "#8a847a" },
  { key: "arch", label: "สถาปัตย์", color: "#a0764f" },
  { key: "elec", label: "ไฟฟ้า", color: "#d29a1c" },
  { key: "plumb", label: "ประปา", color: "#3c9aa6" },
  { key: "sanitary", label: "สุขภัณฑ์", color: "#4f9a8b" },
  { key: "hvac", label: "ปรับอากาศ", color: "#8a83c4" },
  { key: "ext", label: "ภายนอก", color: "#6f8a5a" },
];

export const ALL_SYSTEMS: Record<SysKey, boolean> = { struct: true, arch: true, elec: true, plumb: true, sanitary: true, hvac: true, ext: true };

export function elementSys(e: Element): SysKey {
  return e.kind === "footing" || e.kind === "column" || e.kind === "slab" ? "struct" : "arch";
}

export function assetSys(a: Asset): SysKey {
  if (a.system === "plumb") return /^(WC|LV|SK)-/.test(a.code) ? "sanitary" : "plumb";
  if (a.room === "ภายนอก") return "ext";
  if (a.system === "elec") return "elec";
  if (a.system === "hvac") return "hvac";
  if (a.system === "struct") return "struct";
  if (a.system === "ext") return "ext";
  return "arch";
}

export function runSys(r: Run): SysKey {
  return r.system === "elec" ? "elec" : r.system === "hvac" ? "hvac" : "plumb";
}

export function systemCounts(m: BuildingModel) {
  const out: Record<SysKey, number> = { struct: 0, arch: 0, elec: 0, plumb: 0, sanitary: 0, hvac: 0, ext: 0 };
  for (const e of m.elements) out[elementSys(e)]++;
  for (const a of m.assets) out[assetSys(a)]++;
  for (const r of m.runs) out[runSys(r)]++;
  return out;
}

export const floorName = (m: BuildingModel, f: number) => (f === 0 ? "ฐานราก/ภายนอก" : f > m.floors ? "หลังคา" : `ชั้น ${f}`);

// ---------- schedule ----------

export type Schedule = {
  /** 0..1 position of TODAY on the schedule */
  today: number;
  /** how far actual trails plan at today (schedule fraction) */
  lag: number;
  todayVisible: boolean;
  dateAt: (f: number) => string;
  fracOf: (iso: string) => number;
};

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function calibrate(plan: number, actual: number, els: Element[]) {
  if (plan >= 100) return { today: 1, lag: 0 };
  if (plan <= 0) return { today: 0, lag: 0 };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (progressAt(mid, mid, 0, els).plan < plan) lo = mid;
    else hi = mid;
  }
  const today = hi;
  let a = 0;
  let b = today;
  for (let i = 0; i < 30; i++) {
    const mid = (a + b) / 2;
    if (progressAt(today, today, mid, els).actual > actual) a = mid;
    else b = mid;
  }
  return { today, lag: b };
}

const schedCache = new Map<string, Schedule>();

/** Maps the project's calendar onto the model's 0..1 schedule so TODAY matches the reported plan and actual % */
export function scheduleFor(p: Project, els: Element[]): Schedule {
  const key = `${p.id}:${p.modelCode}:${p.plan}:${p.actual}`;
  const hit = schedCache.get(key);
  if (hit) return hit;
  const s0 = Date.parse(p.start);
  const s1 = Date.parse(p.finish);
  const now = Date.parse(TODAY);
  let out: Schedule;
  const linear = (today: number, lag: number, visible: boolean): Schedule => ({
    today,
    lag,
    todayVisible: visible,
    dateAt: (f) => iso(s0 + (s1 - s0) * f),
    fracOf: (d) => Math.min(1, Math.max(0, (Date.parse(d) - s0) / (s1 - s0 || 1))),
  });
  if (p.status === "delivered" || now >= s1) out = linear(1, 0, false);
  else if (now <= s0 || p.plan <= 0) out = linear(0, 0, false);
  else {
    const { today, lag } = calibrate(p.plan, p.actual, els);
    out = {
      today,
      lag,
      todayVisible: true,
      dateAt: (f) => (f <= today ? iso(s0 + (now - s0) * (today ? f / today : 0)) : iso(now + (s1 - now) * (today < 1 ? (f - today) / (1 - today) : 1))),
      fracOf: (d) => {
        const ms = Date.parse(d);
        if (ms <= now) return Math.max(0, today * ((ms - s0) / (now - s0 || 1)));
        return Math.min(1, today + (1 - today) * ((ms - now) / (s1 - now || 1)));
      },
    };
  }
  schedCache.set(key, out);
  return out;
}

/** Elements with plan ≤ this value are built at t */
export function cutoffAt(t: number, today: number, lag: number) {
  const tt = Math.min(t, today);
  return tt - (today > 0 ? (lag * tt) / today : 0);
}

// synthetic install dates for equipment (the model only schedules building elements)
const assetPlanCache = new WeakMap<BuildingModel, Map<string, number>>();
export function assetPlans(m: BuildingModel) {
  const hit = assetPlanCache.get(m);
  if (hit) return hit;
  const out = new Map<string, number>();
  const list = [...m.assets].sort((a, b) => a.floor - b.floor);
  list.forEach((a, i) => {
    if (a.room === "ภายนอก") out.set(a.code, a.category === "ถังบำบัดน้ำเสีย" ? 0.14 : 0.72);
    else if (a.category === "ตู้ควบคุมไฟฟ้า") out.set(a.code, 0.66);
    else out.set(a.code, 0.85 + (0.15 * (i + 1)) / list.length);
  });
  assetPlanCache.set(m, out);
  return out;
}

export type SiteStats = {
  actual: number;
  plan: number;
  built: number;
  total: number;
  late: number;
  inspected: number;
  defects: number;
  inProgress: number;
};

export function siteStats(m: BuildingModel, t: number, s: Schedule): SiteStats {
  const p = progressAt(t, s.today, s.lag, m.elements);
  const cut = cutoffAt(t, s.today, s.lag);
  let late = 0;
  let inspected = 0;
  let inProgress = 0;
  const builtRooms = new Set<string>();
  for (const e of m.elements) {
    const st = stateAt(e.plan, t, s.today, s.lag);
    if (st === "late" && e.plan <= s.today) late++;
    if (st === "built") {
      if (e.plan <= cut - 0.035) inspected++;
      if (e.room) builtRooms.add(e.room);
    } else if (e.plan <= cut + 0.03) inProgress++;
  }
  const defects = t >= 1 && s.today >= 1 ? 0 : m.rooms.filter((r) => builtRooms.has(r.id)).reduce((n, r) => n + (r.score !== undefined && r.score < 72 ? (r.defects ?? 0) : 0), 0);
  return { actual: p.actual, plan: p.plan, built: p.built, total: p.total, late, inspected, defects, inProgress };
}

/** phase → fraction of its elements built at t */
export function phaseBuilt(m: BuildingModel, t: number, s: Schedule) {
  const out = {} as Record<Phase, number>;
  for (const ph of PHASES) {
    const list = m.elements.filter((e) => e.phase === ph);
    out[ph] = list.length ? list.filter((e) => stateAt(e.plan, t, s.today, s.lag) === "built").length / list.length : 0;
  }
  return out;
}

export const PHASE_COLOR: Record<Phase, string> = {
  foundation: "#8a847a",
  structure: "#6f7f8a",
  masonry: "#b08a63",
  roof: "#6b5646",
  mep: "#c99a2e",
  finish: "#7d8a6a",
  fixture: "#8a83c4",
};

// ---------- heatmap ----------

export type HeatMetric = "score" | "defects" | "progress" | "failures";
export type HeatValue = { value: number; good: number };

export const HEAT_META: Record<HeatMetric, { label: string; legend: string; low: string; high: string; unit: string }> = {
  score: { label: "คะแนนตรวจ", legend: "คะแนนเฉลี่ยจากการตรวจ (เต็ม 100)", low: "ควรแก้ไข ≤ 75", high: "ดี ≥ 95", unit: "" },
  defects: { label: "ข้อบกพร่อง", legend: "ข้อบกพร่องที่พบจากการตรวจ", low: "3 จุดขึ้นไป", high: "ไม่พบ", unit: " จุด" },
  progress: { label: "ความคืบหน้า", legend: "งานที่สร้างแล้วในห้อง ณ วันนี้", low: "0%", high: "100%", unit: "%" },
  failures: { label: "อุปกรณ์ขัดข้อง", legend: "แจ้งซ่อมอุปกรณ์ที่ยังเปิดอยู่", low: "2 รายการขึ้นไป", high: "ไม่มี", unit: " รายการ" },
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function heatValues(m: BuildingModel, metric: HeatMetric, s: Schedule, repairs: Repair[], delivered: boolean): Map<string, HeatValue> {
  const out = new Map<string, HeatValue>();
  const cut = cutoffAt(s.today, s.today, s.lag);
  const byRoom = new Map<string, Element[]>();
  const byFloor = new Map<number, Element[]>();
  for (const e of m.elements) {
    if (e.room) byRoom.set(e.room, [...(byRoom.get(e.room) ?? []), e]);
    byFloor.set(e.floor, [...(byFloor.get(e.floor) ?? []), e]);
  }
  const pctBuilt = (els: Element[]) => (els.length ? (els.filter((e) => e.plan <= cut).length / els.length) * 100 : 0);
  // inspections happen once a room's walls are up
  const inspected = (r: Room) => delivered || pctBuilt((byFloor.get(r.floor) ?? []).filter((e) => e.phase === "masonry")) >= 60;
  for (const r of m.rooms) {
    if (metric === "score") {
      if (inspected(r) && r.score !== undefined) out.set(r.id, { value: r.score, good: clamp(((r.score - 72) / 25) * 100) });
    } else if (metric === "defects") {
      if (inspected(r)) {
        const d = r.defects ?? 0;
        out.set(r.id, { value: d, good: d === 0 ? 100 : d === 1 ? 55 : d === 2 ? 25 : 5 });
      }
    } else if (metric === "progress") {
      const els = byRoom.get(r.id) ?? (byFloor.get(r.floor) ?? []).filter((e) => e.kind === "wall" || e.kind === "column");
      if (els.length) {
        const v = delivered ? 100 : pctBuilt(els);
        out.set(r.id, { value: Math.round(v), good: v });
      }
    } else if (delivered || s.today >= 0.9) {
      const n = repairs.filter((x) => x.status !== "closed" && assetOf(m, x.asset)?.room === r.id).length;
      out.set(r.id, { value: n, good: n === 0 ? 100 : n === 1 ? 35 : 5 });
    }
  }
  return out;
}

const STOPS: [number, [number, number, number]][] = [
  [0, [0xc2, 0x48, 0x3a]],
  [50, [0xc9, 0x9a, 0x2e]],
  [100, [0x4f, 0x9a, 0x6b]],
];

/** red → amber → green; `good` is 0..100 */
export function heatColor(good?: number) {
  if (good === undefined) return "#6f6a63";
  const g = clamp(good);
  const i = g <= 50 ? 0 : 1;
  const [a, ca] = STOPS[i];
  const [b, cb] = STOPS[i + 1];
  const k = (g - a) / (b - a);
  const c = ca.map((v, j) => Math.round(v + (cb[j] - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------- circuits ----------

export function circuitCapacityW(rating: string) {
  const amps = Number(/(\d+)A/.exec(rating)?.[1] ?? 16);
  return amps * 230;
}

// ---------- gallery ----------

export type ProjectCard = {
  id: string;
  name: string;
  owner: string;
  model: string;
  modelCode: string;
  province: string;
  status: Project["status"];
  actual: number;
  built: number;
  total: number;
  dateLabel: string;
  date: string;
  openRepairs: number;
  daysLeft: number;
};

export function projectCard(p: Project, rs: Repair[], els: Element[]): ProjectCard {
  const s = scheduleFor(p, els);
  const prog = progressAt(s.today, s.today, s.lag, els);
  const delivered = p.status === "delivered";
  return {
    id: p.id,
    name: p.name,
    owner: p.owner,
    model: p.model,
    modelCode: p.modelCode,
    province: p.province,
    status: p.status,
    actual: p.actual,
    built: delivered ? els.length : prog.built,
    total: els.length,
    dateLabel: delivered ? "ส่งมอบ" : p.status === "planning" ? "เริ่มงาน" : "กำหนดเสร็จ",
    date: delivered ? (p.handedOver ?? p.finish) : p.status === "planning" ? p.start : p.finish,
    openRepairs: rs.filter((r) => r.projectId === p.id && r.status !== "closed").length,
    daysLeft: daysBetween(TODAY, p.finish),
  };
}
