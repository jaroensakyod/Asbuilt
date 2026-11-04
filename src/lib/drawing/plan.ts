// Floor plans and the systems drawn over them (electrical, plumbing, HVAC).
// Local coordinates: x = model x, y = model z (z = 0 is the street, at the bottom).

import type { Asset, BuildingModel, Room } from "../house";
import type { Builder } from "./builder";
import { textWidth } from "./geom";
import type { Pt, SheetRoom } from "./types";

export type M = BuildingModel;
export const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const fy = (m: M, f: number) => (f - 1) * m.FH;
export const lvl = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
const uniq = (a: number[]) => [...new Set(a.map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
export const gridX = (m: M) => uniq(m.elements.filter((e) => e.kind === "column" && e.floor === 1).map((e) => e.pos[0]));
export const gridZ = (m: M) => uniq(m.elements.filter((e) => e.kind === "column" && e.floor === 1).map((e) => e.pos[2]));
export const sectionX = (m: M) => Math.round(m.W * 36) / 100;

/** Grid lines, bubbles and dimension strings around the footprint */
export function grid(b: Builder, m: M, o: { dims?: "full" | "overall" | "none"; bubbles?: boolean } = {}) {
  const xs = gridX(m);
  const zs = gridZ(m);
  const { W, D } = m;
  const e = b.mm(17);
  const r = b.mm(3.2);
  xs.forEach((x, i) => {
    b.line("S-GRID", [x, -e], [x, D + e], { lt: "CENTER" });
    if (o.bubbles !== false) {
      b.bubble("S-GRID", [x, -e - r], String(i + 1));
      b.bubble("S-GRID", [x, D + e + r], String(i + 1));
    }
  });
  zs.forEach((z, j) => {
    b.line("S-GRID", [-e, z], [W + e, z], { lt: "CENTER" });
    if (o.bubbles !== false) {
      b.bubble("S-GRID", [-e - r, z], LETTERS[j]);
      b.bubble("S-GRID", [W + e + r, z], LETTERS[j]);
    }
  });
  const mode = o.dims ?? "full";
  if (mode === "none") return;
  const g = 0.1 + b.mm(2);
  const t1 = b.mm(5);
  const t2 = b.mm(10);
  if (mode === "full") {
    for (let i = 0; i + 1 < xs.length; i++) {
      b.dim("A-DIMS", [xs[i], -g], [xs[i + 1], -g], -t1);
      b.dim("A-DIMS", [xs[i], D + g], [xs[i + 1], D + g], t1);
    }
    for (let j = 0; j + 1 < zs.length; j++) {
      b.dim("A-DIMS", [-g, zs[j]], [-g, zs[j + 1]], t1);
      b.dim("A-DIMS", [W + g, zs[j]], [W + g, zs[j + 1]], -t1);
    }
  }
  b.dim("A-DIMS", [0, -g], [W, -g], mode === "full" ? -t2 : -t1);
  b.dim("A-DIMS", [-g, 0], [-g, D], mode === "full" ? t2 : t1);
}

function roomLabel(b: Builder, r: Room, area: boolean, scale = 1) {
  const rw = r.x1 - r.x0;
  const rh = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  let h = b.mm(2) * scale;
  let rot = 0;
  if (textWidth(r.name, h) > rw - 0.25 && rh > rw) rot = 90;
  const avail = (rot ? rh : rw) - 0.25;
  const tw = textWidth(r.name, h);
  if (tw > avail) h = Math.max(b.mm(1.1), (h * avail) / tw);
  const a = (rw * rh).toFixed(2);
  if (rot) {
    b.text("A-ANNO", [cx - h * 0.2, cz], h, r.name, { al: "c", va: "m", rot: 90 });
    if (area) b.text("A-ANNO", [cx + h * 1.15, cz], h * 0.72, `${a} ตร.ม.`, { al: "c", va: "m", rot: 90, mono: true });
  } else {
    b.text("A-ANNO", [cx, cz + h * 0.35], h, r.name, { al: "c" });
    if (area) b.text("A-ANNO", [cx, cz - h * 0.95], h * 0.72, `${a} ตร.ม.`, { al: "c", mono: true });
  }
}

function stairs(b: Builder, r: Room) {
  const rw = r.x1 - r.x0;
  const rh = r.z1 - r.z0;
  const alongZ = rh >= rw;
  const L = alongZ ? rh : rw;
  const Wd = alongZ ? rw : rh;
  // local (s along run, t across) → plan
  const P = (s: number, t: number): Pt => (alongZ ? [r.x0 + t, r.z0 + s] : [r.x0 + s, r.z0 + t]);
  const s0 = 0.25;
  const s1 = Math.max(s0 + 0.5, L - Math.min(1.1, L * 0.3));
  const mid = Wd / 2;
  for (let s = s0; s <= s1 + 1e-6; s += 0.26) {
    b.line("A-STRS", P(s, 0.08), P(s, mid - 0.04));
    b.line("A-STRS", P(s, mid + 0.04), P(s, Wd - 0.08));
  }
  b.line("A-STRS", P(s0, mid), P(s1, mid), { w: 0.25 });
  // walk line with arrow
  const q = mid / 2;
  b.pline("A-STRS", [P(s0 + 0.1, q), P(s1 + 0.25, q), P(s1 + 0.25, mid + q), P(s0 + 0.1, mid + q)], false, { w: 0.13 });
  const a = P(s0 + 0.1, mid + q);
  const ah = 0.12;
  b.pline("A-STRS", [alongZ ? [a[0] - ah, a[1] + ah * 1.6] : [a[0] + ah * 1.6, a[1] - ah], a, alongZ ? [a[0] + ah, a[1] + ah * 1.6] : [a[0] + ah * 1.6, a[1] + ah]], false, { w: 0.13 });
  // break line across the first flight
  const bs = (s0 + s1) / 2;
  b.pline("A-STRS", [P(bs - 0.3, 0.05), P(bs, mid * 0.45), P(bs - 0.12, mid * 0.6), P(bs + 0.2, mid - 0.05)], false, { w: 0.18 });
  b.text("A-ANNO", P(s0 + 0.15, q + 0.12), b.mm(1.3), "ขึ้น", { al: "l", rot: alongZ ? 90 : 0 });
}

function lift(b: Builder, r: Room) {
  const i = 0.25;
  b.rect("A-STRS", r.x0 + i, r.z0 + i, r.x1 - i, r.z1 - i, { w: 0.25 });
  b.line("A-STRS", [r.x0 + i, r.z0 + i], [r.x1 - i, r.z1 - i]);
  b.line("A-STRS", [r.x1 - i, r.z0 + i], [r.x0 + i, r.z1 - i]);
}

/** Sanitary fixtures drawn from the asset positions */
export function fixtures(b: Builder, m: M, f: number, layer: string, refs: boolean, heater = false) {
  for (const a of m.assets.filter((q) => q.floor === f)) {
    const [px, , pz] = a.pos;
    const ref = refs ? a.code : undefined;
    const r = m.rooms.find((q) => q.id === a.room);
    if (a.category === "สุขภัณฑ์ (ชักโครก)") {
      b.rect(layer, px + 0.12, pz - 0.22, px + 0.29, pz + 0.22, { ref });
      b.ellipse(layer, [px - 0.08, pz], 0.24, 0.18, { ref });
    } else if (a.category === "อ่างล้างหน้า") {
      b.rect(layer, px - 0.29, pz - 0.36, px + 0.25, pz + 0.36, { ref });
      b.ellipse(layer, [px - 0.02, pz], 0.16, 0.22, { ref });
    } else if (a.category === "ซิงค์ล้างจาน" && r) {
      b.rect(layer, r.x1 - 0.66, r.z0 + 0.1, r.x1 - 0.06, r.z1 - 0.1, { w: 0.18 });
      b.rect(layer, px - 0.2, pz - 0.36, px + 0.2, pz + 0.36, { ref });
      b.rect(layer, px - 0.16, pz - 0.32, px + 0.16, pz + 0.32, { ref, w: 0.13 });
      b.circle(layer, [px, pz], 0.035, { ref });
    } else if (heater && a.category === "เครื่องทำน้ำอุ่น") {
      b.rect(layer, px - 0.2, pz - 0.15, px + 0.04, pz + 0.15, { ref });
      b.text(layer, [px - 0.08, pz], b.mm(1.1), "WH", { al: "c", va: "m", mono: true, ref });
    }
  }
}

export type PlanMode = "arch" | "bg" | "struct";

/** Floor plan at cut height 1.20 m. Returns room outlines for area queries. */
export function floorPlan(b: Builder, m: M, f: number, mode: PlanMode, o: { grid?: boolean; section?: boolean } = {}): SheetRoom[] {
  const { W, D } = m;
  const cut = fy(m, f) + 1.2;
  const arch = mode === "arch";
  const fade = mode === "bg" ? 0.42 : undefined;
  b.fade = fade;

  // walls
  for (const e of m.elements) {
    if (e.floor !== f || e.kind !== "wall") continue;
    const yb = e.pos[1] - e.size[1] / 2;
    const yt = e.pos[1] + e.size[1] / 2;
    if (yb > cut || yt < cut) continue;
    const x0 = e.pos[0] - e.size[0] / 2;
    const x1 = e.pos[0] + e.size[0] / 2;
    const z0 = e.pos[2] - e.size[2] / 2;
    const z1 = e.pos[2] + e.size[2] / 2;
    const ext = e.material === "wallExt";
    b.rect("A-WALL", x0, z0, x1, z1, { w: mode === "bg" ? 0.25 : ext ? 0.5 : 0.35 });
    if (mode !== "bg") b.hatchRect("A-WALL", x0, z0, x1, z1, mode === "struct" ? "lines" : "solid", { sp: 0.06, o: mode === "struct" ? undefined : ext ? 0.55 : 0.35 });
  }
  // columns
  b.fade = mode === "bg" ? 0.55 : undefined;
  for (const e of m.elements) {
    if (e.floor !== f || e.kind !== "column") continue;
    const h = e.size[0] / 2;
    b.rect("S-COLS", e.pos[0] - h, e.pos[2] - h, e.pos[0] + h, e.pos[2] + h, { w: 0.35 });
    b.hatchRect("S-COLS", e.pos[0] - h, e.pos[2] - h, e.pos[0] + h, e.pos[2] + h, "solid");
  }
  b.fade = fade;

  // windows and front door
  for (const e of m.elements) {
    if (e.floor !== f || (e.kind !== "glass" && e.kind !== "door")) continue;
    const horiz = e.size[0] >= e.size[2];
    const c = horiz ? e.pos[2] : e.pos[0];
    const a0 = (horiz ? e.pos[0] : e.pos[2]) - (horiz ? e.size[0] : e.size[2]) / 2;
    const a1 = a0 + (horiz ? e.size[0] : e.size[2]);
    const P = (s: number, t: number): Pt => (horiz ? [s, c + t] : [c + t, s]);
    const ref = e.code;
    const t = 0.1;
    if (e.kind === "glass") {
      b.line("A-GLAZ", P(a0, -t), P(a1, -t), { ref, w: 0.18 });
      b.line("A-GLAZ", P(a0, t), P(a1, t), { ref, w: 0.18 });
      b.line("A-GLAZ", P(a0, -0.025), P(a1, -0.025), { ref });
      b.line("A-GLAZ", P(a0, 0.025), P(a1, 0.025), { ref });
      b.line("A-GLAZ", P(a0, -t), P(a0, t), { ref });
      b.line("A-GLAZ", P(a1, -t), P(a1, t), { ref });
    } else {
      const inward = c < 0.05 ? 1 : -1;
      b.line("A-DOOR", P(a0, -t), P(a0, t), { ref });
      b.line("A-DOOR", P(a1, -t), P(a1, t), { ref });
      const half = (a1 - a0) / 2;
      const dirIn: Pt = horiz ? [0, inward] : [inward, 0];
      b.door(P(a0, t * inward), horiz ? [1, 0] : [0, 1], dirIn, half, ref);
      b.door(P(a1, t * inward), horiz ? [-1, 0] : [0, -1], dirIn, half, ref);
    }
    if (arch && ref) {
      const out = c < 0.05 ? -1 : 1;
      const tp = P((a0 + a1) / 2, out * (b.mm(3.2) + 0.1));
      b.text("A-ANNO", tp, b.mm(1.45), ref, { al: "c", va: "m", mono: true, rot: horiz ? 0 : 90, ref });
    }
  }

  // interior doors
  for (const a of m.assets) {
    if (a.floor !== f || a.category !== "ประตู" || a.name.startsWith("ประตูทางเข้า")) continue;
    const horiz = a.size[0] > a.size[2];
    const mid = horiz ? a.pos[0] : a.pos[2];
    const c = horiz ? a.pos[2] : a.pos[0];
    const hinge: Pt = horiz ? [mid - 0.45, c + 0.06] : [c + 0.06, mid - 0.45];
    b.door(hinge, horiz ? [1, 0] : [0, 1], horiz ? [0, 1] : [1, 0], 0.9, a.code);
    if (arch) {
      const tp: Pt = horiz ? [mid + 0.2, c + 0.42] : [c + 0.42, mid + 0.2];
      b.text("A-ANNO", tp, b.mm(1.25), a.code, { al: "c", va: "m", mono: true, ref: a.code });
    }
  }

  // stairs, lifts, fixtures
  const rooms = m.rooms.filter((r) => r.floor === f);
  if (mode !== "struct") {
    for (const r of rooms) {
      if (r.kind === "stair") stairs(b, r);
      if (r.kind === "lift") lift(b, r);
    }
    if (arch) fixtures(b, m, f, "A-FIXT", true);
  }

  // room names
  if (mode !== "struct") {
    b.fade = mode === "bg" ? 0.6 : undefined;
    for (const r of rooms) roomLabel(b, r, arch, mode === "bg" ? 0.8 : 1);
    b.fade = undefined;
  }
  b.fade = undefined;

  if (arch) {
    const lr = rooms.find((r) => r.kind === "living" || r.kind === "lobby" || r.kind === "office") ?? rooms[0];
    if (lr) b.text("A-ANNO", [lr.x0 + 0.35, lr.z0 + 0.45], b.mm(1.4), `FFL ${lvl(fy(m, f))}`, { mono: true });
  }

  if (o.grid !== false) grid(b, m, { dims: mode === "bg" ? "overall" : "full" });

  if (o.section && arch) {
    const sx = sectionX(m);
    const e = b.mm(26);
    for (const [z0, z1, flip] of [
      [-e, -0.4, false],
      [D + 0.4, D + e, true],
    ] as [number, number, boolean][]) {
      b.line("A-SECT", [sx, z0], [sx, z1], { w: 0.7, lt: "PHANTOM" });
      const zc = flip ? z1 : z0;
      const r = b.mm(3.4);
      const cz = zc + (flip ? r : -r);
      b.circle("A-ANNO", [sx, cz], r, { w: 0.25 });
      b.line("A-ANNO", [sx - r, cz], [sx + r, cz], { w: 0.13 });
      b.text("A-ANNO", [sx, cz + r * 0.2], r * 0.55, "A", { al: "c", mono: true });
      b.text("A-ANNO", [sx, cz - r * 0.75], r * 0.38, "A-301", { al: "c", mono: true });
      // view arrow towards -x
      b.pline("A-ANNO", [[sx - r * 0.2, cz + r], [sx - r * 1.9, cz], [sx - r * 0.2, cz - r]], false, { w: 0.25 });
    }
    if (m.spec.floors >= 5) {
      const sz = D / 2;
      const ex = b.mm(26);
      for (const [x0, x1, flip] of [
        [-ex, -0.4, false],
        [W + 0.4, W + ex, true],
      ] as [number, number, boolean][]) {
        b.line("A-SECT", [x0, sz], [x1, sz], { w: 0.7, lt: "PHANTOM" });
        const xc = flip ? x1 : x0;
        const r = b.mm(3.4);
        const cx = xc + (flip ? r : -r);
        b.circle("A-ANNO", [cx, sz], r, { w: 0.25 });
        b.line("A-ANNO", [cx - r, sz], [cx + r, sz], { w: 0.13 });
        b.text("A-ANNO", [cx, sz + r * 0.2], r * 0.55, "B", { al: "c", mono: true });
        b.text("A-ANNO", [cx, sz - r * 0.75], r * 0.38, "A-302", { al: "c", mono: true });
        b.pline("A-ANNO", [[cx - r, sz + r * 0.2], [cx, sz + r * 1.9], [cx + r, sz + r * 0.2]], false, { w: 0.25 });
      }
    }
  }

  if (arch) b.northArrow([W + b.mm(30), D + b.mm(14)]);

  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    area: (r.x1 - r.x0) * (r.z1 - r.z0),
    pts: [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ],
  }));
}

