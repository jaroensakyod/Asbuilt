// Sheet set assembly: which sheets a model gets, scale selection, placement
// inside the A3 frame, notes/legends and per-sheet caches.

import { getModel, type BuildingModel } from "../house";
import { Builder } from "./builder";
import { CA, drawingTitle, frame, NOTES } from "./frame";
import { clipPrims, primBBox, primsBBox, translatePrims, union } from "./geom";
import { electrical, floorPlan, fy, hvac, lvl, plumbing, sectionX } from "./plan";
import { floorFraming, footingType, foundationPlan, loadSchedule, pilesPer, roofFraming } from "./struct";
import type { BBox, Discipline, Pt, Sheet, SheetHit, SheetKind, SheetMeta, SheetRoom } from "./types";
import { elevation, roofPlan, section, sitePlan } from "./views";

type M = BuildingModel;

type Def = {
  id: string;
  disc: Discipline;
  kind: SheetKind;
  titleTh: string;
  titleEn: string;
  floor?: number;
  level: string;
  scales: number[];
  nts?: boolean;
  draw: (b: Builder) => SheetRoom[] | void;
  notes?: (b: Builder, P: (x: number, y: number) => Pt) => void;
  clip?: BBox;
};

const ORD = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];

export const KIND_LABEL: Record<SheetKind, string> = {
  site: "ผังบริเวณ",
  plan: "แปลนพื้น",
  roof: "แปลนหลังคา",
  elev: "รูปด้าน",
  section: "รูปตัด",
  detail: "แบบขยาย",
  found: "แปลนฐานราก",
  struct: "แปลนโครงสร้าง",
  schedule: "ตารางและผังวงจร",
  elec: "แบบระบบไฟฟ้า",
  plumb: "แบบระบบสุขาภิบาล",
  hvac: "แบบระบบปรับอากาศ",
};

// ---------- notes and legends ----------

function lines(b: Builder, P: (x: number, y: number) => Pt, items: string[], y = NOTES.top - 4.6, h = 1.3, gap = 3.4) {
  for (const t of items) {
    b.text("TITLE", P(NOTES.x0, y), b.mm(h), t);
    y -= gap;
  }
  return y;
}

type Sym = (b: Builder, c: Pt) => void;
function legend(b: Builder, P: (x: number, y: number) => Pt, items: [Sym, string][], y: number) {
  const s = (v: number) => b.mm(v);
  for (const [sym, label] of items) {
    sym(b, P(NOTES.x0 + 3, y));
    b.text("TITLE", P(NOTES.x0 + 8, y), s(1.3), label, { va: "m" });
    y -= 4.2;
  }
  return y;
}

const ARCH_NOTES = [
  "1. ระยะทั้งหมดเป็นเมตร ยกเว้นระบุเป็นอย่างอื่น",
  "2. ระดับ ±0.00 คือระดับพื้นชั้น 1 สำเร็จ (FFL)",
  "3. ผนังภายนอกก่ออิฐมวลเบา หนา 0.20 ม.",
  "4. ผนังภายในก่ออิฐมอญครึ่งแผ่น หนา 0.12 ม.",
  "5. รหัส D-/W- คือรหัสอุปกรณ์ในทะเบียนอาคาร",
  "6. ตรวจสอบระยะจริงที่หน้างานก่อนก่อสร้าง",
];

function archNotes(m: M, f?: number) {
  return (b: Builder, P: (x: number, y: number) => Pt) => {
    let y = lines(b, P, ARCH_NOTES);
    if (f) {
      const doors = m.assets.filter((a) => a.floor === f && a.category === "ประตู").length;
      const wins = m.assets.filter((a) => a.floor === f && a.category === "หน้าต่าง").length;
      const rooms = m.rooms.filter((r) => r.floor === f);
      const area = rooms.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
      y -= 2;
      b.text("TITLE", P(NOTES.x0, y), b.mm(1.4), `สรุปชั้น ${f}`, { bold: true });
      lines(b, P, [`ห้อง ${rooms.length} ห้อง · พื้นที่ภายใน ${area.toFixed(1)} ตร.ม.`, `ประตู ${doors} ชุด · หน้าต่าง ${wins} ชุด`], y - 3.6);
    }
  };
}

