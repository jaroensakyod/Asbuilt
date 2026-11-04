// Procedural scene dressing for the 3D viewer: furniture, ceilings, plot,
// neighbouring village and construction-site gear. Everything is a list of
// boxes so the scene can draw each group as a single instanced mesh.

import { seeded } from "./data";
import type { BuildingModel, Room, Vec3 } from "./house";

export type Item = { pos: Vec3; size: Vec3; color: string; rot?: Vec3; floor?: number; room?: string };

const C = {
  wood: "#a3825f",
  woodDark: "#6e5641",
  fabric: "#8f8a80",
  fabricLight: "#c9c2b5",
  white: "#ecebe6",
  dark: "#4a4540",
  rug: "#cdbfa6",
  steel: "#9aa0a3",
  bedding: "#f1eee8",
};

// ---------- furniture ----------

function furnish(r: Room, FH: number): Item[] {
  const y0 = (r.floor - 1) * FH;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const out: Item[] = [];
  const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string) =>
    out.push({ pos: [x, y0 + y + sy / 2, z], size: [sx, sy, sz], color, floor: r.floor, room: r.id });

  if (w < 1.2 || d < 1.2) return out;

  switch (r.kind) {
    case "bed": {
      const bw = Math.min(w > 3 ? 1.8 : 1.1, w - 0.6);
      const bl = Math.min(2.0, d - 0.8);
      const bz = r.z1 - 0.2 - bl / 2;
      add(cx, 0, bz, bw, 0.32, bl, C.woodDark);
      add(cx, 0.32, bz + 0.05, bw - 0.06, 0.16, bl - 0.12, C.bedding);
      add(cx, 0.48, r.z1 - 0.45, bw - 0.3, 0.1, 0.35, C.white);
      add(cx, 0, r.z1 - 0.24, bw + 0.1, 1.0, 0.08, C.wood);
      if (w > bw + 1.2) {
        add(cx - bw / 2 - 0.35, 0, r.z1 - 0.45, 0.45, 0.5, 0.4, C.wood);
        add(cx + bw / 2 + 0.35, 0, r.z1 - 0.45, 0.45, 0.5, 0.4, C.wood);
      }
      if (d > bl + 1.6) add(r.x0 + Math.min(1, w / 3), 0, r.z0 + 0.4, Math.min(1.8, w / 2), 2.0, 0.6, C.white);
      break;
    }
    case "living":
    case "family":
    case "lobby": {
      const sw = Math.min(2.4, w - 1);
      const sz = cz + Math.min(1.2, d / 4);
      add(cx, 0, cz, Math.min(2.8, w - 0.6), 0.01, Math.min(2, d - 0.6), C.rug);
      add(cx, 0, sz, sw, 0.42, 0.85, C.fabric);
      add(cx, 0.42, sz + 0.34, sw, 0.4, 0.18, C.fabric);
      add(cx - sw / 2 + 0.1, 0.42, sz, 0.2, 0.2, 0.85, C.fabric);
      add(cx + sw / 2 - 0.1, 0.42, sz, 0.2, 0.2, 0.85, C.fabric);
      add(cx, 0, cz - 0.3, Math.min(1.1, sw * 0.5), 0.4, 0.55, C.wood);
      if (r.kind !== "lobby") add(cx, 0, Math.max(r.z0 + 0.35, cz - Math.min(2, d / 2 - 0.4)), Math.min(1.8, w - 1), 0.5, 0.4, C.dark);
      else add(r.x0 + Math.min(1.4, w / 3), 0, r.z1 - 0.8, Math.min(2.4, w / 2), 1.05, 0.6, C.wood);
      break;
    }
    case "dining": {
      const tw = Math.min(1.8, w - 1.4);
      const tl = Math.min(0.9, d - 1.4);
      if (tw < 0.6 || tl < 0.5) break;
      add(cx, 0, cz, tw, 0.75, tl, C.wood);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const x = cx + sx * tw * 0.25;
          const z = cz + sz * (tl / 2 + 0.3);
          add(x, 0, z, 0.44, 0.45, 0.44, C.woodDark);
          add(x, 0.45, z + sz * 0.2, 0.44, 0.45, 0.05, C.woodDark);
        }
      break;
    }
    case "kitchen": {
      const len = Math.min(w - 0.4, 3.2);
      add(r.x0 + 0.2 + len / 2, 0, r.z1 - 0.32, len, 0.9, 0.62, C.white);
      add(r.x0 + 0.2 + len / 2, 0.9, r.z1 - 0.32, len, 0.04, 0.64, C.dark);
      add(r.x0 + 0.2 + len / 2, 1.5, r.z1 - 0.2, len, 0.7, 0.35, C.white);
      add(r.x0 + 0.5, 0, r.z0 + 0.5, 0.7, 1.8, 0.7, C.steel);
      if (d > 3 && w > 3) add(cx, 0, cz, 1.4, 0.9, 0.7, C.wood);
      break;
    }
    case "office": {
      const cols = Math.max(1, Math.min(4, Math.floor((w - 0.6) / 1.8)));
      const rows = Math.max(1, Math.min(3, Math.floor((d - 0.6) / 1.9)));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const x = r.x0 + ((i + 0.5) * w) / cols;
          const z = r.z0 + ((j + 0.5) * d) / rows;
          add(x, 0, z, 1.4, 0.75, 0.7, C.wood);
          add(x, 0, z + 0.65, 0.5, 0.5, 0.5, C.dark);
        }
      break;
    }
    case "store": {
      add(cx, 0, r.z1 - 0.25, Math.min(w - 0.4, 2.4), 1.8, 0.4, C.steel);
      break;
    }
    case "stair": {
      const steps = 16;
      const run = Math.min(d - 0.4, 4.2);
      const sw = Math.min(1.1, w - 0.2);
      const x = r.x0 + 0.1 + sw / 2;
      for (let i = 0; i < steps; i++) {
        const z = r.z1 - 0.2 - (run / steps) * (i + 0.5);
        add(x, (i * FH) / steps, z, sw, FH / steps, run / steps + 0.02, "#cfc8bb");
      }
      break;
    }
  }
  return out;
}

