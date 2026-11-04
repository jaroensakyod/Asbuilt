// Structural plans and the electrical load schedule.

import type { Builder } from "./builder";
import { CA } from "./frame";
import { fy, grid, gridX, gridZ, type M } from "./plan";
import { roofRise } from "./views";
import type { Pt } from "./types";

export function footingType(m: M, x: number, z: number) {
  const xs = gridX(m);
  const zs = gridZ(m);
  const ex = x === xs[0] || x === xs[xs.length - 1];
  const ez = z === zs[0] || z === zs[zs.length - 1];
  return ex && ez ? "F1" : ex || ez ? "F2" : "F3";
}

export const pilesPer = (m: M, t: string) => (m.spec.type === "condo" ? (t === "F3" ? 6 : 4) : t === "F3" ? 3 : 2);

function beamsOnGrid(b: Builder, m: M, o: { hidden?: boolean; half: number; label: (perim: boolean) => string; skip?: number }) {
  const xs = gridX(m);
  const zs = gridZ(m);
  const s = (v: number) => b.mm(v);
  const hw = 0.1;
  const lt = o.hidden ? "DASHED" : "CONTINUOUS";
  for (const z of zs)
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i] + o.half;
      const c = xs[i + 1] - o.half;
      b.line("S-BEAM", [a, z - hw], [c, z - hw], { lt });
      b.line("S-BEAM", [a, z + hw], [c, z + hw], { lt });
      const perim = z === zs[0] || z === zs[zs.length - 1];
      b.text("A-ANNO", [(a + c) / 2, z + hw + s(1)], s(1.3), o.label(perim), { al: "c", mono: true });
    }
  for (const x of xs)
    for (let j = 0; j + 1 < zs.length; j++) {
      const a = zs[j] + o.half;
      const c = zs[j + 1] - o.half;
      b.line("S-BEAM", [x - hw, a], [x - hw, c], { lt });
      b.line("S-BEAM", [x + hw, a], [x + hw, c], { lt });
      const perim = x === xs[0] || x === xs[xs.length - 1];
      b.text("A-ANNO", [x - hw - s(1), (a + c) / 2], s(1.3), o.label(perim), { al: "c", mono: true, rot: 90 });
    }
}

function columns(b: Builder, m: M, f: number) {
  for (const e of m.elements) {
    if (e.kind !== "column" || e.floor !== f) continue;
    const h = e.size[0] / 2;
    b.rect("S-COLS", e.pos[0] - h, e.pos[2] - h, e.pos[0] + h, e.pos[2] + h, { w: 0.35 });
    b.hatchRect("S-COLS", e.pos[0] - h, e.pos[2] - h, e.pos[0] + h, e.pos[2] + h, "solid");
  }
}

export function foundationPlan(b: Builder, m: M) {
  const s = (v: number) => b.mm(v);
  b.rect("A-WALL", -0.1, -0.1, m.W + 0.1, m.D + 0.1, { lt: "HIDDEN", w: 0.18 });
  for (const e of m.elements) {
    if (e.kind !== "footing") continue;
    const [x, , z] = e.pos;
    const t = footingType(m, x, z);
    const hs = e.size[0] / 2 + (t === "F3" ? 0.15 : t === "F2" ? 0.05 : 0);
    b.rect("S-FTNG", x - hs, z - hs, x + hs, z + hs, { w: 0.35 });
    const n = pilesPer(m, t);
    const pts: Pt[] =
      n === 2
        ? [
            [x - 0.25, z],
            [x + 0.25, z],
          ]
        : n === 3
          ? [
              [x - 0.28, z - 0.18],
              [x + 0.28, z - 0.18],
              [x, z + 0.3],
            ]
          : n === 4
            ? [
                [x - 0.28, z - 0.28],
                [x + 0.28, z - 0.28],
                [x + 0.28, z + 0.28],
                [x - 0.28, z + 0.28],
              ]
            : [-0.36, 0, 0.36].flatMap((dx) => [
                [x + dx, z - 0.3] as Pt,
                [x + dx, z + 0.3] as Pt,
              ]);
    for (const p of pts) {
      b.circle("S-FTNG", p, 0.11, { w: 0.18 });
      b.line("S-FTNG", [p[0] - 0.08, p[1] - 0.08], [p[0] + 0.08, p[1] + 0.08]);
    }
    b.text("A-ANNO", [x + hs + s(0.8), z + hs + s(0.6)], s(1.5), t, { mono: true, bold: true });
  }
  beamsOnGrid(b, m, { half: 0.6, label: (p) => (p ? "GB1" : "GB2") });
  columns(b, m, 1);
  grid(b, m);
}

