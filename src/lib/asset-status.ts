// Per-project asset status derived from the house model, repairs and work orders.
// Everything is deterministic so server and client renders agree.

import { daysBetween, projects, repairs, seeded, TODAY, workOrders, type Project, type Repair, type SystemKey } from "./data";
import { modelForProject, type Asset, type AssetCategory, type BuildingModel } from "./house";

export type AssetState = "normal" | "watch" | "fault" | "service";
export const ASSET_STATE_LABEL: Record<AssetState, string> = {
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  fault: "ชำรุด/ขัดข้อง",
  service: "ซ่อมบำรุง",
};
export const ASSET_STATE_TONE: Record<AssetState, "pos" | "warn" | "accent" | "neutral"> = {
  normal: "pos",
  watch: "warn",
  fault: "accent",
  service: "neutral",
};

export type WarrantyState = "active" | "expiring" | "expired";
export const WARRANTY_LABEL: Record<WarrantyState, string> = {
  active: "อยู่ในประกัน",
  expiring: "ใกล้หมดประกัน",
  expired: "หมดประกัน",
};

export type ProjectAsset = Asset & {
  state: AssetState;
  note?: string;
  warranty: WarrantyState;
  /** maintenance cycle in months, when the item has one */
  cycle?: number;
  lastService?: string;
  nextService?: string;
  /** days until next service (negative = overdue) */
  dueIn?: number;
  openRepairs: Repair[];
};

/** Model dates are generated for a handover of 2026-01-20; shift them to the project's own handover */
const MODEL_HANDOVER = "2026-01-20";

export function addDays(iso: string, d: number) {
  return new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);
}

export function addMonths(iso: string, m: number) {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}

const CYCLE: Partial<Record<AssetCategory, number>> = {
  "เครื่องปรับอากาศติดผนัง (Fan Coil)": 6,
  "คอยล์ร้อน (Condensing Unit)": 12,
  "ปั๊มน้ำอัตโนมัติ": 6,
  "ถังเก็บน้ำ": 12,
  "ถังบำบัดน้ำเสีย": 24,
  "ตู้ควบคุมไฟฟ้า": 12,
  "เครื่องทำน้ำอุ่น": 12,
};

const WATCH_NOTES: Record<string, string[]> = {
  elec: ["ผลตรวจพบความร้อนสะสมที่ขั้วต่อ", "กระแสรั่วใกล้ค่าตัด", "หลอดเริ่มหรี่ลง"],
  plumb: ["แรงดันน้ำต่ำกว่าปกติ", "มีคราบน้ำซึมรอบฐาน", "เสียงปั๊มดังผิดปกติ"],
  hvac: ["ลมเย็นอ่อนกว่าค่าออกแบบ", "มีเสียงคอมเพรสเซอร์ดัง", "ท่อน้ำทิ้งไหลช้า"],
  opening: ["รอยร้าวผมรอบวงกบ", "ซีลยางเสื่อมสภาพ", "บานฝืดเมื่อเปิดปิด"],
  floor: ["ยาแนวเริ่มหลุด", "กระเบื้องมีเสียงกลวงบางจุด"],
  roof: ["คราบน้ำซึมใต้ฝ้าหลังฝนตกหนัก", "รางน้ำมีเศษใบไม้อุดตัน"],
};

const noteKey = (a: Asset) =>
  a.category === "ประตู" || a.category === "หน้าต่าง" ? "opening" : a.category === "พื้น/กระเบื้อง" ? "floor" : a.category === "หลังคา/กันซึม" ? "roof" : a.system;

function hash(s: string) {
  return s.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17);
}

export const isHandedOver = (p: Project) => p.status === "delivered" || p.status === "handover";

/** Projects shown in the system and registry selectors: delivered, in handover and under construction */
export const selectableProjects = () =>
  projects
    .filter((p) => p.status !== "planning")
    .slice()
    .sort((a, b) => {
      const rank = (p: Project) => (p.status === "delivered" ? 0 : p.status === "handover" ? 1 : 2);
      return rank(a) - rank(b) || b.id.localeCompare(a.id);
    });