const furnCache = new WeakMap<BuildingModel, Item[]>();
export function furniture(m: BuildingModel): Item[] {
  const hit = furnCache.get(m);
  if (hit) return hit;
  const out = m.rooms.flatMap((r) => furnish(r, m.FH));
  furnCache.set(m, out);
  return out;
}

const ceilCache = new WeakMap<BuildingModel, Item[]>();
export function ceilings(m: BuildingModel): Item[] {
  const hit = ceilCache.get(m);
  if (hit) return hit;
  const out = m.rooms
    .filter((r) => r.kind !== "stair" && r.kind !== "lift")
    .map<Item>((r) => ({
      pos: [(r.x0 + r.x1) / 2, (r.floor - 1) * m.FH + m.FH - 0.32, (r.z0 + r.z1) / 2],
      size: [r.x1 - r.x0 - 0.14, 0.03, r.z1 - r.z0 - 0.14],
      color: "#f3f0ea",
      floor: r.floor,
      room: r.id,
    }));
  ceilCache.set(m, out);
  return out;
}

// ---------- plot ----------

export type Lot = { x0: number; x1: number; z0: number; z1: number; pool?: { x0: number; x1: number; z0: number; z1: number }; parking?: boolean };

export function lotOf(m: BuildingModel): Lot {
  const condo = m.spec.type === "condo";
  const pool = m.spec.code === "HM-07";
  const side = condo ? 5 : m.W < 8 ? 1.6 : 3.4;
  const lot: Lot = { x0: -side, x1: m.W + Math.max(side, 3.4), z0: condo ? -14 : -6.5, z1: m.D + (pool ? 10 : condo ? 5 : 4) };
  if (pool) lot.pool = { x0: 1, x1: m.W - 5, z0: m.D + 3, z1: m.D + 7 };
  if (condo) lot.parking = true;
  return lot;
}

export function buildingHeight(m: BuildingModel) {
  return m.floors * m.FH + (m.spec.roof === "flat" ? 0.9 : m.spec.roof === "hip" ? 1.8 : 2.2);
}

// ---------- village ----------

