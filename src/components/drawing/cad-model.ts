// Model-space layout and picking helpers for the CAD viewer.

import { DISCIPLINES, polyArea, polyPerimeter, primBBox, primDist, primSnaps, type BBox, type Prim, type Pt, type Sheet } from "@/lib/drawing";

/** A sheet placed in world space; (x, y) is its lower-left corner in metres */
export type Placement = { sheet: Sheet; x: number; y: number; i: number };

export function modelLayout(sheets: Sheet[]): Placement[] {
  const out: Placement[] = [];
  let y = 0;
  for (const d of DISCIPLINES) {
    const row = sheets.map((s, i) => [s, i] as const).filter(([s]) => s.disc === d.key);
    if (!row.length) continue;
    const rh = Math.max(...row.map(([s]) => s.h));
    let x = 0;
    for (const [s, i] of row) {
      out.push({ sheet: s, x, y: y - rh, i });
      x += s.w + 8;
    }
    y -= rh + 10;
  }
  return out;
}

export function extents(pl: Placement[]): BBox {
  let bb: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pl) bb = [Math.min(bb[0], p.x), Math.min(bb[1], p.y), Math.max(bb[2], p.x + p.sheet.w), Math.max(bb[3], p.y + p.sheet.h)];
  return bb;
}

export function placementAt(pl: Placement[], wx: number, wy: number) {
  return pl.find((p) => wx >= p.x && wx <= p.x + p.sheet.w && wy >= p.y && wy <= p.y + p.sheet.h);
}

export type Pick = { p: Placement; k: number; prim: Prim };

export function pickPrim(pl: Placement[], wx: number, wy: number, tol: number, skip: (l: string) => boolean): Pick | null {
  const p = placementAt(pl, wx, wy);
  if (!p) return null;
  const q: Pt = [wx - p.x, wy - p.y];
  let best: Pick | null = null;
  let bd = tol;
  let hatch: Pick | null = null;
  let hatchArea = Infinity;
  for (let k = 0; k < p.sheet.prims.length; k++) {
    const prim = p.sheet.prims[k];
    if (skip(prim.l)) continue;
    const d = primDist(prim, q);
    if (prim.t === "hatch") {
      if (d === 0) {
        const bb = primBBox(prim);
        const a = (bb[2] - bb[0]) * (bb[3] - bb[1]);
        if (a < hatchArea) {
          hatchArea = a;
          hatch = { p, k, prim };
        }
      }
      continue;
    }
    if (d < bd || (d === 0 && best && best.prim.t === "text")) {
      bd = d;
      best = { p, k, prim };
    }
  }
  return best ?? hatch;
}

export function snapPoint(pl: Placement[], wx: number, wy: number, tol: number, skip: (l: string) => boolean): Pt | null {
  const p = placementAt(pl, wx, wy);
  if (!p) return null;
  const q: Pt = [wx - p.x, wy - p.y];
  let best: Pt | null = null;
  let bd = tol;
  for (const prim of p.sheet.prims) {
    if (skip(prim.l) || prim.t === "text" || prim.t === "hatch") continue;
    const bb = primBBox(prim);
    if (q[0] < bb[0] - tol || q[0] > bb[2] + tol || q[1] < bb[1] - tol || q[1] > bb[3] + tol) continue;
    for (const s of primSnaps(prim)) {
      const d = Math.hypot(s[0] - q[0], s[1] - q[1]);
      if (d < bd) {
        bd = d;
        best = [s[0] + p.x, s[1] + p.y];
      }
    }
  }
  return best;
}

export const TYPE_NAME: Record<Prim["t"], string> = { line: "Line", pline: "Polyline", circle: "Circle", arc: "Arc", text: "Text", dim: "Dimension", hatch: "Hatch" };

const f4 = (v: number) => v.toFixed(4);

/** Rows for the properties palette and the LIST command, in world coordinates */
export function describe(prim: Prim, ox: number, oy: number): [string, string][] {
  const P = (p: Pt) => `${f4(p[0] + ox)}, ${f4(p[1] + oy)}`;
  switch (prim.t) {
    case "line": {
      const L = Math.hypot(prim.b[0] - prim.a[0], prim.b[1] - prim.a[1]);
      const ang = ((Math.atan2(prim.b[1] - prim.a[1], prim.b[0] - prim.a[0]) * 180) / Math.PI + 360) % 360;
      return [
        ["Start", P(prim.a)],
        ["End", P(prim.b)],
        ["Length", f4(L)],
        ["Angle", `${ang.toFixed(2)}°`],
      ];
    }
    case "pline":
      return [
        ["Vertices", String(prim.pts.length)],
        ["Closed", prim.closed ? "Yes" : "No"],
        ["Length", f4(polyPerimeter(prim.pts, !!prim.closed))],
        ...(prim.closed ? ([["Area", `${f4(polyArea(prim.pts))} ตร.ม.`]] as [string, string][]) : []),
        ["First vertex", P(prim.pts[0])],
      ];
    case "circle":
      return [
        ["Center", P(prim.c)],
        ["Radius", f4(prim.r)],
        ["Diameter", f4(prim.r * 2)],
        ["Area", f4(Math.PI * prim.r * prim.r)],
      ];
    case "arc":
      return [
        ["Center", P(prim.c)],
        ["Radius", f4(prim.r)],
        ["Start angle", `${prim.a0.toFixed(2)}°`],
        ["End angle", `${prim.a1.toFixed(2)}°`],
      ];
    case "text":
      return [
        ["Contents", prim.s],
        ["Position", P(prim.p)],
        ["Height", f4(prim.h)],
        ["Rotation", `${(prim.rot ?? 0).toFixed(2)}°`],
        ["Style", prim.mono ? "MONO" : "THAI"],
      ];
    case "dim":
      return [
        ["Measurement", prim.s ?? Math.hypot(prim.b[0] - prim.a[0], prim.b[1] - prim.a[1]).toFixed(2)],
        ["Ext. line 1", P(prim.a)],
        ["Ext. line 2", P(prim.b)],
        ["Dim style", "TH-ARCH"],
      ];
    case "hatch":
      return [
        ["Pattern", prim.pat === "solid" ? "SOLID" : prim.pat === "lines" ? "ANSI31" : prim.pat === "cross" ? "ANSI37" : "EARTH"],
        ["Spacing", f4(prim.sp ?? 0.2)],
        ["Area", `${f4(polyArea(prim.pts))} ตร.ม.`],
      ];
  }
}
