// Site plan, roof plan, elevations and sections.

import type { Builder } from "./builder";
import { fy, grid, gridX, gridZ, LETTERS, lvl, type M } from "./plan";
import type { Pt } from "./types";

const OVER = 0.6;
export const roofRise = (m: M) => (m.spec.roof === "flat" ? 0.9 : m.spec.roof === "hip" ? 1.8 : 2.2);
export const parsePlot = (land: string): [number, number] => {
  const n = land.match(/[\d.]+/g)?.map(Number) ?? [];
  return [n[0] ?? 20, n[1] ?? 24];
};

// ---------- site ----------

export function sitePlan(b: Builder, m: M) {
  const { W, D, spec } = m;
  const [PW, PD] = parsePlot(spec.land);
  const px0 = (W - PW) / 2;
  const front = Math.max(2.5, (PD - D) * 0.42);
  const pz0 = -front;
  const pz1 = PD - front;
  const s = (v: number) => b.mm(v);

  // road
  const rw = spec.type === "condo" ? 8 : 6;
  b.line("A-SITE", [px0 - 4, pz0 - 0.5], [px0 + PW + 4, pz0 - 0.5], { w: 0.35 });
  b.line("A-SITE", [px0 - 4, pz0 - 0.5 - rw], [px0 + PW + 4, pz0 - 0.5 - rw], { w: 0.35 });
  b.line("A-SITE", [px0 - 4, pz0 - 0.5 - rw / 2], [px0 + PW + 4, pz0 - 0.5 - rw / 2], { w: 0.18, lt: "DASHED" });
  b.text("A-ANNO", [W / 2, pz0 - 0.5 - rw * 0.75], s(2), `ถนนในโครงการ กว้าง ${rw.toFixed(2)} ม.`, { al: "c", va: "m" });

  // plot boundary with pegs
  b.rect("A-SITE", px0, pz0, px0 + PW, pz1, { w: 0.7, lt: "PHANTOM" });
  const pegs: Pt[] = [
    [px0, pz0],
    [px0 + PW, pz0],
    [px0 + PW, pz1],
    [px0, pz1],
  ];
  pegs.forEach((p, i) => {
    b.circle("A-SITE", p, s(1), { w: 0.25 });
    b.text("A-ANNO", [p[0] + (i === 1 || i === 2 ? s(1.6) : -s(1.6)), p[1] + (i < 2 ? -s(2.6) : s(1.4))], s(1.3), `หมุด ${i + 1}`, { al: i === 1 || i === 2 ? "l" : "r" });
  });
  // fence with gate
  const gate0 = Math.max(px0 + 0.6, W * 0.15);
  const gate1 = Math.min(px0 + PW - 0.6, gate0 + Math.min(5.5, PW * 0.35));
  b.line("A-SITE", [px0, pz0 + 0.15], [gate0, pz0 + 0.15], { w: 0.25 });
  b.line("A-SITE", [gate1, pz0 + 0.15], [px0 + PW, pz0 + 0.15], { w: 0.25 });
  b.text("A-ANNO", [(gate0 + gate1) / 2, pz0 + s(2)], s(1.4), "ประตูรั้วบานเลื่อน", { al: "c" });

  // driveway and parking
  const stallW = 2.5;
  const stallD = 5;
  const perRow = Math.max(1, Math.floor((PW - 1.5) / stallW));
  const frontRows = Math.max(0, Math.floor((front - 0.8) / stallD));
  let left = spec.parking;
  const stall = (x: number, z: number, n: number) => {
    b.rect("A-SITE", x, z, x + stallW, z + stallD, { w: 0.18 });
    b.text("A-ANNO", [x + stallW / 2, z + stallD / 2], s(1.3), `P${n}`, { al: "c", va: "m", mono: true });
  };
  let n = 1;
  for (let row = 0; row < frontRows && left > 0; row++) {
    const k = Math.min(perRow, left);
    const x0 = spec.type === "condo" ? px0 + (PW - k * stallW) / 2 : gate0;
    for (let i = 0; i < k; i++) stall(x0 + i * stallW, pz0 + 0.5 + row * stallD, n++);
    left -= k;
  }
  if (left > 0) {
    // side or rear parking
    const back = pz1 - D;
    const rows = Math.max(1, Math.floor((back - 0.8) / stallD));
    for (let row = 0; row < rows && left > 0; row++) {
      const k = Math.min(perRow, left);
      const x0 = px0 + (PW - k * stallW) / 2;
      for (let i = 0; i < k; i++) stall(x0 + i * stallW, pz1 - 0.5 - stallD * (row + 1), n++);
      left -= k;
    }
  }
  b.text("A-ANNO", [px0 + PW - 0.5, pz0 + front - 0.6], s(1.5), `ที่จอดรถ ${spec.parking} คัน`, { al: "r" });

  // building
  b.rect("A-WALL", 0, 0, W, D, { w: 0.7 });
  b.hatchRect("A-HATC", 0, 0, W, D, "lines", { sp: s(1.6) });
  if (spec.roof !== "flat") b.rect("A-ROOF", -OVER, -OVER, W + OVER, D + OVER, { lt: "DASHED" });
  b.text("A-ANNO", [W / 2, D / 2 + s(1.4)], s(2.6), spec.nameTh, { al: "c", bold: true });
  b.text("A-ANNO", [W / 2, D / 2 - s(2.2)], s(1.7), `${spec.floors} ชั้น · พื้นที่ใช้สอย ${spec.area.toLocaleString()} ตร.ม. · FFL ±0.00`, { al: "c" });

  // trees
  const trees: Pt[] = [];
  for (let x = px0 + 1.4; x < px0 + PW - 1; x += 3.6) trees.push([x, pz1 - 1.3]);
  for (let z = 1.5; z < pz1 - 3; z += 4) {
    if (px0 + 1.2 < -2) trees.push([px0 + 1.2, z]);
    if (px0 + PW - 1.2 > W + 3) trees.push([px0 + PW - 1.2, z]);
  }
  for (const t of trees) {
    b.circle("A-PLNT", t, 1.1, { w: 0.18 });
    b.circle("A-PLNT", t, 0.12, {});
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.line("A-PLNT", [t[0] + Math.cos(a) * 0.3, t[1] + Math.sin(a) * 0.3], [t[0] + Math.cos(a) * 0.95, t[1] + Math.sin(a) * 0.95]);
    }
  }

  // site equipment
  for (const a of m.assets) {
    if (a.room !== "ภายนอก" || a.system !== "plumb") continue;
    const [x, , z] = a.pos;
    if (a.category === "ปั๊มน้ำอัตโนมัติ") b.rect("P-EQPM", x - 0.2, z - 0.15, x + 0.2, z + 0.15, { ref: a.code, w: 0.35 });
    else b.circle("P-EQPM", [x, z], a.size[0], { ref: a.code, w: 0.35 });
    b.text("P-EQPM", [x + a.size[0] + s(1), z], s(1.35), a.code, { va: "m", mono: true, ref: a.code });
  }

  // setback dimensions and plot size
  const g = s(6);
  b.dim("A-DIMS", [px0, pz0], [px0 + PW, pz0], -g - rw - 0.5);
  b.dim("A-DIMS", [px0, pz0], [px0, pz1], g);
  b.dim("A-DIMS", [W / 2 + 0.8, pz0], [W / 2 + 0.8, 0], 0, { s: `ร่นหน้า ${front.toFixed(2)}` });
  b.dim("A-DIMS", [W / 2 + 0.8, D], [W / 2 + 0.8, pz1], 0, { s: `ร่นหลัง ${(pz1 - D).toFixed(2)}` });
  b.dim("A-DIMS", [px0, D / 2 - 1.2], [0, D / 2 - 1.2], 0);
  b.dim("A-DIMS", [W, D / 2 - 1.2], [px0 + PW, D / 2 - 1.2], 0);

  const areaPlot = PW * PD;
  b.text("A-ANNO", [px0, pz1 + s(9)], s(1.7), `ขนาดที่ดิน ${PW} × ${PD} ม. · ${areaPlot.toFixed(0)} ตร.ม. (${(areaPlot / 4).toFixed(1)} ตร.ว.)`);
  b.text("A-ANNO", [px0, pz1 + s(5)], s(1.5), `พื้นที่ปกคลุมดิน ${(W * D).toFixed(1)} ตร.ม. · ${((W * D * 100) / areaPlot).toFixed(1)}% ของที่ดิน · ที่ว่างตามกฎหมายไม่น้อยกว่า 30%`);
  b.northArrow([px0 + PW + s(12), pz1 - s(8)]);
}

