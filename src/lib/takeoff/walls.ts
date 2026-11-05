// Rebuild wall runs from a BuildingModel. The model stores walls as pieces cut around openings
// (full-height pieces, below-sill and above-head pieces, glass / door leaves, interior door lintels).
// Collinear pieces on one floor are merged back into a run, and the gaps become openings.
// Pure: relative imports only, no React / three.js.

import type { BuildingModel, Element, Room } from "../house";
import type { AddedOpening, Box, Opening, TakeoffEdits, TakeoffRoom, TakeoffSource, Wall } from "./types";

const EPS = 0.02;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Piece = { e: Element; orient: "h" | "v"; c: number; s0: number; s1: number; y0: number; y1: number; thick: number };

function pieceOf(e: Element): Piece {
  const [x, y, z] = e.pos;
  const [sx, sy, sz] = e.size;
  const orient = sx >= sz ? "h" : "v";
  return orient === "h"
    ? { e, orient, c: z, s0: x - sx / 2, s1: x + sx / 2, y0: y - sy / 2, y1: y + sy / 2, thick: sz }
    : { e, orient, c: x, s0: z - sz / 2, s1: z + sz / 2, y0: y - sy / 2, y1: y + sy / 2, thick: sx };
}

const lineKey = (floor: number, orient: string, c: number) => `${floor}:${orient}:${r2(c).toFixed(2)}`;

export function extractWalls(m: BuildingModel): Wall[] {
  const FH = m.FH;
  const base = (f: number) => (f - 1) * FH;
  const height = r2(FH - 0.2); // floor to underside of the slab / beam

  const byLine = new Map<string, Piece[]>();
  for (const e of m.elements) {
    if (e.floor < 1 || e.floor > m.floors) continue;
    if (e.kind !== "wall" && e.kind !== "glass" && e.kind !== "door") continue;
    const p = pieceOf(e);
    const k = lineKey(e.floor, p.orient, p.c);
    byLine.set(k, [...(byLine.get(k) ?? []), p]);
  }

  const columns = m.elements.filter((e) => e.kind === "column");
  const doorAssets = m.assets.filter((a) => a.category === "ประตู");

  const walls: Wall[] = [];
  const perFloor = new Map<number, number>();
  const keys = [...byLine.keys()].sort((x, y) => {
    const [fa, oa, ca] = x.split(":");
    const [fb, ob, cb] = y.split(":");
    return Number(fa) - Number(fb) || oa.localeCompare(ob) || Number(ca) - Number(cb);
  });

  for (const key of keys) {
    const pieces = byLine.get(key)!.sort((p, q) => p.s0 - q.s0);
    const [fs, orient, cs] = key.split(":");
    const floor = Number(fs);
    const c = Number(cs);
    const y0 = base(floor);

    // merge into runs (pieces that touch or overlap along the axis)
    const runs: Piece[][] = [];
    for (const p of pieces) {
      const run = runs[runs.length - 1];
      const end = run ? Math.max(...run.map((q) => q.s1)) : -Infinity;
      if (run && p.s0 <= end + EPS) run.push(p);
      else runs.push([p]);
    }

    for (const run of runs) {
      const a = r2(Math.min(...run.map((p) => p.s0)));
      const b = r2(Math.max(...run.map((p) => p.s1)));
      const walls_ = run.filter((p) => p.e.kind === "wall");
      const thick = Math.max(...walls_.map((p) => p.thick), 0.1);
      const exterior = run.some((p) => p.e.material === "wallExt");
      const openings: Opening[] = [];

      // glass / door leaves are openings
      for (const p of run) {
        if (p.e.kind !== "glass" && p.e.kind !== "door") continue;
        openings.push({ id: p.e.code ?? p.e.id, kind: p.e.kind === "door" ? "door" : "window", s0: r2(p.s0), s1: r2(p.s1), sill: r2(p.y0 - y0), head: r2(p.y1 - y0) });
      }
      // interior door: a lintel piece with nothing below it
      for (const p of walls_) {
        if (p.y0 - y0 < 1.5) continue;
        const mid = (p.s0 + p.s1) / 2;
        const below = run.some((q) => q !== p && q.y1 <= p.y0 + EPS && q.s0 < mid && q.s1 > mid);
        if (below) continue;
        const asset = doorAssets.find((d) => d.floor === floor && Math.abs((orient === "h" ? d.pos[0] : d.pos[2]) - mid) < 0.05 && Math.abs((orient === "h" ? d.pos[2] : d.pos[0]) - c) < 0.05);
        openings.push({ id: asset?.code ?? `${p.e.id}-D`, kind: "door", s0: r2(p.s0), s1: r2(p.s1), sill: 0, head: r2(p.y0 - y0) });
      }
      openings.sort((p, q) => p.s0 - q.s0);

      const cols = columns
        .filter((e) => e.floor === floor)
        .map((e) => (orient === "h" ? { s: e.pos[0], c: e.pos[2] } : { s: e.pos[2], c: e.pos[0] }))
        .filter((x) => Math.abs(x.c - c) < thick / 2 + 0.15 && x.s >= a - 0.15 && x.s <= b + 0.15)
        .map((x) => r2(x.s))
        .sort((p, q) => p - q);

      const n = (perFloor.get(floor) ?? 0) + 1;
      perFloor.set(floor, n);
      walls.push({ id: `${floor}W${n}`, floor, orient: orient as "h" | "v", c, a, b, base: y0, height, thick, exterior, openings, columns: cols });
    }
  }
  return walls;
}

