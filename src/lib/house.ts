// Procedural building models generated from a room layout per house model.
// Every element and asset carries metadata so it can be selected, scheduled,
// coloured, listed in registries and drawn on 2D plans.
//
// Public API (used by 3D, Blueprint, CAD, systems and registry pages):
//   getModel(code)            → full BuildingModel (cached)
//   modelForProject(project)  → BuildingModel for a project's house model
//   stateAt / progressAt / phaseProgress   → schedule helpers

import { getHouseModel, seeded, type HouseModel, type SystemKey } from "./data";

export type Vec3 = [number, number, number];

export type RoomKind = "living" | "bed" | "bath" | "kitchen" | "dining" | "stair" | "store" | "office" | "corridor" | "lobby" | "lift" | "family";

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  floor: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  score?: number;
  defects?: number;
};

export type Phase = "foundation" | "structure" | "masonry" | "roof" | "mep" | "finish" | "fixture";
export const PHASE_LABEL: Record<Phase, string> = {
  foundation: "งานฐานราก",
  structure: "งานโครงสร้าง",
  masonry: "งานก่ออิฐ",
  roof: "งานหลังคา",
  mep: "งานระบบ (เดินท่อ/สายไฟ)",
  finish: "งานตกแต่ง/ผิว",
  fixture: "ติดตั้งสุขภัณฑ์/อุปกรณ์",
};
const PHASE_WINDOW: Record<Phase, [number, number]> = {
  foundation: [0, 0.12],
  structure: [0.12, 0.38],
  masonry: [0.35, 0.58],
  roof: [0.4, 0.58],
  mep: [0.55, 0.76],
  finish: [0.7, 0.9],
  fixture: [0.85, 1],
};
export const PHASES = Object.keys(PHASE_WINDOW) as Phase[];

export type Material = "concrete" | "wall" | "wallExt" | "glass" | "roof" | "wood" | "frame";

export type Element = {
  id: string;
  kind: "slab" | "column" | "wall" | "glass" | "door" | "roof" | "footing" | "parapet";
  floor: number; // 0 = foundation, floors+1 = roof
  phase: Phase;
  plan: number; // 0..1 point in schedule when it should be finished
  pos: Vec3;
  size: Vec3;
  rot?: Vec3;
  material: Material;
  label: string;
  room?: string;
  code?: string; // asset code for doors/windows
};

export type AssetCategory =
  | "ตู้ควบคุมไฟฟ้า"
  | "เบรกเกอร์ลูกย่อย"
  | "โคมดาวน์ไลท์ LED"
  | "เต้ารับคู่มีกราวด์"
  | "สวิตช์ไฟ"
  | "เครื่องทำน้ำอุ่น"
  | "สุขภัณฑ์ (ชักโครก)"
  | "อ่างล้างหน้า"
  | "ซิงค์ล้างจาน"
  | "ปั๊มน้ำอัตโนมัติ"
  | "ถังเก็บน้ำ"
  | "ถังบำบัดน้ำเสีย"
  | "เครื่องปรับอากาศติดผนัง (Fan Coil)"
  | "คอยล์ร้อน (Condensing Unit)"
  | "ประตู"
  | "หน้าต่าง"
  | "พื้น/กระเบื้อง"
  | "หลังคา/กันซึม";

export type Asset = {
  code: string;
  name: string;
  category: AssetCategory;
  system: SystemKey;
  floor: number;
  room: string; // room id or "ภายนอก"
  pos: Vec3;
  brand: string;
  installed: string;
  warrantyUntil: string;
  circuit?: string;
  shape: "box" | "disc" | "cyl";
  size: Vec3;
  render: boolean; // false for registry-only items (doors, windows, finishes, breakers)
  btu?: number;
  watts?: number;
};

export type Run = { id: string; system: "elec" | "water" | "drain" | "hvac"; circuit?: string; floor: number; points: Vec3[] };

export type Circuit = { id: string; breaker: string; db: string; floor: number; name: string; rating: string; loadW: number };

export type BuildingModel = {
  code: string;
  spec: HouseModel;
  W: number;
  D: number;
  FH: number;
  floors: number;
  rooms: Room[];
  elements: Element[];
  assets: Asset[];
  runs: Run[];
  circuits: Circuit[];
};

const EXT = 0.2;
const INT = 0.12;

// ---------- layouts (fractions of the footprint; z = 0 is the street side) ----------

type T = [string, RoomKind, number, number, number, number];

const L_HOUSE_2F: T[][] = [
  [
    ["ห้องนั่งเล่น", "living", 0, 0.5, 0, 0.556],
    ["ครัว", "kitchen", 0.5, 1, 0, 0.444],
    ["ห้องรับประทานอาหาร", "dining", 0.5, 0.79, 0.444, 1],
    ["ห้องน้ำ 1", "bath", 0.79, 1, 0.444, 0.722],
    ["ห้องเก็บของ", "store", 0.79, 1, 0.722, 1],
    ["โถงบันได", "stair", 0, 0.208, 0.556, 1],
    ["ห้องนอนแขก", "bed", 0.208, 0.5, 0.556, 1],
  ],
  [
    ["ห้องนอนใหญ่", "bed", 0, 0.5, 0, 0.556],
    ["ห้องนอน 2", "bed", 0.5, 0.833, 0, 0.5],
    ["ห้องน้ำ 2", "bath", 0.833, 1, 0, 0.5],
    ["โถงบันได", "stair", 0, 0.208, 0.556, 1],
    ["ห้องนอน 3", "bed", 0.208, 0.542, 0.556, 1],
    ["ห้องน้ำ 3", "bath", 0.542, 0.708, 0.556, 1],
    ["ห้องนั่งเล่นชั้นบน", "family", 0.708, 1, 0.5, 1],
  ],
];