export type Village = { bodies: Item[]; roofs: Item[]; windows: Item[]; trunks: Item[]; crowns: Item[]; roadZ: number; roadW: number; stripes: Item[]; poles: Item[] };

const villageCache = new WeakMap<BuildingModel, Village>();
export function village(m: BuildingModel): Village {
  const hit = villageCache.get(m);
  if (hit) return hit;
  const lot = lotOf(m);
  const rnd = seeded(m.code.length * 977 + m.W * 13 + m.D);
  const roadW = 8;
  const roadZ = lot.z0 - 1.5 - roadW / 2;
  const bodies: Item[] = [];
  const roofs: Item[] = [];
  const windows: Item[] = [];
  const trunks: Item[] = [];
  const crowns: Item[] = [];
  const walls = ["#eeeae2", "#e9e4da", "#f2efe8", "#e3ddd2", "#ece6dc"];
  const roofC = ["#6b4a3e", "#5a4a3e", "#4b4540", "#7a5546", "#585a5c"];
  const cx = (lot.x0 + lot.x1) / 2;
  const plotW = 17;
  const plotD = 22;
  const keepOut = { x0: lot.x0 - 2, x1: lot.x1 + 2, z0: lot.z0 - 1, z1: lot.z1 + 2 };
  const tree = (x: number, z: number, s = 1) => {
    trunks.push({ pos: [x, 0.9 * s, z], size: [0.22 * s, 1.8 * s, 0.22 * s], color: "#6b5a48" });
    crowns.push({ pos: [x, 2.5 * s, z], size: [2.2 * s, 2.2 * s, 2.2 * s], color: rnd() > 0.5 ? "#7f8f6a" : "#748562" });
  };
  for (let row = -3; row <= 3; row++) {
    // rows in front of the road face it (z < road) and rows behind face it from the other side
    const zc = row < 0 ? roadZ - roadW / 2 - 2 - plotD / 2 + (row + 1) * plotD : lot.z0 + plotD / 2 - 2 + row * plotD;
    for (let col = -4; col <= 4; col++) {
      const xc = cx + col * plotW + (row % 2 ? plotW / 3 : 0);
      if (xc + plotW / 2 > keepOut.x0 && xc - plotW / 2 < keepOut.x1 && zc + plotD / 2 > keepOut.z0 && zc - plotD / 2 < keepOut.z1) continue;
      if (Math.abs(xc - cx) > 70 && rnd() > 0.5) continue;
      if (rnd() < 0.12) {
        tree(xc + (rnd() - 0.5) * 6, zc + (rnd() - 0.5) * 6, 1 + rnd() * 0.4);
        continue;
      }
      const w = 8 + rnd() * 3;
      const d = 7 + rnd() * 2.5;
      const two = rnd() > 0.35;
      const h = two ? 5.8 : 3;
      const y = h / 2;
      const facing = row < 0 ? 1 : -1;
      const zf = zc + facing * 1.5;
      bodies.push({ pos: [xc, y, zf], size: [w, h, d], color: walls[Math.floor(rnd() * walls.length)] });
      const rh = two ? 2.2 : 2;
      roofs.push({ pos: [xc, h + rh / 2, zf], size: [w + 1, rh, d + 1], color: roofC[Math.floor(rnd() * roofC.length)] });
      for (let f = 0; f < (two ? 2 : 1); f++)
        for (const side of [-1, 1]) {
          const wy = f * 2.9 + 1.6;
          for (let k = -1; k <= 1; k += 2) windows.push({ pos: [xc + k * w * 0.25, wy, zf + side * (d / 2 + 0.02)], size: [1.4, 1.2, 0.06], color: "#55625f" });
        }
      if (rnd() > 0.4) tree(xc + (rnd() > 0.5 ? 1 : -1) * (w / 2 + 2), zc - facing * (plotD / 2 - 2.5));
    }
  }
  // trees along the plot edges
  for (const [x, z] of [
    [lot.x0 - 1.2, lot.z1 + 1.2],
    [lot.x1 + 1.4, lot.z1 + 1],
    [lot.x0 - 1.2, (lot.z0 + lot.z1) / 2],
  ])
    tree(x, z, 1.1);
  const stripes: Item[] = [];
  const poles: Item[] = [];
  for (let x = cx - 110; x <= cx + 110; x += 6) stripes.push({ pos: [x, -0.225, roadZ], size: [2.6, 0.02, 0.16], color: "#efece4" });
  for (let x = cx - 96; x <= cx + 96; x += 24) poles.push({ pos: [x, 4, roadZ + roadW / 2 + 0.8], size: [0.18, 8, 0.18], color: "#8b8680" });
  const v = { bodies, roofs, windows, trunks, crowns, roadZ, roadW, stripes, poles };
  villageCache.set(m, v);
  return v;
}

