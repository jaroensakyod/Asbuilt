// WBS templates and the deterministic demo-schedule generator (pure, no "@/" imports).
// Used by seed.ts (demo data) and by "สร้าง WBS จากแม่แบบ" for projects without a schedule.

import type { CostCode, DepType, ProgressEntry, WbsTask } from "../biz";
import { addDays, diffDays, durationOf, finishFrom, maxIso, minIso } from "./dates";
import { cpm, progressAware, reschedule, type CpmTask } from "./cpm";
import type { SchedTask } from "./types";
import { plannedFraction, plannedPct, rollup, weightedPct } from "./rollup";

export type GenProject = {
  id: string;
  start: string;
  finish: string;
  status: "planning" | "building" | "handover" | "delivered";
  actual: number;
  plan: number;
  value: number; // million baht
  floors: number;
  area: number;
  modelCode: string;
  pm: string;
};

type Dep = [key: string, type?: DepType, lag?: number];
type Node = { key: string; name: string; parent?: string; dur?: number; cc?: CostCode; deps?: Dep[]; crew?: string; qty?: number; unit?: string; ms?: boolean; w?: number };

export const CREW = {
  struct: "ทีมโครงสร้าง (บริษัท)",
  pile: "หจก. ธนาเสาเข็ม",
  mason: "ทีมก่อฉาบ ช่างประยูร",
  roof: "ทีมหลังคา ช่างวิชัย",
  elec: "ทีมไฟฟ้า (บริษัท)",
  plumb: "ทีมประปา ช่างสมชาย",
  hvac: "บจ. แอร์เย็นดี เซอร์วิส",
  ceil: "ทีมฝ้า-ยิปซัม ช่างอำนาจ",
  tile: "ทีมกระเบื้อง ช่างบุญชู",
  paint: "ทีมสี ช่างเสน่ห์",
  door: "บจ. อลูเฟรม ไทย",
  ext: "ทีมงานภายนอก (บริษัท)",
  qc: "ฝ่าย QC/ส่งมอบ",
  lift: "บจ. ลิฟต์สยาม เอนจิเนียริ่ง",
  fire: "บจ. ไฟร์เซฟ ซิสเต็ม",
} as const;

/** value share per cost code (same split as the procurement fallback budget) */
const CODE_WEIGHT: Record<CostCode, number> = { "01": 2, "02": 10, "03": 22, "04": 10, "05": 8, "06": 6, "07": 5, "08": 4, "09": 7, "10": 11, "11": 4, "12": 5, "13": 3, "90": 3 };

// ---------- templates ----------