const STRUCT_NOTES = [
  "1. คอนกรีตโครงสร้าง f'c ≥ 240 กก./ตร.ซม. (ทรงกระบอก)",
  "2. เหล็กเสริม SD40 / SR24 ตาม มอก.",
  "3. ระยะหุ้มคอนกรีต ฐานราก 0.075 · คาน เสา 0.035 ม.",
  "4. เสาเข็มเจาะแห้ง Ø0.35 ม. รับน้ำหนักปลอดภัย 25 ตัน/ต้น",
  "5. ทดสอบเสาเข็มด้วย Seismic test ทุกต้น",
];

function footingNotes(m: M) {
  return (b: Builder, P: (x: number, y: number) => Pt) => {
    const y = lines(b, P, STRUCT_NOTES);
    const counts: Record<string, number> = {};
    for (const e of m.elements) if (e.kind === "footing") counts[footingType(m, e.pos[0], e.pos[2])] = (counts[footingType(m, e.pos[0], e.pos[2])] ?? 0) + 1;
    const rows = ["F1", "F2", "F3"]
      .filter((t) => counts[t])
      .map((t) => [t, t === "F3" ? "1.30×1.30×0.50" : t === "F2" ? "1.10×1.10×0.50" : "1.00×1.00×0.50", String(pilesPer(m, t)), String(counts[t])]);
    b.table(P(NOTES.x0, y - 2)[0], P(NOTES.x0, y - 2)[1], [
      { w: 10, head: "ชนิด", mono: true },
      { w: 30, head: "ขนาด (ม.)", mono: true },
      { w: 16, head: "เข็ม/ฐาน", al: "r", mono: true },
      { w: 18, head: "จำนวน", al: "r", mono: true },
    ], rows, { rowH: 3.6, textH: 1.3, l: "TITLE" });
  };
}

function framingNotes(roof: boolean) {
  return (b: Builder, P: (x: number, y: number) => Pt) => {
    const y = lines(b, P, STRUCT_NOTES.slice(0, 3));
    b.table(P(NOTES.x0, y - 2)[0], P(NOTES.x0, y - 2)[1], [
      { w: 12, head: "รหัส", mono: true },
      { w: 26, head: "ขนาด (ม.)", mono: true },
      { w: 36, head: "รายละเอียด" },
    ], roof ? [["RB1", "0.20×0.50", "คานหลังคา"], ["RS1", "t = 0.12", "พื้นหลังคา 2 ทาง"]] : [["B1", "0.20×0.50", "คานขอบอาคาร"], ["B2", "0.20×0.40", "คานภายใน"], ["S1", "t = 0.12", "พื้นหล่อในที่ 2 ทาง"]], { rowH: 3.6, textH: 1.3, l: "TITLE" });
  };
}