export function floorFraming(b: Builder, m: M, f: number) {
  const s = (v: number) => b.mm(v);
  const xs = gridX(m);
  const zs = gridZ(m);
  const roof = f > m.floors;
  b.rect("S-SLAB", -0.1, -0.1, m.W + 0.1, m.D + 0.1, { w: 0.35 });
  beamsOnGrid(b, m, { hidden: true, half: 0.125, label: (p) => (roof ? "RB1" : p ? "B1" : "B2") });
  columns(b, m, Math.min(f - 1, m.floors));
  let k = 0;
  for (let i = 0; i + 1 < xs.length; i++)
    for (let j = 0; j + 1 < zs.length; j++) {
      const x0 = xs[i] + 0.25;
      const x1 = xs[i + 1] - 0.25;
      const z0 = zs[j] + 0.25;
      const z1 = zs[j + 1] - 0.25;
      b.line("S-SLAB", [x0, z0], [x1, z1], { w: 0.09 });
      b.line("S-SLAB", [x1, z0], [x0, z1], { w: 0.09 });
      const c: Pt = [(x0 + x1) / 2, (z0 + z1) / 2];
      const r = s(3);
      b.circle("A-ANNO", c, r, { w: 0.25 });
      b.text("A-ANNO", [c[0], c[1] + r * 0.1], r * 0.55, roof ? "RS1" : "S1", { al: "c", mono: true, bold: true });
      b.text("A-ANNO", [c[0], c[1] - r * 0.6], r * 0.32, "t=0.12", { al: "c", mono: true });
      k++;
    }
  // openings
  if (!roof)
    for (const r of m.rooms.filter((q) => q.floor === f && (q.kind === "stair" || q.kind === "lift"))) {
      b.rect("S-SLAB", r.x0 + 0.1, r.z0 + 0.1, r.x1 - 0.1, r.z1 - 0.1, { w: 0.35 });
      b.line("S-SLAB", [r.x0 + 0.1, r.z0 + 0.1], [r.x1 - 0.1, r.z1 - 0.1], { w: 0.18 });
      b.line("S-SLAB", [r.x1 - 0.1, r.z0 + 0.1], [r.x0 + 0.1, r.z1 - 0.1], { w: 0.18 });
      b.text("A-ANNO", [(r.x0 + r.x1) / 2, r.z0 + 0.3], s(1.3), r.kind === "lift" ? "ช่องลิฟต์" : "ช่องบันได", { al: "c" });
    }
  b.text("A-ANNO", [m.W / 2, -b.mm(24) - 0.3], s(1.5), roof ? `พื้นหลังคา คสล. ระดับ +${(m.floors * m.FH).toFixed(2)}` : `ระดับหลังพื้น +${fy(m, f).toFixed(2)} · ${k} แผงพื้น`, { al: "c" });
  grid(b, m);
}