/** Detached / home-office house, 1–4 floors */
export function houseTemplate(floors: number, area: number): Node[] {
  const n: Node[] = [];
  const ph = (key: string, name: string) => n.push({ key, name });
  const t = (parent: string, key: string, name: string, dur: number, cc: CostCode | undefined, deps: Dep[], extra: Partial<Node> = {}) => n.push({ parent, key, name, dur, cc, deps, ...extra });
  const F = Math.max(1, Math.min(4, floors));
  const per = Math.round(area / F);

  ph("prep", "งานเตรียมการ");
  t("prep", "survey", "ปักผัง วางระดับ ตรวจสอบหมุดที่ดิน", 4, "01", [], { crew: CREW.struct });
  t("prep", "site", "ปรับพื้นที่ รั้วชั่วคราว บ้านพักคนงาน", 6, "01", [["survey", "SS", 2]], { crew: CREW.ext });

  ph("found", "งานเสาเข็ม/ฐานราก");
  t("found", "pile", "ตอกเสาเข็ม", 8, "02", [["survey"]], { crew: CREW.pile, qty: Math.max(12, Math.round(area / 6)), unit: "ต้น" });
  t("found", "footing", "ขุดดิน หล่อฐานราก", 12, "02", [["pile"]], { crew: CREW.struct, qty: Math.max(8, Math.round(area / 13)), unit: "ฐาน" });
  t("found", "gbeam", "คานคอดิน และพื้นชั้น 1", 12, "02", [["footing"]], { crew: CREW.struct, qty: Math.round(area * 0.09), unit: "ลบ.ม." });
  t("found", "msFound", "ตรวจรับงานฐานราก", 0, undefined, [["gbeam"]], { ms: true, crew: CREW.qc });

  for (let k = 1; k <= F; k++) {
    ph(`fl${k}`, `งานโครงสร้างชั้น ${k}`);
    t(`fl${k}`, `col${k}`, `เสาชั้น ${k}`, 8, "03", [[k === 1 ? "gbeam" : `slab${k - 1}`]], { crew: CREW.struct, qty: Math.max(8, Math.round(per / 14)), unit: "ต้น" });
    t(`fl${k}`, `slab${k}`, k < F ? `คานและพื้นชั้น ${k + 1}` : "คานหลังคา ทับหลัง", k < F ? 16 : 10, "03", [[`col${k}`]], { crew: CREW.struct, qty: Math.round(per * (k < F ? 0.18 : 0.06)), unit: "ลบ.ม." });
    if (k === 1 && F > 1) t("fl1", "stair", "บันได คสล.", 6, "03", [["slab1", "SS", 6]], { crew: CREW.struct });
  }
  t(`fl${F}`, "msStruct", "โครงสร้างแล้วเสร็จ", 0, undefined, [[`slab${F}`]], { ms: true, crew: CREW.qc });

  ph("roof", "งานหลังคา");
  t("roof", "roofFrame", "โครงหลังคาเหล็ก ทากันสนิม", 10, "05", [[`slab${F}`]], { crew: CREW.roof });
  t("roof", "roofTile", "มุงกระเบื้อง ครอบสัน รางน้ำ", 10, "05", [["roofFrame"]], { crew: CREW.roof, qty: Math.round((area / F) * 1.35), unit: "ตร.ม." });

  ph("mason", "งานก่ออิฐฉาบปูน");
  for (let k = 1; k <= F; k++) t("mason", `brick${k}`, `ก่ออิฐ ชั้น ${k}`, 12, "04", k === 1 ? [["slab1"]] : [[`slab${k}`], [`brick${k - 1}`, "SS", 5]], { crew: CREW.mason, qty: Math.round(per * 1.6), unit: "ตร.ม." });
  t("mason", "plaster", "ฉาบปูนภายใน-ภายนอก", 16 + 4 * F, "04", [[`brick${F}`, "SS", 5], [`brick${F}`, "FF", 8]], { crew: CREW.mason, qty: Math.round(area * 3.2), unit: "ตร.ม." });
  t("mason", "openings", "ติดตั้งวงกบ ประตู หน้าต่าง", 12, "09", [["plaster", "SS", 8]], { crew: CREW.door, qty: Math.round(area / 9), unit: "ชุด" });

  ph("mep", "งานระบบไฟฟ้า/ประปา");
  t("mep", "drain", "ท่อน้ำทิ้ง ถังบำบัด บ่อพัก", 8, "07", [["gbeam"]], { crew: CREW.plumb });
  t("mep", "conduit", "เดินท่อร้อยสายและท่อประปาฝังผนัง", 14, "06", [["brick1", "SS", 4]], { crew: CREW.elec });
  t("mep", "wiring", "เดินสายไฟ ติดตั้งตู้ควบคุม", 12, "06", [["plaster"]], { crew: CREW.elec });
  t("mep", "water", "ท่อน้ำดี ถังเก็บน้ำ ปั๊มน้ำ", 10, "07", [["plaster", "SS", 6]], { crew: CREW.plumb });
  t("mep", "ac", "ท่อน้ำยาแอร์ ท่อน้ำทิ้งแอร์", 6, "08", [["plaster"]], { crew: CREW.hvac });

  ph("ceil", "งานฝ้าเพดาน");
  t("ceil", "ceiling", "โครงฝ้าและแผ่นยิปซัม ฉาบรอยต่อ", 12, "10", [["wiring", "SS", 4], ["roofTile"]], { crew: CREW.ceil, qty: Math.round(area * 0.9), unit: "ตร.ม." });

  ph("flooring", "งานปูพื้น/ผนัง");
  t("flooring", "wet", "ปูกระเบื้องห้องน้ำ ครัว", 10, "10", [["water"]], { crew: CREW.tile });
  t("flooring", "floor", "ปูพื้นแกรนิตโต้ ลามิเนต", 14, "10", [["ceiling"]], { crew: CREW.tile, qty: Math.round(area * 0.85), unit: "ตร.ม." });

  ph("paint", "งานสี");
  t("paint", "extPaint", "ทาสีภายนอก", 10, "11", [["plaster"], ["roofTile"]], { crew: CREW.paint });
  t("paint", "intPaint", "ทาสีภายใน", 12, "11", [["floor", "SS", 4]], { crew: CREW.paint, qty: Math.round(area * 2.6), unit: "ตร.ม." });

  ph("sani", "งานสุขภัณฑ์/อุปกรณ์");
  t("sani", "sanitary", "ติดตั้งสุขภัณฑ์ อุปกรณ์ห้องน้ำ", 6, "12", [["wet"]], { crew: CREW.plumb, qty: Math.max(1, Math.round(area / 70)), unit: "ห้อง" });
  t("sani", "fixtures", "ติดตั้งดวงโคม สวิตช์ ปลั๊ก เครื่องปรับอากาศ", 6, "06", [["intPaint"]], { crew: CREW.elec });

  ph("ext", "งานภายนอก");
  t("ext", "external", "รั้ว ถนน ลานจอดรถ ระบบระบายน้ำรอบบ้าน", 16, "13", [["extPaint", "SS", 0]], { crew: CREW.ext });

  ph("hand", "ทดสอบ/ส่งมอบ");
  t("hand", "test", "ทดสอบระบบ ทำความสะอาด", 5, "90", [["sanitary"], ["fixtures"], ["external"], ["openings"]], { crew: CREW.qc });
  t("hand", "punch", "ตรวจรับ แก้ไขงาน (defect)", 8, "90", [["test"]], { crew: CREW.qc });
  t("hand", "msHand", "ส่งมอบบ้าน", 0, undefined, [["punch"]], { ms: true, crew: CREW.qc });
  return n;
}