const L_HOUSE_1F: T[][] = [
  [
    ["ห้องนั่งเล่น", "living", 0, 0.4, 0, 0.5],
    ["ครัว", "kitchen", 0.4, 0.7, 0, 0.4],
    ["ห้องน้ำ 1", "bath", 0.7, 0.85, 0, 0.4],
    ["ห้องน้ำ 2", "bath", 0.85, 1, 0, 0.4],
    ["ห้องรับประทานอาหาร", "dining", 0.4, 0.7, 0.4, 1],
    ["ห้องนอนใหญ่", "bed", 0, 0.4, 0.5, 1],
    ["ห้องนอน 2", "bed", 0.7, 1, 0.4, 0.7],
    ["ห้องนอน 3", "bed", 0.7, 1, 0.7, 1],
  ],
];

const L_TOWN: T[][] = [
  [
    ["ห้องนั่งเล่น", "living", 0, 1, 0, 0.45],
    ["ครัว", "kitchen", 0, 0.6, 0.45, 0.8],
    ["ห้องน้ำ 1", "bath", 0.6, 1, 0.45, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["ห้องเก็บของ", "store", 0.45, 1, 0.8, 1],
  ],
  [
    ["ห้องนอน 2", "bed", 0, 1, 0, 0.5],
    ["ห้องน้ำ 2", "bath", 0, 0.5, 0.5, 0.8],
    ["ห้องนอน 3", "bed", 0.5, 1, 0.5, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["โถงชั้น 2", "corridor", 0.45, 1, 0.8, 1],
  ],
  [
    ["ห้องนอนใหญ่", "bed", 0, 1, 0, 0.55],
    ["ห้องน้ำ 3", "bath", 0, 0.5, 0.55, 0.8],
    ["ห้องทำงาน", "office", 0.5, 1, 0.55, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["ห้องซักล้าง", "store", 0.45, 1, 0.8, 1],
  ],
];

const L_OFFICE: T[][] = [
  [
    ["สำนักงานชั้น 1", "office", 0, 1, 0, 0.6],
    ["ห้องน้ำ 1", "bath", 0, 0.5, 0.6, 0.8],
    ["แพนทรี", "kitchen", 0.5, 1, 0.6, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["ห้องเก็บเอกสาร", "store", 0.45, 1, 0.8, 1],
  ],
  [
    ["สำนักงานชั้น 2", "office", 0, 1, 0, 0.6],
    ["ห้องประชุม", "office", 0, 0.6, 0.6, 0.8],
    ["ห้องน้ำ 2", "bath", 0.6, 1, 0.6, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["ห้องเก็บของ", "store", 0.45, 1, 0.8, 1],
  ],
  [
    ["สำนักงานชั้น 3", "office", 0, 1, 0, 0.6],
    ["ห้องผู้บริหาร", "office", 0, 0.6, 0.6, 0.8],
    ["ห้องน้ำ 3", "bath", 0.6, 1, 0.6, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["ห้องเก็บของ", "store", 0.45, 1, 0.8, 1],
  ],
  [
    ["ห้องนอนใหญ่", "bed", 0, 1, 0, 0.5],
    ["ห้องนอน 2", "bed", 0, 0.55, 0.5, 0.8],
    ["ห้องน้ำ 4", "bath", 0.55, 1, 0.5, 0.8],
    ["โถงบันได", "stair", 0, 0.45, 0.8, 1],
    ["ห้องซักล้าง", "store", 0.45, 1, 0.8, 1],
  ],
];

function condoLayout(floors: number): T[][] {
  const out: T[][] = [];
  const ground: T[] = [
    ["ล็อบบี้", "lobby", 0, 0.3, 0, 0.42],
    ["สำนักงานนิติบุคคล", "office", 0.3, 0.5, 0, 0.42],
    ["ห้องฟิตเนส", "living", 0.5, 0.75, 0, 0.42],
    ["ห้องรับพัสดุ", "store", 0.75, 1, 0, 0.42],
    ["บันไดหนีไฟ 1 (ST-1)", "stair", 0, 0.05, 0.42, 0.58],
    ["ทางเดินชั้น 1", "corridor", 0.05, 1, 0.42, 0.58],
    ["ห้องน้ำชาย", "bath", 0, 0.11, 0.58, 1],
    ["ห้องน้ำหญิง", "bath", 0.11, 0.22, 0.58, 1],
    ["ห้องเครื่องไฟฟ้า", "store", 0.22, 0.44, 0.58, 1],
    ["ลิฟต์โดยสาร (8 คน)", "lift", 0.44, 0.56, 0.58, 1],
    ["ห้องขยะ", "store", 0.56, 0.78, 0.58, 1],
    ["ห้องปั๊มน้ำ", "store", 0.78, 1, 0.58, 1],
  ];
  out.push(ground);
  for (let f = 2; f <= floors; f++) {
    const t: T[] = [];
    let n = 1;
    const unit = (x0: number, x1: number, z0: number, z1: number) => {
      const no = `${f}${String(n++).padStart(2, "0")}`;
      const b = 0.08;
      t.push([`ห้องชุด ${no}`, "bed", x0, x1 - b, z0, z1]);
      t.push([`ห้องน้ำ ${no}`, "bath", x1 - b, x1, z0, z1]);
    };
    for (let i = 0; i < 4; i++) unit(i / 4, (i + 1) / 4, 0, 0.42);
    t.push([`บันไดหนีไฟ 1 (ST-1)`, "stair", 0, 0.05, 0.42, 0.58]);
    t.push([`ทางเดินชั้น ${f}`, "corridor", 0.05, 1, 0.42, 0.58]);
    unit(0, 0.22, 0.58, 1);
    unit(0.22, 0.44, 0.58, 1);
    t.push(["ลิฟต์โดยสาร (8 คน)", "lift", 0.44, 0.56, 0.58, 1]);
    unit(0.56, 0.78, 0.58, 1);
    unit(0.78, 1, 0.58, 1);
    out.push(t);
  }
  return out;
}

function layoutFor(m: HouseModel): T[][] {
  if (m.type === "condo") return condoLayout(m.floors);
  if (m.type === "homeoffice") return L_OFFICE.slice(0, m.floors);
  if (m.type === "townhome") return L_TOWN.slice(0, m.floors);
  if (m.floors === 1) return L_HOUSE_1F;
  return L_HOUSE_2F;
}

// ---------- builder ----------

function build(spec: HouseModel): BuildingModel {
  const { W, D, floors } = spec;
  const FH = spec.type === "homeoffice" ? 3.2 : 3;
  const y0 = (f: number) => (f - 1) * FH;
  const rnd = seeded(spec.code.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7));

  // rooms
  const rooms: Room[] = [];
  layoutFor(spec).forEach((fl, fi) => {
    fl.forEach(([name, kind, a, b, c, d], i) => {
      const r: Room = {
        id: `${fi + 1}.${String(i + 1).padStart(2, "0")}`,
        name,
        kind,
        floor: fi + 1,
        x0: +(a * W).toFixed(2),
        x1: +(b * W).toFixed(2),
        z0: +(c * D).toFixed(2),
        z1: +(d * D).toFixed(2),
      };
      const roll = rnd();
      r.score = Math.round(kind === "bath" ? 60 + roll * 38 : kind === "corridor" || kind === "lift" ? 70 + roll * 28 : 78 + roll * 21);
      r.defects = r.score < 80 ? 1 + Math.floor(rnd() * 3) : r.score < 88 ? Math.floor(rnd() * 2) : 0;
      rooms.push(r);
    });
  });

  const elements: Element[] = [];
  const assets: Asset[] = [];
  let n = 0;
  const of = Math.max(1, floors);
  const addEl = (e: Omit<Element, "id" | "plan">, order: number, total: number) => {
    const [a, b] = PHASE_WINDOW[e.phase];
    const plan = a + ((b - a) * Math.min(total, order + 1)) / total;
    elements.push({ ...e, id: `E${++n}`, plan });
  };
  const counters = new Map<string, number>();
  const nextCode = (prefix: string, floor: number) => {
    const k = `${prefix}${floor}`;
    const v = (counters.get(k) ?? 0) + 1;
    counters.set(k, v);
    return `${prefix}-${floor}${String(v).padStart(2, "0")}`;
  };
  const installed = "2025-11-20";
  const addAsset = (a: Omit<Asset, "brand" | "installed" | "warrantyUntil" | "render"> & Partial<Asset>) => {
    assets.push({ brand: "—", installed, warrantyUntil: "2027-11-20", render: true, ...a });
  };

  // grid for columns and footings
  const bays = (len: number) => {
    const k = Math.max(1, Math.ceil(len / 6));
    return Array.from({ length: k + 1 }, (_, i) => +((len * i) / k).toFixed(2));
  };
  const colX = bays(W);
  const colZ = bays(D);
  const nCols = colX.length * colZ.length;

  // footings + ground slab
  let i = 0;
  for (const x of colX)
    for (const z of colZ) addEl({ kind: "footing", floor: 0, phase: "foundation", pos: [x, -0.35, z], size: [1, 0.5, 1], material: "concrete", label: `ฐานราก F${++i}` }, i, nCols + 1);
  addEl({ kind: "slab", floor: 1, phase: "foundation", pos: [W / 2, -0.1, D / 2], size: [W + 0.2, 0.2, D + 0.2], material: "concrete", label: "พื้นชั้น 1" }, nCols, nCols + 1);

  // columns and slabs per floor
  for (let f = 1; f <= floors; f++) {
    let c = 0;
    for (const x of colX)
      for (const z of colZ) {
        c++;
        addEl(
          { kind: "column", floor: f, phase: "structure", pos: [x, y0(f) + FH / 2, z], size: [0.25, FH, 0.25], material: "concrete", label: `เสา C${f}${String(c).padStart(2, "0")}` },
          (f - 1) * (nCols + 1) + c,
          of * (nCols + 1),
        );
      }
    addEl(
      { kind: "slab", floor: f, phase: "structure", pos: [W / 2, y0(f) + FH - 0.1, D / 2], size: [W + 0.2, 0.2, D + 0.2], material: "concrete", label: f === floors ? "พื้นหลังคา" : `พื้นชั้น ${f + 1}` },
      f * (nCols + 1) - 1,
      of * (nCols + 1),
    );
  }

  // exterior walls per room edge with openings (windows / front door)
  const frontRoom = rooms.find((r) => r.floor === 1 && r.z0 === 0);
  rooms.forEach((r, ri) => {
    const edges: { a: Vec3; horiz: boolean; len: number; side: "S" | "N" | "W" | "E" }[] = [];
    if (r.z0 === 0) edges.push({ a: [r.x0, 0, 0], horiz: true, len: r.x1 - r.x0, side: "S" });
    if (r.z1 === D) edges.push({ a: [r.x0, 0, D], horiz: true, len: r.x1 - r.x0, side: "N" });
    if (r.x0 === 0) edges.push({ a: [0, 0, r.z0], horiz: false, len: r.z1 - r.z0, side: "W" });
    if (r.x1 === W) edges.push({ a: [W, 0, r.z0], horiz: false, len: r.z1 - r.z0, side: "E" });
    const fy = y0(r.floor);
    const wallH = FH - 0.2;
    edges.forEach((e, k) => {
      const isDoor = r === frontRoom && e.side === "S";
      const isBath = r.kind === "bath";
      const noOpen = r.kind === "lift" || r.kind === "stair" || r.kind === "store";
      const ow = !noOpen && e.len >= 2.4 ? Math.min(isDoor ? 1.8 : r.kind === "lobby" ? 4 : 2.0, e.len - 1) : isBath && e.len >= 1.6 ? 0.6 : 0;
      const sill = isDoor ? 0 : isBath ? 1.5 : 0.8;
      const head = 2.2;
      const order = (r.floor - 1) * 60 + ri * 3 + k;
      const piece = (s0: number, s1: number, h0: number, h1: number, mat: Material = "wallExt", kind: Element["kind"] = "wall", phase: Phase = "masonry") => {
        if (s1 - s0 < 0.01 || h1 - h0 < 0.01) return;
        const mid = (s0 + s1) / 2;
        const pos: Vec3 = e.horiz ? [e.a[0] + mid, fy + (h0 + h1) / 2, e.a[2]] : [e.a[0], fy + (h0 + h1) / 2, e.a[2] + mid];
        const t = kind === "glass" || kind === "door" ? 0.06 : EXT;
        const size: Vec3 = e.horiz ? [s1 - s0, h1 - h0, t] : [t, h1 - h0, s1 - s0];
        let code: string | undefined;
        if (kind === "glass" || kind === "door") {
          code = nextCode(kind === "door" ? "D" : "W", r.floor);
          addAsset({
            code,
            name: kind === "door" ? `ประตูทางเข้าบานคู่ · ${r.name}` : `${isBath ? "หน้าต่างบานกระทุ้ง" : "หน้าต่างบานเลื่อนอะลูมิเนียม"} · ${r.name}`,
            category: kind === "door" ? "ประตู" : "หน้าต่าง",
            system: "arch",
            floor: r.floor,
            room: r.id,
            pos,
            shape: "box",
            size,
            render: false,
            brand: kind === "door" ? "Leowood" : "TOSTEM",
            warrantyUntil: "2026-11-20",
          });
        }
        addEl(
          {
            kind,
            floor: r.floor,
            phase,
            pos,
            size,
            material: mat,
            room: r.id,
            code,
            label: kind === "glass" ? `หน้าต่าง ${r.name}` : kind === "door" ? "ประตูทางเข้า" : `ผนังภายนอก ${r.name}`,
          },
          order,
          floors * 60 + 20,
        );
      };
      if (!ow) {
        piece(0, e.len, 0, wallH);
        return;
      }
      const c = e.len / 2;
      piece(0, c - ow / 2, 0, wallH);
      piece(c + ow / 2, e.len, 0, wallH);
      piece(c - ow / 2, c + ow / 2, 0, sill);
      piece(c - ow / 2, c + ow / 2, head, wallH);
      piece(c - ow / 2, c + ow / 2, sill, head, isDoor ? "wood" : "glass", isDoor ? "door" : "glass", "finish");
    });
  });

  // interior walls: merge room edges that are not on the perimeter, leave door gaps
  for (let f = 1; f <= floors; f++) {
    const lines = new Map<string, [number, number][]>();
    for (const r of rooms.filter((q) => q.floor === f)) {
      const segs: [string, number, number][] = [];
      if (r.z0 !== 0) segs.push([`h:${r.z0}`, r.x0, r.x1]);
      if (r.z1 !== D) segs.push([`h:${r.z1}`, r.x0, r.x1]);
      if (r.x0 !== 0) segs.push([`v:${r.x0}`, r.z0, r.z1]);
      if (r.x1 !== W) segs.push([`v:${r.x1}`, r.z0, r.z1]);
      for (const [k, a, b] of segs) lines.set(k, [...(lines.get(k) ?? []), [a, b]]);
    }
    let k = 0;
    for (const [key, ivs] of lines) {
      ivs.sort((p, q) => p[0] - q[0]);
      const merged: [number, number][] = [];
      for (const iv of ivs) {
        const last = merged[merged.length - 1];
        if (last && iv[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], iv[1]);
        else merged.push([...iv]);
      }
      const [o, cs] = key.split(":");
      const c = Number(cs);
      const wy = y0(f) + (FH - 0.2) / 2;
      for (const [a, b] of merged) {
        const gapA = a + 0.3;
        const gapB = gapA + 0.9;
        const parts: [number, number][] = b - a > 1.6 ? [[a, gapA], [gapB, b]] : [[a, b]];
        for (const [s0, s1] of parts) {
          const mid = (s0 + s1) / 2;
          addEl(
            { kind: "wall", floor: f, phase: "masonry", pos: o === "h" ? [mid, wy, c] : [c, wy, mid], size: o === "h" ? [s1 - s0, FH - 0.2, INT] : [INT, FH - 0.2, s1 - s0], material: "wall", label: `ผนังภายใน ชั้น ${f}` },
            (f - 1) * 60 + 30 + ++k,
            floors * 60 + 20,
          );
        }
        if (b - a > 1.6) {
          const mid = (gapA + gapB) / 2;
          const hy = y0(f) + 2.2 + (FH - 0.2 - 2.2) / 2;
          const pos: Vec3 = o === "h" ? [mid, hy, c] : [c, hy, mid];
          addEl({ kind: "wall", floor: f, phase: "masonry", pos, size: o === "h" ? [0.9, FH - 0.2 - 2.2, INT] : [INT, FH - 0.2 - 2.2, 0.9], material: "wall", label: `ทับหลังประตู ชั้น ${f}` }, (f - 1) * 60 + 30 + k, floors * 60 + 20);
          // which room does this door serve? the one containing a point just beside the gap
          const probe: [number, number] = o === "h" ? [mid, c + 0.2] : [c + 0.2, mid];
          const room = rooms.find((r) => r.floor === f && probe[0] >= r.x0 && probe[0] <= r.x1 && probe[1] >= r.z0 && probe[1] <= r.z1);
          addAsset({
            code: nextCode("D", f),
            name: `ประตู${room?.kind === "bath" ? " UPVC ห้องน้ำ" : "ไม้เอ็นจิเนียร์"} · ${room?.name ?? `ชั้น ${f}`}`,
            category: "ประตู",
            system: "arch",
            floor: f,
            room: room?.id ?? "",
            pos: o === "h" ? [mid, y0(f) + 1.1, c] : [c, y0(f) + 1.1, mid],
            shape: "box",
            size: o === "h" ? [0.9, 2.2, 0.04] : [0.04, 2.2, 0.9],
            render: false,
            brand: room?.kind === "bath" ? "Polywood" : "Leowood",
            warrantyUntil: "2026-11-20",
          });
        }
      }
    }
  }

  // roof
  const top = floors * FH;
  if (spec.roof === "flat") {
    const ph = 0.9;
    const sides: [Vec3, Vec3][] = [
      [[W / 2, top + ph / 2, 0], [W + 0.2, ph, EXT]],
      [[W / 2, top + ph / 2, D], [W + 0.2, ph, EXT]],
      [[0, top + ph / 2, D / 2], [EXT, ph, D]],
      [[W, top + ph / 2, D / 2], [EXT, ph, D]],
    ];
    sides.forEach(([pos, size], k) => addEl({ kind: "parapet", floor: floors + 1, phase: "roof", pos, size, material: "wallExt", label: "ผนังกันตก (Parapet)" }, k, 5));
  } else {
    const rise = spec.roof === "hip" ? 1.8 : 2.2;
    const over = 0.6;
    const half = D / 2 + over;
    const slope = Math.atan2(rise, half);
    const planeLen = Math.hypot(half, rise);
    const ry = top + rise / 2;
    const len = spec.roof === "hip" ? W + 2 * over - 2 * (rise / Math.tan(slope)) * 0.6 : W + 2 * over;
    addEl({ kind: "roof", floor: floors + 1, phase: "roof", pos: [W / 2, ry, D / 2 - half / 2], size: [len, 0.12, planeLen], rot: [-slope, 0, 0], material: "roof", label: "หลังคาด้านหน้า" }, 1, 5);
    addEl({ kind: "roof", floor: floors + 1, phase: "roof", pos: [W / 2, ry, D / 2 + half / 2], size: [len, 0.12, planeLen], rot: [slope, 0, 0], material: "roof", label: "หลังคาด้านหลัง" }, 2, 5);
    if (spec.roof === "hip") {
      const halfX = Math.min(half, W / 2 + over);
      const s2 = Math.atan2(rise, halfX);
      const pl2 = Math.hypot(halfX, rise);
      addEl({ kind: "roof", floor: floors + 1, phase: "roof", pos: [-over + halfX / 2, ry, D / 2], size: [pl2, 0.12, D + 2 * over - 0.4], rot: [0, 0, s2], material: "roof", label: "หลังคาจั่วปั้นหยา ด้านซ้าย" }, 3, 5);
      addEl({ kind: "roof", floor: floors + 1, phase: "roof", pos: [W + over - halfX / 2, ry, D / 2], size: [pl2, 0.12, D + 2 * over - 0.4], rot: [0, 0, -s2], material: "roof", label: "หลังคาจั่วปั้นหยา ด้านขวา" }, 4, 5);
    }
  }
  // roof registry items
  for (let k = 1; k <= 2; k++)
    addAsset({ code: `RF-${floors + 1}0${k}`, name: k === 1 ? (spec.roof === "flat" ? "งานกันซึมหลังคา คสล." : "กระเบื้องหลังคาคอนกรีต") : "รางน้ำฝนและท่อลง", category: "หลังคา/กันซึม", system: "arch", floor: floors + 1, room: "หลังคา", pos: [W / 2, top + 0.5, D / 2], shape: "box", size: [1, 0.1, 1], render: false, brand: k === 1 ? (spec.roof === "flat" ? "Jorakay" : "SCG") : "SCG", warrantyUntil: "2030-11-20" });

  // floor finish registry per room
  for (const r of rooms) {
    addAsset({
      code: nextCode("FF", r.floor),
      name: `${r.kind === "bath" ? "กระเบื้องเซรามิก 30×30" : r.kind === "bed" ? "พื้นไม้ลามิเนต" : "แกรนิตโต้ 60×60"} · ${r.name}`,
      category: "พื้น/กระเบื้อง",
      system: "arch",
      floor: r.floor,
      room: r.id,
      pos: [(r.x0 + r.x1) / 2, y0(r.floor) + 0.01, (r.z0 + r.z1) / 2],
      shape: "box",
      size: [r.x1 - r.x0, 0.02, r.z1 - r.z0],
      render: false,
      brand: r.kind === "bed" ? "Kronotex" : "COTTO",
    });
  }

  // ---------- MEP ----------
  const circuits: Circuit[] = [];
  const runs: Run[] = [];
  let cb = 0;
  const stairRoom = (f: number) => rooms.find((r) => r.floor === f && r.kind === "stair") ?? rooms.find((r) => r.floor === f)!;
  const multiDB = floors >= 3;
  const dbPos = (f: number): Vec3 => {
    const s = stairRoom(multiDB ? f : 1);
    return [s.x0 + 0.15, y0(multiDB ? f : 1) + 1.5, s.z1 - 0.4];
  };
  const dbCode = (f: number) => (multiDB ? `DB-${f}01` : "DB-101");
  for (let f = 1; f <= (multiDB ? floors : 1); f++) {
    addAsset({ code: dbCode(f), name: multiDB ? `ตู้ไฟย่อยชั้น ${f}` : "ตู้ควบคุมไฟฟ้า (Consumer Unit) 12 ช่อง", category: "ตู้ควบคุมไฟฟ้า", system: "elec", floor: f, room: stairRoom(f).id, pos: dbPos(f), shape: "box", size: [0.1, 0.5, 0.35], brand: "Schneider Square D QO", warrantyUntil: "2028-01-20" });
    if (multiDB && f > 1) runs.push({ id: `RS${f}`, system: "elec", floor: f, points: [dbPos(f - 1), [dbPos(f - 1)[0], y0(f) + 1.5, dbPos(f - 1)[2]]] });
  }
  const newCircuit = (f: number, name: string, rating: string, loadW: number) => {
    const df = multiDB ? f : 1;
    const id = `C${++cb}`;
    const breaker = multiDB ? `CB-${df}${String(cb).padStart(2, "0")}` : `CB-1${String(10 + cb)}`;
    circuits.push({ id, breaker, db: dbCode(df), floor: f, name, rating, loadW });
    addAsset({ code: breaker, name: `เบรกเกอร์ ${rating} · ${name}`, category: "เบรกเกอร์ลูกย่อย", system: "elec", floor: df, room: stairRoom(df).id, pos: dbPos(df), shape: "box", size: [0.02, 0.08, 0.02], render: false, brand: "Schneider", circuit: id, warrantyUntil: "2028-01-20" });
    return id;
  };
  const ceil = (f: number) => y0(f) + FH - 0.35;
  const wire = (a: Asset) => {
    const db = dbPos(multiDB ? a.floor : 1);
    const h = ceil(a.floor);
    const pts: Vec3[] = [db, [db[0], h, db[2]], [a.pos[0], h, db[2]], [a.pos[0], h, a.pos[2]], a.pos];
    runs.push({ id: `R${runs.length + 1}`, system: "elec", circuit: a.circuit, floor: a.floor, points: pts });
  };

  // outside equipment (back right corner)
  const tk: Vec3 = [W + 1.6, 0.8, D - 1.8];
  const pu: Vec3 = [W + 1, 0.3, D - 0.6];
  const st: Vec3 = [W - 1.5, -0.5, D + 1.6];
  addAsset({ code: "TK-001", name: spec.type === "condo" ? "ถังเก็บน้ำ 10,000 ลิตร" : "ถังเก็บน้ำ 2,000 ลิตร", category: "ถังเก็บน้ำ", system: "plumb", floor: 1, room: "ภายนอก", pos: tk, shape: "cyl", size: [0.65, 1.6, 0.65], brand: "Safe", warrantyUntil: "2035-01-20" });
  addAsset({ code: "PU-001", name: spec.type === "condo" ? "ปั๊มน้ำเพิ่มแรงดัน (Booster) 2 ตัว" : "ปั๊มน้ำอัตโนมัติ 250 W", category: "ปั๊มน้ำอัตโนมัติ", system: "plumb", floor: 1, room: "ภายนอก", pos: pu, shape: "box", size: [0.4, 0.4, 0.3], brand: "Mitsubishi WP-255R", warrantyUntil: "2029-01-20", watts: 250 });
  addAsset({ code: "ST-001", name: "ถังบำบัดน้ำเสีย 1,600 ลิตร", category: "ถังบำบัดน้ำเสีย", system: "plumb", floor: 1, room: "ภายนอก", pos: st, shape: "cyl", size: [0.6, 1, 0.6], brand: "DOS", warrantyUntil: "2036-01-20" });
  const entry: Vec3 = [W - 0.3, 0.2, D - 0.6];
  runs.push({ id: "W0", system: "water", floor: 1, points: [tk, [tk[0], 0.2, tk[2]], [pu[0], 0.2, pu[2]], entry] });
  const pumpCircuit = newCircuit(1, "ปั๊มน้ำ", "MCB 1P 16A", 250);
  assets.find((a) => a.code === "PU-001")!.circuit = pumpCircuit;

  const water = (a: Asset) => runs.push({ id: `W${runs.length}`, system: "water", floor: a.floor, points: [entry, [entry[0], 0.2, a.pos[2]], [a.pos[0], 0.2, a.pos[2]], [a.pos[0], a.pos[1], a.pos[2]]] });
  const drain = (a: Asset) =>
    runs.push({ id: `D${runs.length}`, system: "drain", floor: a.floor, points: [[a.pos[0], a.pos[1] - 0.1, a.pos[2]], [a.pos[0], -0.4, a.pos[2]], [a.pos[0], -0.4, D + 1.6], [st[0], -0.4, D + 1.6]] });

  for (let f = 1; f <= floors; f++) {
    const fr = rooms.filter((r) => r.floor === f);
    const lightC = newCircuit(f, `แสงสว่าง ชั้น ${f}`, "MCB 1P 10A", 0);
    const outC = newCircuit(f, `เต้ารับ ชั้น ${f}`, "MCB 1P 16A", 0);
    for (const r of fr) {
      const area = (r.x1 - r.x0) * (r.z1 - r.z0);
      const cx = (r.x0 + r.x1) / 2;
      const cz = (r.z0 + r.z1) / 2;
      // lights: one per ~12 m²
      const nl = Math.max(1, Math.min(6, Math.round(area / 12)));
      for (let k = 0; k < nl; k++) {
        const lx = r.x0 + ((r.x1 - r.x0) * (k + 1)) / (nl + 1);
        const a: Asset = { code: nextCode("LT", f), name: `ดาวน์ไลท์ LED 9 W · ${r.name}`, category: "โคมดาวน์ไลท์ LED", system: "elec", floor: f, room: r.id, pos: [lx, y0(f) + FH - 0.22, cz], shape: "disc", size: [0.12, 0.03, 0.12], brand: "Philips", installed, warrantyUntil: "2027-11-20", circuit: lightC, render: true, watts: 9 };
        assets.push(a);
        wire(a);
      }
      if (r.kind !== "lift" && r.kind !== "corridor" && r.kind !== "stair") {
        assets.push({ code: nextCode("SW", f), name: `สวิตช์ทางเดียว · ${r.name}`, category: "สวิตช์ไฟ", system: "elec", floor: f, room: r.id, pos: [r.x0 + 0.5, y0(f) + 1.2, r.z0 + 0.08], shape: "box", size: [0.08, 0.12, 0.02], brand: "Panasonic Wide", installed, warrantyUntil: "2027-11-20", circuit: lightC, render: false });
      }
      if (["living", "bed", "office", "kitchen", "dining", "family", "lobby"].includes(r.kind)) {
        const no = r.kind === "kitchen" || r.kind === "office" ? 2 : 1;
        for (let k = 0; k < no; k++) {
          const a: Asset = { code: nextCode("OU", f), name: `เต้ารับคู่มีกราวด์ · ${r.name}`, category: "เต้ารับคู่มีกราวด์", system: "elec", floor: f, room: r.id, pos: [r.x0 + 0.12, y0(f) + 0.35, r.z0 + ((r.z1 - r.z0) * (k + 1)) / (no + 1)], shape: "box", size: [0.04, 0.1, 0.12], brand: "Panasonic Wide", installed, warrantyUntil: "2027-11-20", circuit: outC, render: true, watts: 400 };
          assets.push(a);
          wire(a);
        }
      }
      if (r.kind === "bath") {
        const wc: Asset = { code: nextCode("WC", f), name: "สุขภัณฑ์ชิ้นเดียว (ชักโครก)", category: "สุขภัณฑ์ (ชักโครก)", system: "plumb", floor: f, room: r.id, pos: [r.x1 - 0.35, y0(f) + 0.35, r.z0 + 0.5], shape: "box", size: [0.4, 0.7, 0.65], brand: "COTTO C10507", installed, warrantyUntil: "2028-01-20", render: true };
        const lv: Asset = { code: nextCode("LV", f), name: "อ่างล้างหน้าแบบวางบนเคาน์เตอร์", category: "อ่างล้างหน้า", system: "plumb", floor: f, room: r.id, pos: [r.x0 + 0.35, y0(f) + 0.85, r.z1 - 0.5], shape: "box", size: [0.5, 0.15, 0.4], brand: "American Standard", installed, warrantyUntil: "2027-01-20", render: true };
        assets.push(wc, lv);
        water(wc);
        water(lv);
        drain(wc);
        drain(lv);
        if (spec.type !== "condo" || f > 1) {
          const whC = newCircuit(f, `เครื่องทำน้ำอุ่น ${r.name}`, "RCBO 1P 32A 30mA", 4500);
          const wh: Asset = { code: nextCode("WH", f), name: "เครื่องทำน้ำอุ่น 4,500 W", category: "เครื่องทำน้ำอุ่น", system: "elec", floor: f, room: r.id, pos: [r.x1 - 0.1, y0(f) + 1.6, (r.z0 + r.z1) / 2], shape: "box", size: [0.08, 0.4, 0.25], brand: "Stiebel Eltron DS 45 E", installed, warrantyUntil: "2027-01-20", circuit: whC, render: true, watts: 4500 };
          assets.push(wh);
          wire(wh);
          water(wh);
        }
      }
      if (r.kind === "kitchen") {
        const sk: Asset = { code: nextCode("SK", f), name: "ซิงค์ล้างจาน 1 หลุม พร้อมก๊อก", category: "ซิงค์ล้างจาน", system: "plumb", floor: f, room: r.id, pos: [r.x1 - 0.4, y0(f) + 0.9, cz], shape: "box", size: [0.5, 0.2, 0.8], brand: "Teka", installed, warrantyUntil: "2027-01-20", render: true };
        assets.push(sk);
        water(sk);
        drain(sk);
      }
      if (["bed", "office", "living", "lobby"].includes(r.kind) && !(spec.type !== "condo" && r.kind === "office" && area < 8)) {
        const btu = area > 30 ? 24000 : area > 18 ? 18000 : 12000;
        const watts = btu === 24000 ? 2200 : btu === 18000 ? 1650 : 1150;
        const acC = newCircuit(f, `แอร์ ${r.name}`, "MCB 1P 20A", watts);
        // mount on an exterior wall if the room has one
        const onS = r.z0 === 0;
        const onN = r.z1 === D;
        const onW = r.x0 === 0;
        const onE = r.x1 === W;
        let pos: Vec3;
        let size: Vec3;
        let out: Vec3;
        const ay = y0(f) + 2.3;
        if (onS) [pos, size, out] = [[cx, ay, 0.2], [0.9, 0.3, 0.22], [cx, ay, -0.25]];
        else if (onN) [pos, size, out] = [[cx, ay, D - 0.2], [0.9, 0.3, 0.22], [cx, ay, D + 0.25]];
        else if (onW) [pos, size, out] = [[0.2, ay, cz], [0.22, 0.3, 0.9], [-0.25, ay, cz]];
        else if (onE) [pos, size, out] = [[W - 0.2, ay, cz], [0.22, 0.3, 0.9], [W + 0.25, ay, cz]];
        else [pos, size, out] = [[cx, ay, r.z0 + 0.2], [0.9, 0.3, 0.22], [cx, ay, -0.25]];
        const code = nextCode("AC", f);
        const ac: Asset = { code, name: `แอร์ติดผนัง ${btu.toLocaleString()} BTU`, category: "เครื่องปรับอากาศติดผนัง (Fan Coil)", system: "hvac", floor: f, room: r.id, pos, shape: "box", size, brand: btu >= 18000 ? "Daikin FTKQ18" : "Daikin FTKQ12", installed, warrantyUntil: "2027-01-20", circuit: acC, render: true, btu, watts };
        assets.push(ac);
        wire(ac);
        const ground = spec.type === "house" || spec.type === "townhome";
        const cuY = ground ? 0.35 : y0(f) + 0.35;
        const cuPos: Vec3 = [out[0] + (out[0] < 0 ? -0.35 : out[0] > W ? 0.35 : 0), cuY, out[2] + (out[2] < 0 ? -0.35 : out[2] > D ? 0.35 : 0)];
        const cuSize: Vec3 = Math.abs(out[2]) < 0.01 || out[2] < 0 || out[2] > D ? [0.8, 0.6, 0.3] : [0.3, 0.6, 0.8];
        assets.push({ code: code.replace("AC", "CU"), name: `คอยล์ร้อน ${btu.toLocaleString()} BTU`, category: "คอยล์ร้อน (Condensing Unit)", system: "hvac", floor: ground ? 1 : f, room: "ภายนอก", pos: cuPos, shape: "box", size: cuSize, brand: btu >= 18000 ? "Daikin RKQ18" : "Daikin RKQ12", installed, warrantyUntil: "2030-01-20", render: true, btu });
        runs.push({ id: `A${runs.length}`, system: "hvac", floor: f, points: [pos, out, [out[0], cuY + 0.25, out[2]], [cuPos[0], cuY + 0.25, cuPos[2]]] });
      }
    }
    // sum loads on lighting/outlet circuits
    const lc = circuits.find((c) => c.id === lightC)!;
    lc.loadW = assets.filter((a) => a.circuit === lightC).reduce((s, a) => s + (a.watts ?? 0), 0);
    const oc = circuits.find((c) => c.id === outC)!;
    oc.loadW = assets.filter((a) => a.circuit === outC).reduce((s, a) => s + (a.watts ?? 0), 0);
  }

  return { code: spec.code, spec, W, D, FH, floors, rooms, elements, assets, runs, circuits };
}

const cache = new Map<string, BuildingModel>();

export function getModel(code: string): BuildingModel {
  const hit = cache.get(code);
  if (hit) return hit;
  const spec = getHouseModel(code) ?? getHouseModel("HM-17")!;
  const m = build(spec);
  cache.set(code, m);
  return m;
}

export function modelForProject(p: { modelCode: string }) {
  return getModel(p.modelCode);
}

export const roomOf = (m: BuildingModel, id: string) => m.rooms.find((r) => r.id === id);
export const assetOf = (m: BuildingModel, code: string) => m.assets.find((a) => a.code === code);

// ---------- schedule helpers ----------

export type BuildState = "built" | "late" | "future";

/** t and today are 0..1 fractions of the project schedule, lagToday is how far actual trails plan at today */
export function stateAt(plan: number, t: number, today: number, lagToday: number): BuildState {
  const tt = Math.min(t, today);
  const lag = today > 0 ? (lagToday * tt) / today : 0;
  if (plan <= tt - lag) return "built";
  if (plan <= t) return "late";
  return "future";
}

export function progressAt(t: number, today: number, lagToday: number, els: Element[] = legacy.elements) {
  let built = 0;
  let planned = 0;
  for (const e of els) {
    if (e.plan <= t) planned++;
    if (stateAt(e.plan, t, today, lagToday) === "built") built++;
  }
  return { actual: (built / els.length) * 100, plan: (planned / els.length) * 100, built, planned, total: els.length };
}

export function phaseProgress(t: number, today: number, lagToday: number, els: Element[] = legacy.elements) {
  return PHASES.map((p) => {
    const list = els.filter((e) => e.phase === p);
    const built = list.filter((e) => stateAt(e.plan, t, today, lagToday) === "built").length;
    const planned = list.filter((e) => e.plan <= t).length;
    return { phase: p, actual: list.length ? (built / list.length) * 100 : 0, plan: list.length ? (planned / list.length) * 100 : 0 };
  });
}

// ---------- legacy exports (HM-17) kept for older call sites ----------

const legacy = getModel("HM-17");
export const W = legacy.W;
export const D = legacy.D;
export const FH = legacy.FH;
export const rooms = legacy.rooms;
export const elements = legacy.elements;
export const assets = legacy.assets;
export const runs = legacy.runs;
export const circuits = legacy.circuits;
export const roomById = (id: string) => roomOf(legacy, id);
export const assetByCode = (code: string) => assetOf(legacy, code);
