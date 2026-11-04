// Shared calculations for the dashboard and project pages.

import { daysBetween, projects, repairs, TODAY, type Project, type Repair, type Severity } from "@/lib/data";
import { getModel, PHASES, PHASE_LABEL, type Phase } from "@/lib/house";

export type StatusKey = Project["status"] | "paused";

export const STATUS_ORDER: StatusKey[] = ["planning", "building", "handover", "delivered", "paused"];
export const STATUS_TEXT: Record<StatusKey, string> = {
  planning: "วางแผน",
  building: "กำลังก่อสร้าง",
  handover: "ตรวจรับงาน",
  delivered: "ส่งมอบแล้ว",
  paused: "พักงาน",
};
/** Map/legend colours (hex because Leaflet paths take plain colour values) */
export const STATUS_HEX: Record<StatusKey, string> = {
  planning: "#7b7266",
  building: "#c2410c",
  handover: "#9a6a07",
  delivered: "#2f7d4f",
  paused: "#c9c1b4",
};
export const STATUS_TONE: Record<Project["status"], "neutral" | "accent" | "warn" | "pos"> = {
  planning: "neutral",
  building: "accent",
  handover: "warn",
  delivered: "pos",
};

const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_MONTH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const TH_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function thLongDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `วัน${TH_DAY[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${TH_MONTH_FULL[d.getUTCMonth()]} พ.ศ. ${d.getUTCFullYear() + 543}`;
}

export function relDays(iso: string, from = TODAY) {
  const n = daysBetween(from, iso);
  if (n === 0) return "วันนี้";
  if (n === 1) return "พรุ่งนี้";
  if (n === -1) return "เมื่อวาน";
  return n > 0 ? `อีก ${n} วัน` : `${-n} วันที่แล้ว`;
}

export const baht = (m: number, digits = 1) => `฿${m.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ล้าน`;

export const isActive = (p: Project) => p.status === "building" || p.status === "handover";

export const openRepairsOf = (projectId: string) => repairs.filter((r) => r.projectId === projectId && r.status !== "closed");

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
export const byUrgency = (a: Repair, b: Repair) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.slaHours - b.slaHours;

export function statusCounts(list: Project[] = projects) {
  return STATUS_ORDER.map((s) => {
    const n = s === "paused" ? 0 : list.filter((p) => p.status === s).length;
    return { status: s, label: STATUS_TEXT[s], n, pct: list.length ? (n / list.length) * 100 : 0 };
  });
}

/** Mirrors the schedule windows in lib/house.ts (not exported there) */
const WINDOW: Record<Phase, [number, number]> = {
  foundation: [0, 0.12],
  structure: [0.12, 0.38],
  masonry: [0.35, 0.58],
  roof: [0.4, 0.58],
  mep: [0.55, 0.76],
  finish: [0.7, 0.9],
  fixture: [0.85, 1],
};

export type PhaseSeg = { phase: Phase; label: string; actual: number; plan: number; state: "done" | "current" | "late" | "future" };

/** Per-phase progress from the model's elements, read at the project's actual and planned % */
export function phaseSegments(p: Pick<Project, "modelCode" | "actual" | "plan">): PhaseSeg[] {
  const els = getModel(p.modelCode).elements;
  const a = p.actual / 100;
  const pl = p.plan / 100;
  return PHASES.map((phase) => {
    const list = els.filter((e) => e.phase === phase);
    // phases without modelled elements (MEP runs, fixtures) follow the schedule window linearly
    const [w0, w1] = WINDOW[phase];
    const lin = (x: number) => Math.max(0, Math.min(1, (x - w0) / (w1 - w0))) * 100;
    const share = (x: number) => (list.filter((e) => e.plan <= x + 1e-9).length / list.length) * 100;
    const actual = list.length ? share(a) : lin(a);
    const plan = list.length ? share(pl) : lin(pl);
    const state = actual >= 99.9 ? "done" : actual > 0 ? "current" : plan > 0 ? "late" : "future";
    return { phase, label: PHASE_LABEL[phase], actual, plan, state };
  });
}

export function behindBy(p: Project) {
  return Math.round((p.actual - p.plan) * 10) / 10;
}