/** 6-storey low-rise condominium (per-floor WBS) */
export function condoTemplate(): Node[] {
  const n: Node[] = [];
  const ph = (key: string, name: string, parent?: string) => n.push({ key, name, parent });
  const t = (parent: string, key: string, name: string, dur: number, cc: CostCode | undefined, deps: Dep[], extra: Partial<Node> = {}) => n.push({ parent, key, name, dur, cc, deps, ...extra });
  const F = 6;

  ph("prep", "งานเตรียมการ");
  t("prep", "survey", "สำรวจ วางผัง รังวัด", 7, "01", [], { crew: CREW.struct });
  t("prep", "site", "รั้วชั่วคราว สำนักงานสนาม บ้านพักคนงาน", 21, "01", [["survey", "SS", 3]], { crew: CREW.ext });
  t("prep", "permitWay", "ขออนุญาตใช้ทาง/เชื่อมท่อระบายน้ำ", 14, "01", [["survey", "SS", 0]], { crew: CREW.qc });

  ph("found", "งานเสาเข็ม/ฐานราก");
  t("found", "pile", "เสาเข็มเจาะ ⌀0.60 ม.", 45, "02", [["survey"]], { crew: CREW.pile, qty: 168, unit: "ต้น" });
  t("found", "pileTest", "ทดสอบเสาเข็ม (Seismic/Static load)", 10, "02", [["pile", "FF", 5]], { crew: CREW.pile, qty: 24, unit: "ต้น" });
  t("found", "excav", "ขุดดิน ค้ำยันดิน (sheet pile)", 20, "02", [["pile", "SS", 20]], { crew: CREW.struct });
  t("found", "footing", "ฐานราก ฐานแพปล่องลิฟต์", 30, "02", [["excav"], ["pileTest", "SS", 0]], { crew: CREW.struct, qty: 46, unit: "ฐาน" });
  t("found", "tank", "ถังเก็บน้ำใต้ดิน คสล.", 25, "02", [["footing", "SS", 10]], { crew: CREW.struct });
  t("found", "gbeam", "คานคอดิน และพื้นชั้น 1", 25, "02", [["footing"]], { crew: CREW.struct, qty: 310, unit: "ลบ.ม." });
  t("found", "msFound", "ฐานรากแล้วเสร็จ", 0, undefined, [["gbeam"], ["tank"]], { ms: true, crew: CREW.qc });

  ph("struct", "งานโครงสร้าง");
  for (let k = 1; k <= F; k++) {
    ph(`st${k}`, `โครงสร้างชั้น ${k}`, "struct");
    t(`st${k}`, `col${k}`, `เสา ผนังปล่องลิฟต์ ชั้น ${k}`, 12, "03", [[k === 1 ? "gbeam" : `slab${k - 1}`]], { crew: CREW.struct, qty: 34, unit: "ต้น" });
    t(`st${k}`, `slab${k}`, k < F ? `คานและพื้น post-tension ชั้น ${k + 1}` : "คานและพื้นดาดฟ้า", 18, "03", [[`col${k}`]], { crew: CREW.struct, qty: 370, unit: "ตร.ม." });
  }
  t("struct", "stairs", "บันไดหนีไฟ ชั้น 1–6", 40, "03", [["col1", "SS", 10], [`slab${F}`, "FF", 10]], { crew: CREW.struct });
  t("struct", "msTop", "โครงสร้างแล้วเสร็จ (top-out)", 0, undefined, [[`slab${F}`]], { ms: true, crew: CREW.qc });

  ph("roof", "งานหลังคา/ดาดฟ้า");
  t("roof", "roofFrame", "โครงหลังคาเหล็ก ห้องเครื่องลิฟต์", 15, "05", [[`slab${F}`]], { crew: CREW.roof });
  t("roof", "roofProof", "กันซึมดาดฟ้า", 10, "05", [["roofFrame"]], { crew: CREW.roof, qty: 380, unit: "ตร.ม." });
  t("roof", "roofSheet", "มุงหลังคาเมทัลชีท ครอบ รางน้ำ", 10, "05", [["roofProof", "SS", 3]], { crew: CREW.roof });

  ph("mason", "งานก่ออิฐฉาบปูน");
  for (let k = 1; k <= F; k++) {
    ph(`ma${k}`, `ก่อฉาบ ชั้น ${k}`, "mason");
    t(`ma${k}`, `brick${k}`, `ก่ออิฐมวลเบา ชั้น ${k}`, 15, "04", k === 1 ? [["slab1"]] : [[`slab${k}`], [`brick${k - 1}`, "SS", 7]], { crew: CREW.mason, qty: 620, unit: "ตร.ม." });
    t(`ma${k}`, `plaster${k}`, `ฉาบปูน ชั้น ${k}`, 18, "04", [[`brick${k}`, "SS", 6], [`brick${k}`, "FF", 4]], { crew: CREW.mason, qty: 1240, unit: "ตร.ม." });
  }

  ph("mep", "งานระบบ");
  ph("elec", "ระบบไฟฟ้า/สื่อสาร", "mep");
  for (let k = 1; k <= F; k++) t("elec", `elec${k}`, `ไฟฟ้า/สื่อสาร ชั้น ${k}`, 12, "06", [[`brick${k}`, "SS", 4]], { crew: CREW.elec });
  t("elec", "mdb", "หม้อแปลง ตู้ MDB สายเมน", 20, "06", [[`slab${F}`]], { crew: CREW.elec });
  ph("plumb", "ระบบประปา/สุขาภิบาล", "mep");
  for (let k = 1; k <= F; k++) t("plumb", `plumb${k}`, `ประปา ท่อน้ำทิ้ง ชั้น ${k}`, 10, "07", [[`brick${k}`, "SS", 4]], { crew: CREW.plumb });
  t("plumb", "pump", "ระบบปั๊มน้ำ ถังน้ำดาดฟ้า", 15, "07", [["roofProof"]], { crew: CREW.plumb });
  t("mep", "hvac", "ระบบปรับอากาศ ท่อน้ำยา คอยล์ร้อน", 30, "08", [["plaster3", "SS", 0]], { crew: CREW.hvac, qty: 64, unit: "ชุด" });
  t("mep", "lift", "ลิฟต์โดยสาร 2 ชุด", 60, "12", [[`slab${F}`]], { crew: CREW.lift, qty: 2, unit: "ชุด" });
  t("mep", "fire", "ระบบดับเพลิง แจ้งเหตุเพลิงไหม้", 40, "07", [["plaster1", "SS", 0]], { crew: CREW.fire });

  ph("door", "งานประตูหน้าต่าง/ฟาซาด");
  t("door", "win13", "วงกบอลูมิเนียม กระจก ชั้น 1–3", 25, "09", [["plaster3", "SS", 5]], { crew: CREW.door, qty: 96, unit: "ชุด" });
  t("door", "win46", "วงกบอลูมิเนียม กระจก ชั้น 4–6", 25, "09", [["plaster6", "SS", 5], ["win13"]], { crew: CREW.door, qty: 96, unit: "ชุด" });
  t("door", "doors", "ประตูห้องชุด ประตูหนีไฟ", 20, "09", [["plaster6"]], { crew: CREW.door, qty: 72, unit: "บาน" });

  ph("arch", "งานสถาปัตย์ตกแต่ง");
  for (let k = 1; k <= F; k++) {
    ph(`ar${k}`, `ตกแต่ง ชั้น ${k}`, "arch");
    t(`ar${k}`, `ceil${k}`, `ฝ้าเพดาน ชั้น ${k}`, 10, "10", [[`elec${k}`], [`plaster${k}`]], { crew: CREW.ceil, qty: 330, unit: "ตร.ม." });
    t(`ar${k}`, `tile${k}`, `ปูพื้น/ผนังกระเบื้อง ชั้น ${k}`, 12, "10", [[`ceil${k}`, "SS", 4], [`plumb${k}`]], { crew: CREW.tile, qty: 360, unit: "ตร.ม." });
    t(`ar${k}`, `paint${k}`, `ทาสีภายใน ชั้น ${k}`, 8, "11", [[`tile${k}`]], { crew: CREW.paint });
  }
  t("arch", "extPaint", "ทาสีภายนอก ฟาซาด", 30, "11", [["plaster6"], ["roofSheet"]], { crew: CREW.paint });

  ph("sani", "งานสุขภัณฑ์/อุปกรณ์");
  t("sani", "sani13", "สุขภัณฑ์ อุปกรณ์ห้องน้ำ ชั้น 1–3", 15, "12", [["tile3"]], { crew: CREW.plumb, qty: 30, unit: "ห้อง" });
  t("sani", "sani46", "สุขภัณฑ์ อุปกรณ์ห้องน้ำ ชั้น 4–6", 15, "12", [["tile6"], ["sani13"]], { crew: CREW.plumb, qty: 30, unit: "ห้อง" });
  t("sani", "fixtures", "ดวงโคม สวิตช์ ปลั๊ก", 20, "06", [["paint3"], ["paint6", "SS", 0]], { crew: CREW.elec });

  ph("ext", "งานภายนอก");
  t("ext", "road", "ถนน ลานจอดรถ ท่อระบายน้ำ", 30, "13", [["extPaint", "SS", 10]], { crew: CREW.ext });
  t("ext", "landscape", "รั้ว ป้อมยาม ภูมิทัศน์", 25, "13", [["road", "SS", 10]], { crew: CREW.ext });

  ph("hand", "ทดสอบ/ส่งมอบ");
  t("hand", "test", "ทดสอบระบบไฟฟ้า ประปา ดับเพลิง ลิฟต์", 15, "90", [["lift"], ["fire"], ["fixtures"], ["sani46"], ["mdb"], ["pump"], ["hvac"]], { crew: CREW.qc });
  t("hand", "permitUse", "ขอใบรับรองการก่อสร้างอาคาร (อ.6)", 30, "01", [["test", "SS", 5]], { crew: CREW.qc });
  t("hand", "punch", "ตรวจรับ แก้ไขงาน ทำความสะอาด", 20, "90", [["test"], ["landscape"], ["doors"], ["win46"]], { crew: CREW.qc });
  t("hand", "msHand", "ส่งมอบอาคาร", 0, undefined, [["punch"], ["permitUse"]], { ms: true, crew: CREW.qc });
  return n;
}