// ---------- systems ----------

const xz = (p: [number, number, number]): Pt => [p[0], p[2]];

function dedupe(pts: Pt[]) {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-3 || Math.abs(q[1] - p[1]) > 1e-3) out.push(p);
  }
  return out;
}

export function circuitOf(m: M, a: Asset) {
  return a.circuit ? m.circuits.find((c) => c.id === a.circuit) : undefined;
}

export function electrical(b: Builder, m: M, f: number) {
  const rooms = floorPlan(b, m, f, "bg");
  const s = (v: number) => b.mm(v);
  const list = m.assets.filter((a) => a.floor === f);
  // home runs first so symbols draw on top
  for (const r of m.runs) {
    if (r.system !== "elec" || r.floor !== f || r.id.startsWith("RS")) continue;
    const pts = dedupe(r.points.map(xz));
    if (pts.length >= 2) b.pline("E-CIRC", pts, false, { w: 0.18 });
  }
  const multiDB = m.floors >= 3;
  const db = m.assets.find((a) => a.category === "ตู้ควบคุมไฟฟ้า" && a.floor === (multiDB ? f : 1));
  for (const a of list) {
    const [x, , z] = a.pos;
    const ref = a.code;
    switch (a.category) {
      case "โคมดาวน์ไลท์ LED": {
        const r = s(1.5);
        b.circle("E-LITE", [x, z], r, { ref, w: 0.25 });
        const k = r * 0.7071;
        b.line("E-LITE", [x - k, z - k], [x + k, z + k], { ref });
        b.line("E-LITE", [x - k, z + k], [x + k, z - k], { ref });
        break;
      }
      case "สวิตช์ไฟ": {
        b.circle("E-LITE", [x, z], s(0.7), { ref, fill: true });
        b.line("E-LITE", [x, z], [x + s(1.8), z + s(1.8)], { ref });
        b.line("E-LITE", [x + s(1.8), z + s(1.8)], [x + s(2.5), z + s(1.2)], { ref });
        b.text("E-LITE", [x + s(1.2), z - s(1.2)], s(1.3), "S", { mono: true, ref, va: "m" });
        break;
      }
      case "เต้ารับคู่มีกราวด์": {
        const r = s(1.3);
        b.circle("E-POWR", [x + r, z], r, { ref, w: 0.25 });
        b.line("E-POWR", [x + r * 0.6, z - r * 0.55], [x + r * 0.6, z + r * 0.55], { ref });
        b.line("E-POWR", [x + r * 1.4, z - r * 0.55], [x + r * 1.4, z + r * 0.55], { ref });
        break;
      }
      case "เครื่องทำน้ำอุ่น":
        b.rect("E-POWR", x - s(2.6), z - s(1.4), x, z + s(1.4), { ref });
        b.text("E-POWR", [x - s(1.3), z], s(1.2), "WH", { al: "c", va: "m", mono: true, ref });
        break;
      case "ตู้ควบคุมไฟฟ้า":
        b.rect("E-POWR", x, z - s(2.4), x + s(1.6), z + s(2.4), { ref, w: 0.35 });
        b.hatchRect("E-POWR", x, z - s(2.4), x + s(1.6), z + s(2.4), "solid", { ref });
        b.text("E-POWR", [x + s(2.4), z], s(1.6), a.code, { va: "m", mono: true, bold: true, ref });
        break;
    }
  }
  // AC and pump power points
  for (const a of m.assets) {
    if (a.floor !== f) continue;
    if (a.category === "เครื่องปรับอากาศติดผนัง (Fan Coil)" || a.code === "PU-001") {
      const [x, , z] = a.pos;
      b.rect("E-POWR", x - s(1.2), z - s(1.2), x + s(1.2), z + s(1.2), { ref: a.code, w: 0.25 });
      b.text("E-POWR", [x, z], s(1.3), a.code === "PU-001" ? "P" : "A", { al: "c", va: "m", mono: true, ref: a.code });
    }
  }
  // circuit labels at the last device of each circuit
  const last = new Map<string, Asset>();
  for (const a of m.assets) if (a.circuit && a.render && a.floor === f) last.set(a.circuit, a);
  for (const [cid, a] of last) {
    const c = m.circuits.find((q) => q.id === cid);
    if (!c) continue;
    b.text("E-CIRC", [a.pos[0] + s(2), a.pos[2] + s(2.2)], s(1.25), c.breaker, { mono: true, ref: c.breaker });
  }
  if (db && (multiDB ? f > 1 : f > 1)) {
    const [x, , z] = db.pos;
    b.circle("E-CIRC", [x + s(0.8), z + s(4)], s(1.2), { w: 0.25 });
    b.circle("E-CIRC", [x + s(0.8), z + s(4)], s(0.5), { fill: true });
    b.text("E-CIRC", [x + s(2.6), z + s(4)], s(1.3), multiDB ? `ท่อสายป้อนจาก DB-${f - 1}01` : "ท่อร้อยสายขึ้นจาก DB-101", { va: "m" });
  }
  return rooms;
}