const symLight: Sym = (b, c) => {
  const r = b.mm(1.4);
  b.circle("E-LITE", c, r);
  b.line("E-LITE", [c[0] - r * 0.7, c[1] - r * 0.7], [c[0] + r * 0.7, c[1] + r * 0.7]);
  b.line("E-LITE", [c[0] - r * 0.7, c[1] + r * 0.7], [c[0] + r * 0.7, c[1] - r * 0.7]);
};
const symSwitch: Sym = (b, c) => {
  b.circle("E-LITE", c, b.mm(0.7), { fill: true });
  b.line("E-LITE", c, [c[0] + b.mm(1.8), c[1] + b.mm(1.8)]);
};
const symOutlet: Sym = (b, c) => {
  const r = b.mm(1.3);
  b.circle("E-POWR", c, r);
  b.line("E-POWR", [c[0] - r * 0.4, c[1] - r * 0.55], [c[0] - r * 0.4, c[1] + r * 0.55]);
  b.line("E-POWR", [c[0] + r * 0.4, c[1] - r * 0.55], [c[0] + r * 0.4, c[1] + r * 0.55]);
};
const symBox = (layer: string, label: string, fill = false): Sym => (b, c) => {
  b.rect(layer, c[0] - b.mm(1.6), c[1] - b.mm(1.2), c[0] + b.mm(1.6), c[1] + b.mm(1.2));
  if (fill) b.hatchRect(layer, c[0] - b.mm(1.6), c[1] - b.mm(1.2), c[0] + b.mm(1.6), c[1] + b.mm(1.2), "solid");
  else b.text(layer, c, b.mm(1), label, { al: "c", va: "m", mono: true });
};
const symLine = (layer: string, lt?: "DASHED" | "HIDDEN"): Sym => (b, c) => b.line(layer, [c[0] - b.mm(2.5), c[1]], [c[0] + b.mm(2.5), c[1]], { lt, w: 0.35 });
const symCircle = (layer: string): Sym => (b, c) => b.circle(layer, c, b.mm(1.2), { w: 0.35 });

function elecNotes(m: M, f: number) {
  return (b: Builder, P: (x: number, y: number) => Pt) => {
    let y = legend(b, P, [
      [symLight, "ดาวน์ไลท์ LED 9 W ฝังฝ้า"],
      [symSwitch, "สวิตช์ทางเดียว สูง 1.20 ม."],
      [symOutlet, "เต้ารับคู่มีกราวด์ สูง 0.30 ม."],
      [symBox("E-POWR", "WH"), "จุดเครื่องทำน้ำอุ่น"],
      [symBox("E-POWR", "", true), "ตู้ควบคุมไฟฟ้า (DB)"],
      [symLine("E-CIRC"), "สายวงจร (Home run) ในท่อ EMT"],
    ], NOTES.top - 5);
    const cs = m.circuits.filter((c) => c.floor === f);
    const rowH = Math.min(3.2, (y - NOTES.bottom - 4) / (cs.length + 1));
    if (cs.length && rowH > 1.6)
      b.table(P(NOTES.x0, y - 1)[0], P(NOTES.x0, y - 1)[1], [
        { w: 14, head: "วงจร", mono: true },
        { w: 38, head: "รายการ" },
        { w: 22, head: "โหลด W", al: "r", mono: true },
      ], cs.map((c) => [c.breaker, c.name, c.loadW ? c.loadW.toLocaleString() : "—"]), { rowH, textH: Math.min(1.25, rowH * 0.45), l: "TITLE", refs: cs.map((c) => c.breaker) });
    else y = lines(b, P, [`วงจรชั้นนี้ ${cs.length} วงจร ดูตาราง E-001`], y);
  };
}

function plumbNotes(m: M, f: number) {
  return (b: Builder, P: (x: number, y: number) => Pt) => {
    const y = legend(b, P, [
      [symLine("P-WATR", "DASHED"), "ท่อน้ำดี PPR PN20 Ø½\"–1\""],
      [symLine("P-SANR", "HIDDEN"), "ท่อน้ำทิ้ง/โสโครก PVC 8.5"],
      [symCircle("P-SANR"), "ท่อลง/ท่อโสโครกแนวดิ่ง"],
      [symCircle("P-WATR"), "ท่อน้ำดีขึ้นแนวดิ่ง"],
      [symBox("P-FIXT", "WH"), "เครื่องทำน้ำอุ่น"],
    ], NOTES.top - 5);
    const cats = ["สุขภัณฑ์ (ชักโครก)", "อ่างล้างหน้า", "ซิงค์ล้างจาน", "เครื่องทำน้ำอุ่น", ...(f === 1 ? ["ถังเก็บน้ำ", "ปั๊มน้ำอัตโนมัติ", "ถังบำบัดน้ำเสีย"] : [])];
    const rows = cats
      .map((c) => {
        const list = m.assets.filter((a) => a.floor === f && a.category === c);
        return list.length ? [c.replace(" (ชักโครก)", ""), String(list.length), list[0].brand] : null;
      })
      .filter((r): r is string[] => !!r);
    b.table(P(NOTES.x0, y - 1)[0], P(NOTES.x0, y - 1)[1], [
      { w: 26, head: "อุปกรณ์" },
      { w: 10, head: "จำนวน", al: "r", mono: true },
      { w: 38, head: "ยี่ห้อ/รุ่น" },
    ], rows, { rowH: 3.4, textH: 1.2, l: "TITLE" });
  };
}