/** fence or hoarding segments around the plot with a gap for the gate at the front */
export function fence(lot: Lot, h: number, t: number, color: string, gate: [number, number]): Item[] {
  const y = h / 2;
  const out: Item[] = [
    { pos: [(lot.x0 + lot.x1) / 2, y, lot.z1], size: [lot.x1 - lot.x0, h, t], color },
    { pos: [lot.x0, y, (lot.z0 + lot.z1) / 2], size: [t, h, lot.z1 - lot.z0], color },
    { pos: [lot.x1, y, (lot.z0 + lot.z1) / 2], size: [t, h, lot.z1 - lot.z0], color },
  ];
  if (gate[0] > lot.x0) out.push({ pos: [(lot.x0 + gate[0]) / 2, y, lot.z0], size: [gate[0] - lot.x0, h, t], color });
  if (gate[1] < lot.x1) out.push({ pos: [(gate[1] + lot.x1) / 2, y, lot.z0], size: [lot.x1 - gate[1], h, t], color });
  return out;
}

export function parkingStripes(m: BuildingModel, lot: Lot): Item[] {
  const out: Item[] = [];
  const rows = [lot.z0 + 1.5, lot.z0 + 7.5];
  for (const z0 of rows)
    for (let x = 0.5; x <= m.W - 0.5; x += 2.5) out.push({ pos: [x, -0.215, z0 + 2.5], size: [0.1, 0.02, 5], color: "#f2efe8" });
  return out;
}

// ---------- construction site ----------

const PIPE = "#a9a59e";
const PLANK = "#a77c4f";
const CRANE = "#c99a2e";

/** Tube-and-coupler scaffolding wrapped around the given floors */
export function scaffold(m: BuildingModel, floors: number[]): Item[] {
  const out: Item[] = [];
  const off = 0.9;
  const x0 = -off;
  const x1 = m.W + off;
  const z0 = -off;
  const z1 = m.D + off;
  const sides: { a: [number, number]; b: [number, number] }[] = [
    { a: [x0, z0], b: [x1, z0] },
    { a: [x1, z0], b: [x1, z1] },
    { a: [x1, z1], b: [x0, z1] },
    { a: [x0, z1], b: [x0, z0] },
  ];
  for (const f of floors) {
    const y0 = (f - 1) * m.FH;
    for (const { a, b } of sides) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 1.8));
      const horiz = a[1] === b[1];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const x = a[0] + (b[0] - a[0]) * k;
        const z = a[1] + (b[1] - a[1]) * k;
        out.push({ pos: [x, y0 + m.FH / 2, z], size: [0.06, m.FH, 0.06], color: PIPE });
        if (i < n && i % 2 === 0) {
          const step = len / n;
          const ang = Math.atan2(m.FH, step);
          const mx = a[0] + (b[0] - a[0]) * ((i + 0.5) / n);
          const mz = a[1] + (b[1] - a[1]) * ((i + 0.5) / n);
          const dl = Math.hypot(step, m.FH);
          out.push({ pos: [mx, y0 + m.FH / 2, mz], size: horiz ? [dl, 0.045, 0.045] : [0.045, 0.045, dl], rot: horiz ? [0, 0, ang] : [ang, 0, 0], color: PIPE });
        }
      }
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      for (const h of [1.0, 2.0]) out.push({ pos: [mx, y0 + h, mz], size: horiz ? [len, 0.05, 0.05] : [0.05, 0.05, len], color: PIPE });
      out.push({ pos: [mx, y0 + 0.04, mz], size: horiz ? [len, 0.05, 0.6] : [0.6, 0.05, len], color: PLANK });
    }
  }
  return out;
}

