// Takeoff source from an IFC file. The browser reader (components/takeoff/ifc-reader.ts) turns each
// wall / door / window / column / space into a bounding box in a frame rotated so the main wall
// direction runs along x. This file builds walls, openings, floors and rooms from those boxes.
// Pure: no web-ifc, no React.

import type { Box, Opening, TakeoffRoom, TakeoffSource, Vec3, Wall } from "./types";

export type IfcBox = {
  id: number;
  type: string; // IFCWALL, IFCDOOR … (upper case)
  name: string;
  min: Vec3;
  max: Vec3;
  /** walls only: false when the wall runs at an angle to the main grid */
  aligned?: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const WALL = /^IFCWALL(STANDARDCASE|ELEMENTEDCASE)?$/;
const BATH = /น้ำ|ส้วม|bath|toilet|\bwc\b|shower|restroom|lavatory/i;
const NO_TILE = /บันได|stair|lift|ลิฟต์|shaft|void|ช่องว่าง|ท่อ/i;

/** Group heights into storeys: levels closer than `gap` are one floor. */
export function floorLevels(bases: number[], gap = 0.6): number[] {
  const sorted = [...bases].sort((a, b) => a - b);
  const levels: number[] = [];
  for (const y of sorted) if (!levels.length || y - levels[levels.length - 1] > gap) levels.push(y);
  return levels.map(r2);
}

const floorOf = (levels: number[], y: number) => {
  let best = 0;
  for (let i = 0; i < levels.length; i++) if (Math.abs(levels[i] - y) < Math.abs(levels[best] - y)) best = i;
  return best + 1;
};

export function sourceFromIfc(input: IfcBox[], key: string, label: string): TakeoffSource {
  const notes: string[] = [];
  // web-ifc may move the model (COORDINATE_TO_ORIGIN): put the lowest wall base at level 0
  const wallMins = input.filter((b) => WALL.test(b.type)).map((b) => b.min[1]);
  const dy = wallMins.length ? Math.min(...wallMins) : 0;
  const boxes = dy ? input.map((b) => ({ ...b, min: [b.min[0], b.min[1] - dy, b.min[2]] as Vec3, max: [b.max[0], b.max[1] - dy, b.max[2]] as Vec3 })) : input;
  const wallBoxes = boxes.filter((b) => WALL.test(b.type));
  const angled = wallBoxes.filter((b) => b.aligned === false);
  const usable = wallBoxes.filter((b) => b.aligned !== false);
  if (angled.length) notes.push(`ผนังเอียง ${angled.length} แนวไม่ได้ถอด (รองรับเฉพาะผนังที่ตั้งฉากกัน)`);

  const levels = floorLevels(usable.map((b) => b.min[1]));
  type Draft = Wall & { src: IfcBox };
  const drafts: Draft[] = [];
  let thickSkipped = 0;
  for (const b of usable) {
    const dx = b.max[0] - b.min[0];
    const dz = b.max[2] - b.min[2];
    const orient: "h" | "v" = dx >= dz ? "h" : "v";
    const thick = Math.min(dx, dz);
    if (thick > 0.6 || Math.max(dx, dz) < 0.3) {
      thickSkipped++;
      continue;
    }
    const floor = floorOf(levels, b.min[1]);
    drafts.push({
      src: b,
      id: "",
      floor,
      orient,
      c: r2(orient === "h" ? (b.min[2] + b.max[2]) / 2 : (b.min[0] + b.max[0]) / 2),
      a: r2(orient === "h" ? b.min[0] : b.min[2]),
      b: r2(orient === "h" ? b.max[0] : b.max[2]),
      base: r2(b.min[1]),
      height: r2(b.max[1] - b.min[1]),
      thick: r2(thick),
      exterior: false,
      openings: [],
      columns: [],
    });
  }
  if (thickSkipped) notes.push(`ผนัง ${thickSkipped} ชิ้นมีรูปทรงซับซ้อน (หนาเกิน 0.60 ม. หรือสั้นเกินไป) ไม่ได้ถอด`);

  // ids per floor, in a stable order
  drafts.sort((p, q) => p.floor - q.floor || p.orient.localeCompare(q.orient) || p.c - q.c || p.a - q.a);
  const perFloor = new Map<number, number>();
  for (const w of drafts) {
    const n = (perFloor.get(w.floor) ?? 0) + 1;
    perFloor.set(w.floor, n);
    w.id = `${w.floor}W${n}`;
  }

  // which wall holds a box (door / window / column): same height band, centre on the wall line
  const hostOf = (b: IfcBox, slack = 0.15) => {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    let best: Draft | null = null;
    let bestD = Infinity;
    for (const w of drafts) {
      if (b.max[1] < w.base + 0.05 || b.min[1] > w.base + w.height - 0.05) continue;
      const [across, along] = w.orient === "h" ? [cz, cx] : [cx, cz];
      const d = Math.abs(across - w.c);
      if (d > w.thick / 2 + slack || along < w.a - 0.05 || along > w.b + 0.05) continue;
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return best;
  };

  let unmatched = 0;
  for (const b of boxes.filter((x) => x.type === "IFCDOOR" || x.type === "IFCWINDOW")) {
    const w = hostOf(b);
    if (!w) {
      unmatched++;
      continue;
    }
    const kind = b.type === "IFCDOOR" ? "door" : "window";
    const [s0, s1] = w.orient === "h" ? [b.min[0], b.max[0]] : [b.min[2], b.max[2]];
    const o: Opening = {
      id: `${kind === "door" ? "D" : "W"}-${b.id}`,
      kind,
      s0: r2(Math.max(w.a, s0)),
      s1: r2(Math.min(w.b, s1)),
      sill: r2(Math.max(0, b.min[1] - w.base)),
      head: r2(Math.min(w.height, b.max[1] - w.base)),
    };
    if (o.s1 - o.s0 > 0.1 && o.head - o.sill > 0.1) w.openings.push(o);
  }
  if (unmatched) notes.push(`ประตู/หน้าต่าง ${unmatched} ชิ้นหาผนังที่ติดตั้งไม่เจอ`);
  for (const b of boxes.filter((x) => x.type === "IFCCOLUMN")) {
    const w = hostOf(b, 0.25);
    if (w) w.columns.push(r2(w.orient === "h" ? (b.min[0] + b.max[0]) / 2 : (b.min[2] + b.max[2]) / 2));
  }
  for (const w of drafts) {
    w.openings.sort((p, q) => p.s0 - q.s0);
    w.columns.sort((p, q) => p - q);
  }

  // per floor outline → exterior walls, corners, slabs
  const corners: TakeoffSource["corners"] = [];
  const slabs: Box[] = [];
  const floors = levels.length;
  for (let f = 1; f <= floors; f++) {
    const fw = drafts.filter((w) => w.floor === f);
    if (!fw.length) continue;
    const minX = Math.min(...fw.map((w) => w.src.min[0]));
    const maxX = Math.max(...fw.map((w) => w.src.max[0]));
    const minZ = Math.min(...fw.map((w) => w.src.min[2]));
    const maxZ = Math.max(...fw.map((w) => w.src.max[2]));
    for (const w of fw) {
      const [lo, hi] = w.orient === "h" ? [minZ, maxZ] : [minX, maxX];
      if (Math.abs(w.c - lo) < w.thick / 2 + 0.2) {
        w.exterior = true;
        w.outside = -1;
      } else if (Math.abs(w.c - hi) < w.thick / 2 + 0.2) {
        w.exterior = true;
        w.outside = 1;
      }
    }
    const heights = fw.map((w) => w.height).sort((p, q) => p - q);
    const height = heights[Math.floor(heights.length / 2)];
    const base = levels[f - 1];
    for (const [x, z] of [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ] as [number, number][])
      corners.push({ x: r2(x), z: r2(z), floor: f, base, height, ox: x === minX ? -0.02 : 0.02, oz: z === minZ ? -0.02 : 0.02 });
    slabs.push({ pos: [(minX + maxX) / 2, base - 0.1, (minZ + maxZ) / 2], size: [maxX - minX, 0.2, maxZ - minZ] });
  }

  // rooms from IfcSpace
  const spaces = boxes.filter((b) => b.type === "IFCSPACE");
  const rooms: TakeoffRoom[] = spaces.map((b, i) => ({
    id: `S${b.id}`,
    name: b.name || `ห้อง ${i + 1}`,
    floor: levels.length ? floorOf(levels, b.min[1]) : 1,
    x0: r2(b.min[0]),
    x1: r2(b.max[0]),
    z0: r2(b.min[2]),
    z1: r2(b.max[2]),
    bath: BATH.test(b.name),
    floorTile: !NO_TILE.test(b.name),
  }));
  if (!spaces.length) notes.push("ไฟล์ไม่มี IfcSpace จึงไม่แยกห้อง และไม่มีรายการกระเบื้องพื้น/ผนัง ฉาบและทาสีแยกเป็นด้าน A/B ของผนัง");
  if (!drafts.length) notes.push("ไม่พบผนัง (IfcWall) ที่ถอดได้ในไฟล์นี้");

  const all = drafts.map((w) => w.src);
  const bounds = all.length
    ? { min: [Math.min(...all.map((b) => b.min[0])), Math.min(...all.map((b) => b.min[1])), Math.min(...all.map((b) => b.min[2]))] as Vec3, max: [Math.max(...all.map((b) => b.max[0])), Math.max(...all.map((b) => b.max[1])), Math.max(...all.map((b) => b.max[2]))] as Vec3 }
    : { min: [0, 0, 0] as Vec3, max: [1, 1, 1] as Vec3 };

  const walls: Wall[] = drafts.map(({ src: _src, ...w }) => w); // eslint-disable-line @typescript-eslint/no-unused-vars
  return { kind: "ifc", key, label, floors, walls, rooms, corners, slabs, bounds, notes };
}