export const templateFor = (p: Pick<GenProject, "modelCode" | "floors" | "area">) => (p.modelCode.startsWith("CD") ? condoTemplate() : houseTemplate(p.floors, p.area));

// ---------- generator ----------

function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};

const PEOPLE = { foreman: "สมศักดิ์ แก้วมณี", engineer: "ธีรวัฒน์ บุญมา" };
const NOTES = ["ตรวจรับร่วมกับผู้ควบคุมงานแล้ว", "รอวัสดุบางส่วนจากผู้ขาย", "ฝนตกช่วงบ่าย หยุดงานครึ่งวัน", "ผ่านการตรวจ QC", "แก้ไขตามความเห็นผู้ควบคุมงาน", "เพิ่มคนงาน 4 คนเร่งงาน"];

type Built = { tasks: WbsTask[]; leafKeys: Map<string, string> };

/** Turn a template into tasks with codes, ids and dependency ids (dates not set yet). */
function build(projectId: string, nodes: Node[], startId = 1): Built & { nodes: Map<string, Node> } {
  const byKey = new Map(nodes.map((x) => [x.key, x]));
  const id = new Map<string, string>();
  nodes.forEach((x, i) => id.set(x.key, `WBS-${projectId}-${String(startId + i).padStart(3, "0")}`));
  const code = new Map<string, string>();
  const counters = new Map<string, number>();
  for (const x of nodes) {
    const k = x.parent ?? "";
    const c = (counters.get(k) ?? 0) + 1;
    counters.set(k, c);
    code.set(x.key, x.parent ? `${code.get(x.parent)}.${c}` : `${c}`);
  }
  const tasks: WbsTask[] = nodes.map((x) => ({
    id: id.get(x.key)!,
    projectId,
    code: code.get(x.key)!,
    name: x.name,
    parentId: x.parent ? id.get(x.parent) : undefined,
    costCode: x.cc,
    start: "",
    finish: "",
    deps: (x.deps ?? []).filter(([k]) => byKey.has(k)).map(([k, type = "FS", lag = 0]) => ({ taskId: id.get(k)!, type, lag })),
    value: 0,
    qty: x.qty,
    unit: x.unit,
    crew: x.crew,
    milestone: x.ms || undefined,
    pct: 0,
  }));
  return { tasks, leafKeys: id, nodes: byKey };
}

