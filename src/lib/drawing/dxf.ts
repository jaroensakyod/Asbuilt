// DXF R12 (AC1009) ASCII exporter: LAYER/LTYPE/STYLE tables and
// LINE / POLYLINE / CIRCLE / ARC / TEXT entities. Dimensions and line
// hatches are exploded; solid fills export their boundary.

import { dimGeometry, hatchLines, primsBBox } from "./geom";
import { LAYERS, layerDef } from "./layers";
import type { LineType, Prim, Pt, Sheet } from "./types";

const f = (v: number) => (Math.round(v * 10000) / 10000).toString();

/** Non-ASCII characters become \U+XXXX escapes, which AutoCAD decodes in TEXT */
const enc = (s: string) =>
  s.replace(/[^\x20-\x7e]/g, (c) => `\\U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`);

const LTYPES: { name: LineType; desc: string; pat: number[] }[] = [
  { name: "CONTINUOUS", desc: "Solid line", pat: [] },
  { name: "DASHED", desc: "__ __ __", pat: [0.3, -0.15] },
  { name: "HIDDEN", desc: "_ _ _ _", pat: [0.16, -0.09] },
  { name: "CENTER", desc: "____ _ ____", pat: [0.7, -0.14, 0.1, -0.14] },
  { name: "PHANTOM", desc: "_____ _ _ _____", pat: [0.9, -0.14, 0.1, -0.14, 0.1, -0.14] },
];

export type DxfPart = { prims: Prim[]; dx?: number; dy?: number };