// ---------- roof plan ----------

export function roofPlan(b: Builder, m: M) {
  const { W, D, spec } = m;
  const s = (v: number) => b.mm(v);
  b.rect("A-WALL", 0, 0, W, D, { lt: "HIDDEN", w: 0.25 });
  const X0 = -OVER;
  const X1 = W + OVER;
  const Z0 = -OVER;
  const Z1 = D + OVER;
  const zc = D / 2;
  const top = m.floors * m.FH;
  const rf = (k: number) => `RF-${m.floors + 1}0${k}`;
  if (spec.roof === "flat") {
    b.rect("A-ROOF", -0.1, -0.1, W + 0.1, D + 0.1, { w: 0.5 });
    b.rect("A-ROOF", 0.1, 0.1, W - 0.1, D - 0.1, { w: 0.25 });
    // drains at corners, falls towards them
    const dr: Pt[] = [
      [0.5, 0.5],
      [W - 0.5, 0.5],
      [W - 0.5, D - 0.5],
      [0.5, D - 0.5],
    ];
    for (const p of dr) {
      b.circle("A-ROOF", p, 0.12, { ref: rf(2) });
      b.text("A-ANNO", [p[0] + (p[0] < W / 2 ? 0.25 : -0.25), p[1] + (p[1] < D / 2 ? 0.25 : -0.35)], s(1.2), "RD", { al: p[0] < W / 2 ? "l" : "r", mono: true, ref: rf(2) });
      const c: Pt = [W / 2, D / 2];
      const v: Pt = [p[0] - c[0], p[1] - c[1]];
      const L = Math.hypot(v[0], v[1]);
      const a: Pt = [c[0] + (v[0] / L) * L * 0.35, c[1] + (v[1] / L) * L * 0.35];
      const e: Pt = [c[0] + (v[0] / L) * L * 0.7, c[1] + (v[1] / L) * L * 0.7];
      b.line("A-ANNO", a, e, { w: 0.18 });
      const ang = Math.atan2(v[1], v[0]);
      const ah = s(1.6);
      b.pline("A-ANNO", [[e[0] - Math.cos(ang - 0.4) * ah, e[1] - Math.sin(ang - 0.4) * ah], e, [e[0] - Math.cos(ang + 0.4) * ah, e[1] - Math.sin(ang + 0.4) * ah]], false, { w: 0.18 });
    }
    if (spec.type === "condo") {
      for (const r of m.rooms.filter((q) => q.floor === m.floors && (q.kind === "lift" || q.kind === "stair"))) {
        b.rect("A-ROOF", r.x0, r.z0, r.x1, r.z1, { w: 0.5 });
        b.hatchRect("A-HATC", r.x0, r.z0, r.x1, r.z1, "cross", { sp: 0.4 });
        b.text("A-ANNO", [(r.x0 + r.x1) / 2, r.z1 + s(2)], s(1.4), r.kind === "lift" ? "ห้องเครื่องลิฟต์" : "หลังคาบันไดหนีไฟ", { al: "c" });
      }
    }
    b.text("A-ANNO", [W / 2, D / 2 + s(1)], s(1.8), "พื้นหลังคา คสล. ทำระบบกันซึม", { al: "c", ref: rf(1) });
    b.text("A-ANNO", [W / 2, D / 2 - s(2.4)], s(1.4), `ลาดเอียง 1:100 เข้าท่อระบายน้ำฝน · ระดับ ${lvl(top)}`, { al: "c", ref: rf(1) });
  } else {
    b.rect("A-ROOF", X0, Z0, X1, Z1, { w: 0.5, ref: rf(1) });
    // gutters
    b.rect("A-ROOF", X0 - 0.15, Z0 - 0.15, X1 + 0.15, Z0, { w: 0.13, ref: rf(2) });
    b.rect("A-ROOF", X0 - 0.15, Z1, X1 + 0.15, Z1 + 0.15, { w: 0.13, ref: rf(2) });
    for (const p of [
      [X0, Z0 - 0.08],
      [X1, Z0 - 0.08],
      [X0, Z1 + 0.08],
      [X1, Z1 + 0.08],
    ] as Pt[])
      b.circle("A-ROOF", p, 0.07, { ref: rf(2) });
    const half = (Z1 - Z0) / 2;
    if (spec.roof === "gable") {
      b.line("A-ROOF", [X0, zc], [X1, zc], { w: 0.5 });
      b.hatchRect("A-HATC", X0, Z0, X1, zc, "lines", { sp: 0.33, ang: 0 });
      b.hatchRect("A-HATC", X0, zc, X1, Z1, "lines", { sp: 0.33, ang: 0 });
    } else {
      const r0 = Math.min(X0 + half, (X0 + X1) / 2);
      const r1 = Math.max(X1 - half, (X0 + X1) / 2);
      b.line("A-ROOF", [r0, zc], [r1, zc], { w: 0.5 });
      for (const [a, c] of [
        [[X0, Z0], [r0, zc]],
        [[X1, Z0], [r1, zc]],
        [[X0, Z1], [r0, zc]],
        [[X1, Z1], [r1, zc]],
      ] as [Pt, Pt][])
        b.line("A-ROOF", a, c, { w: 0.35 });
      b.hatch("A-HATC", [[X0, Z0], [X1, Z0], [r1, zc], [r0, zc]], "lines", { sp: 0.33, ang: 0 });
      b.hatch("A-HATC", [[r0, zc], [r1, zc], [X1, Z1], [X0, Z1]], "lines", { sp: 0.33, ang: 0 });
      b.hatch("A-HATC", [[X0, Z0], [r0, zc], [X0, Z1]], "lines", { sp: 0.33, ang: 90 });
      b.hatch("A-HATC", [[X1, Z0], [X1, Z1], [r1, zc]], "lines", { sp: 0.33, ang: 90 });
    }
    const deg = Math.round((Math.atan2(roofRise(m), D / 2 + OVER) * 180) / Math.PI);
    for (const z of [Z0 + half * 0.5, Z1 - half * 0.5]) {
      const dir = z < zc ? -1 : 1;
      b.line("A-ANNO", [W / 2, zc + dir * 0.4], [W / 2, z + dir * half * 0.3], { w: 0.25 });
      const e: Pt = [W / 2, z + dir * half * 0.3];
      const ah = s(1.6);
      b.pline("A-ANNO", [[e[0] - ah * 0.5, e[1] - dir * ah], e, [e[0] + ah * 0.5, e[1] - dir * ah]], false, { w: 0.25 });
      b.text("A-ANNO", [W / 2 + s(1.5), z], s(1.5), `ลาด ${deg}°`, { va: "m", ref: rf(1) });
    }
    b.text("A-ANNO", [W / 2, Z0 - s(5)], s(1.5), "หลังคากระเบื้องคอนกรีต · รางน้ำฝนและท่อลง", { al: "c", ref: rf(1) });
  }
  grid(b, m, { dims: "overall" });
  b.northArrow([W + b.mm(30), D + b.mm(14)]);
}