function hvacNotes(m: M, f: number) {
  return (b: Builder, P: (x: number, y: number) => Pt) => {
    const y = legend(b, P, [
      [symBox("M-HVAC", "AC"), "เครื่องปรับอากาศติดผนัง (FCU)"],
      [symBox("M-HVAC", "CU"), "คอยล์ร้อน (Condensing unit)"],
      [symLine("M-PIPE", "DASHED"), "ท่อน้ำยา หุ้มฉนวน 3/4\""],
    ], NOTES.top - 5);
    const acs = m.assets.filter((a) => a.floor === f && a.category === "เครื่องปรับอากาศติดผนัง (Fan Coil)");
    const rowH = Math.min(3.4, (y - NOTES.bottom - 3) / (acs.length + 1));
    b.table(P(NOTES.x0, y - 1)[0], P(NOTES.x0, y - 1)[1], [
      { w: 14, head: "รหัส", mono: true },
      { w: 30, head: "ห้อง" },
      { w: 16, head: "BTU", al: "r", mono: true },
      { w: 14, head: "kW", al: "r", mono: true },
    ], acs.map((a) => [a.code, m.rooms.find((r) => r.id === a.room)?.name ?? "", (a.btu ?? 0).toLocaleString(), ((a.watts ?? 0) / 1000).toFixed(2)]), { rowH, textH: Math.min(1.25, rowH * 0.42), l: "TITLE", refs: acs.map((a) => a.code) });
  };
}

// ---------- sheet list ----------

