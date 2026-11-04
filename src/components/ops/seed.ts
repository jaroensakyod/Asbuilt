// Seed data for the operations module (inspections, repairs, work orders, maintenance).
// Pure module: safe to import from server components (generateStaticParams) and the client store.

import {
  checklists,
  getProject,
  inspections as baseInspections,
  maintenance as baseMaintenance,
  projects,
  repairs as baseRepairs,
  seeded,
  TODAY,
  workOrders as baseWorkOrders,
  type CheckItem,
  type Inspection,
  type Maintenance,
  type Project,
  type Repair,
  type Severity,
  type SystemKey,
  type WorkOrder,
} from "@/lib/data";
import { modelForProject, roomOf, type Asset, type AssetCategory, type BuildingModel } from "@/lib/house";

// ---------- types ----------

export type ItemResult = "pass" | "fail" | "na";
export type ItemState = { r?: ItemResult; note?: string; photos?: number; severity?: Severity; asset?: string };

export type OpsInspection = Inspection & {
  systems: SystemKey[];
  results?: Record<string, ItemState>;
  repairIds?: string[];
  reinspectOf?: string;
  submitted?: string;
};

export type OpsRepair = Repair & {
  slaTotal: number; // hours allowed by severity
  closed?: string;
  reporter?: string;
  inspectionId?: string;
};

export type OpsWorkOrder = WorkOrder & { parts?: string };

export type OpsMaint = Maintenance & {
  assignee: string;
  cycleMonths: number;
  asset?: string;
  planId?: string;
  doneOn?: string;
};

// ---------- constants ----------

export const SLA_HOURS: Record<Severity, number> = { high: 48, medium: 96, low: 168 };
export const PASS_SCORE = 80;
export const PHASES = Object.keys(checklists);

export const TECH_BY_SYSTEM: Record<SystemKey, string> = {
  elec: "สุริยา คำแก้ว",
  hvac: "ไพโรจน์ ดวงจันทร์",
  plumb: "สมชาย ปานทอง",
  arch: "บุญเลิศ ใจดี",
  struct: "บุญเลิศ ใจดี",
  ext: "บุญเลิศ ใจดี",
};
export const ISSUER = "นภัสสร วงศ์ใหญ่";

export const PHASE_SYSTEMS: Record<string, SystemKey[]> = {
  "งานฐานราก": ["struct"],
  "งานโครงสร้าง": ["struct"],
  "งานก่ออิฐ": ["arch"],
  "งานหลังคา": ["arch", "ext"],
  "งานระบบ": ["elec", "plumb"],
  "งานตกแต่ง/ผิว": ["arch"],
  "ติดตั้งสุขภัณฑ์/อุปกรณ์": ["elec", "plumb", "hvac"],
};

/** General items appended to a phase checklist when an inspection has more items than the template */
export const GENERAL_ITEMS: CheckItem[] = [
  { id: "G1", text: "ความสะอาดและการเก็บเศษวัสดุหน้างาน", standard: "ไม่มีเศษวัสดุตกค้าง" },
  { id: "G2", text: "ความปลอดภัยหน้างาน นั่งร้าน ราวกันตก", standard: "ตามมาตรฐานความปลอดภัย" },
  { id: "G3", text: "วัสดุที่ใช้ตรงตามรายการประกอบแบบ", standard: "ตามสเปกสัญญา" },
  { id: "G4", text: "งานป้องกันผิวงานที่แล้วเสร็จ", standard: "คลุมป้องกันครบ" },
  { id: "G5", text: "รอยต่อระหว่างงานต่างระบบเรียบร้อย", standard: "ไม่มีรอยแตกหรือช่องว่าง" },
  { id: "G6", text: "ระดับและแนวตามแบบ", standard: "ตามแบบ A-series" },
  { id: "G7", text: "บันทึกภาพก่อนปิดงาน", standard: "ครบทุกจุด" },
  { id: "G8", text: "เอกสารรับรองวัสดุ/ผลทดสอบ", standard: "แนบครบ" },
  { id: "G9", text: "แก้ไขข้อบกพร่องจากการตรวจครั้งก่อน", standard: "แก้ไขครบทุกข้อ" },
  { id: "G10", text: "ผู้รับเหมาช่วงลงนามรับทราบผล", standard: "ลงนามครบ" },
];

