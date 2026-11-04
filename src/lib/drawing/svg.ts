// SVG renderer. Entities are batched per layer into a few <path> elements
// (one per lineweight/linetype/opacity) so a sheet with thousands of
// entities becomes a few hundred DOM nodes. Colours come from a theme
// stylesheet keyed on data-l, so switching paper theme or hiding layers
// never regenerates the markup.

import { dimGeometry, hatchLines } from "./geom";
import { LAYERS, layerDef, type Theme } from "./layers";
import type { LineType, Prim, Pt, Sheet } from "./types";

const n = (v: number) => Math.round(v * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const DASH: Record<LineType, number[]> = {
  CONTINUOUS: [],
  DASHED: [3, 1.5],
  HIDDEN: [1.6, 0.9],
  CENTER: [7, 1.4, 1, 1.4],
  PHANTOM: [9, 1.4, 1, 1.4, 1, 1.4],
};

const LITE_LAYERS = new Set(["A-WALL", "S-COLS", "A-GLAZ", "A-ROOF", "A-ELEV", "A-SECT", "S-FTNG", "S-BEAM", "TITLE", "A-SITE"]);

type Bucket = { strokes: Map<string, string[]>; fills: Map<string, string[]>; texts: string[] };

export type RenderOpts = { lite?: boolean; scale: number; h: number; dx?: number; dy?: number };

/** Render entities to SVG markup (no outer <svg>). Coordinates: metres, y flipped. */
export function renderPrims(prims: Prim[], o: RenderOpts): string {
  const k = o.scale / 1000;
  const dx = o.dx ?? 0;
  const dy = o.dy ?? 0;
  const X = (v: number) => n(v + dx);
  const Y = (v: number) => n(o.h - v + dy);
  const P = (p: Pt) => `${X(p[0])} ${Y(p[1])}`;
  const buckets = new Map<string, Bucket>();
  const bucket = (l: string) => {
    let bk = buckets.get(l);
    if (!bk) {
      bk = { strokes: new Map(), fills: new Map(), texts: [] };
      buckets.set(l, bk);
    }
    return bk;
  };
  const stroke = (l: string, w: number | undefined, lt: LineType | undefined, op: number | undefined, d: string) => {
    const def = layerDef(l);
    const key = `${w ?? def.lw}|${lt ?? def.lt}|${op ?? 1}`;
    const bk = bucket(l).strokes;
    const arr = bk.get(key);
    if (arr) arr.push(d);
    else bk.set(key, [d]);
  };
  const fill = (l: string, op: number | undefined, d: string) => {
    const key = String(op ?? 1);
    const bk = bucket(l).fills;
    const arr = bk.get(key);
    if (arr) arr.push(d);
    else bk.set(key, [d]);
  };
  const text = (l: string, p: Pt, h: number, s: string, al?: string, va?: string, rot?: number, mono?: boolean, bold?: boolean, op?: number) => {
    const sc = n((h * 1.4) / 10);
    const anchor = al === "c" ? ' text-anchor="middle"' : al === "r" ? ' text-anchor="end"' : "";
    const yy = va === "m" ? ' y="3.6"' : va === "t" ? ' y="7.1"' : "";
    const cls = mono ? ' class="m"' : "";
    const fw = bold ? ' font-weight="500"' : "";
    const opa = op !== undefined && op < 1 ? ` opacity="${op}"` : "";
    const r = rot ? ` rotate(${n(-rot)})` : "";
    bucket(l).texts.push(`<text transform="translate(${X(p[0])} ${Y(p[1])})${r} scale(${sc})"${yy}${anchor}${cls}${fw}${opa}>${esc(s)}</text>`);
  };

  for (const p of prims) {
    if (o.lite && (!LITE_LAYERS.has(p.l) || p.t === "text" || p.t === "dim")) continue;
    switch (p.t) {
      case "line":
        stroke(p.l, p.w, p.lt, p.o, `M${P(p.a)}L${P(p.b)}`);
        break;
      case "pline":
        if (p.pts.length < 2) break;
        stroke(p.l, p.w, p.lt, p.o, `M${p.pts.map(P).join("L")}${p.closed ? "Z" : ""}`);
        break;
      case "circle": {
        const r = n(p.r);
        const d = `M${X(p.c[0] - p.r)} ${Y(p.c[1])}a${r} ${r} 0 1 0 ${n(2 * p.r)} 0a${r} ${r} 0 1 0 ${n(-2 * p.r)} 0`;
        if (p.fill) fill(p.l, p.o, d);
        else stroke(p.l, p.w, undefined, p.o, d);
        break;
      }
      case "arc": {
        const a0 = (p.a0 * Math.PI) / 180;
        const a1 = (p.a1 * Math.PI) / 180;
        let sweep = p.a1 - p.a0;
        while (sweep < 0) sweep += 360;
        const s: Pt = [p.c[0] + p.r * Math.cos(a0), p.c[1] + p.r * Math.sin(a0)];
        const e: Pt = [p.c[0] + p.r * Math.cos(a1), p.c[1] + p.r * Math.sin(a1)];
        stroke(p.l, p.w, p.lt, p.o, `M${P(s)}A${n(p.r)} ${n(p.r)} 0 ${sweep > 180 ? 1 : 0} 0 ${P(e)}`);
        break;
      }
      case "text":
        text(p.l, p.p, p.h, p.s, p.al, p.va, p.rot, p.mono, p.bold, p.o);
        break;
      case "dim": {
        const g = dimGeometry(p);
        const d = [...g.ext, g.dimLine].map(([a, b]) => `M${P(a)}L${P(b)}`).join("");
        stroke(p.l, 0.13, "CONTINUOUS", p.o, d);
        stroke(p.l, 0.35, "CONTINUOUS", p.o, g.ticks.map(([a, b]) => `M${P(a)}L${P(b)}`).join(""));
        text(p.l, g.textP, p.h, g.text, "c", "b", g.ang, true, false, p.o);
        break;
      }
      case "hatch":
        if (p.pat === "solid") fill(p.l, p.o, `M${p.pts.map(P).join("L")}Z`);
        else if (!o.lite) {
          const segs = hatchLines(p);
          if (segs.length) stroke(p.l, 0.09, "CONTINUOUS", p.o, segs.map(([a, b]) => `M${P(a)}L${P(b)}`).join(""));
        }
        break;
    }
  }

  const order = [...LAYERS.map((l) => l.name), ...[...buckets.keys()].filter((l) => !LAYERS.some((d) => d.name === l))];
  let out = "";
  for (const l of order) {
    const bk = buckets.get(l);
    if (!bk) continue;
    out += `<g data-l="${l}">`;
    for (const [op, ds] of bk.fills) out += `<path class="f" d="${ds.join("")}"${op !== "1" ? ` opacity="${op}"` : ""}/>`;
    for (const [key, ds] of bk.strokes) {
      const [w, lt, op] = key.split("|");
      const dash = DASH[lt as LineType];
      const da = dash.length ? ` stroke-dasharray="${dash.map((v) => n(v * k)).join(" ")}"` : "";
      out += `<path class="s" d="${ds.join("")}" stroke-width="${n(Number(w) * k)}"${da}${op !== "1" ? ` opacity="${op}"` : ""}/>`;
    }
    out += bk.texts.join("");
    out += "</g>";
  }
  return out;
}

const memo = new WeakMap<Sheet, { full?: string; lite?: string }>();

/** Sheet markup including the paper rectangle, memoised per sheet */
export function sheetMarkup(sheet: Sheet, lite = false): string {
  let m = memo.get(sheet);
  if (!m) {
    m = {};
    memo.set(sheet, m);
  }
  const key = lite ? "lite" : "full";
  const hit = m[key];
  if (hit) return hit;
  const s = `<rect class="pp" width="${n(sheet.w)}" height="${n(sheet.h)}"/>` + renderPrims(sheet.prims, { scale: sheet.scale, h: sheet.h, lite });
  m[key] = s;
  return s;
}

export const FONT_SANS = `var(--font-plex-thai), "IBM Plex Sans Thai", "Noto Sans Thai", Tahoma, sans-serif`;
export const FONT_MONO = `var(--font-plex-mono), "IBM Plex Mono", Consolas, monospace`;

/** Stylesheet mapping layers to theme colours, scoped to a selector */
export function themeCss(theme: Theme, scope: string, hidden: Iterable<string> = [], o: { lwOff?: boolean; paper?: string } = {}) {
  let css = `${scope}{color:${theme.frame}}${scope} .pp{fill:${o.paper ?? theme.bg}}${scope} .s{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}${scope} .f{fill:currentColor;stroke:none}${scope} text{fill:currentColor;stroke:none;font-size:10px;font-family:${FONT_SANS}}${scope} text.m{font-family:${FONT_MONO}}`;
  for (const l of LAYERS) css += `${scope} [data-l="${l.name}"]{color:${l.name === "TITLE" ? theme.frame : theme.color(l)}}`;
  for (const h of hidden) css += `${scope} [data-l="${h}"]{display:none}`;
  if (o.lwOff) css += `${scope} .s{vector-effect:non-scaling-stroke;stroke-width:1px}`;
  return css;
}

/** Standalone SVG file for download / print */
export function standaloneSvg(sheet: Sheet, theme: Theme, hidden: Iterable<string> = []) {
  const css = themeCss(theme, "svg", hidden).replace(/var\(--font-plex-thai\), /g, "").replace(/var\(--font-plex-mono\), /g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 ${n(sheet.w)} ${n(sheet.h)}"><title>${esc(sheet.code)} ${esc(sheet.titleTh)}</title><style>${css}</style>${sheetMarkup(sheet)}</svg>`;
}

/** Small preview as a data URL (lite markup) */
export function thumbDataUrl(sheet: Sheet, theme: Theme, crop?: boolean) {
  const vb = crop ? sheet.content : ([0, 0, sheet.w, sheet.h] as const);
  const pad = crop ? (vb[2] - vb[0]) * 0.04 : 0;
  const x = vb[0] - pad;
  const w = vb[2] - vb[0] + pad * 2;
  const y = sheet.h - vb[3] - pad;
  const h = vb[3] - vb[1] + pad * 2;
  const css = `.s{fill:none;stroke:currentColor;vector-effect:non-scaling-stroke;stroke-width:0.7px}.f{fill:currentColor}.pp{fill:${theme.bg}}` + LAYERS.map((l) => `[data-l="${l.name}"]{color:${l.name === "TITLE" ? theme.frame : theme.color(l)}}`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}"><style>${css}</style><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${theme.bg}"/>${sheetMarkup(sheet, true)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