export function toDxf(parts: DxfPart[], o: { hidden?: Iterable<string>; frozen?: Iterable<string> } = {}): string {
  const out: string[] = [];
  const g = (code: number, v: string | number) => {
    out.push(String(code), typeof v === "number" ? f(v) : v);
  };
  const hidden = new Set(o.hidden ?? []);
  const frozen = new Set(o.frozen ?? []);

  // extents
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const used = new Set<string>(["0"]);
  for (const p of parts) {
    const bb = primsBBox(p.prims);
    x0 = Math.min(x0, bb[0] + (p.dx ?? 0));
    y0 = Math.min(y0, bb[1] + (p.dy ?? 0));
    x1 = Math.max(x1, bb[2] + (p.dx ?? 0));
    y1 = Math.max(y1, bb[3] + (p.dy ?? 0));
    for (const q of p.prims) used.add(q.l);
  }
  if (!isFinite(x0)) [x0, y0, x1, y1] = [0, 0, 1, 1];

  g(999, "Asbuilt drawing export (DXF R12)");
  g(0, "SECTION");
  g(2, "HEADER");
  g(9, "$ACADVER");
  g(1, "AC1009");
  g(9, "$INSBASE");
  g(10, 0);
  g(20, 0);
  g(30, 0);
  g(9, "$EXTMIN");
  g(10, x0);
  g(20, y0);
  g(30, 0);
  g(9, "$EXTMAX");
  g(10, x1);
  g(20, y1);
  g(30, 0);
  g(9, "$LIMMIN");
  g(10, x0);
  g(20, y0);
  g(9, "$LIMMAX");
  g(10, x1);
  g(20, y1);
  g(9, "$LTSCALE");
  g(40, 1);
  g(9, "$TEXTSTYLE");
  g(7, "STANDARD");
  g(9, "$CLAYER");
  g(8, "0");
  g(0, "ENDSEC");

  g(0, "SECTION");
  g(2, "TABLES");
  g(0, "TABLE");
  g(2, "LTYPE");
  g(70, String(LTYPES.length));
  for (const lt of LTYPES) {
    g(0, "LTYPE");
    g(2, lt.name);
    g(70, "0");
    g(3, lt.desc);
    g(72, "65");
    g(73, String(lt.pat.length));
    g(40, lt.pat.reduce((s, v) => s + Math.abs(v), 0));
    for (const v of lt.pat) g(49, v);
  }
  g(0, "ENDTAB");

  const layerNames = [...used];
  g(0, "TABLE");
  g(2, "LAYER");
  g(70, String(layerNames.length));
  for (const name of layerNames) {
    const d = name === "0" ? { aci: 7, lt: "CONTINUOUS" as LineType } : layerDef(name);
    g(0, "LAYER");
    g(2, name);
    g(70, frozen.has(name) ? "1" : "0");
    g(62, String(hidden.has(name) ? -d.aci : d.aci));
    g(6, d.lt);
  }
  g(0, "ENDTAB");

  g(0, "TABLE");
  g(2, "STYLE");
  g(70, "1");
  g(0, "STYLE");
  g(2, "STANDARD");
  g(70, "0");
  g(40, 0);
  g(41, 1);
  g(50, 0);
  g(71, "0");
  g(42, 0.25);
  g(3, "txt");
  g(4, "");
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  g(0, "SECTION");
  g(2, "ENTITIES");
  for (const part of parts) {
    const dx = part.dx ?? 0;
    const dy = part.dy ?? 0;
    const line = (l: string, a: Pt, b: Pt, lt?: LineType) => {
      g(0, "LINE");
      g(8, l);
      if (lt) g(6, lt);
      g(10, a[0] + dx);
      g(20, a[1] + dy);
      g(30, 0);
      g(11, b[0] + dx);
      g(21, b[1] + dy);
      g(31, 0);
    };
    const text = (l: string, p: Pt, h: number, s: string, al?: string, va?: string, rot?: number) => {
      g(0, "TEXT");
      g(8, l);
      g(10, p[0] + dx);
      g(20, p[1] + dy);
      g(30, 0);
      g(40, h);
      g(1, enc(s));
      if (rot) g(50, rot);
      const h72 = al === "c" ? 1 : al === "r" ? 2 : 0;
      const v73 = va === "m" ? 2 : va === "t" ? 3 : 0;
      if (h72 || v73) {
        g(72, String(h72));
        g(11, p[0] + dx);
        g(21, p[1] + dy);
        g(31, 0);
        g(73, String(v73));
      }
    };
    const poly = (l: string, pts: Pt[], closed: boolean, lt?: LineType) => {
      g(0, "POLYLINE");
      g(8, l);
      if (lt) g(6, lt);
      g(66, "1");
      g(10, 0);
      g(20, 0);
      g(30, 0);
      g(70, closed ? "1" : "0");
      for (const q of pts) {
        g(0, "VERTEX");
        g(8, l);
        g(10, q[0] + dx);
        g(20, q[1] + dy);
        g(30, 0);
      }
      g(0, "SEQEND");
      g(8, l);
    };
    for (const p of part.prims) {
      const lt = "lt" in p && p.lt && p.lt !== layerDef(p.l).lt ? p.lt : undefined;
      switch (p.t) {
        case "line":
          line(p.l, p.a, p.b, lt);
          break;
        case "pline":
          poly(p.l, p.pts, !!p.closed, lt);
          break;
        case "circle":
          g(0, "CIRCLE");
          g(8, p.l);
          g(10, p.c[0] + dx);
          g(20, p.c[1] + dy);
          g(30, 0);
          g(40, p.r);
          break;
        case "arc":
          g(0, "ARC");
          g(8, p.l);
          g(10, p.c[0] + dx);
          g(20, p.c[1] + dy);
          g(30, 0);
          g(40, p.r);
          g(50, p.a0);
          g(51, p.a1);
          break;
        case "text":
          text(p.l, p.p, p.h, p.s, p.al, p.va, p.rot);
          break;
        case "dim": {
          const d = dimGeometry(p);
          for (const [a, b] of [...d.ext, d.dimLine, ...d.ticks]) line(p.l, a, b);
          text(p.l, d.textP, p.h, d.text, "c", "b", d.ang);
          break;
        }
        case "hatch":
          if (p.pat === "solid") poly(p.l, p.pts, true);
          else for (const [a, b] of hatchLines(p)) line(p.l, a, b);
          break;
      }
    }
  }
  g(0, "ENDSEC");
  g(0, "EOF");
  return out.join("\r\n") + "\r\n";
}

export function sheetDxf(sheet: Sheet, hidden?: Iterable<string>) {
  return toDxf([{ prims: sheet.prims }], { hidden });
}

export const layerCount = () => LAYERS.length;
