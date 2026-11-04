// Role-based access per module. Used by the sidebar (hide what a role can't see),
// the page guard in AppFrame, and the permission matrix on /team.
// Database RLS still applies on top of this in live mode.

import type { Role } from "./data";

/** - none · v view · o own records only · e edit · a approve */
export type Level = "-" | "v" | "o" | "e" | "a";

export const MODULES = {
  projects: "โครงการ",
  costs: "มูลค่าสัญญา/ต้นทุน",
  design: "แบบบ้าน & 3D",
  systems: "งานระบบ & อุปกรณ์",
  inspections: "การตรวจสอบ",
  repairs: "แจ้งซ่อม",
  workorders: "ใบสั่งงาน",
  maintenance: "บำรุงรักษา",
  sales: "การขาย/ใบเสนอราคา",
  purchasing: "จัดซื้อ/คลัง",
  accounting: "บัญชี/การเงิน",
  hr: "บุคคล/เงินเดือน",
  documents: "เอกสาร",
  reports: "รายงาน/ผู้บริหาร",
  admin: "ผู้ใช้/ตั้งค่า",
} as const;
export type ModuleKey = keyof typeof MODULES;
export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

//                         proj cost desg sys  insp rep  wo   pm   sale purc acct hr   doc  rpt  admin
const ROWS: Record<Role, Level[]> = {
  admin: /*           */ ["a", "a", "e", "e", "e", "a", "a", "e", "a", "a", "a", "a", "a", "v", "a"],
  exec: /*            */ ["v", "a", "v", "v", "v", "v", "v", "v", "a", "a", "a", "a", "v", "v", "v"],
  sales: /*           */ ["e", "-", "v", "-", "-", "v", "-", "-", "e", "-", "-", "-", "e", "v", "-"],
  architect: /*       */ ["v", "-", "a", "e", "v", "v", "-", "-", "v", "-", "-", "-", "e", "-", "-"],
  engineer: /*        */ ["v", "-", "e", "a", "e", "e", "e", "v", "v", "v", "-", "-", "e", "v", "-"],
  pm: /*              */ ["e", "v", "v", "v", "a", "a", "a", "e", "v", "e", "-", "v", "e", "v", "-"],
  foreman: /*         */ ["v", "-", "v", "v", "e", "e", "o", "-", "-", "o", "-", "o", "v", "-", "-"],
  qc: /*              */ ["v", "-", "v", "v", "a", "e", "v", "-", "-", "-", "-", "-", "e", "v", "-"],
  technician: /*      */ ["-", "-", "v", "v", "-", "o", "o", "o", "-", "-", "-", "-", "-", "-", "-"],
  purchasing: /*      */ ["v", "e", "-", "v", "-", "v", "v", "-", "v", "a", "v", "-", "v", "v", "-"],
  accounting: /*      */ ["v", "a", "-", "-", "-", "v", "v", "-", "v", "v", "a", "e", "v", "e", "-"],
};

export const MATRIX: Record<Role, Record<ModuleKey, Level>> = Object.fromEntries(
  Object.entries(ROWS).map(([role, levels]) => [role, Object.fromEntries(MODULE_KEYS.map((m, i) => [m, levels[i]]))]),
) as Record<Role, Record<ModuleKey, Level>>;

export const levelOf = (role: Role, m: ModuleKey): Level => MATRIX[role]?.[m] ?? "-";
export const canView = (role: Role, m: ModuleKey) => levelOf(role, m) !== "-";
export const canEdit = (role: Role, m: ModuleKey) => ["e", "a"].includes(levelOf(role, m));
export const canApprove = (role: Role, m: ModuleKey) => levelOf(role, m) === "a";

/** Which module a route belongs to (first matching prefix wins). */
const ROUTES: [string, ModuleKey][] = [
  ["/executive", "reports"],
  ["/reports", "reports"],
  ["/projects", "projects"],
  ["/models", "design"],
  ["/structure", "design"],
  ["/blueprint", "design"],
  ["/cad", "design"],
  ["/systems", "systems"],
  ["/assets", "systems"],
  ["/inspections", "inspections"],
  ["/repairs", "repairs"],
  ["/work-orders", "workorders"],
  ["/maintenance", "maintenance"],
  ["/sales", "sales"],
  ["/quotes", "sales"],
  ["/estimating", "costs"],
  ["/prices", "costs"],
  ["/purchasing", "purchasing"],
  ["/suppliers", "purchasing"],
  ["/inventory", "purchasing"],
  ["/costs", "costs"],
  ["/accounting", "accounting"],
  ["/hr", "hr"],
  ["/documents", "documents"],
  ["/team", "admin"],
  ["/billing", "admin"],
];
export function moduleOfPath(path: string): ModuleKey | null {
  for (const [p, m] of ROUTES) if (path === p || path.startsWith(p + "/")) return m;
  return null;
}
