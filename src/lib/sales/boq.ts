// Estimating & BOQ: quantities derived from the procedural building model
// (src/lib/house.ts getModel) priced with a PriceBook from prices-data.ts.
// Pure functions: usable in components and in demo seeds.

import { getModel, type BuildingModel, type RoomKind } from "../house";
import type { CostCode } from "../biz";
import type { BookChoice, PriceBook, PriceSource } from "./prices-data";

export const DEFAULT_OVERHEAD = 8; // % of direct cost
export const DEFAULT_MARGIN = 18; // % of selling price

export type Quantities = {
  area: number; // catalog floor area m²
  footprint: number;
  floors: number;
  footings: number;
  piles: number;
  concFooting: number; // m³
  concColumn: number;
  concBeam: number;
  concSlab: number;
  concTotal: number;
  lean: number;
  rebar: number; // kg
  formwork: number; // m²
  groundSlab: number; // m² (wire mesh)
  wallGross: number; // m² (one face)
  openings: number;
  wallNet: number;
  wallExtNet: number;
  plaster: number; // both faces
  paintInt: number;
  paintExt: number;
  roofPitched: number; // m² (sloped area)
  roofFlat: number; // m² (waterproofing)
  gutter: number; // m
  floorByKind: Partial<Record<RoomKind, number>>;
  ceiling: number;
  bathWallTile: number;
  doors: number;
  windows: number;
  windowArea: number;
  wc: number;
  basin: number;
  heater: number;
  sink: number;
  baths: number;
  kitchens: number;
  lights: number;
  sockets: number;
  switches: number;
  breakers: number;
  boards: number;
  wire: number; // m of circuit route
  water: number; // m
  drain: number; // m
  hvacPipe: number; // m
  ac: Record<number, number>; // btu → units
  tanks: number;
  pumps: number;
  septic: number;
  stairs: number;
  parking: number;
  perimeter: number;
  months: number;
  skirting: number; // m
  balcony: number; // m² waterproofed wet areas
  lifts: number;
  /** finish grade multiplier from the model's catalog price level */
  grade: number;
};

const len = (pts: [number, number, number][]) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return L;
};
const face = (s: [number, number, number]) => Math.max(s[0], s[2]) * s[1];

/** Standard-spec house sells around 24,000 ฿/m²; premium catalog models carry higher-grade finishes. */
export const STANDARD_PER_M2 = 24000;
export function gradeOf(m: BuildingModel) {
  const mid = ((m.spec.priceMin + m.spec.priceMax) / 2) * 1e6;
  const g = m.spec.area ? mid / m.spec.area / STANDARD_PER_M2 : 1;
  return Math.round(Math.min(1.6, Math.max(0.75, g)) * 100) / 100;
}
/** Cost codes whose material price follows the finish grade */
export const GRADED: CostCode[] = ["08", "09", "10", "11", "12"];