const ITEM_SYSTEM: Record<string, SystemKey> = { F: "struct", S: "struct", M: "arch", R: "arch", T: "arch", E: "elec", P: "plumb", H: "hvac", G: "arch" };
const X_SYSTEM: Record<string, SystemKey> = { X1: "elec", X2: "elec", X3: "plumb", X4: "elec", X5: "hvac", X6: "plumb" };

export function itemSystem(id: string): SystemKey {
  return X_SYSTEM[id] ?? ITEM_SYSTEM[id[0]] ?? "arch";
}

export function itemsFor(ins: Pick<Inspection, "phase" | "items">): CheckItem[] {
  const base = checklists[ins.phase] ?? [];
  const extra = Math.max(0, ins.items - base.length);
  return [...base, ...GENERAL_ITEMS.slice(0, extra)];
}

export function scoreOf(results: Record<string, ItemState> | undefined) {
  const v = Object.values(results ?? {});
  const pass = v.filter((s) => s.r === "pass").length;
  const fail = v.filter((s) => s.r === "fail").length;
  const na = v.filter((s) => s.r === "na").length;
  const applicable = pass + fail;
  return { pass, fail, na, score: applicable ? Math.round((pass / applicable) * 1000) / 10 : 0 };
}

// ---------- small date helpers ----------

export function addDays(iso: string, n: number) {
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
}
export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}
const pad = (n: number, w = 4) => String(n).padStart(w, "0");

// ---------- asset helpers ----------

export function assetLocation(model: BuildingModel, a: Asset) {
  if (a.room === "ภายนอก") return "ภายนอก";
  if (a.room === "หลังคา") return "หลังคา";
  const r = roomOf(model, a.room);
  return `ชั้น ${a.floor} · ${r?.name ?? (a.room || "โถง")}`;
}

export function projectAssets(p: Project | undefined) {
  if (!p) return { model: undefined, assets: [] as Asset[] };
  const model = modelForProject(p);
  return { model, assets: model.assets };
}

export function ownerShort(p: Project | undefined) {
  if (!p) return "";
  return p.owner.startsWith("บริษัท") || p.owner.startsWith("นิติ") ? p.owner : `คุณ${p.owner.split(" ")[0]}`;
}

// ---------- generated history ----------