/** Spread the contract value over the leaves by cost-code share, weighted by duration. */
function assignValues(leaves: { t: WbsTask; dur: number; w: number }[], total: number) {
  const byCode = new Map<CostCode, { t: WbsTask; dur: number; w: number }[]>();
  for (const l of leaves) if (l.t.costCode && !l.t.milestone) byCode.set(l.t.costCode, [...(byCode.get(l.t.costCode) ?? []), l]);
  const shareSum = [...byCode.keys()].reduce((s, c) => s + CODE_WEIGHT[c], 0);
  let assigned = 0;
  let biggest: WbsTask | undefined;
  for (const [c, ls] of byCode) {
    const amount = (total * CODE_WEIGHT[c]) / shareSum;
    const wsum = ls.reduce((s, l) => s + Math.max(1, l.dur) * l.w, 0);
    for (const l of ls) {
      l.t.value = Math.round((amount * Math.max(1, l.dur) * l.w) / wsum / 1000) * 1000;
      assigned += l.t.value;
      if (!biggest || l.t.value > biggest.value) biggest = l.t;
    }
  }
  if (biggest) biggest.value += Math.round(total - assigned);
}

/** Schedule a template from `start`, stretched so the baseline ends on or just before `finish`. */
function scheduleTemplate(tasks: WbsTask[], nodes: Node[], start: string, finish: string) {
  const summaries = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
  const leaves = tasks.filter((t) => !summaries.has(t.id));
  const baseDur = new Map<string, number>();
  nodes.forEach((x, i) => baseDur.set(tasks[i].id, x.ms ? 0 : (x.dur ?? 5)));
  const baseLag = new Map(leaves.map((t) => [t.id, t.deps.map((d) => d.lag)]));
  const target = diffDays(start, finish) + 1;
  const run = (f: number) => {
    const cts: CpmTask[] = leaves.map((t) => {
      const d = baseDur.get(t.id)!;
      const dur = t.milestone ? 0 : Math.max(1, Math.round(d * f));
      return { id: t.id, start, finish: t.milestone ? start : finishFrom(start, dur), milestone: t.milestone, deps: t.deps.map((x, i) => ({ ...x, lag: Math.round(baseLag.get(t.id)![i] * f) })) };
    });
    return { cts, res: cpm(cts) };
  };
  let f = 1;
  let out = run(f);
  for (let i = 0; i < 12 && out.res.ok; i++) {
    const span = diffDays(start, out.res.finish) + 1;
    if (span <= target && target - span <= 3) break;
    f *= span > target ? Math.min(0.995, (target - 1) / span) : (target - 1) / span;
    out = run(f);
  }
  if (!out.res.ok) throw new Error("template has a dependency loop");
  const rows = out.res.rows;
  for (const t of leaves) {
    const c = out.cts.find((x) => x.id === t.id)!;
    t.start = rows[t.id].start;
    t.finish = rows[t.id].finish;
    t.deps = c.deps;
  }
  return { leaves, durOf: (id: string) => durationOf(rows[id].start, rows[id].finish, {}, !!tasks.find((x) => x.id === id)?.milestone), critical: new Set(out.res.critical), rows };
}