export function quantitiesOf(m: BuildingModel): Quantities {
  const els = m.elements;
  const sum = (f: (e: (typeof els)[number]) => number, k: string | string[]) => els.filter((e) => (Array.isArray(k) ? k.includes(e.kind) : e.kind === k)).reduce((s, e) => s + f(e), 0);
  const vol = (e: (typeof els)[number]) => e.size[0] * e.size[1] * e.size[2];

  const footings = els.filter((e) => e.kind === "footing").length;
  const concFooting = sum(vol, "footing");
  const concColumn = sum(vol, "column");
  const slabs = els.filter((e) => e.kind === "slab");
  const concSlab = slabs.reduce((s, e) => s + vol(e), 0);
  const slabArea = slabs.reduce((s, e) => s + e.size[0] * e.size[2], 0);
  const groundSlab = slabs.filter((e) => e.phase === "foundation").reduce((s, e) => s + e.size[0] * e.size[2], 0);
  const suspended = slabArea - groundSlab;
  // beams are not modelled as elements: allowance 0.075 m³ per m² of slab
  const concBeam = slabArea * 0.075;
  const concTotal = concFooting + concColumn + concBeam + concSlab;
  const rebar = concFooting * 85 + concColumn * 165 + concBeam * 150 + concSlab * 70;
  const formwork = concColumn * 16 + concBeam * 9 + suspended * 0.35 + concFooting * 3;

  const walls = els.filter((e) => e.kind === "wall" || e.kind === "parapet");
  const wallNet = walls.reduce((s, e) => s + face(e.size), 0);
  const wallExtNet = walls.filter((e) => e.material === "wallExt").reduce((s, e) => s + face(e.size), 0);
  const glassArea = sum((e) => face(e.size), "glass");
  const doorAssets = m.assets.filter((a) => a.category === "ประตู").length;
  const openings = glassArea + doorAssets * 0.9 * 2.0;
  const roofPitched = sum((e) => e.size[0] * e.size[2], "roof");
  const top = [...slabs].sort((a, b) => b.pos[1] - a.pos[1])[0];
  const roofFlat = roofPitched > 0 ? 0 : top ? top.size[0] * top.size[2] : 0;
  const perimeter = 2 * (m.W + m.D);

  const floorByKind: Partial<Record<RoomKind, number>> = {};
  let ceiling = 0;
  let bathWallTile = 0;
  let skirting = 0;
  for (const r of m.rooms) {
    const a = (r.x1 - r.x0) * (r.z1 - r.z0);
    floorByKind[r.kind] = (floorByKind[r.kind] ?? 0) + a;
    if (r.kind !== "lift") ceiling += a;
    if (r.kind !== "bath" && r.kind !== "lift") skirting += 2 * (r.x1 - r.x0 + (r.z1 - r.z0)) - 0.9;
    if (r.kind === "bath") bathWallTile += 2 * (r.x1 - r.x0 + (r.z1 - r.z0)) * 2.4 - 1.8;
  }

  const cnt = (c: string) => m.assets.filter((a) => a.category === c).length;
  const ac: Record<number, number> = {};
  for (const a of m.assets) if (a.btu && a.category.startsWith("เครื่องปรับอากาศ")) ac[a.btu] = (ac[a.btu] ?? 0) + 1;
  const runLen = (sys: string) => m.runs.filter((r) => r.system === sys).reduce((s, r) => s + len(r.points), 0);
  const acUnits = Object.values(ac).reduce((s, n) => s + n, 0);
  const footprint = m.W * m.D;

  return {
    area: m.spec.area,
    footprint,
    floors: m.floors,
    footings,
    piles: footings * (m.floors >= 4 ? 6 : 4),
    concFooting,
    concColumn,
    concBeam,
    concSlab,
    concTotal,
    lean: footings * 0.12 + groundSlab * 0.05,
    rebar,
    formwork,
    groundSlab,
    wallGross: wallNet + openings,
    openings,
    wallNet,
    wallExtNet,
    plaster: wallNet * 2,
    paintInt: wallNet * 2 - wallExtNet + ceiling,
    paintExt: wallExtNet,
    roofPitched,
    roofFlat,
    gutter: roofPitched > 0 ? perimeter : perimeter * 0.25,
    floorByKind,
    ceiling,
    bathWallTile: Math.max(0, bathWallTile),
    doors: doorAssets,
    windows: cnt("หน้าต่าง"),
    windowArea: glassArea,
    wc: cnt("สุขภัณฑ์ (ชักโครก)"),
    basin: cnt("อ่างล้างหน้า"),
    heater: cnt("เครื่องทำน้ำอุ่น"),
    sink: cnt("ซิงค์ล้างจาน"),
    baths: m.rooms.filter((r) => r.kind === "bath").length,
    kitchens: m.rooms.filter((r) => r.kind === "kitchen").length,
    lights: cnt("โคมดาวน์ไลท์ LED"),
    sockets: cnt("เต้ารับคู่มีกราวด์"),
    switches: cnt("สวิตช์ไฟ"),
    breakers: cnt("เบรกเกอร์ลูกย่อย"),
    boards: cnt("ตู้ควบคุมไฟฟ้า"),
    wire: runLen("elec"),
    water: runLen("water"),
    drain: runLen("drain"),
    hvacPipe: runLen("hvac") + acUnits * 4,
    ac,
    tanks: cnt("ถังเก็บน้ำ"),
    pumps: cnt("ปั๊มน้ำอัตโนมัติ"),
    septic: cnt("ถังบำบัดน้ำเสีย"),
    stairs: m.floors > 1 ? m.floors - 1 : 0,
    parking: m.spec.parking,
    perimeter,
    months: m.spec.months,
    skirting,
    balcony: floorByKind.bath ?? 0,
    lifts: m.floors > 0 ? Math.round(m.rooms.filter((r) => r.kind === "lift").length / m.floors) : 0,
    grade: gradeOf(m),
  };
}

// ---------- BOQ ----------

export type BoqLine = {
  key: string;
  costCode: CostCode;
  name: string;
  qty: number;
  unit: string;
  /** price item used (material), with conversion factor item-units per BOQ unit */
  itemCode?: string;
  factor?: number;
  /** material unit price per BOQ unit */
  material: number;
  /** labour unit price per BOQ unit */
  labour: number;
  materialAmt: number;
  labourAmt: number;
  amount: number;
  source: PriceSource | "rate";
  sample: boolean;
  basis: string; // how the quantity was derived
};

