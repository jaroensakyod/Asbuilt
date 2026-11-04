// Geometry helpers: bounding boxes, hatch expansion, text metrics, hit tests and snaps.

import type { BBox, DimPrim, HatchPrim, Prim, Pt, TextPrim } from "./types";

export const EMPTY: BBox = [Infinity, Infinity, -Infinity, -Infinity];

export function grow(bb: BBox, x: number, y: number): BBox {
  if (x < bb[0]) bb[0] = x;
  if (y < bb[1]) bb[1] = y;
  if (x > bb[2]) bb[2] = x;
  if (y > bb[3]) bb[3] = y;
  return bb;
}

export function union(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export const inBox = (bb: BBox, x: number, y: number, pad = 0) => x >= bb[0] - pad && x <= bb[2] + pad && y >= bb[1] - pad && y <= bb[3] + pad;

// Thai above/below vowels and tone marks take no horizontal space
const COMBINING = /[ัิ-ฺ็-๎]/g;

/** Approximate advance width of a string at cap height h */
export function textWidth(s: string, h: number, mono?: boolean) {
  const n = s.replace(COMBINING, "").length;
  return n * h * (mono ? 0.68 : 0.62);
}

/** Corner points of a text's box in sheet coordinates */
export function textBox(t: TextPrim): Pt[] {
  const w = textWidth(t.s, t.h, t.mono);
  const x0 = t.al === "c" ? -w / 2 : t.al === "r" ? -w : 0;
  const y0 = t.va === "m" ? -t.h / 2 : t.va === "t" ? -t.h : 0;
  const pts: Pt[] = [
    [x0, y0 - t.h * 0.25],
    [x0 + w, y0 - t.h * 0.25],
    [x0 + w, y0 + t.h * 1.15],
    [x0, y0 + t.h * 1.15],
  ];
  const r = ((t.rot ?? 0) * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return pts.map(([x, y]) => [t.p[0] + x * c - y * s, t.p[1] + x * s + y * c]);
}

/** Geometry of an aligned dimension: extension lines, dimension line, ticks and text anchor */
export function dimGeometry(d: DimPrim) {
  const dx = d.b[0] - d.a[0];
  const dy = d.b[1] - d.a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const gap = d.h * 0.5;
  const over = d.h * 0.7;
  const s = Math.sign(d.off) || 1;
  const pa: Pt = [d.a[0] + nx * d.off, d.a[1] + ny * d.off];
  const pb: Pt = [d.b[0] + nx * d.off, d.b[1] + ny * d.off];
  const ext: [Pt, Pt][] = [
    [
      [d.a[0] + nx * gap * s, d.a[1] + ny * gap * s],
      [pa[0] + nx * over * s, pa[1] + ny * over * s],
    ],
    [
      [d.b[0] + nx * gap * s, d.b[1] + ny * gap * s],
      [pb[0] + nx * over * s, pb[1] + ny * over * s],
    ],
  ];
  const tk = d.h * 0.55;
  // architectural 45° ticks
  const tx = (ux + nx) * tk * 0.7071;
  const ty = (uy + ny) * tk * 0.7071;
  const ticks: [Pt, Pt][] = [pa, pb].map((p) => [
    [p[0] - tx, p[1] - ty],
    [p[0] + tx, p[1] + ty],
  ]);
  const dimLine: [Pt, Pt] = [
    [pa[0] - ux * d.h * 0.6, pa[1] - uy * d.h * 0.6],
    [pb[0] + ux * d.h * 0.6, pb[1] + uy * d.h * 0.6],
  ];
  let ang = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (ang > 90.01 || ang < -89.99) ang += 180;
  if (ang > 180) ang -= 360;
  const mid: Pt = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  // text sits on the far side of the dimension line, reading up or right
  const ar = (ang * Math.PI) / 180;
  const up: Pt = [-Math.sin(ar), Math.cos(ar)];
  const textP: Pt = [mid[0] + up[0] * d.h * 0.35, mid[1] + up[1] * d.h * 0.35];
  const text = d.s ?? fmtLen(len);
  return { ext, ticks, dimLine, textP, ang, text, len };
}

export const fmtLen = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

const hatchCache = new WeakMap<HatchPrim, [Pt, Pt][]>();

/** Expand a line hatch into segments clipped to its polygon (even-odd scanlines) */
export function hatchLines(h: HatchPrim): [Pt, Pt][] {
  if (h.pat === "solid") return [];
  const hit = hatchCache.get(h);
  if (hit) return hit;
  const out: [Pt, Pt][] = [];
  const angles = h.pat === "cross" ? [h.ang ?? 45, (h.ang ?? 45) + 90] : h.pat === "earth" ? [h.ang ?? 45] : [h.ang ?? 45];
  const sp = h.sp ?? 0.2;
  for (const ang of angles) {
    const r = (ang * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    // rotate polygon so hatch lines become horizontal
    const rp = h.pts.map(([x, y]) => [x * c + y * s, -x * s + y * c] as Pt);
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of rp) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    const start = Math.ceil(y0 / sp) * sp;
    let k = 0;
    for (let y = start; y <= y1; y += sp, k++) {
      const xs: number[] = [];
      for (let i = 0; i < rp.length; i++) {
        const p = rp[i];
        const q = rp[(i + 1) % rp.length];
        if (p[1] === q[1]) continue;
        if ((y >= p[1] && y < q[1]) || (y >= q[1] && y < p[1])) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        let xa = xs[i];
        let xb = xs[i + 1];
        if (h.pat === "earth") {
          // short broken strokes for earth fill
          const L = xb - xa;
          const off = (k % 3) * sp * 0.6;
          xa = xa + Math.min(L, off);
          xb = Math.min(xb, xa + sp * 1.2);
          if (xb <= xa) continue;
        }
        out.push([
          [xa * c - y * s, xa * s + y * c],
          [xb * c - y * s, xb * s + y * c],
        ]);
      }
    }
  }
  hatchCache.set(h, out);
  return out;
}

export function primBBox(p: Prim): BBox {
  const bb: BBox = [...EMPTY];
  switch (p.t) {
    case "line":
      grow(bb, p.a[0], p.a[1]);
      grow(bb, p.b[0], p.b[1]);
      break;
    case "pline":
    case "hatch":
      for (const q of p.pts) grow(bb, q[0], q[1]);
      break;
    case "circle":
    case "arc":
      grow(bb, p.c[0] - p.r, p.c[1] - p.r);
      grow(bb, p.c[0] + p.r, p.c[1] + p.r);
      break;
    case "text":
      for (const q of textBox(p)) grow(bb, q[0], q[1]);
      break;
    case "dim": {
      const g = dimGeometry(p);
      for (const [a, b] of [...g.ext, g.dimLine]) {
        grow(bb, a[0], a[1]);
        grow(bb, b[0], b[1]);
      }
      break;
    }
  }
  return bb;
}

export function primsBBox(prims: Prim[]): BBox {
  let bb: BBox = [...EMPTY];
  for (const p of prims) bb = union(bb, primBBox(p));
  return bb;
}

export function translatePrims(prims: Prim[], dx: number, dy: number) {
  const m = (q: Pt): Pt => [q[0] + dx, q[1] + dy];
  for (const p of prims) {
    switch (p.t) {
      case "line":
        p.a = m(p.a);
        p.b = m(p.b);
        break;
      case "pline":
      case "hatch":
        p.pts = p.pts.map(m);
        break;
      case "circle":
      case "arc":
        p.c = m(p.c);
        break;
      case "text":
        p.p = m(p.p);
        break;
      case "dim":
        p.a = m(p.a);
        p.b = m(p.b);
        break;
    }
  }
}

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function pointInPoly(p: Pt, pts: Pt[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function angIn(a: number, a0: number, a1: number) {
  const n = (v: number) => ((v % 360) + 360) % 360;
  const s = n(a - a0);
  const e = n(a1 - a0);
  return s <= e;
}

/** Distance from point to an entity's visible geometry (0 inside filled shapes and text boxes) */
export function primDist(p: Prim, q: Pt): number {
  switch (p.t) {
    case "line":
      return segDist(q, p.a, p.b);
    case "pline": {
      let d = Infinity;
      const n = p.pts.length;
      for (let i = 0; i < n - (p.closed ? 0 : 1); i++) d = Math.min(d, segDist(q, p.pts[i], p.pts[(i + 1) % n]));
      return d;
    }
    case "hatch":
      return pointInPoly(q, p.pts) ? 0 : Infinity;
    case "circle": {
      const r = Math.hypot(q[0] - p.c[0], q[1] - p.c[1]);
      return p.fill && r <= p.r ? 0 : Math.abs(r - p.r);
    }
    case "arc": {
      const r = Math.hypot(q[0] - p.c[0], q[1] - p.c[1]);
      const a = (Math.atan2(q[1] - p.c[1], q[0] - p.c[0]) * 180) / Math.PI;
      return angIn(a, p.a0, p.a1) ? Math.abs(r - p.r) : Infinity;
    }
    case "text":
      return pointInPoly(q, textBox(p)) ? 0 : Infinity;
    case "dim": {
      const g = dimGeometry(p);
      return Math.min(...[...g.ext, g.dimLine].map(([a, b]) => segDist(q, a, b)));
    }
  }
}

/** Snap candidates (endpoints, vertices, centres) */
export function primSnaps(p: Prim): Pt[] {
  switch (p.t) {
    case "line":
      return [p.a, p.b, [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2]];
    case "pline":
    case "hatch":
      return p.pts;
    case "circle":
      return [p.c];
    case "arc": {
      const r0 = (p.a0 * Math.PI) / 180;
      const r1 = (p.a1 * Math.PI) / 180;
      return [p.c, [p.c[0] + p.r * Math.cos(r0), p.c[1] + p.r * Math.sin(r0)], [p.c[0] + p.r * Math.cos(r1), p.c[1] + p.r * Math.sin(r1)]];
    }
    case "dim":
      return [p.a, p.b];
    case "text":
      return [p.p];
  }
}

export function polyArea(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a / 2);
}

export function polyPerimeter(pts: Pt[], closed = true) {
  let s = 0;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
}

/** Axis-aligned clip of a set of prims to a box (used by enlarged-detail sheets) */
export function clipPrims(prims: Prim[], bb: BBox): Prim[] {
  const out: Prim[] = [];
  const clipSeg = (a: Pt, b: Pt): [Pt, Pt] | null => {
    // Liang–Barsky
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const ps = [-dx, dx, -dy, dy];
    const qs = [a[0] - bb[0], bb[2] - a[0], a[1] - bb[1], bb[3] - a[1]];
    for (let i = 0; i < 4; i++) {
      if (ps[i] === 0) {
        if (qs[i] < 0) return null;
      } else {
        const t = qs[i] / ps[i];
        if (ps[i] < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (t0 > t1) return null;
    return [
      [a[0] + t0 * dx, a[1] + t0 * dy],
      [a[0] + t1 * dx, a[1] + t1 * dy],
    ];
  };
  const isRect = (pts: Pt[]) => pts.length === 4 && pts.every((p, i) => { const q = pts[(i + 1) % 4]; return p[0] === q[0] || p[1] === q[1]; });
  for (const p of prims) {
    if (p.t === "line") {
      const s = clipSeg(p.a, p.b);
      if (s) out.push({ ...p, a: s[0], b: s[1] });
    } else if ((p.t === "pline" && p.closed) || p.t === "hatch") {
      if (isRect(p.pts)) {
        const xs = p.pts.map((q) => q[0]);
        const ys = p.pts.map((q) => q[1]);
        const x0 = Math.max(Math.min(...xs), bb[0]);
        const x1 = Math.min(Math.max(...xs), bb[2]);
        const y0 = Math.max(Math.min(...ys), bb[1]);
        const y1 = Math.min(Math.max(...ys), bb[3]);
        if (x1 > x0 && y1 > y0)
          out.push({
            ...p,
            pts: [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
            ],
          });
      } else {
        const b2 = primBBox(p);
        if (b2[0] >= bb[0] && b2[2] <= bb[2] && b2[1] >= bb[1] && b2[3] <= bb[3]) out.push(p);
      }
    } else if (p.t === "pline") {
      for (let i = 0; i + 1 < p.pts.length; i++) {
        const s = clipSeg(p.pts[i], p.pts[i + 1]);
        if (s) out.push({ t: "line", l: p.l, ref: p.ref, o: p.o, w: p.w, lt: p.lt, a: s[0], b: s[1] });
      }
    } else {
      const b2 = primBBox(p);
      const cx = (b2[0] + b2[2]) / 2;
      const cy = (b2[1] + b2[3]) / 2;
      if (inBox(bb, cx, cy)) out.push(p);
    }
  }
  return out;
}