function defsFor(m: M): Def[] {
  const { floors, spec, FH } = m;
  const top = floors * FH;
  const F = Array.from({ length: floors }, (_, i) => i + 1);
  const big = spec.type === "condo";
  const planScales = [100, 200, 250];
  const defs: Def[] = [
    { id: "A-001", disc: "A", kind: "site", titleTh: "ผังบริเวณ", titleEn: "Site plan", level: "FFL ชั้น 1 ±0.00 · ถนน -0.30", scales: [200, 250, 500], draw: (b) => sitePlan(b, m), notes: archNotes(m) },
    ...F.map<Def>((f) => ({
      id: `A-10${f}`,
      disc: "A",
      kind: "plan",
      floor: f,
      titleTh: `แปลนพื้นชั้น ${f}`,
      titleEn: `${ORD[f - 1]} floor plan`,
      level: `ชั้น ${f} · FFL ${lvl(fy(m, f))}`,
      scales: planScales,
      draw: (b) => floorPlan(b, m, f, "arch", { section: true }),
      notes: archNotes(m, f),
    })),
    { id: "A-190", disc: "A", kind: "roof", titleTh: "แปลนหลังคา", titleEn: "Roof plan", level: `หลังคา · ${lvl(top)}`, scales: planScales, draw: (b) => roofPlan(b, m), notes: archNotes(m) },
    ...(
      [
        ["A-201", "front", "รูปด้านหน้า", "Front elevation"],
        ["A-202", "rear", "รูปด้านหลัง", "Rear elevation"],
        ["A-203", "left", "รูปด้านซ้าย", "Left elevation"],
        ["A-204", "right", "รูปด้านขวา", "Right elevation"],
      ] as const
    ).map<Def>(([id, side, th, en]) => ({ id, disc: "A", kind: "elev", titleTh: th, titleEn: en, level: `ทุกชั้น · สูงรวม ${(top + (spec.roof === "flat" ? 0.9 : spec.roof === "hip" ? 1.8 : 2.2)).toFixed(2)} ม.`, scales: planScales, draw: (b) => elevation(b, m, side), notes: archNotes(m) })),
    { id: "A-301", disc: "A", kind: "section", titleTh: "รูปตัด A-A", titleEn: "Section A-A", level: `ตัดที่ x = ${sectionX(m).toFixed(2)} ม.`, scales: planScales, draw: (b) => section(b, m, "x", sectionX(m)), notes: archNotes(m) },
  ];
  if (big) {
    const bath = m.rooms.find((r) => r.floor === 2 && r.kind === "bath") ?? m.rooms[0];
    const lift = m.rooms.find((r) => r.floor === 2 && r.kind === "lift") ?? m.rooms[0];
    defs.push(
      { id: "A-302", disc: "A", kind: "section", titleTh: "รูปตัด B-B", titleEn: "Section B-B", level: `ตัดที่ z = ${(m.D / 2).toFixed(2)} ม.`, scales: planScales, draw: (b) => section(b, m, "z", m.D / 2), notes: archNotes(m) },
      {
        id: "A-401",
        disc: "A",
        kind: "detail",
        floor: 2,
        titleTh: `แบบขยาย${bath.name}`,
        titleEn: "Enlarged toilet plan",
        level: `ชั้น 2 · FFL ${lvl(fy(m, 2))}`,
        scales: [50],
        clip: [bath.x0 - 0.8, bath.z0 - 0.8, bath.x1 + 0.8, bath.z1 + 0.8],
        draw: (b) => {
          const rooms = floorPlan(b, m, 2, "arch", { grid: false });
          b.dim("A-DIMS", [bath.x0, bath.z0 - 0.45], [bath.x1, bath.z0 - 0.45], -b.mm(4));
          b.dim("A-DIMS", [bath.x1 + 0.45, bath.z0], [bath.x1 + 0.45, bath.z1], -b.mm(4));
          b.text("A-ANNO", [(bath.x0 + bath.x1) / 2, bath.z1 + 0.35], b.mm(1.6), "พื้นกระเบื้อง 30×30 ซม. ลาดเอียงเข้าท่อระบายน้ำ 1:100", { al: "c" });
          return rooms;
        },
        notes: archNotes(m, 2),
      },
      {
        id: "A-402",
        disc: "A",
        kind: "detail",
        floor: 2,
        titleTh: "แบบขยายห้องลิฟต์และโถงทางเดิน",
        titleEn: "Enlarged lift core plan",
        level: `ชั้น 2 · FFL ${lvl(fy(m, 2))}`,
        scales: [50, 100],
        clip: [lift.x0 - 1.4, lift.z0 - 2.4, lift.x1 + 1.4, lift.z1 + 0.8],
        draw: (b) => {
          const rooms = floorPlan(b, m, 2, "arch", { grid: false });
          b.dim("A-DIMS", [lift.x0, lift.z1 + 0.4], [lift.x1, lift.z1 + 0.4], b.mm(4));
          b.dim("A-DIMS", [lift.x1 + 0.6, lift.z0], [lift.x1 + 0.6, lift.z1], -b.mm(4));
          b.text("A-ANNO", [(lift.x0 + lift.x1) / 2, lift.z0 - 1.6], b.mm(1.6), "ลิฟต์โดยสาร 8 คน 630 กก. ความเร็ว 1.0 ม./วินาที", { al: "c" });
          return rooms;
        },
        notes: archNotes(m, 2),
      },
    );
  }
  defs.push(
    { id: "S-100", disc: "S", kind: "found", titleTh: "แปลนฐานราก", titleEn: "Foundation plan", level: "ฐานราก · ท้องฐาน -0.60", scales: planScales, draw: (b) => foundationPlan(b, m), notes: footingNotes(m) },
    ...F.slice(1).map<Def>((f) => ({ id: `S-10${f}`, disc: "S", kind: "struct", floor: f, titleTh: `แปลนโครงสร้างพื้นชั้น ${f}`, titleEn: `Level ${f} framing plan`, level: `ชั้น ${f} · ${lvl(fy(m, f))}`, scales: planScales, draw: (b) => floorFraming(b, m, f), notes: framingNotes(false) })),
    { id: "S-190", disc: "S", kind: "struct", titleTh: "แปลนโครงสร้างหลังคา", titleEn: "Roof framing plan", level: `หลังคา · ${lvl(top)}`, scales: planScales, draw: (b) => roofFraming(b, m), notes: framingNotes(true) },
    { id: "E-001", disc: "E", kind: "schedule", titleTh: "ตารางโหลดและผังวงจรไฟฟ้า", titleEn: "Load schedule and single-line diagram", level: "ทุกชั้น", scales: [100], nts: true, draw: (b) => loadSchedule(b, m), notes: (b, P) => lines(b, P, ["1. ติดตั้งตามมาตรฐานการติดตั้งทางไฟฟ้า วสท.", "2. วงจรเครื่องทำน้ำอุ่นใช้ RCBO 30 mA", "3. วงจรเต้ารับทุกวงจรต้องมีสายดิน", "4. ระบุรหัส CB- ตรงกับทะเบียนอุปกรณ์", "5. ค่าโหลดเป็นค่าติดตั้ง (Connected load)"]) },
    ...F.map<Def>((f) => ({ id: `E-10${f}`, disc: "E", kind: "elec", floor: f, titleTh: `แบบไฟฟ้าชั้น ${f}`, titleEn: `Level ${f} electrical plan`, level: `ชั้น ${f} · FFL ${lvl(fy(m, f))}`, scales: planScales, draw: (b) => electrical(b, m, f), notes: elecNotes(m, f) })),
    ...F.map<Def>((f) => ({ id: `P-10${f}`, disc: "P", kind: "plumb", floor: f, titleTh: `แบบสุขาภิบาลชั้น ${f}`, titleEn: `Level ${f} plumbing plan`, level: `ชั้น ${f} · FFL ${lvl(fy(m, f))}`, scales: planScales, draw: (b) => plumbing(b, m, f), notes: plumbNotes(m, f) })),
    ...F.map<Def>((f) => ({ id: `M-10${f}`, disc: "M", kind: "hvac", floor: f, titleTh: `แบบปรับอากาศชั้น ${f}`, titleEn: `Level ${f} air-conditioning plan`, level: `ชั้น ${f} · FFL ${lvl(fy(m, f))}`, scales: planScales, draw: (b) => hvac(b, m, f), notes: hvacNotes(m, f) })),
  );
  return defs;
}