const round5 = (x: number) => Math.round(x / 5) * 5;

/** Copy rolled-up dates / % into summary tasks (summary value stays 0: leaves carry the value). */
export function syncSummaries(tasks: WbsTask[]): WbsTask[] {
  const roll = rollup(tasks);
  const sums = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
  return tasks.map((t) => {
    if (!sums.has(t.id)) return t;
    const r = roll.get(t.id)!;
    return { ...t, start: r.start, finish: r.finish, baselineStart: r.baselineStart, baselineFinish: r.baselineFinish, pct: Math.round(r.pct * 10) / 10, value: 0, deps: [], milestone: undefined };
  });
}

/**
 * WBS + progress for one project. Baseline = template stretched over the contract period;
 * current dates = baseline with a few slipped tasks; % complete set so the weighted progress
 * matches the project's `actual`, measured on dated progress entries before `today`.
 */
export function generateProject(p: GenProject, today: string, opts: { withProgress?: boolean } = {}): { tasks: WbsTask[]; entries: ProgressEntry[] } {
  const rnd = prng(hash(p.id));
  const nodes = templateFor(p);
  const { tasks: template } = build(p.id, nodes);
  const fresh = () => template.map((t) => ({ ...t, deps: t.deps.map((d) => ({ ...d })) }));
  const withProgress = opts.withProgress ?? (p.status === "building" || p.status === "handover");
  // baseline length: the contract period, shortened when needed so that the baseline's planned %
  // today matches the project's planned % (houses often plan to finish ahead of the contract date)
  const contractDays = diffDays(p.start, p.finish) + 1;
  const total = Math.round(p.value * 1e6);
  const plan = (days: number) => {
    const tasks = fresh();
    const s = scheduleTemplate(tasks, nodes, p.start, addDays(p.start, days - 1));
    assignValues(
      s.leaves.map((t) => ({ t, dur: s.durOf(t.id), w: 1 })),
      total,
    );
    return { tasks, ...s };
  };
  const pvToday = (days: number) => plannedPct(plan(days).leaves, today, "current");
  let days = contractDays;
  if (withProgress && p.plan > 0 && p.start < today && pvToday(contractDays) < p.plan) {
    let lo = Math.max(30, diffDays(p.start, today) + 10);
    let hi = contractDays;
    for (let i = 0; i < 7 && hi - lo > 3; i++) {
      const mid = Math.round((lo + hi) / 2);
      if (pvToday(mid) < p.plan) hi = mid;
      else lo = mid;
    }
    days = lo;
  }
  const { tasks, leaves, durOf, critical, rows } = plan(days);
  for (const t of leaves) {
    t.baselineStart = t.start;
    t.baselineFinish = t.finish;
  }
  const entries: ProgressEntry[] = [];
  if (!withProgress) return { tasks: syncSummaries(tasks), entries };

  // --- slips: delayed tasks move the current schedule away from the baseline
  const projectDays = diffDays(p.start, p.finish) + 1;
  const started = leaves.filter((t) => !t.milestone && t.start < today).sort((a, b) => a.start.localeCompare(b.start));
  const add = new Map<string, number>();
  const gap = p.plan - p.actual;
  const critStarted = started.filter((t) => critical.has(t.id));
  if (gap > 0 && critStarted.length) {
    const extra = Math.max(3, Math.round((gap / 100) * projectDays * 0.8));
    const a = critStarted[Math.floor(rnd() * Math.max(1, critStarted.length * 0.6))];
    const b = critStarted[critStarted.length - 1];
    const first = a === b ? extra : Math.round(extra * 0.6);
    add.set(a.id, (add.get(a.id) ?? 0) + first);
    if (a !== b) add.set(b.id, (add.get(b.id) ?? 0) + extra - first);
  }
  const loose = started.filter((t) => !critical.has(t.id) && rows[t.id].totalFloat > 4);
  if (loose.length) {
    const c = loose[Math.floor(rnd() * loose.length)];
    add.set(c.id, (add.get(c.id) ?? 0) + Math.min(rows[c.id].totalFloat - 2, 3 + Math.floor(rnd() * 6)));
  }
  if (add.size) {
    const cts = leaves.map((t) => ({ ...t, finish: add.has(t.id) ? finishFrom(t.start, durOf(t.id) + add.get(t.id)!) : t.finish }));
    const r = reschedule(cts);
    if (r.ok)
      for (const t of leaves) {
        const n = r.tasks.find((x) => x.id === t.id)!;
        t.start = n.start;
        t.finish = n.finish;
      }
  }

  // --- progress date D where the linear plan of the current schedule equals `actual`
  const work = leaves.filter((t) => !t.milestone);
  let lo = -1;
  let hi = projectDays + 120;
  const pctAtDay = (d: number) => plannedPct(work, addDays(p.start, d), "current");
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (pctAtDay(mid) >= p.actual) hi = mid;
    else lo = mid + 1;
  }
  const D = addDays(p.start, lo);
  const lastDay = addDays(today, -1);
  for (const t of leaves) {
    const fr = plannedFraction(t.start, t.finish, D, t.milestone);
    let pct = fr >= 0.97 ? 100 : fr <= 0.02 ? 0 : Math.min(95, Math.max(5, round5(fr * 100)));
    if (t.start > today || (t.milestone && t.finish > today)) pct = 0;
    t.pct = pct;
  }
  // fine-tune the biggest running task so the weighted % lands on `actual`
  const running = work.filter((t) => t.pct > 0 && t.pct < 100).sort((a, b) => b.value - a.value)[0];
  if (running) {
    const diff = ((p.actual - weightedPct(work)) * total) / 100 / Math.max(1, running.value);
    running.pct = Math.min(99, Math.max(1, Math.round(running.pct + diff * 100)));
  }

  // --- status-date update: unfinished work does not stay in the past
  const tomorrow = addDays(today, 1);
  const lastWeek = addDays(today, -7);
  const recent = addDays(today, -3);
  for (const t of leaves as SchedTask[]) {
    if (t.pct >= 100) continue;
    if (t.pct > 0 && t.finish < lastWeek) t.finish = finishFrom(tomorrow, Math.max(1, Math.round(durOf(t.id) * (1 - t.pct / 100))));
    // unstarted work that should have started a while ago is pushed to tomorrow; the last few days stay as "should have started"
    if (t.pct === 0 && t.start < recent) t.notBefore = tomorrow;
  }
  const upd = reschedule(progressAware(leaves as SchedTask[]));
  if (upd.ok)
    for (const t of leaves) {
      const n = upd.tasks.find((x) => x.id === t.id)!;
      t.start = n.start;
      t.finish = n.finish;
    }

  // --- dated measurements
  let seq = 1;
  for (const t of leaves) {
    if (t.pct <= 0) continue;
    const last = t.pct >= 100 ? minIso(t.finish, lastDay) : maxIso(t.start, minIso(D, lastDay));
    const end = maxIso(t.start, last);
    const dur = durOf(t.id);
    const n = t.milestone ? 1 : dur >= 20 ? 3 : dur >= 8 ? 2 : 1;
    const span = diffDays(t.start, end);
    const sub = /^(บจ\.|หจก\.)/.test(t.crew ?? "");
    for (let k = 1; k <= n; k++) {
      const final = k === n;
      const date = final ? end : addDays(t.start, Math.round((span * k) / n));
      const pct = final ? t.pct : Math.max(5, Math.min(t.pct - 5, round5((t.pct * k) / n)));
      if (!final && pct <= 0) continue;
      const source: ProgressEntry["source"] = final ? (t.pct >= 100 ? "engineer" : "foreman") : sub ? "subcontractor" : "foreman";
      const by = source === "engineer" ? PEOPLE.engineer : source === "subcontractor" ? (t.crew ?? "ผู้รับเหมา") : PEOPLE.foreman;
      entries.push({
        id: `PRG-${p.id}-${String(seq++).padStart(4, "0")}`,
        projectId: p.id,
        taskId: t.id,
        date: minIso(date, today),
        pct,
        qtyToDate: t.qty ? Math.round((t.qty * pct) / 100) : undefined,
        by,
        source,
        note: rnd() < 0.22 ? NOTES[Math.floor(rnd() * NOTES.length)] : undefined,
      });
    }
  }
  return { tasks: syncSummaries(tasks), entries };
}

/** Projects that get a demo schedule */
export const seedsSchedule = (p: Pick<GenProject, "status" | "id">, planningIds: string[]) => p.status === "building" || p.status === "handover" || planningIds.includes(p.id);