/** Tower crane beside the building, office container and a mixer */
export function siteGear(m: BuildingModel, lot: Lot, crane: boolean): { boxes: Item[]; drum: Vec3; pile: Vec3 } {
  const out: Item[] = [];
  const condo = m.spec.type === "condo";
  if (crane) {
    const H = buildingHeight(m) + 7;
    const mx = m.W + 2.6;
    const mz = m.D / 2;
    const s = 1.2;
    out.push({ pos: [mx, 0.4, mz], size: [3, 0.8, 3], color: "#b8b0a3" });
    for (const [dx, dz] of [
      [-s / 2, -s / 2],
      [s / 2, -s / 2],
      [s / 2, s / 2],
      [-s / 2, s / 2],
    ])
      out.push({ pos: [mx + dx, H / 2, mz + dz], size: [0.12, H, 0.12], color: CRANE });
    for (let y = 1.6; y < H; y += 1.6) {
      out.push({ pos: [mx, y, mz - s / 2], size: [s, 0.07, 0.07], color: CRANE });
      out.push({ pos: [mx, y, mz + s / 2], size: [s, 0.07, 0.07], color: CRANE });
      out.push({ pos: [mx - s / 2, y, mz], size: [0.07, 0.07, s], color: CRANE });
      out.push({ pos: [mx + s / 2, y, mz], size: [0.07, 0.07, s], color: CRANE });
    }
    const jib = Math.max(14, m.W + 4);
    const counter = Math.min(8, jib * 0.35);
    out.push({ pos: [mx - jib / 2, H + 0.5, mz], size: [jib, 0.8, 0.8], color: CRANE });
    out.push({ pos: [mx + counter / 2, H + 0.5, mz], size: [counter, 0.6, 0.8], color: CRANE });
    out.push({ pos: [mx + counter - 0.8, H - 0.2, mz], size: [1.4, 1.6, 1.4], color: "#8a847a" });
    out.push({ pos: [mx, H + 2.2, mz], size: [0.3, 3, 0.3], color: CRANE });
    out.push({ pos: [mx + 0.9, H - 0.4, mz - 0.9], size: [1.2, 1.2, 1.2], color: "#e8e4dc" });
    const hookX = mx - jib * 0.55;
    const hookTop = H;
    const hookY = Math.max(2, H * 0.45);
    out.push({ pos: [hookX, hookY + (hookTop - hookY) / 2, mz], size: [0.03, hookTop - hookY, 0.03], color: "#3b3631" });
    out.push({ pos: [hookX, hookY - 0.2, mz], size: [0.4, 0.4, 0.4], color: "#3b3631" });
    out.push({ pos: [hookX, H + 0.05, mz], size: [0.9, 0.3, 0.9], color: "#3b3631" });
  }
  const ox = condo ? m.W - 5 : lot.x1 - 3.8;
  const oz = condo ? lot.z0 + 3 : lot.z0 + 1.6;
  out.push({ pos: [ox, 1.3, oz], size: [6, 2.6, 2.4], color: "#e5e1d8" });
  out.push({ pos: [ox, 2.65, oz], size: [6.1, 0.1, 2.5], color: "#8a847a" });
  out.push({ pos: [ox - 1.4, 1.6, oz - 1.22], size: [1.4, 0.9, 0.04], color: "#55625f" });
  out.push({ pos: [ox + 1.6, 1.05, oz - 1.22], size: [0.9, 2.1, 0.04], color: "#6e5641" });
  out.push({ pos: [ox + 3.6, 0.6, oz - 0.2], size: [0.9, 1.2, 0.9], color: "#3e5c7e" });
  const mxr = condo ? 4 : Math.max(1.5, m.W * 0.3);
  const mzr = lot.z0 + 2.4;
  out.push({ pos: [mxr, 0.35, mzr], size: [1.4, 0.7, 0.9], color: "#7a6a58" });
  return { boxes: out, drum: [mxr, 1.15, mzr], pile: [mxr + 2.2, 0, mzr + 0.6] };
}