/**
 * Rooms whose edge lies on this wall, on each side (+1: room on the larger-coordinate side).
 * The room edge may be on the wall centre line (system model) or on its face (IFC spaces).
 */
export function roomsBeside(w: Wall, rooms: TakeoffRoom[]) {
  const tol = w.thick / 2 + 0.06;
  const out: { dir: 1 | -1; room: TakeoffRoom; p: number; q: number }[] = [];
  for (const r of rooms) {
    if (r.floor !== w.floor) continue;
    const [lo, hi, s0, s1] = w.orient === "h" ? [r.z0, r.z1, r.x0, r.x1] : [r.x0, r.x1, r.z0, r.z1];
    const p = Math.max(w.a, s0);
    const q = Math.min(w.b, s1);
    if (q - p < 0.05) continue;
    if (Math.abs(lo - w.c) < tol) out.push({ dir: 1, room: r, p: r2(p), q: r2(q) });
    else if (Math.abs(hi - w.c) < tol) out.push({ dir: -1, room: r, p: r2(p), q: r2(q) });
  }
  return out;
}

const roomOf = (r: Room): TakeoffRoom => ({
  id: r.id,
  name: r.name,
  floor: r.floor,
  x0: r.x0,
  x1: r.x1,
  z0: r.z0,
  z1: r.z1,
  bath: r.kind === "bath",
  floorTile: r.kind !== "lift" && r.kind !== "stair",
});

/** Takeoff source from the system's procedural house model. */
export function sourceFromModel(m: BuildingModel): TakeoffSource {
  const walls = extractWalls(m).map((w) => (w.exterior ? { ...w, outside: (w.c < (w.orient === "h" ? m.D : m.W) / 2 ? -1 : 1) as 1 | -1 } : w));
  const corners: TakeoffSource["corners"] = [];
  const slabs: Box[] = [];
  for (let f = 1; f <= m.floors; f++) {
    const base = (f - 1) * m.FH;
    for (const [x, z] of [
      [0, 0],
      [m.W, 0],
      [m.W, m.D],
      [0, m.D],
    ] as [number, number][])
      corners.push({ x, z, floor: f, base, height: m.FH, ox: x === 0 ? -0.11 : 0.11, oz: z === 0 ? -0.11 : 0.11 });
    slabs.push({ pos: [m.W / 2, base - 0.1, m.D / 2], size: [m.W + 0.2, 0.2, m.D + 0.2] });
  }
  return {
    kind: "model",
    key: "model",
    label: `โมเดลแบบบ้าน ${m.code}`,
    floors: m.floors,
    walls,
    rooms: m.rooms.map(roomOf),
    corners,
    slabs,
    bounds: { min: [0, 0, 0], max: [m.W, m.floors * m.FH, m.D] },
    notes: [],
  };
}

/** Apply the user's edits (heights, block types, excluded walls, removed / added openings). */
export function applyEdits(walls: Wall[], e?: TakeoffEdits | null): Wall[] {
  if (!e) return walls;
  const removed = new Set(e.removed);
  const out: Wall[] = [];
  for (const w of walls) {
    const we = e.walls[w.id];
    if (we?.excluded) continue;
    const height = we?.height && we.height > 0.5 ? r2(we.height) : w.height;
    const kept = w.openings.filter((o) => !removed.has(`${w.id}:${o.id}`));
    const added = e.added
      .filter((a) => a.wallId === w.id)
      .map((a) => ({ id: a.id, kind: a.kind, s0: r2(w.a + a.offset), s1: r2(w.a + a.offset + a.width), sill: a.sill, head: a.head }))
      .filter((o) => o.s0 >= w.a - 1e-6 && o.s1 <= w.b + 1e-6 && o.head > o.sill);
    const openings = [...kept, ...added].map((o) => ({ ...o, head: Math.min(o.head, height) })).sort((p, q) => p.s0 - q.s0);
    const edited = !!we || added.length > 0 || kept.length !== w.openings.length;
    out.push({ ...w, height, openings, block: we?.block ?? w.block, edited });
  }
  return out;
}

/** Why a new opening can't go on this wall (Thai), or null. */
export function openingProblem(w: Wall, a: Omit<AddedOpening, "id" | "wallId">): string | null {
  const s0 = w.a + a.offset;
  const s1 = s0 + a.width;
  if (a.width < 0.3) return "ช่องเปิดกว้างอย่างน้อย 0.30 ม.";
  if (a.offset < 0 || s1 > w.b + 1e-6) return `ต้องอยู่ในความยาวผนัง 0–${r2(w.b - w.a).toFixed(2)} ม.`;
  if (a.head <= a.sill) return "ความสูงหัวต้องมากกว่าระดับขอบล่าง";
  if (a.head > w.height + 1e-6) return `สูงเกินผนัง (${w.height.toFixed(2)} ม.)`;
  if (w.openings.some((o) => s0 < o.s1 - 1e-6 && s1 > o.s0 + 1e-6)) return "ซ้อนกับช่องเปิดเดิม";
  return null;
}