type Spec = {
  key: string;
  cc: CostCode;
  name: string;
  qty: number;
  unit: string;
  basis: string;
  item?: string;
  factor?: number;
  /** labour per BOQ unit; default: item labour × factor */
  labour?: number;
  /** company rate per BOQ unit (no price item) */
  rate?: number;
};

const FLOOR_FINISH: Record<RoomKind, "granito" | "ceramic" | "laminate" | null> = {
  living: "granito",
  dining: "granito",
  family: "granito",
  kitchen: "granito",
  lobby: "granito",
  corridor: "granito",
  office: "granito",
  stair: "granito",
  bed: "laminate",
  bath: "ceramic",
  store: "ceramic",
  lift: null,
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r0 = (n: number) => Math.ceil(n - 1e-9);

function specs(q: Quantities, roofKind: "gable" | "hip" | "flat"): Spec[] {
  const fk = q.floorByKind;
  const areaOf = (kind: "granito" | "ceramic" | "laminate") =>
    (Object.keys(fk) as RoomKind[]).filter((k) => FLOOR_FINISH[k] === kind).reduce((s, k) => s + (fk[k] ?? 0) * (k === "stair" ? 1.3 : 1), 0);
  const granito = areaOf("granito");
  const ceramic = areaOf("ceramic");
  const laminate = areaOf("laminate");
  const tiled = granito + ceramic + q.bathWallTile;
  // site overheads scale with the size of the job
  const scale = Math.min(1.4, Math.max(0.6, q.area / (q.floors >= 4 ? 1000 : 200)));
  const out: Spec[] = [
    // 01 preparation
    { key: "prep-site", cc: "01", name: "งานเตรียมพื้นที่ วางผัง รั้วชั่วคราว ห้องน้ำคนงาน", qty: r1(q.footprint), unit: "ตร.ม.", basis: "พื้นที่ฐานอาคาร", rate: 260 },
    { key: "prep-permit", cc: "01", name: "ค่าขออนุญาตก่อสร้าง วิศวกร/สถาปนิกควบคุมงาน", qty: r1(q.area), unit: "ตร.ม.", basis: "พื้นที่ใช้สอย", rate: 210 },
    { key: "prep-super", cc: "01", name: "ควบคุมงานประจำหน้างาน (โฟร์แมน/วิศวกรสนาม)", qty: q.months, unit: "เดือน", basis: "ระยะเวลาก่อสร้างตามแบบ", rate: Math.round((q.floors >= 4 ? 80000 : 30000) * scale) },
    { key: "prep-temp", cc: "01", name: "ไฟฟ้า/ประปาชั่วคราว ค่าขนส่งและเครื่องมือ", qty: q.months, unit: "เดือน", basis: "ระยะเวลาก่อสร้างตามแบบ", rate: Math.round((q.floors >= 4 ? 30000 : 9000) * scale) },
    { key: "prep-termite", cc: "01", name: "ระบบป้องกันปลวกแบบวางท่อ", qty: r1(q.footprint), unit: "ตร.ม.", basis: "พื้นที่ฐานอาคาร", rate: 140 },
    { key: "prep-fill", cc: "01", name: "ดินถมปรับระดับพร้อมบดอัด หนา 0.5 ม.", qty: r1(q.footprint * 0.5 * 1.25), unit: "ลบ.ม.", basis: "ฐานอาคาร × 0.5 ม. × เผื่อยุบตัว 25%", item: "PR-SOIL" },
    // 02 foundation
    { key: "fd-pile", cc: "02", name: "เสาเข็มคอนกรีตอัดแรง I-18 ยาว 6 ม. พร้อมตอก", qty: q.piles, unit: "ต้น", basis: `${q.footings} ฐานราก × ${q.footings ? q.piles / q.footings : 0} ต้น`, item: "FD-PILE-I18" },
    { key: "fd-lean", cc: "02", name: "คอนกรีตหยาบรองพื้น", qty: r1(q.lean), unit: "ลบ.ม.", basis: "ใต้ฐานราก + ใต้พื้นชั้นล่าง 5 ซม.", item: "FD-LEAN" },
    { key: "fd-conc", cc: "02", name: "คอนกรีตฐานราก 240 ksc", qty: r1(q.concFooting * 1.05), unit: "ลบ.ม.", basis: "ปริมาตรฐานราก + เผื่อ 5%", item: "CN-240" },
    { key: "fd-rebar", cc: "02", name: "เหล็กเสริมฐานราก DB12", qty: r0(q.concFooting * 85 * 1.07), unit: "กก.", basis: "85 กก./ลบ.ม. + เผื่อ 7%", item: "ST-DB12" },
    { key: "fd-mesh", cc: "02", name: "ไวร์เมชพื้นชั้นล่าง", qty: r1(q.groundSlab), unit: "ตร.ม.", basis: "พื้นที่พื้นชั้นล่าง", item: "ST-MESH" },
    // 03 structure
    { key: "st-conc-col", cc: "03", name: "คอนกรีตเสา 240 ksc", qty: r1(q.concColumn * 1.05), unit: "ลบ.ม.", basis: "ปริมาตรเสาจากโมเดล + เผื่อ 5%", item: "CN-240" },
    { key: "st-conc-beam", cc: "03", name: "คอนกรีตคาน 240 ksc", qty: r1(q.concBeam * 1.05), unit: "ลบ.ม.", basis: "ประมาณ 0.075 ลบ.ม./ตร.ม. พื้น", item: "CN-240" },
    { key: "st-conc-slab", cc: "03", name: "คอนกรีตพื้น 240 ksc", qty: r1(q.concSlab * 1.05), unit: "ลบ.ม.", basis: "ปริมาตรพื้นจากโมเดล + เผื่อ 5%", item: "CN-240" },
    { key: "st-db16", cc: "03", name: "เหล็กข้ออ้อย DB16 (เสา/คาน)", qty: r0((q.concColumn * 165 + q.concBeam * 150) * 0.45 * 1.07), unit: "กก.", basis: "45% ของเหล็กเสา/คาน", item: "ST-DB16" },
    { key: "st-db12", cc: "03", name: "เหล็กข้ออ้อย DB12 (เสา/คาน/พื้น)", qty: r0(((q.concColumn * 165 + q.concBeam * 150) * 0.35 + q.concSlab * 70 * 0.8) * 1.07), unit: "กก.", basis: "เสา/คาน 35% + พื้น 80%", item: "ST-DB12" },
    { key: "st-rb9", cc: "03", name: "เหล็กเส้นกลม RB9 (ปลอก/เหล็กเสริมกันร้าว)", qty: r0(((q.concColumn * 165 + q.concBeam * 150) * 0.2 + q.concSlab * 70 * 0.2) * 1.07), unit: "กก.", basis: "เสา/คาน 20% + พื้น 20%", item: "ST-RB9" },
    { key: "st-wire", cc: "03", name: "ลวดผูกเหล็ก", qty: r0(q.rebar * 0.015), unit: "กก.", basis: "1.5% ของน้ำหนักเหล็กเสริม", item: "ST-WIRE" },
    { key: "st-form", cc: "03", name: "ไม้แบบ ค้ำยัน และค่าแรงแบบหล่อ", qty: r1(q.formwork), unit: "ตร.ม.", basis: "ผิวเสา คาน ฐานราก และท้องพื้น", item: "FW-PLY" },
  ];
  if (q.stairs) out.push({ key: "st-stair", cc: "03", name: "บันได คสล. พร้อมราวบันได", qty: q.stairs, unit: "ช่วง", basis: `${q.floors} ชั้น`, rate: 48000 });
  out.push(
    // 04 masonry / plaster
    { key: "ms-aac", cc: "04", name: "ผนังก่ออิฐมวลเบา หนา 7.5 ซม.", qty: r1(q.wallNet), unit: "ตร.ม.", basis: `ผนังรวม ${r1(q.wallGross)} − ช่องเปิด ${r1(q.openings)} ตร.ม.`, item: "MS-AAC75", factor: 8.6, labour: 165 },
    { key: "ms-mortar", cc: "04", name: "ปูนก่ออิฐมวลเบา", qty: r0(q.wallNet * 0.11), unit: "ถุง", basis: "0.11 ถุง/ตร.ม.", item: "MS-MORTAR" },
    { key: "ms-lintel", cc: "04", name: "เสาเอ็น-ทับหลัง", qty: r1(q.wallNet * 0.45), unit: "ม.", basis: "0.45 ม./ตร.ม. ผนัง", item: "MS-LINTEL" },
    { key: "ms-plaster", cc: "04", name: "ฉาบปูนเรียบ 2 ด้าน หนา 1.5 ซม.", qty: r1(q.plaster), unit: "ตร.ม.", basis: "ผนังสุทธิ × 2 ด้าน", item: "MS-PLASTER", factor: 0.33, labour: 135 },
    { key: "ms-mesh", cc: "04", name: "ตะแกรงกันร้าวมุมช่องเปิด", qty: r1((q.doors + q.windows) * 2.4), unit: "ม.", basis: "2.4 ม. ต่อช่องเปิด", item: "MS-MESH", labour: 12 },
  );
  // 05 roof
  if (roofKind !== "flat" && q.roofPitched > 0) {
    out.push(
      { key: "rf-steel", cc: "05", name: "โครงหลังคาเหล็กรูปพรรณ ทากันสนิม", qty: r0(q.roofPitched * 13), unit: "กก.", basis: "13 กก./ตร.ม. หลังคา", item: "RF-STEEL" },
      { key: "rf-tile", cc: "05", name: "มุงกระเบื้องหลังคาคอนกรีต พร้อมครอบ", qty: r1(q.roofPitched), unit: "ตร.ม.", basis: "พื้นที่ลาดหลังคาจากโมเดล", item: "RF-CTILE", factor: 10.5, labour: 95 },
      { key: "rf-insul", cc: "05", name: "ฉนวนกันความร้อนใต้หลังคา", qty: r1(q.roofPitched * 0.92), unit: "ตร.ม.", basis: "พื้นที่หลังคาฉาย", item: "RF-INSUL" },
    );
  }
  if (q.roofFlat > 0) out.push({ key: "rf-pu", cc: "05", name: "กันซึมดาดฟ้าโพลียูรีเทน", qty: r1(q.roofFlat), unit: "ตร.ม.", basis: "พื้นหลังคา คสล.", item: "RF-PU" });
  if (q.balcony > 0) out.push({ key: "rf-bath-wp", cc: "05", name: "กันซึมพื้นห้องน้ำและระเบียง", qty: r1(q.balcony), unit: "ตร.ม.", basis: "พื้นห้องน้ำ + ระเบียง", item: "RF-PU", factor: 0.6 });
  out.push({ key: "rf-gutter", cc: "05", name: "รางน้ำฝนพร้อมท่อลง", qty: r1(q.gutter), unit: "ม.", basis: roofKind === "flat" ? "ท่อลงดาดฟ้า" : "รอบชายคา", item: "RF-GUTTER" });
  // 06 electrical
  out.push(
    { key: "el-cu", cc: "06", name: "ตู้คอนซูมเมอร์ยูนิต พร้อม RCBO", qty: q.boards, unit: "ชุด", basis: "ตามจำนวนตู้ในโมเดล", item: "EL-CU" },
    { key: "el-mcb", cc: "06", name: "เบรกเกอร์ลูกย่อย", qty: q.breakers, unit: "ตัว", basis: "ตามวงจรในโมเดล", item: "EL-MCB" },
    { key: "el-thw", cc: "06", name: "สายไฟ THW 2.5 ตร.มม. (L/N/G)", qty: r0(q.wire * 3 * 1.15), unit: "ม.", basis: `แนวสาย ${r1(q.wire)} ม. × 3 เส้น + เผื่อ 15%`, item: "EL-THW25", labour: 6 },
    { key: "el-conduit", cc: "06", name: "ท่อร้อยสายไฟ EMT", qty: r0(q.wire * 1.05), unit: "ม.", basis: "แนวสายไฟจากโมเดล + 5%", item: "EL-CONDUIT" },
    { key: "el-dl", cc: "06", name: "โคมดาวน์ไลท์ LED", qty: q.lights, unit: "ชุด", basis: "ตามโมเดล", item: "EL-DL" },
    { key: "el-socket", cc: "06", name: "เต้ารับคู่มีกราวด์", qty: q.sockets, unit: "ชุด", basis: "ตามโมเดล", item: "EL-SOCKET" },
    { key: "el-switch", cc: "06", name: "สวิตช์ไฟ", qty: q.switches, unit: "ชุด", basis: "ตามโมเดล", item: "EL-SWITCH" },
    { key: "el-main", cc: "06", name: "สายเมน มิเตอร์ และระบบสื่อสาร (LAN/TV/กล้อง)", qty: Math.max(1, q.boards), unit: "ชุด", basis: "1 ชุดต่อตู้", rate: 42000 },
    { key: "el-ground", cc: "06", name: "ระบบหลักดิน", qty: Math.max(1, q.boards), unit: "ชุด", basis: "1 ชุดต่อตู้", item: "EL-GROUND" },
  );
  // 07 plumbing
  out.push(
    { key: "pl-ppr", cc: "07", name: "ท่อน้ำดี PPR 20 มม.", qty: r0(q.water * 1.1), unit: "ม.", basis: `แนวท่อน้ำดี ${r1(q.water)} ม. + 10%`, item: "PL-PPR20" },
    { key: "pl-pvc4", cc: "07", name: "ท่อน้ำทิ้ง/โสโครก PVC 4 นิ้ว", qty: r0(q.drain * 0.55 * 1.1), unit: "ม.", basis: "55% ของแนวท่อระบาย", item: "PL-PVC4" },
    { key: "pl-pvc2", cc: "07", name: "ท่อน้ำทิ้ง/ระบายอากาศ PVC 2 นิ้ว", qty: r0(q.drain * 0.45 * 1.1), unit: "ม.", basis: "45% ของแนวท่อระบาย", item: "PL-PVC2" },
    { key: "pl-tank", cc: "07", name: "ถังเก็บน้ำ", qty: q.tanks, unit: "ใบ", basis: "ตามโมเดล", item: "PL-TANK" },
    { key: "pl-pump", cc: "07", name: "ปั๊มน้ำอัตโนมัติ", qty: q.pumps, unit: "ชุด", basis: "ตามโมเดล", item: "PL-PUMP" },
    { key: "pl-septic", cc: "07", name: "ถังบำบัดน้ำเสีย", qty: q.septic, unit: "ใบ", basis: "ตามโมเดล", item: "PL-SEPTIC" },
  );
  // 08 HVAC
  for (const [btu, n] of Object.entries(q.ac).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const b = Number(btu);
    const item = b >= 24000 ? "AC-24" : b >= 18000 ? "AC-18" : "AC-12";
    out.push({ key: `ac-${b}`, cc: "08", name: `เครื่องปรับอากาศ ${b.toLocaleString("th-TH")} BTU พร้อมติดตั้ง`, qty: n, unit: "ชุด", basis: "ตามโมเดล", item });
  }
  out.push({ key: "ac-pipe", cc: "08", name: "ท่อน้ำยาแอร์และท่อน้ำทิ้ง", qty: r0(q.hvacPipe), unit: "ม.", basis: "แนวท่อในโมเดล + 4 ม./เครื่อง", item: "AC-PIPE" });
  // 09 doors / windows
  out.push(
    { key: "dw-main", cc: "09", name: "ประตูทางเข้าหลัก", qty: q.doors ? 1 : 0, unit: "ชุด", basis: "1 ชุด", item: "DW-MAIN" },
    { key: "dw-door", cc: "09", name: "ประตูภายใน HDF พร้อมวงกบ", qty: Math.max(0, q.doors - 1), unit: "ชุด", basis: "ประตูในโมเดล − ประตูหลัก", item: "DW-DOOR" },
    { key: "dw-hw", cc: "09", name: "อุปกรณ์ประตู", qty: q.doors, unit: "ชุด", basis: "ทุกบาน", item: "DW-HW", labour: 150 },
    { key: "dw-win", cc: "09", name: `หน้าต่างอะลูมิเนียม (${q.windows} ช่อง)`, qty: r1(q.windowArea), unit: "ตร.ม.", basis: "พื้นที่กระจกจากโมเดล", item: "DW-WIN" },
  );
  // 10 finishes
  out.push(
    { key: "fn-screed", cc: "10", name: "ปูนทรายปรับระดับพื้น", qty: r1(granito + ceramic + laminate), unit: "ตร.ม.", basis: "พื้นที่ห้องทั้งหมด", item: "FN-SCREED" },
    { key: "fn-granito", cc: "10", name: "ปูกระเบื้องแกรนิตโต้ 60×60", qty: r1(granito * 1.05), unit: "ตร.ม.", basis: "ห้องนั่งเล่น ครัว ทางเดิน บันได + เผื่อ 5%", item: "FN-GRANITO" },
    { key: "fn-laminate", cc: "10", name: "พื้นไม้ลามิเนต ห้องนอน", qty: r1(laminate * 1.05), unit: "ตร.ม.", basis: "ห้องนอน + เผื่อ 5%", item: "FN-LAMINATE" },
    { key: "fn-ceramic", cc: "10", name: "ปูกระเบื้องเซรามิกพื้นกันลื่น", qty: r1(ceramic * 1.08), unit: "ตร.ม.", basis: "ห้องน้ำ ห้องเก็บของ + เผื่อ 8%", item: "FN-CERAMIC" },
    { key: "fn-walltile", cc: "10", name: "กระเบื้องผนังห้องน้ำ สูง 2.4 ม.", qty: r1(q.bathWallTile * 1.08), unit: "ตร.ม.", basis: "เส้นรอบห้องน้ำ × 2.4 ม.", item: "FN-WALLTILE" },
    { key: "fn-glue", cc: "10", name: "กาวซีเมนต์ปูกระเบื้อง", qty: r0(tiled * 0.22), unit: "ถุง", basis: "0.22 ถุง/ตร.ม.", item: "FN-GLUE" },
    { key: "fn-ceiling", cc: "10", name: "ฝ้ายิปซัมฉาบเรียบ", qty: r1(q.ceiling), unit: "ตร.ม.", basis: "พื้นที่ห้อง", item: "FN-GYPSUM" },
  );
  out.push({ key: "fn-skirting", cc: "10", name: "บัวเชิงผนัง", qty: r1(q.skirting), unit: "ม.", basis: "เส้นรอบห้อง", rate: 180 });
  out.push({ key: "fn-facade", cc: "10", name: "งานตกแต่งผนังภายนอก ระแนง บัว ซุ้ม ตามแบบ", qty: r1(q.paintExt), unit: "ตร.ม.", basis: "ผนังภายนอก", rate: 480 });
  if (q.baths) out.push({ key: "fn-screen", cc: "12", name: "ฉากกั้นอาบน้ำกระจกเทมเปอร์", qty: q.baths, unit: "ชุด", basis: "1 ชุดต่อห้องน้ำ", rate: 9500 });
  if (q.lifts) out.push({ key: "st-lift", cc: "03", name: "ลิฟต์โดยสาร พร้อมติดตั้ง", qty: q.lifts, unit: "ชุด", basis: "ตามช่องลิฟต์ในโมเดล", rate: 1650000 });
  if (q.kitchens) out.push({ key: "fn-kitchen", cc: "10", name: "เคาน์เตอร์ครัวปูน ท็อปแกรนิต", qty: q.kitchens, unit: "ชุด", basis: "ตามห้องครัว", rate: 32000 });
  // 11 paint
  out.push(
    { key: "pt-primer", cc: "11", name: "สีรองพื้นปูนใหม่", qty: r0((q.paintInt + q.paintExt) / 32), unit: "แกลลอน", basis: "32 ตร.ม./แกลลอน", item: "PT-PRIMER", labour: 0 },
    { key: "pt-int", cc: "11", name: "สีทับหน้าภายใน 2 เที่ยว", qty: r1(q.paintInt), unit: "ตร.ม.", basis: "ผนังภายใน + ฝ้า", item: "PT-INT", factor: 1 / 16, labour: 38 },
    { key: "pt-ext", cc: "11", name: "สีทับหน้าภายนอก 2 เที่ยว", qty: r1(q.paintExt), unit: "ตร.ม.", basis: "ผนังภายนอก", item: "PT-EXT", factor: 1 / 15, labour: 48 },
  );
  // 12 sanitary
  out.push(
    { key: "sn-wc", cc: "12", name: "ชักโครก", qty: q.wc, unit: "ชุด", basis: "ตามโมเดล", item: "SN-WC" },
    { key: "sn-basin", cc: "12", name: "อ่างล้างหน้า", qty: q.basin, unit: "ชุด", basis: "ตามโมเดล", item: "SN-BASIN" },
    { key: "sn-shower", cc: "12", name: "ชุดฝักบัว", qty: q.baths, unit: "ชุด", basis: "1 ชุดต่อห้องน้ำ", item: "SN-SHOWER" },
    { key: "sn-heater", cc: "12", name: "เครื่องทำน้ำอุ่น", qty: q.heater, unit: "เครื่อง", basis: "ตามโมเดล", item: "SN-HEATER" },
    { key: "sn-sink", cc: "12", name: "ซิงค์ล้างจาน", qty: q.sink, unit: "ชุด", basis: "ตามโมเดล", item: "SN-SINK" },
    { key: "sn-acc", cc: "12", name: "อุปกรณ์ห้องน้ำ", qty: q.baths, unit: "ชุด", basis: "1 ชุดต่อห้องน้ำ", item: "SN-ACC" },
  );
  // 13 exterior
  out.push({ key: "ex-clean", cc: "13", name: "ทำความสะอาดและขนย้ายเศษวัสดุก่อนส่งมอบ", qty: r1(q.area), unit: "ตร.ม.", basis: "พื้นที่ใช้สอย", rate: 90 });
  out.push(
    { key: "ex-pave", cc: "13", name: "ลานจอดรถ/ทางเดินบล็อกปูพื้น", qty: r1(q.parking * 16 + q.perimeter * 0.8), unit: "ตร.ม.", basis: `${q.parking} คัน × 16 ตร.ม. + ทางเดินรอบบ้าน`, item: "EX-PAVE" },
    { key: "ex-drain", cc: "13", name: "บ่อพักและท่อระบายน้ำรอบบ้าน", qty: Math.max(4, Math.round(q.perimeter / 8)), unit: "บ่อ", basis: "ทุก 8 ม. รอบอาคาร", item: "PL-DRAIN" },
  );
  return out.filter((s) => s.qty > 0);
}

export type BoqResult = {
  modelCode: string;
  q: Quantities;
  lines: BoqLine[];
  byCode: { costCode: CostCode; material: number; labour: number; amount: number }[];
  direct: number;
  overheadPct: number;
  marginPct: number;
  overhead: number;
  cost: number; // direct + overhead
  margin: number;
  selling: number; // excl. VAT
  perM2: number;
  sampleShare: number; // share of material cost priced from sample data
  grade: number;
  choice: BookChoice;
};

export function computeBoq(modelCode: string, book: PriceBook, overheadPct = DEFAULT_OVERHEAD, marginPct = DEFAULT_MARGIN, gradeOverride?: number): BoqResult {
  const m = getModel(modelCode);
  const q = quantitiesOf(m);
  const grade = gradeOverride ?? q.grade;
  let sampleMat = 0;
  let mat = 0;
  const lines: BoqLine[] = specs(q, m.spec.roof).map((s) => {
    let material = 0;
    let labour = 0;
    let source: BoqLine["source"] = "rate";
    let sample = false;
    if (s.item) {
      const p = book.material(s.item);
      const f = s.factor ?? 1;
      material = (p?.price ?? 0) * f * (GRADED.includes(s.cc) ? grade : s.cc === "01" ? 1 : 1 + (grade - 1) * 0.5);
      labour = s.labour ?? book.labour(s.item) * f;
      source = p?.source ?? "rate";
      sample = p?.sample ?? false;
    } else {
      // company rate: split 60 / 40 material / labour
      material = (s.rate ?? 0) * 0.6;
      labour = (s.rate ?? 0) * 0.4;
    }
    const materialAmt = material * s.qty;
    const labourAmt = labour * s.qty;
    mat += materialAmt;
    if (sample) sampleMat += materialAmt;
    return {
      key: s.key,
      costCode: s.cc,
      name: s.name,
      qty: s.qty,
      unit: s.unit,
      itemCode: s.item,
      factor: s.factor,
      material,
      labour,
      materialAmt,
      labourAmt,
      amount: materialAmt + labourAmt,
      source,
      sample,
      basis: s.basis,
    };
  });
  const codes = new Map<CostCode, { costCode: CostCode; material: number; labour: number; amount: number }>();
  for (const l of lines) {
    const c = codes.get(l.costCode) ?? { costCode: l.costCode, material: 0, labour: 0, amount: 0 };
    c.material += l.materialAmt;
    c.labour += l.labourAmt;
    c.amount += l.amount;
    codes.set(l.costCode, c);
  }
  const byCode = [...codes.values()].sort((a, b) => a.costCode.localeCompare(b.costCode));
  const direct = lines.reduce((s, l) => s + l.amount, 0);
  return finish({ modelCode, q, lines, byCode, direct, grade, choice: book.choice, sampleShare: mat ? sampleMat / mat : 0 }, overheadPct, marginPct);
}

/** Recompute overhead / margin / selling price for new percentages. */
export function finish(r: Pick<BoqResult, "modelCode" | "q" | "lines" | "byCode" | "direct" | "choice" | "sampleShare" | "grade">, overheadPct: number, marginPct: number): BoqResult {
  const overhead = (r.direct * overheadPct) / 100;
  const cost = r.direct + overhead;
  const mp = Math.min(Math.max(marginPct, 0), 90);
  const selling = cost / (1 - mp / 100);
  return { ...r, overheadPct, marginPct, overhead, cost, margin: selling - cost, selling, perM2: r.q.area ? selling / r.q.area : 0 };
}

/** Budget lines (cost codes incl. 90 overhead) scaled to a target total cost. */
export function budgetLinesFrom(r: Pick<BoqResult, "byCode" | "direct" | "overhead">, targetCost?: number) {
  const total = r.direct + r.overhead;
  const k = targetCost && total ? targetCost / total : 1;
  const lines = r.byCode.map((c) => ({ costCode: c.costCode, amount: Math.round(c.amount * k) }));
  lines.push({ costCode: "90" as CostCode, amount: Math.round(r.overhead * k) });
  return lines;
}