const REPAIR_TEMPLATES: Partial<Record<AssetCategory, [string, string][]>> = {
  "ตู้ควบคุมไฟฟ้า": [["เมนเบรกเกอร์ตัดเอง", "ไฟดับทั้งหลังช่วงเย็น รีเซ็ตแล้วใช้ได้"]],
  "โคมดาวน์ไลท์ LED": [["ไฟดาวน์ไลท์ดับ", "หลอด LED ดับ 1 ดวง เปลี่ยนหลอดแล้วยังไม่ติด"], ["ไฟกะพริบ", "ดาวน์ไลท์กะพริบเป็นช่วงหลังเปิด 10 นาที"]],
  "เต้ารับคู่มีกราวด์": [["เต้ารับไม่มีไฟ", "เสียบปลั๊กแล้วไฟไม่เข้า เบรกเกอร์ไม่ตัด"], ["เต้ารับหลวม", "เสียบปลั๊กแล้วหลุดง่าย มีรอยไหม้เล็กน้อย"]],
  "สวิตช์ไฟ": [["สวิตช์ไฟกดไม่ติด", "กลไกสวิตช์ค้าง กดแล้วไม่เด้งกลับ"]],
  "เครื่องทำน้ำอุ่น": [["น้ำไม่อุ่น", "เปิดแล้วไฟเครื่องติดแต่น้ำไม่ร้อน"], ["ELCB ตัดบ่อย", "ตัดทุกครั้งที่เปิดน้ำร้อนนานเกิน 2 นาที"]],
  "สุขภัณฑ์ (ชักโครก)": [["ชักโครกกดน้ำไม่ลง", "ชุดกดชำรุด ต้องกดหลายครั้ง"], ["ชักโครกน้ำซึมที่ฐาน", "มีน้ำซึมรอบฐานหลังกดชักโครก"]],
  "อ่างล้างหน้า": [["ก๊อกอ่างล้างหน้ารั่ว", "น้ำหยดจากด้ามก๊อกตลอดเวลา"], ["ท่อใต้อ่างซึม", "ข้อต่อท่อน้ำทิ้งใต้อ่างมีน้ำซึม"]],
  "ซิงค์ล้างจาน": [["ซิงค์ระบายช้า", "น้ำขังในซิงค์ มีกลิ่นย้อน"]],
  "ปั๊มน้ำอัตโนมัติ": [["ปั๊มน้ำเสียงดัง", "มีเสียงดังผิดปกติขณะทำงาน"], ["ปั๊มน้ำทำงานถี่", "ปั๊มติดดับบ่อยแม้ไม่มีการใช้น้ำ"]],
  "ถังเก็บน้ำ": [["ถังเก็บน้ำมีตะกอน", "น้ำประปามีตะกอนสีน้ำตาล"]],
  "ถังบำบัดน้ำเสีย": [["ถังบำบัดมีกลิ่น", "มีกลิ่นเหม็นบริเวณฝาถังบำบัด"]],
  "เครื่องปรับอากาศติดผนัง (Fan Coil)": [["แอร์มีน้ำหยด", "ท่อน้ำทิ้งแอร์อุดตัน น้ำหยดจากหน้าเครื่อง"], ["แอร์ไม่เย็น", "ลมออกอ่อน ไม่เย็นตามที่ตั้ง"], ["แอร์มีกลิ่นอับ", "ลมออกมีกลิ่น ต้องล้างแผ่นกรองและคอยล์"]],
  "คอยล์ร้อน (Condensing Unit)": [["คอยล์ร้อนเสียงดัง", "พัดลมคอยล์ร้อนสั่นเวลาเริ่มทำงาน"]],
  "ประตู": [["ประตูฝืด", "บานประตูเสียดสีวงกบด้านบน"], ["ลูกบิดประตูชำรุด", "ลูกบิดหลวม ล็อกไม่เข้า"]],
  "หน้าต่าง": [["หน้าต่างน้ำซึม", "น้ำซึมเข้าขอบล่างเวลาฝนตกหนัก"], ["รอยร้าวมุมหน้าต่าง", "รอยร้าวแนวทแยงจากมุมวงกบ"]],
  "พื้น/กระเบื้อง": [["กระเบื้องกลวง", "เคาะแล้วมีเสียงกลวง 2–3 แผ่น"], ["ยาแนวหลุดร่อน", "ยาแนวกระเบื้องหลุดเป็นช่วง"]],
  "หลังคา/กันซึม": [["หลังคารั่วซึม", "น้ำซึมที่ฝ้าหลังฝนตกหนัก"], ["รางน้ำฝนรั่ว", "น้ำหยดจากรอยต่อรางน้ำ"]],
};

const RESOLUTIONS = ["แก้ไขเรียบร้อย ทดสอบใช้งานปกติ", "เปลี่ยนอะไหล่ใหม่ ลูกค้าตรวจรับแล้ว", "ปรับตั้งใหม่และทำความสะอาด ใช้งานได้ปกติ", "ซ่อมแซมและเก็บงานสี ลูกค้าเซ็นรับ"];

const servicePool = projects.filter((p) => p.status === "delivered" || p.status === "handover");
const buildPool = projects.filter((p) => p.status === "building" || p.status === "handover");

function seqMap(ids: string[], re: RegExp) {
  const m: Record<string, number> = {};
  for (const id of ids) {
    const x = id.match(re);
    if (x) m[x[1]] = Math.max(m[x[1]] ?? 0, Number(x[2]));
  }
  return m;
}