export function roofFraming(b: Builder, m: M) {
  if (m.spec.roof === "flat") return floorFraming(b, m, m.floors + 1);
  const s = (v: number) => b.mm(v);
  const O = 0.6;
  const X0 = -O;
  const X1 = m.W + O;
  const Z0 = -O;
  const Z1 = m.D + O;
  const zc = m.D / 2;
  b.rect("A-ROOF", X0, Z0, X1, Z1, { lt: "DASHED", w: 0.18 });
  // ring beam
  b.rect("S-BEAM", -0.1, -0.1, m.W + 0.1, m.D + 0.1, { w: 0.35 });
  b.rect("S-BEAM", 0.1, 0.1, m.W - 0.1, m.D - 0.1, { w: 0.18 });
  columns(b, m, m.floors);
  const half = (Z1 - Z0) / 2;
  if (m.spec.roof === "gable") {
    b.line("S-BEAM", [X0, zc], [X1, zc], { w: 0.5 });
    for (const [a, c] of [
      [Z0, zc],
      [zc, Z1],
    ]) {
      b.hatchRect("S-BEAM", X0, a, X1, c, "lines", { sp: 1, ang: 90 });
      b.hatchRect("S-BEAM", X0, a, X1, c, "lines", { sp: 0.8, ang: 0 });
    }
  } else {
    const r0 = Math.min(X0 + half, (X0 + X1) / 2);
    const r1 = Math.max(X1 - half, (X0 + X1) / 2);
    b.line("S-BEAM", [r0, zc], [r1, zc], { w: 0.5 });
    for (const [a, c] of [
      [[X0, Z0], [r0, zc]],
      [[X1, Z0], [r1, zc]],
      [[X0, Z1], [r0, zc]],
      [[X1, Z1], [r1, zc]],
    ] as [Pt, Pt][])
      b.line("S-BEAM", a, c, { w: 0.5 });
    const front: Pt[] = [[X0, Z0], [X1, Z0], [r1, zc], [r0, zc]];
    const back: Pt[] = [[r0, zc], [r1, zc], [X1, Z1], [X0, Z1]];
    const left: Pt[] = [[X0, Z0], [r0, zc], [X0, Z1]];
    const right: Pt[] = [[X1, Z0], [X1, Z1], [r1, zc]];
    for (const p of [front, back]) {
      b.hatch("S-BEAM", p, "lines", { sp: 1, ang: 90 });
      b.hatch("S-BEAM", p, "lines", { sp: 0.8, ang: 0 });
    }
    for (const p of [left, right]) {
      b.hatch("S-BEAM", p, "lines", { sp: 1, ang: 0 });
      b.hatch("S-BEAM", p, "lines", { sp: 0.8, ang: 90 });
    }
  }
  const deg = Math.round((Math.atan2(roofRise(m), half) * 180) / Math.PI);
  b.text("A-ANNO", [m.W / 2, Z0 - s(4)], s(1.5), `จันทันเหล็ก C-100×50×20×3.2 มม. @1.00 ม. · แปเหล็ก C-75×45×15×2.3 มม. @0.80 ม. · ลาด ${deg}°`, { al: "c" });
  b.text("A-ANNO", [m.W / 2, Z1 + s(3)], s(1.4), "คานรัดหัวเสา RB 0.15×0.30 ม. รอบอาคาร", { al: "c" });
  grid(b, m, { dims: "overall" });
}

// ---------- E-001 load schedule & single-line diagram (paper mm) ----------