export function plumbing(b: Builder, m: M, f: number) {
  const rooms = floorPlan(b, m, f, "bg");
  const s = (v: number) => b.mm(v);
  const { D } = m;
  const seen = new Set<string>();
  const seg = (layer: string, a: Pt, c: Pt) => {
    if (Math.hypot(a[0] - c[0], a[1] - c[1]) < 1e-3) return;
    const k = [a, c].map((p) => p.map((v) => v.toFixed(2)).join(",")).sort().join("|") + layer;
    if (seen.has(k)) return;
    seen.add(k);
    b.line(layer, a, c, {});
  };
  if (f === 1) {
    for (const r of m.runs) {
      if (r.system !== "water" && r.system !== "drain") continue;
      const pts = dedupe(r.points.map(xz));
      for (let i = 0; i + 1 < pts.length; i++) seg(r.system === "water" ? "P-WATR" : "P-SANR", pts[i], pts[i + 1]);
    }
    // inspection chambers at drain bends
    const bends = new Set<string>();
    for (const r of m.runs) {
      if (r.system !== "drain") continue;
      const p = r.points[2];
      bends.add(`${p[0].toFixed(2)},${p[2].toFixed(2)}`);
    }
    for (const k of bends) {
      const [x, z] = k.split(",").map(Number);
      b.rect("P-SANR", x - s(1.2), z - s(1.2), x + s(1.2), z + s(1.2), { w: 0.25, lt: "CONTINUOUS" });
    }
    b.text("P-SANR", [m.W / 2, D + 1.6 + s(2.5)], s(1.4), "ท่อโสโครก PVC Ø100 มม. ลาดเอียง 1:100 เข้าถังบำบัด", { al: "c" });
  } else {
    for (const a of m.assets) {
      if (a.floor !== f || !["สุขภัณฑ์ (ชักโครก)", "อ่างล้างหน้า", "ซิงค์ล้างจาน", "เครื่องทำน้ำอุ่น"].includes(a.category)) continue;
      const [x, , z] = a.pos;
      b.circle("P-WATR", [x - s(2.2), z + s(2.2)], s(0.9), { w: 0.25 });
      b.line("P-WATR", [x - s(2.2), z + s(2.2)], [x, z], {});
      if (a.category !== "เครื่องทำน้ำอุ่น") {
        b.circle("P-SANR", [x + s(2.2), z - s(2.2)], s(1.1), { w: 0.25, lt: "CONTINUOUS" });
        b.circle("P-SANR", [x + s(2.2), z - s(2.2)], s(0.5), { lt: "CONTINUOUS" });
        b.line("P-SANR", [x, z], [x + s(2.2), z - s(2.2)], {});
      }
    }
  }
  fixtures(b, m, f, "P-FIXT", true, true);
  // floor drains in bathrooms
  for (const r of m.rooms) {
    if (r.floor !== f || r.kind !== "bath") continue;
    const c: Pt = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2 - 0.2];
    b.circle("P-SANR", c, s(1), { lt: "CONTINUOUS", w: 0.25 });
    b.line("P-SANR", [c[0] - s(0.7), c[1]], [c[0] + s(0.7), c[1]], { lt: "CONTINUOUS" });
    b.line("P-SANR", [c[0], c[1] - s(0.7)], [c[0], c[1] + s(0.7)], { lt: "CONTINUOUS" });
    b.text("P-SANR", [c[0] + s(1.6), c[1]], s(1.1), "FD", { va: "m", mono: true });
  }
  if (f === 1) {
    for (const a of m.assets) {
      if (a.room !== "ภายนอก" || a.system !== "plumb") continue;
      const [x, , z] = a.pos;
      const ref = a.code;
      if (a.category === "ถังเก็บน้ำ") {
        b.circle("P-EQPM", [x, z], a.size[0], { ref, w: 0.5 });
        b.circle("P-EQPM", [x, z], a.size[0] * 0.8, { ref });
      } else if (a.category === "ถังบำบัดน้ำเสีย") {
        b.circle("P-EQPM", [x, z], a.size[0], { ref, w: 0.5 });
        b.line("P-EQPM", [x - a.size[0], z], [x + a.size[0], z], { ref });
      } else {
        b.rect("P-EQPM", x - a.size[0] / 2, z - a.size[2] / 2, x + a.size[0] / 2, z + a.size[2] / 2, { ref, w: 0.35 });
        b.circle("P-EQPM", [x, z], Math.min(a.size[0], a.size[2]) * 0.35, { ref });
      }
      b.text("P-EQPM", [x + a.size[0] + s(1.2), z + s(0.8)], s(1.5), a.code, { mono: true, bold: true, ref });
      b.text("P-EQPM", [x + a.size[0] + s(1.2), z - s(1.6)], s(1.2), a.name, { ref });
    }
  }
  return rooms;
}