export const openRepairsOf = (projectId: string, system?: SystemKey) =>
  repairs.filter((r) => r.projectId === projectId && r.status !== "closed" && (!system || r.system === system));

const cache = new Map<string, ProjectAsset[]>();

export function projectAssets(p: Project): ProjectAsset[] {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const m = modelForProject(p);
  const handover = p.handedOver ?? p.finish;
  const shift = daysBetween(MODEL_HANDOVER, handover);
  const delivered = isHandedOver(p);
  const open = openRepairsOf(p.id);
  const activeWO = new Set(workOrders.filter((w) => w.projectId === p.id && w.status === "in_progress").map((w) => w.asset));

  const list: ProjectAsset[] = m.assets.map((a) => {
    const installed = addDays(a.installed, shift);
    const warrantyUntil = addDays(a.warrantyUntil, shift);
    const left = daysBetween(TODAY, warrantyUntil);
    const warranty: WarrantyState = left < 0 ? "expired" : left <= 90 ? "expiring" : "active";
    const own = open.filter((r) => r.asset === a.code);
    const state: AssetState = activeWO.has(a.code) && own.length ? "service" : own.length ? "fault" : "normal";
    const cycle = delivered ? CYCLE[a.category] : undefined;
    let lastService: string | undefined;
    let nextService: string | undefined;
    if (cycle) {
      let k = 1;
      while (addMonths(installed, cycle * k) <= TODAY) k++;
      nextService = addMonths(installed, cycle * k);
      lastService = k > 1 ? addMonths(installed, cycle * (k - 1)) : undefined;
    }
    return {
      ...a,
      installed,
      warrantyUntil,
      warranty,
      state,
      note: own[0]?.title,
      cycle,
      lastService,
      nextService,
      dueIn: nextService ? daysBetween(TODAY, nextService) : undefined,
      openRepairs: own,
    };
  });

  // a few seeded watch points on handed-over houses
  if (delivered) {
    const rnd = seeded(hash(p.id));
    const pool = list.filter((a) => a.state === "normal" && a.category !== "เบรกเกอร์ลูกย่อย" && a.category !== "สวิตช์ไฟ");
    const n = Math.floor(rnd() * 4);
    for (let i = 0; i < n && pool.length; i++) {
      const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const notes = WATCH_NOTES[noteKey(a)] ?? ["ติดตามผลการตรวจรอบถัดไป"];
      a.state = "watch";
      a.note = notes[Math.floor(rnd() * notes.length)];
    }
  }

  cache.set(p.id, list);
  return list;
}

export type AssetSummary = {
  total: number;
  normal: number;
  watch: number;
  fault: number;
  service: number;
  inWarranty: number;
  expiring: number;
  due30: number;
};

export function summarize(list: ProjectAsset[]): AssetSummary {
  const s: AssetSummary = { total: list.length, normal: 0, watch: 0, fault: 0, service: 0, inWarranty: 0, expiring: 0, due30: 0 };
  for (const a of list) {
    s[a.state]++;
    if (a.warranty !== "expired") s.inWarranty++;
    if (a.warranty === "expiring") s.expiring++;
    if (a.dueIn !== undefined && a.dueIn <= 30) s.due30++;
  }
  return s;
}

/** Where an asset sits on the plan: a floor number or the site ("ext") */
export const planFloorOf = (a: Pick<Asset, "room" | "floor">, m: BuildingModel): number | "ext" =>
  a.room === "ภายนอก" || a.room === "หลังคา" || a.floor > m.floors ? "ext" : a.floor;

export function locationOf(a: Pick<Asset, "room" | "floor">, m: BuildingModel) {
  if (a.room === "ภายนอก") return "ภายนอกอาคาร";
  if (a.room === "หลังคา") return "หลังคา";
  const r = m.rooms.find((q) => q.id === a.room);
  return r ? `ชั้น ${a.floor} · ${r.name}` : `ชั้น ${a.floor}`;
}

export const projectOpenRepairCount = (projectId: string) => openRepairsOf(projectId).length;