export function loadSchedule(b: Builder, m: M) {
  const P = (x: number, y: number): Pt => [b.mm(x), b.mm(y)];
  const mm = (v: number) => b.mm(v);
  const dbs = [...new Set(m.circuits.map((c) => c.db))];
  const total = m.circuits.reduce((s, c) => s + c.loadW, 0);
  const demand = total * 0.7;
  const threePhase = demand > 12000 || m.spec.type === "condo";
  const amps = threePhase ? demand / (Math.sqrt(3) * 400 * 0.9) : demand / 220;
  const mainA = [32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400].find((v) => v >= amps * 1.25) ?? 400;

  // single-line diagram on the left
  const x = CA.x0 + 6;
  let y = CA.y1 - 6;
  b.text("E-POWR", P(x, y), mm(2.4), "ผังวงจรเส้นเดียว (Single-line diagram)", { bold: true });
  y -= 10;
  b.text("E-POWR", P(x, y), mm(1.6), "ระบบไฟฟ้าจากการไฟฟ้า " + (threePhase ? "3 เฟส 4 สาย 400/230 V" : "1 เฟส 2 สาย 230 V"));
  const cx = x + 16;
  y -= 4;
  b.line("E-POWR", P(cx, y), P(cx, y - 6), { w: 0.35 });
  b.circle("E-POWR", P(cx, y - 10), mm(4), { w: 0.35 });
  b.text("E-POWR", P(cx, y - 10), mm(1.6), "kWh", { al: "c", va: "m", mono: true });
  b.text("E-POWR", P(cx + 7, y - 10), mm(1.5), threePhase ? `มิเตอร์ 3 เฟส ${mainA >= 100 ? "CT 200/5 A" : "30(100) A"}` : `มิเตอร์ 1 เฟส ${amps > 30 ? "30(100)" : "15(45)"} A`, { va: "m" });
  b.line("E-POWR", P(cx, y - 14), P(cx, y - 20), { w: 0.35 });
  b.arc("E-POWR", P(cx + 1.5, y - 22), mm(2.2), 120, 240, { w: 0.35 });
  b.text("E-POWR", P(cx + 7, y - 22), mm(1.5), `เมนเบรกเกอร์ ${threePhase ? "MCCB 3P" : "MCB 2P"} ${mainA} A`, { va: "m" });
  b.line("E-POWR", P(cx, y - 24), P(cx, y - 30), { w: 0.35 });
  y -= 30;
  const busTop = y;
  const items = dbs.length > 1 ? dbs : m.circuits.map((c) => c.breaker);
  const step = Math.min(7, 150 / Math.max(1, items.length));
  const busBot = busTop - step * (items.length - 1) - 4;
  b.line("E-POWR", P(cx, busTop), P(cx, busBot), { w: 0.7 });
  items.forEach((it, i) => {
    const yy = busTop - 2 - i * step;
    b.line("E-POWR", P(cx, yy), P(cx + 18, yy), { w: 0.25 });
    b.arc("E-POWR", P(cx + 9, yy - 1.2), mm(1.4), 30, 150, { w: 0.25 });
    if (dbs.length > 1) {
      const load = m.circuits.filter((c) => c.db === it).reduce((s, c) => s + c.loadW, 0);
      b.rect("E-POWR", b.mm(cx + 18), b.mm(yy - 2), b.mm(cx + 32), b.mm(yy + 2), { w: 0.35, ref: it });
      b.text("E-POWR", P(cx + 25, yy), mm(1.4), it, { al: "c", va: "m", mono: true, ref: it });
      b.text("E-POWR", P(cx + 34, yy), mm(1.3), `${(load / 1000).toFixed(1)} kW`, { va: "m", mono: true });
    } else {
      const c = m.circuits[i];
      b.text("E-POWR", P(cx + 20, yy), mm(1.3), `${c.breaker} ${c.rating}`, { va: "m", mono: true, ref: c.breaker });
    }
  });
  if (dbs.length === 1) b.text("E-POWR", P(cx - 3, busBot - 4), mm(1.5), `${dbs[0]} · Consumer unit`, { mono: true });

  // summary
  let sy = Math.min(busBot - 12, 110);
  const sum = [
    `โหลดรวมติดตั้ง ${(total / 1000).toFixed(2)} kW`,
    `ค่าความต้องการ (Demand factor 0.70) ${(demand / 1000).toFixed(2)} kW`,
    `กระแสออกแบบ ${amps.toFixed(1)} A · เมน ${mainA} A`,
    `จำนวนวงจรย่อย ${m.circuits.length} วงจร · ตู้ไฟ ${dbs.length} ตู้`,
    "สายไฟ THW/VAF ตาม มอก. 11-2553 · ต่อหลักดิน Ø5/8\" ยาว 2.40 ม.",
  ];
  for (const t of sum) {
    b.text("E-POWR", P(x, sy), mm(1.55), t);
    sy -= 4.2;
  }

  // load tables
  type Row = { cells: string[]; ref?: string; head?: boolean };
  const rows: Row[] = [];
  for (const db of dbs) {
    const cs = m.circuits.filter((c) => c.db === db);
    rows.push({ cells: [db, cs.length > 0 ? `ตู้ไฟ ${db}` : "", "", "", ""], ref: db, head: true });
    for (const c of cs) rows.push({ cells: [c.breaker, c.name, c.rating, c.loadW ? c.loadW.toLocaleString() : "—", c.loadW ? (c.loadW / 220).toFixed(1) : "—"], ref: c.breaker });
    const sub = cs.reduce((s, c) => s + c.loadW, 0);
    rows.push({ cells: ["", "รวม", "", sub.toLocaleString(), (sub / 220).toFixed(1)], head: true });
  }
  const tx0 = CA.x0 + 86;
  const availH = CA.y1 - CA.y0 - 14;
  const cols = rows.length * 4 > availH * 2 ? 3 : 2;
  const per = Math.ceil(rows.length / cols);
  const rowH = Math.min(4.2, availH / (per + 1));
  const widths = cols === 3 ? [15, 33, 0, 11, 8] : [15, 40, 22, 12, 9];
  const head = ["วงจร", "รายการ", "พิกัด", "วัตต์", "แอมป์"];
  const colDefs = head
    .map((h, i) => ({ w: widths[i], head: h, al: (i >= 3 ? "r" : "l") as "l" | "r", mono: i !== 1 }))
    .filter((c) => c.w > 0);
  const keep = widths.map((w) => w > 0);
  const tw = colDefs.reduce((s, c) => s + c.w, 0);
  b.text("E-POWR", P(tx0, CA.y1 - 6), mm(2.4), "ตารางโหลดไฟฟ้า (Load schedule)", { bold: true });
  for (let k = 0; k < cols; k++) {
    const chunk = rows.slice(k * per, (k + 1) * per);
    if (!chunk.length) break;
    b.table(
      b.mm(tx0 + k * (tw + 4)),
      b.mm(CA.y1 - 10),
      colDefs,
      chunk.map((r) => r.cells.filter((_, i) => keep[i])),
      { rowH, textH: Math.min(1.5, rowH * 0.42), refs: chunk.map((r) => r.ref), l: "E-POWR" },
    );
  }
}