// ---------- building ----------

const CW = CA.x1 - CA.x0;
const CH = CA.y1 - CA.y0;

function build(m: M, def: Def, index: number, total: number, n: number): Sheet {
  let b = new Builder(def.scales[0]);
  let rooms: SheetRoom[] = [];
  let bb: BBox = [0, 0, 1, 1];
  for (let i = 0; i < def.scales.length; i++) {
    b = new Builder(def.scales[i]);
    rooms = def.draw(b) || [];
    if (def.clip) {
      b.prims = clipPrims(b.prims, def.clip);
      const [x0, y0, x1, y1] = def.clip;
      b.rect("A-ANNO", x0, y0, x1, y1, { w: 0.18, lt: "PHANTOM" });
    }
    bb = primsBBox(b.prims);
    if (def.nts) break;
    const wmm = ((bb[2] - bb[0]) * 1000) / b.scale;
    const hmm = ((bb[3] - bb[1]) * 1000) / b.scale;
    if (wmm <= CW && hmm <= CH) break;
  }
  const meta: SheetMeta = { id: def.id, index, total, disc: def.disc, kind: def.kind, titleTh: def.titleTh, titleEn: def.titleEn, floor: def.floor, scale: b.scale, nts: def.nts, code: `${m.code}-${def.id}-R2` };
  let dx = 0;
  let dy = 0;
  if (!def.nts) {
    dx = b.mm((CA.x0 + CA.x1) / 2) - (bb[0] + bb[2]) / 2;
    dy = b.mm((CA.y0 + CA.y1) / 2) - (bb[1] + bb[3]) / 2;
    translatePrims(b.prims, dx, dy);
    bb = [bb[0] + dx, bb[1] + dy, bb[2] + dx, bb[3] + dy];
    rooms = rooms.map((r) => ({ ...r, pts: r.pts.map(([x, y]) => [x + dx, y + dy] as Pt) }));
  } else {
    bb = [b.mm(CA.x0), b.mm(CA.y0), b.mm(CA.x1), b.mm(CA.y1)];
  }
  frame(b, m.spec, meta, def.level);
  drawingTitle(b, meta, n);
  if (def.notes) def.notes(b, (x, y) => [b.mm(x), b.mm(y)]);

  const hitMap = new Map<string, BBox>();
  for (const p of b.prims) {
    if (!p.ref) continue;
    const pb = primBBox(p);
    const prev = hitMap.get(p.ref);
    hitMap.set(p.ref, prev ? union(prev, pb) : pb);
  }
  const hits: SheetHit[] = [...hitMap].map(([code, bb2]) => ({ code, bb: bb2 }));
  const layers = [...new Set(b.prims.map((p) => p.l))];
  return {
    ...meta,
    w: b.mm(420),
    h: b.mm(297),
    origin: [dx, dy],
    content: bb,
    prims: b.prims,
    rooms,
    hits,
    layers,
    level: def.level,
  };
}