// ---------- elevations ----------

export type Side = "front" | "rear" | "left" | "right";

/** level markers on the right and stacked height dimensions on the left */
function levels(b: Builder, L: number, marks: [number, string][], heights: number[]) {
  const s = (v: number) => b.mm(v);
  const x = L + s(5);
  for (const [y, label] of marks) {
    b.line("A-ANNO", [L + s(1), y], [x + s(16), y], { w: 0.13 });
    b.pline("A-ANNO", [[x, y], [x + s(1.2), y + s(1.6)], [x - s(1.2), y + s(1.6)]], true, { w: 0.18 });
    b.text("A-ANNO", [x + s(2), y + s(0.6)], s(1.5), lvl(y), { mono: true });
    b.text("A-ANNO", [x + s(2), y - s(2)], s(1.2), label);
  }
  const g = 0.1 + s(2);
  for (let i = 0; i + 1 < heights.length; i++) b.dim("A-DIMS", [-g, heights[i]], [-g, heights[i + 1]], s(4));
  b.dim("A-DIMS", [-g, heights[0]], [-g, heights[heights.length - 1]], s(9));
}

export function elevation(b: Builder, m: M, side: Side) {
  const { W, D, spec, floors, FH } = m;
  const s = (v: number) => b.mm(v);
  const L = side === "front" || side === "rear" ? W : D;
  const u = (x: number, z: number) => (side === "front" ? x : side === "rear" ? W - x : side === "left" ? D - z : z);
  const onFace = (p: [number, number, number]) =>
    side === "front" ? Math.abs(p[2]) < 0.05 : side === "rear" ? Math.abs(p[2] - D) < 0.05 : side === "left" ? Math.abs(p[0]) < 0.05 : Math.abs(p[0] - W) < 0.05;
  const along = (sz: [number, number, number]) => (side === "front" || side === "rear" ? sz[0] : sz[2]);
  const outside = (p: [number, number, number]) => (side === "front" ? p[2] < 0 : side === "rear" ? p[2] > D : side === "left" ? p[0] < 0 : p[0] > W);
  const top = floors * FH;
  const rise = roofRise(m);
  const GL = -0.2;

  // ground
  const ge = s(14);
  b.line("A-SITE", [-ge, GL], [L + ge, GL], { w: 0.7 });
  b.hatchRect("A-HATC", -ge, GL - s(3), L + ge, GL, "earth", { sp: s(1.1) });
  b.rect("A-ELEV", -0.1, GL, L + 0.1, 0, { w: 0.25 });

  // body and floor lines
  b.rect("A-ELEV", 0, 0, L, top, { w: 0.5 });
  for (let f = 2; f <= floors; f++) {
    b.line("A-ELEV", [0, fy(m, f)], [L, fy(m, f)], { w: 0.18 });
    b.line("A-ELEV", [0, fy(m, f) - 0.2], [L, fy(m, f) - 0.2], { w: 0.13 });
  }

  // openings
  for (const e of m.elements) {
    if ((e.kind !== "glass" && e.kind !== "door") || !onFace(e.pos)) continue;
    const w = along(e.size);
    const h = e.size[1];
    const uc = u(e.pos[0], e.pos[2]);
    const yc = e.pos[1];
    const a0 = uc - w / 2;
    const a1 = uc + w / 2;
    const yb = yc - h / 2;
    const yt = yc + h / 2;
    const ref = e.code;
    b.rect("A-ELEV", a0, yb, a1, yt, { ref, w: 0.35 });
    b.rect("A-GLAZ", a0 + 0.05, yb + 0.05, a1 - 0.05, yt - 0.05, { ref, w: 0.13 });
    if (e.kind === "glass") {
      if (w >= 1.2) b.line("A-GLAZ", [uc, yb + 0.05], [uc, yt - 0.05], { ref });
      if (h < 1) b.pline("A-GLAZ", [[a0 + 0.05, yt - 0.05], [uc, yb + 0.05], [a1 - 0.05, yt - 0.05]], false, { ref, lt: "DASHED" });
      b.line("A-ELEV", [a0 - 0.08, yb - 0.04], [a1 + 0.08, yb - 0.04], { ref, w: 0.25 });
      b.hatchRect("A-GLAZ", a0 + 0.05, yb + 0.05, a1 - 0.05, yt - 0.05, "lines", { sp: 0.35, ang: 60, ref });
    } else {
      b.line("A-ELEV", [uc, yb], [uc, yt - 0.05], { ref });
      b.pline("A-DOOR", [[a0 + 0.05, yt - 0.05], [uc - 0.05, (yb + yt) / 2], [a0 + 0.05, yb + 0.05]], false, { ref, lt: "DASHED" });
      b.pline("A-DOOR", [[a1 - 0.05, yt - 0.05], [uc + 0.05, (yb + yt) / 2], [a1 - 0.05, yb + 0.05]], false, { ref, lt: "DASHED" });
    }
    if (ref) b.text("A-ANNO", [uc, yb - s(2.6)], s(1.3), ref, { al: "c", va: "m", mono: true, ref });
  }

  // roof
  if (spec.roof === "flat") {
    b.rect("A-ROOF", -0.1, top, L + 0.1, top + rise, { w: 0.5, ref: `RF-${floors + 1}01` });
    b.line("A-ROOF", [-0.1, top + rise - 0.08], [L + 0.1, top + rise - 0.08], { w: 0.13 });
    if (spec.type === "condo") {
      for (const r of m.rooms.filter((q) => q.floor === floors && q.kind === "lift")) {
        const ua = u(r.x0, r.z0);
        const ub = u(r.x1, r.z1);
        b.rect("A-ROOF", Math.min(ua, ub), top + rise, Math.max(ua, ub), top + 3.2, { w: 0.35 });
        b.text("A-ANNO", [(ua + ub) / 2, top + 2], s(1.3), "ห้องเครื่องลิฟต์", { al: "c" });
      }
    }
  } else {
    const ridgeAlongView = side === "front" || side === "rear";
    if (ridgeAlongView) {
      // sloped face seen frontally
      const a = -OVER;
      const c = L + OVER;
      const half = D / 2 + OVER;
      const pts: Pt[] =
        spec.roof === "gable"
          ? [
              [a, top],
              [c, top],
              [c, top + rise],
              [a, top + rise],
            ]
          : (() => {
              const r0 = Math.min(a + half, L / 2);
              const r1 = Math.max(c - half, L / 2);
              return [
                [a, top],
                [c, top],
                [r1, top + rise],
                [r0, top + rise],
              ] as Pt[];
            })();
      b.pline("A-ROOF", pts, true, { w: 0.5, ref: `RF-${floors + 1}01` });
      b.hatch("A-HATC", pts, "lines", { sp: 0.25, ang: 0 });
      b.rect("A-ROOF", a - 0.05, top - 0.2, c + 0.05, top, { w: 0.25, ref: `RF-${floors + 1}02` });
    } else {
      const a = -OVER;
      const c = L + OVER;
      const pts: Pt[] = [
        [a, top - 0.05],
        [L / 2, top + rise],
        [c, top - 0.05],
      ];
      b.pline("A-ROOF", pts, true, { w: 0.5, ref: `RF-${floors + 1}01` });
      if (spec.roof === "hip") b.hatch("A-HATC", pts, "lines", { sp: 0.25, ang: 0 });
      else {
        b.pline("A-ROOF", [[a + 0.25, top - 0.05], [L / 2, top + rise - 0.22], [c - 0.25, top - 0.05]], false, { w: 0.18 });
        b.hatch("A-HATC", [[0, top], [L / 2, top + rise - 0.25], [L, top]], "lines", { sp: 0.15, ang: 90 });
      }
    }
  }

  // outdoor equipment on this side
  for (const a of m.assets) {
    if (a.room !== "ภายนอก" || !outside(a.pos) || a.category === "ถังบำบัดน้ำเสีย") continue;
    const w = along(a.size) || 0.5;
    const uc = u(a.pos[0], a.pos[2]);
    if (uc < -2 || uc > L + 2) continue;
    const yb = a.category === "ถังเก็บน้ำ" ? 0 : a.pos[1] - a.size[1] / 2;
    const yt = a.category === "ถังเก็บน้ำ" ? a.size[1] + 0.2 : a.pos[1] + a.size[1] / 2;
    const ww = a.category === "ถังเก็บน้ำ" ? a.size[0] * 2 : w;
    b.rect(a.system === "hvac" ? "M-HVAC" : "P-EQPM", uc - ww / 2, yb, uc + ww / 2, yt, { ref: a.code, w: 0.25 });
    if (a.system === "hvac") b.circle("M-HVAC", [uc, (yb + yt) / 2], Math.min(ww, yt - yb) * 0.35, { ref: a.code });
  }

  // grid bubbles below
  const axis = side === "front" || side === "rear" ? gridX(m) : gridZ(m);
  axis.forEach((v, i) => {
    const uc = side === "front" || side === "right" ? v : L - v;
    const lab = side === "front" || side === "rear" ? String(i + 1) : LETTERS[i];
    b.line("S-GRID", [uc, GL - s(1)], [uc, GL - s(9)], { lt: "CENTER" });
    b.bubble("S-GRID", [uc, GL - s(9) - s(3.2)], lab);
  });

  const marks: [number, string][] = [[0, "FFL ชั้น 1 / ±0.00"]];
  for (let f = 2; f <= floors; f++) marks.push([fy(m, f), `FFL ชั้น ${f}`]);
  marks.push([top, spec.roof === "flat" ? "ระดับพื้นหลังคา" : "ระดับหลังคา (ยอดเสา)"]);
  levels(b, L, marks, [0, ...Array.from({ length: floors - 1 }, (_, i) => fy(m, i + 2)), top, top + rise]);

  // material notes
  b.line("A-ANNO", [L * 0.18, FH * 0.55], [-s(18), FH * 0.55 + s(6)], { w: 0.13 });
  b.text("A-ANNO", [-s(18), FH * 0.55 + s(7)], s(1.35), "ผนังก่ออิฐฉาบปูนเรียบ ทาสีภายนอก", { al: "c" });
  if (spec.roof !== "flat") {
    b.line("A-ANNO", [L * 0.7, top + rise * 0.5], [L + s(18), top + rise + s(4)], { w: 0.13 });
    b.text("A-ANNO", [L + s(18), top + rise + s(5)], s(1.35), "หลังคากระเบื้องคอนกรีต", { al: "c" });
  }
}

