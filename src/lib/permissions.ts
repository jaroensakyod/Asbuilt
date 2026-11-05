// Role-based access per module. Used by the sidebar (hide what a role can't see),
// the page guard in AppFrame, and the permission matrix on /team.
// Database RLS still applies on top of this in live mode.

import type { Role } from "./data";

/** - none · v view · o own records only · e edit · a approve */
export type Level = "-" | "v" | "o" | "e" | "a";

export const MODULES = {
  projects: "โครงการ",
  costs: "มูลค่าสัญญา/ต้นทุน",
  design: "แบบบ้าน & ออกแบบ",
  systems: "งานระบบ & อุปกรณ์",
  inspections: "การตรวจสอบ",
  repairs: "แจ้งซ่อม",
  workorders: "ใบสั่งงาน",
  maintenance: "บำรุงรักษา",
  sales: "การขาย/ใบเสนอราคา",
  purchasing: "จัดซื้อ/คลัง",
  accounting: "บัญชี/การเงิน",
  hr: "บุคคล/เงินเดือน/แรงงาน",
  documents: "เอกสาร",
  reports: "รายงาน/ผู้บริหาร",
  admin: "ผู้ใช้/ตั้งค่า",
  schedule: "แผนงาน/ความคืบหน้า",
  contracts: "สัญญา/งานเปลี่ยนแปลง/เบิกงวด",
  engineering: "วิศวกรรม/RFI/คุณภาพ",
  safety: "ความปลอดภัย",
  plant: "เครื่องจักร",
  interior: "ตกแต่งภายใน/Selections",
  field: "หน้างาน/รายงานประจำวัน",
  service: "งานบริการ/ประกัน",
  tender: "ประมูลงาน",
} as const;
export type ModuleKey = keyof typeof MODULES;
export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

//                         proj cost desg sys  insp rep  wo   pm   sale purc acct hr   doc  rpt  admin sched cntr eng  safe plnt intr fld  serv tend
const ROWS: Record<Role, Level[]> = {
  admin: /*           */ ["a", "a", "e", "e", "e", "a", "a", "e", "a", "a", "a", "a", "a", "v", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"],
  exec: /*            */ ["v", "a", "v", "v", "v", "v", "v", "v", "a", "a", "a", "a", "v", "v", "v", "v", "a", "v", "v", "v", "v", "v", "v", "a"],
  sales: /*           */ ["e", "-", "v", "-", "-", "v", "-", "-", "e", "-", "-", "-", "e", "v", "-", "v", "e", "-", "-", "-", "v", "-", "-", "e"],
  architect: /*       */ ["v", "-", "a", "e", "v", "v", "-", "-", "v", "-", "-", "-", "e", "-", "-", "v", "v", "a", "-", "-", "e", "v", "-", "v"],
  engineer: /*        */ ["v", "-", "e", "a", "e", "e", "e", "v", "v", "v", "-", "-", "e", "v", "-", "e", "v", "a", "v", "v", "v", "e", "v", "v"],
  pm: /*              */ ["e", "v", "v", "v", "a", "a", "a", "e", "v", "e", "-", "v", "e", "v", "-", "a", "e", "e", "e", "e", "e", "a", "e", "v"],
  foreman: /*         */ ["v", "-", "v", "v", "e", "e", "o", "-", "-", "o", "-", "o", "v", "-", "-", "o", "-", "e", "e", "o", "-", "e", "-", "-"],
  qc: /*              */ ["v", "-", "v", "v", "a", "e", "v", "-", "-", "-", "-", "-", "e", "v", "-", "v", "-", "a", "e", "-", "v", "e", "-", "-"],
  technician: /*      */ ["-", "-", "v", "v", "-", "o", "o", "o", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "v", "-", "-", "o", "e", "-"],
  purchasing: /*      */ ["v", "e", "-", "v", "-", "v", "v", "-", "v", "a", "v", "-", "v", "v", "-", "v", "v", "-", "-", "e", "v", "v", "-", "v"],
  accounting: /*      */ ["v", "a", "-", "-", "-", "v", "v", "-", "v", "v", "a", "e", "v", "e", "-", "v", "a", "-", "-", "v", "-", "-", "v", "v"],
  qs: /*              */ ["v", "a", "v", "-", "-", "-", "-", "-", "v", "v", "v", "-", "v", "v", "-", "e", "a", "v", "-", "v", "v", "v", "-", "a"],
  safety: /*          */ ["v", "-", "v", "-", "v", "v", "-", "-", "-", "-", "-", "v", "v", "v", "-", "v", "-", "v", "a", "e", "-", "e", "-", "-"],
  interior: /*        */ ["v", "v", "e", "v", "-", "v", "-", "-", "v", "e", "-", "-", "e", "-", "-", "v", "v", "v", "-", "-", "a", "v", "-", "-"],
  subcontractor: /*   */ ["o", "-", "v", "-", "o", "o", "-", "-", "-", "-", "-", "-", "o", "-", "-", "o", "o", "o", "o", "-", "-", "o", "-", "-"],
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
  ["/settings", "admin"],
  // phases 8–14
  ["/schedule", "schedule"],
  ["/contracts", "contracts"],
  ["/subcontractors", "contracts"],
  ["/cashflow", "contracts"],
  ["/tenders", "tender"],
  ["/rfi", "engineering"],
  ["/submittals", "engineering"],
  ["/quality", "engineering"],
  ["/supervision", "engineering"],
  ["/doc-control", "engineering"],
  ["/meetings", "engineering"],
  ["/closeout", "engineering"],
  ["/safety", "safety"],
  ["/plant", "plant"],
  ["/design-stages", "design"],
  ["/permits", "design"],
  ["/specs", "design"],
  ["/interior", "interior"],
  ["/selections", "interior"],
  ["/diary", "field"],
  ["/m", "field"],
  ["/dispatch", "service"],
  ["/service-contracts", "service"],
  ["/warranty", "service"],
];
export function moduleOfPath(path: string): ModuleKey | null {
  for (const [p, m] of ROUTES) if (path === p || path.startsWith(p + "/")) return m;
  return null;
}