export type SheetStub = Pick<SheetMeta, "id" | "disc" | "kind" | "titleTh" | "titleEn" | "floor" | "index" | "total"> & { level: string };

const defCache = new Map<string, Def[]>();
function defs(code: string) {
  let d = defCache.get(code);
  if (!d) {
    d = defsFor(getModel(code));
    defCache.set(code, d);
  }
  return d;
}

/** Cheap list of the sheets in a set (no geometry) */
export function sheetIndex(code: string): SheetStub[] {
  const d = defs(code);
  return d.map((s, i) => ({ id: s.id, disc: s.disc, kind: s.kind, titleTh: s.titleTh, titleEn: s.titleEn, floor: s.floor, level: s.level, index: i + 1, total: d.length }));
}

const sheetCache = new Map<string, Sheet>();

export function getSheet(code: string, id: string): Sheet | undefined {
  const key = `${code}/${id}`;
  const hit = sheetCache.get(key);
  if (hit) return hit;
  const d = defs(code);
  const i = d.findIndex((s) => s.id === id);
  if (i < 0) return undefined;
  const s = build(getModel(code), d[i], i + 1, d.length, d.filter((x) => x.disc === d[i].disc).indexOf(d[i]) + 1);
  sheetCache.set(key, s);
  return s;
}

export type DrawingSet = { code: string; model: M; sheets: Sheet[]; layers: string[]; entities: number; ms: number };
const setCache = new Map<string, DrawingSet>();

export function getDrawingSet(code: string): DrawingSet {
  const hit = setCache.get(code);
  if (hit) return hit;
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const model = getModel(code);
  const sheets = defs(code).map((d) => getSheet(code, d.id)!);
  const layers = [...new Set(sheets.flatMap((s) => s.layers))];
  const entities = sheets.reduce((s, sh) => s + sh.prims.length, 0);
  const ms = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
  const set = { code, model, sheets, layers, entities, ms };
  setCache.set(code, set);
  return set;
}

/** Drop caches (used by the CAD REGEN command) */
export function clearDrawingCache(code: string) {
  setCache.delete(code);
  for (const k of [...sheetCache.keys()]) if (k.startsWith(code + "/")) sheetCache.delete(k);
}