export function hvac(b: Builder, m: M, f: number) {
  const rooms = floorPlan(b, m, f, "bg");
  const s = (v: number) => b.mm(v);
  for (const r of m.runs) {
    if (r.system !== "hvac" || r.floor !== f) continue;
    const pts = dedupe(r.points.map(xz));
    if (pts.length >= 2) b.pline("M-PIPE", pts, false, {});
  }
  for (const a of m.assets) {
    if (a.floor !== f || a.category !== "เครื่องปรับอากาศติดผนัง (Fan Coil)") continue;
    const [x, , z] = a.pos;
    const hx = a.size[0] / 2;
    const hz = a.size[2] / 2;
    const ref = a.code;
    b.rect("M-HVAC", x - hx, z - hz, x + hx, z + hz, { ref, w: 0.35 });
    b.hatchRect("M-HVAC", x - hx, z - hz, x + hx, z + hz, "lines", { ref, sp: 0.06, ang: hx > hz ? 90 : 0 });
    const room = m.rooms.find((q) => q.id === a.room);
    const inward: Pt = room ? [Math.sign((room.x0 + room.x1) / 2 - x) * (hz > hx ? 1 : 0), Math.sign((room.z0 + room.z1) / 2 - z) * (hx >= hz ? 1 : 0)] : [0, 1];
    const tx = x + inward[0] * s(5);
    const tz = z + inward[1] * s(4.2);
    b.text("M-HVAC", [tx, tz + s(0.6)], s(1.5), a.code, { al: "c", mono: true, bold: true, ref });
    b.text("M-HVAC", [tx, tz - s(1.6)], s(1.25), `${(a.btu ?? 0).toLocaleString()} BTU`, { al: "c", mono: true, ref });
    const cu = m.assets.find((q) => q.code === a.code.replace("AC", "CU"));
    if (cu) {
      const [cx, , cz] = cu.pos;
      const sx = cu.size[0] / 2;
      const sz = cu.size[2] / 2;
      b.rect("M-HVAC", cx - sx, cz - sz, cx + sx, cz + sz, { ref: cu.code, w: 0.35 });
      b.circle("M-HVAC", [cx, cz], Math.min(sx, sz) * 0.8, { ref: cu.code });
      const right = cx > m.W ? 1 : cx < 0 ? -1 : 0;
      const tp: Pt = right ? [cx + right * (sx + s(1.5)), cz] : [cx, cz + (cz < 0 ? -1 : 1) * (sz + s(2.5))];
      b.text("M-HVAC", tp, s(1.35), cu.code + (cu.floor !== f ? " (พื้นชั้น 1)" : ""), { al: right > 0 ? "l" : right < 0 ? "r" : "c", va: "m", mono: true, ref: cu.code });
    }
  }
  return rooms;
}