function buildSeed() {
  const rnd = seeded(20261104);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  // --- inspections ---
  const insp: OpsInspection[] = baseInspections.map((i) => ({ ...i, systems: PHASE_SYSTEMS[i.phase] ?? ["arch"] }));
  const qc = ["อรอุมา จันทร์หอม", "จิราพร พูลสวัสดิ์", "อนุชา ศรีสุข"];
  const times = ["09:00", "09:30", "10:00", "13:30", "14:00", "15:00"];
  const titleFor = (phase: string, floor: number) =>
    ({
      "งานฐานราก": "ตรวจรับงานฐานรากและคานคอดิน",
      "งานโครงสร้าง": `ตรวจเหล็กเสริมและแบบหล่อ ชั้น ${floor}`,
      "งานก่ออิฐ": `ตรวจงานก่ออิฐฉาบปูน ชั้น ${floor}`,
      "งานหลังคา": "ตรวจงานโครงหลังคาและมุงกระเบื้อง",
      "งานระบบ": `ตรวจงานเดินท่อและสายไฟ ชั้น ${floor}`,
      "งานตกแต่ง/ผิว": `ตรวจงานผิวพื้น ผนัง ฝ้า ชั้น ${floor}`,
      "ติดตั้งสุขภัณฑ์/อุปกรณ์": "ทดสอบสุขภัณฑ์และอุปกรณ์ก่อนส่งมอบ",
    })[phase] ?? `ตรวจ${phase}`;

  const gen: OpsInspection[] = [];
  for (let k = 0; k < 26; k++) {
    const date = addDays("2025-11-08", Math.floor((k / 26) * 340 + rnd() * 10));
    const phase = pick(PHASES);
    const p = pick(buildPool.length ? [...buildPool, ...servicePool.slice(0, 6)] : projects);
    const floor = 1 + Math.floor(rnd() * Math.max(1, p.floors));
    const base = checklists[phase].length;
    const items = base + Math.floor(rnd() * 6);
    const fails = rnd() < 0.25 ? 2 + Math.floor(rnd() * 2) : rnd() < 0.5 ? 1 : 0;
    const score = Math.round(((items - fails) / items) * 1000) / 10;
    const inspector = phase === "งานระบบ" && rnd() < 0.5 ? "ธีรวัฒน์ บุญมา" : pick(qc);
    const one: OpsInspection = {
      id: "",
      title: titleFor(phase, floor),
      projectId: p.id,
      location: phase === "งานหลังคา" ? "หลังคา" : `ชั้น ${floor}`,
      inspector,
      date,
      time: pick(times),
      items,
      phase,
      score,
      result: score >= PASS_SCORE ? "pass" : "fail",
      systems: PHASE_SYSTEMS[phase] ?? ["arch"],
    };
    gen.push(one);
    if (one.result === "fail" && date < "2026-10-20") {
      gen.push({ ...one, id: "", date: addDays(date, 6 + Math.floor(rnd() * 5)), time: pick(times), score: 100, result: "pass", title: `ตรวจซ้ำ · ${one.title}`, reinspectOf: `#${gen.length - 1}` });
    }
  }
  // a few scheduled visits later this month
  for (let k = 0; k < 4; k++) {
    const phase = pick(PHASES);
    const p = pick(buildPool);
    const floor = 1 + Math.floor(rnd() * Math.max(1, p.floors));
    gen.push({ id: "", title: titleFor(phase, floor), projectId: p.id, location: `ชั้น ${floor}`, inspector: pick(qc), date: addDays("2026-11-10", k * 4 + Math.floor(rnd() * 3)), time: pick(times), items: checklists[phase].length, phase, result: "scheduled", systems: PHASE_SYSTEMS[phase] ?? ["arch"] });
  }
  // ids: past ones numbered in date order before the oldest seed id of the year
  const order = gen.map((g, i) => ({ g, i })).sort((a, b) => a.g.date.localeCompare(b.g.date));
  const idx: string[] = [];
  let n25 = 280;
  let n26 = 100;
  let nFuture = 162;
  for (const { g, i } of order) {
    if (g.result === "scheduled") g.id = `INS-2026-${pad(nFuture++)}`;
    else if (g.date < "2026-01-01") g.id = `INS-2025-${pad(n25++)}`;
    else g.id = `INS-2026-${pad(n26++)}`;
    idx[i] = g.id;
  }
  for (const g of gen) if (g.reinspectOf?.startsWith("#")) g.reinspectOf = idx[Number(g.reinspectOf.slice(1))];
  insp.push(...gen);

  // --- repairs ---
  const reps: OpsRepair[] = baseRepairs.map((r) => {
    const p = getProject(r.projectId);
    return {
      ...r,
      slaTotal: SLA_HOURS[r.severity],
      closed: r.status === "closed" ? addDays(r.reported, 1) : undefined,
      reporter: r.source === "customer" || r.source === "warranty" ? ownerShort(p) : r.source === "inspection" ? "อนุชา ศรีสุข" : ISSUER,
    };
  });
  const repSeq = seqMap(reps.map((r) => r.id), /^REP-(\d{6})-(\d{4})$/);
  const genReps: OpsRepair[] = [];
  for (let k = 0; k < 28; k++) {
    const reported = addDays("2025-12-03", Math.floor((k / 28) * 320 + rnd() * 8));
    const source = rnd() < 0.18 ? "inspection" : rnd() < 0.55 ? "customer" : rnd() < 0.85 ? "warranty" : "internal";
    const p = pick(source === "inspection" ? buildPool : servicePool);
    const { model, assets } = projectAssets(p);
    const cat = pick((Object.keys(REPAIR_TEMPLATES) as AssetCategory[]).filter((c) => assets.some((x) => x.category === c)));
    const a = pick(assets.filter((x) => x.category === cat));
    const [title, detail] = pick(REPAIR_TEMPLATES[a.category]!);
    const severity: Severity = rnd() < 0.25 ? "high" : rnd() < 0.6 ? "medium" : "low";
    const age = Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(reported)) / 86400000));
    const openOne = age < 12 && rnd() < 0.7;
    const days = severity === "high" ? 1 + Math.floor(rnd() * 3) : severity === "medium" ? 2 + Math.floor(rnd() * 4) : 3 + Math.floor(rnd() * 7);
    const ym = reported.slice(0, 7).replace("-", "");
    repSeq[ym] = (repSeq[ym] ?? 0) + 1;
    genReps.push({
      id: `REP-${ym}-${pad(repSeq[ym])}`,
      title,
      detail,
      asset: a.code,
      assetName: a.name,
      projectId: p.id,
      location: model ? assetLocation(model, a) : "",
      system: a.system,
      severity,
      status: openOne ? (rnd() < 0.5 ? "open" : "fixing") : "closed",
      source,
      assignee: TECH_BY_SYSTEM[a.system],
      reported,
      slaHours: openOne ? SLA_HOURS[severity] - age * 24 : 0,
      slaTotal: SLA_HOURS[severity],
      closed: openOne ? undefined : addDays(reported, days),
      reporter: source === "customer" || source === "warranty" ? ownerShort(p) : source === "inspection" ? pick(qc) : ISSUER,
    });
  }
  // keep the generated ids from colliding with seed ids of the same month
  reps.push(...genReps);

  // --- work orders ---
  const wos: OpsWorkOrder[] = baseWorkOrders.map((w) => ({ ...w }));
  const woSeq = seqMap(wos.map((w) => w.id), /^WO-(\d{6})-(\d{4})$/);
  for (const r of genReps) {
    if (rnd() < 0.15) continue;
    const ym = r.reported.slice(0, 7).replace("-", "");
    woSeq[ym] = (woSeq[ym] ?? 0) + 1;
    const charge = r.source === "customer" && rnd() < 0.5;
    const done = r.status === "closed";
    wos.push({
      id: `WO-${ym}-${pad(woSeq[ym])}`,
      repairId: r.id,
      title: `แก้ไข${r.title} ${r.location.split("·").pop()?.trim() ?? ""}`.trim(),
      asset: r.asset,
      projectId: r.projectId,
      technician: r.assignee,
      issuedBy: ISSUER,
      issued: r.reported,
      scheduled: addDays(r.reported, 1),
      status: done ? "done" : r.status === "fixing" ? "in_progress" : "assigned",
      severity: r.severity,
      billing: charge ? "charge" : "warranty",
      hours: done ? Math.round((1 + rnd() * 3) * 2) / 2 : undefined,
      cost: done ? (charge ? Math.round((400 + rnd() * 3000) / 50) * 50 : 0) : undefined,
      summary: done ? pick(RESOLUTIONS) : undefined,
      log: done
        ? [
            { at: `${r.closed} 15:30`, text: "ปิดงาน ลูกค้าเซ็นรับ" },
            { at: `${addDays(r.reported, 1)} 10:00`, text: "ช่างเข้าดำเนินการ" },
            { at: `${r.reported} 09:15`, text: "รับแจ้งซ่อม" },
          ]
        : [{ at: `${r.reported} 09:15`, text: "รับแจ้งซ่อม" }],
    });
    if (r.status === "open") r.status = "fixing";
  }

  // --- maintenance ---
  const maint: OpsMaint[] = baseMaintenance.map((m) => {
    const cycleMonths = Number(m.cycle.match(/\d+/)?.[0] ?? 12);
    return { ...m, assignee: TECH_BY_SYSTEM[m.system], cycleMonths, doneOn: m.state === "done" ? m.date : undefined };
  });
  const PLANS: { task: string; system: SystemKey; cycle: number; cat?: string }[] = [
    { task: "ล้างแอร์ทั้งหลัง", system: "hvac", cycle: 6, cat: "เครื่องปรับอากาศติดผนัง (Fan Coil)" },
    { task: "ตักไขมันและล้างถังดักไขมัน", system: "plumb", cycle: 3 },
    { task: "ทดสอบเบรกเกอร์กันดูด (RCBO)", system: "elec", cycle: 12, cat: "ตู้ควบคุมไฟฟ้า" },
    { task: "ล้างถังเก็บน้ำ", system: "plumb", cycle: 12, cat: "ถังเก็บน้ำ" },
    { task: "ตรวจปั๊มน้ำและถังแรงดัน", system: "plumb", cycle: 6, cat: "ปั๊มน้ำอัตโนมัติ" },
    { task: "ตรวจรางน้ำฝนและท่อลง", system: "ext", cycle: 12, cat: "หลังคา/กันซึม" },
    { task: "ตรวจเครื่องทำน้ำอุ่นและทดสอบ ELCB", system: "elec", cycle: 12, cat: "เครื่องทำน้ำอุ่น" },
  ];
  const genM: OpsMaint[] = [];
  const delivered = projects.filter((p) => p.status === "delivered").slice(0, 18);
  delivered.forEach((p, i) => {
    const { assets } = projectAssets(p);
    for (let j = 0; j < 2; j++) {
      const plan = PLANS[(i * 2 + j + Math.floor(rnd() * 3)) % PLANS.length];
      const asset = plan.cat ? assets.find((a) => a.category === plan.cat)?.code : undefined;
      let date = addDays("2026-08-01", Math.floor(rnd() * 28 * plan.cycle));
      const planId = `PLAN-${p.id}-${j}`;
      while (date < "2027-05-01") {
        const m: OpsMaint = {
          id: "",
          task: plan.task,
          projectId: p.id,
          owner: ownerShort(p),
          date,
          system: plan.system,
          state: date < TODAY ? "done" : "planned",
          cycle: `ทุก ${plan.cycle} เดือน`,
          assignee: TECH_BY_SYSTEM[plan.system],
          cycleMonths: plan.cycle,
          asset,
          planId,
          doneOn: date < TODAY ? addDays(date, Math.floor(rnd() * 2)) : undefined,
        };
        genM.push(m);
        date = addMonths(date, plan.cycle);
      }
    }
  });
  genM.sort((a, b) => a.date.localeCompare(b.date));
  genM.forEach((m, i) => (m.id = `PM-${pad(200 + i)}`));
  maint.push(...genM);

  return { inspections: insp, repairs: reps, workOrders: wos, maintenance: maint };
}

export const SEED = buildSeed();

export const SEED_INSPECTION_IDS = SEED.inspections.map((i) => i.id);
export const SEED_WORK_ORDER_IDS = SEED.workOrders.map((w) => w.id);

/** Deterministic item results for seed inspections that were completed before the app existed */
export function seedResults(ins: OpsInspection): Record<string, ItemState> | undefined {
  if (ins.results || ins.score === undefined) return ins.results;
  const items = itemsFor(ins);
  const nFail = Math.max(ins.result === "fail" ? 1 : 0, Math.round(items.length * (1 - ins.score / 100)));
  const rnd = seeded(Number(ins.id.replace(/\D/g, "")) || 1);
  const failIdx = new Set<number>();
  while (failIdx.size < Math.min(nFail, items.length)) failIdx.add(Math.floor(rnd() * items.length));
  const out: Record<string, ItemState> = {};
  items.forEach((it, i) => (out[it.id] = { r: failIdx.has(i) ? "fail" : "pass" }));
  return out;
}