// ---------- sections ----------

export function section(b: Builder, m: M, axis: "x" | "z", c: number) {
  const { W, D, spec, floors, FH } = m;
  const s = (v: number) => b.mm(v);
  const top = floors * FH;
  const rise = roofRise(m);
  const L = axis === "x" ? D : W;
  const GL = -0.2;
  // along the cut: u; across the cut: the coordinate we test against c
  const uOf = (p: [number, number, number]) => (axis === "x" ? p[2] : p[0]);
  const vOf = (p: [number, number, number]) => (axis === "x" ? p[0] : p[2]);
  const uSize = (sz: [number, number, number]) => (axis === "x" ? sz[2] : sz[0]);
  const vSize = (sz: [number, number, number]) => (axis === "x" ? sz[0] : sz[2]);

  const ge = s(14);
  b.line("A-SITE", [-ge, GL], [L + ge, GL], { w: 0.7 });
  b.hatchRect("A-HATC", -ge, GL - s(5), L + ge, GL, "earth", { sp: s(1.1) });

  for (const e of m.elements) {
    const vc = vOf(e.pos);
    const vh = vSize(e.size) / 2;
    if (c < vc - vh || c > vc + vh) continue;
    const uc = uOf(e.pos);
    const uh = uSize(e.size) / 2;
    const yb = e.pos[1] - e.size[1] / 2;
    const yt = e.pos[1] + e.size[1] / 2;
    if (e.kind === "slab" || e.kind === "wall" || e.kind === "parapet") {
      b.rect("A-SECT", uc - uh, yb, uc + uh, yt, { w: 0.5 });
      b.hatchRect("A-SECT", uc - uh, yb, uc + uh, yt, "solid", { o: 0.5 });
    } else if (e.kind === "glass" || e.kind === "door") {
      b.line("A-GLAZ", [uc - 0.03, yb], [uc - 0.03, yt], { ref: e.code });
      b.line("A-GLAZ", [uc + 0.03, yb], [uc + 0.03, yt], { ref: e.code });
    }
  }
  // footings and piles on the nearest grid row (beyond the cut)
  const row = (axis === "x" ? gridX(m) : gridZ(m)).reduce((p, q) => (Math.abs(q - c) < Math.abs(p - c) ? q : p));
  for (const e of m.elements) {
    if (e.kind !== "footing" || Math.abs(vOf(e.pos) - row) > 0.01) continue;
    const uc = uOf(e.pos);
    b.rect("S-FTNG", uc - 0.5, -0.6, uc + 0.5, -0.1, { lt: "HIDDEN" });
    b.rect("S-COLS", uc - 0.125, -0.1, uc + 0.125, 0, { lt: "HIDDEN" });
    for (const k of [-0.25, 0.25]) b.line("S-FTNG", [uc + k, -0.6], [uc + k, -2.2], { lt: "HIDDEN" });
    b.line("A-ANNO", [uc - 0.35, -2.25], [uc + 0.35, -2.25], { w: 0.09 });
  }
  b.text("A-ANNO", [L / 2, -2.6], s(1.3), "เสาเข็มเจาะ Ø0.35 ม. ลึก 21.00 ม. (แสดงบางส่วน)", { al: "c" });

  // roof
  if (spec.roof !== "flat") {
    if (axis === "x") {
      const a = -OVER;
      const cc = L + OVER;
      const pts: Pt[] = [
        [a, top],
        [L / 2, top + rise],
        [cc, top],
      ];
      b.pline("A-SECT", pts, false, { w: 0.5, ref: `RF-${floors + 1}01` });
      b.pline("A-SECT", pts.map(([x, y]) => [x, y + 0.12] as Pt), false, { w: 0.25 });
      // truss
      b.line("S-BEAM", [0, top], [L, top], { w: 0.25 });
      b.line("S-BEAM", [L / 2, top], [L / 2, top + rise], { w: 0.25 });
      for (const k of [0.25, 0.75]) {
        const x = L * k;
        const y = top + rise * (1 - Math.abs(x - L / 2) / (L / 2 + OVER));
        b.line("S-BEAM", [x, top], [x, y], { w: 0.18 });
        b.line("S-BEAM", [x, top], [L / 2, top + rise * 0.55], { w: 0.18 });
      }
      b.text("A-ANNO", [L / 2, top + rise + s(4)], s(1.4), "โครงหลังคาเหล็กรูปพรรณ · กระเบื้องคอนกรีต", { al: "c" });
    } else {
      const hr = top + rise * (1 - Math.abs(c - D / 2) / (D / 2 + OVER));
      b.rect("A-SECT", -OVER, hr, L + OVER, hr + 0.12, { w: 0.5 });
    }
  }

  // ceilings and room names
  for (let f = 1; f <= floors; f++) {
    const y = fy(m, f);
    for (const r of m.rooms.filter((q) => q.floor === f)) {
      const lo = axis === "x" ? r.x0 : r.z0;
      const hi = axis === "x" ? r.x1 : r.z1;
      if (c < lo || c > hi) continue;
      const u0 = axis === "x" ? r.z0 : r.x0;
      const u1 = axis === "x" ? r.z1 : r.x1;
      b.line("A-ELEV", [u0 + 0.1, y + FH - 0.55], [u1 - 0.1, y + FH - 0.55], { lt: "DASHED", w: 0.13 });
      const h = Math.min(s(1.8), ((u1 - u0) * 0.8) / Math.max(4, r.name.length * 0.6));
      b.text("A-ANNO", [(u0 + u1) / 2, y + 1.2], h, r.name, { al: "c" });
    }
  }
  const marks: [number, string][] = [[0, "FFL ชั้น 1 / ±0.00"]];
  for (let f = 2; f <= floors; f++) marks.push([fy(m, f), `FFL ชั้น ${f}`]);
  marks.push([top, "ระดับหลังคา"]);
  levels(b, L, marks, [0, ...Array.from({ length: floors - 1 }, (_, i) => fy(m, i + 2)), top]);
  const ax = axis === "x" ? gridZ(m) : gridX(m);
  ax.forEach((v, i) => {
    b.line("S-GRID", [v, GL - s(6)], [v, -2.9 - s(3)], { lt: "CENTER" });
    b.bubble("S-GRID", [v, -2.9 - s(3) - s(3.2)], axis === "x" ? LETTERS[i] : String(i + 1));
  });
}
