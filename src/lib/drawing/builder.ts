// Primitive builder with paper-size helpers. Sizes given through `mm()` are
// millimetres on the printed A3 sheet, converted to metres at the sheet scale.

import type { HatchPattern, LineType, Prim, Pt, TextPrim } from "./types";

export type Opt = { w?: number; lt?: LineType; ref?: string; o?: number };
export type TOpt = { al?: "l" | "c" | "r"; va?: "b" | "m" | "t"; rot?: number; mono?: boolean; bold?: boolean; ref?: string; o?: number };

export class Builder {
  prims: Prim[] = [];
  /** default opacity applied to everything drawn (used to screen backgrounds) */
  fade?: number;
  constructor(public scale: number) {}

  mm(v: number) {
    return (v * this.scale) / 1000;
  }

  private push(p: Prim, o: { ref?: string; o?: number }) {
    if (o.ref) p.ref = o.ref;
    const op = o.o ?? this.fade;
    if (op !== undefined && op < 1) p.o = op;
    this.prims.push(p);
    return p;
  }

  line(l: string, a: Pt, b: Pt, o: Opt = {}) {
    return this.push({ t: "line", l, a, b, w: o.w, lt: o.lt }, o);
  }

  pline(l: string, pts: Pt[], closed = false, o: Opt = {}) {
    return this.push({ t: "pline", l, pts, closed, w: o.w, lt: o.lt }, o);
  }

  rect(l: string, x0: number, y0: number, x1: number, y1: number, o: Opt = {}) {
    return this.pline(
      l,
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      true,
      o,
    );
  }

  circle(l: string, c: Pt, r: number, o: Opt & { fill?: boolean } = {}) {
    return this.push({ t: "circle", l, c, r, w: o.w, fill: o.fill }, o);
  }

  arc(l: string, c: Pt, r: number, a0: number, a1: number, o: Opt = {}) {
    return this.push({ t: "arc", l, c, r, a0, a1, w: o.w, lt: o.lt }, o);
  }

  text(l: string, p: Pt, h: number, s: string, o: TOpt = {}) {
    const t: TextPrim = { t: "text", l, p, h, s };
    if (o.al && o.al !== "l") t.al = o.al;
    if (o.va && o.va !== "b") t.va = o.va;
    if (o.rot) t.rot = o.rot;
    if (o.mono) t.mono = true;
    if (o.bold) t.bold = true;
    return this.push(t, o);
  }

  dim(l: string, a: Pt, b: Pt, off: number, o: { s?: string; ref?: string; h?: number } = {}) {
    return this.push({ t: "dim", l, a, b, off, h: o.h ?? this.mm(1.8), s: o.s }, o);
  }

  hatch(l: string, pts: Pt[], pat: HatchPattern, o: { sp?: number; ang?: number; ref?: string; o?: number } = {}) {
    return this.push({ t: "hatch", l, pts, pat, sp: o.sp, ang: o.ang }, o);
  }

  hatchRect(l: string, x0: number, y0: number, x1: number, y1: number, pat: HatchPattern, o: { sp?: number; ang?: number; ref?: string; o?: number } = {}) {
    return this.hatch(
      l,
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      pat,
      o,
    );
  }

  /** ellipse approximated by a closed polyline */
  ellipse(l: string, c: Pt, rx: number, ry: number, o: Opt = {}) {
    const pts: Pt[] = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)]);
    }
    return this.pline(l, pts, true, o);
  }

  /** Grid bubble: circle with a label */
  bubble(l: string, c: Pt, label: string, r = this.mm(3.2)) {
    this.circle(l, c, r, { w: 0.25, lt: "CONTINUOUS" });
    this.text("A-ANNO", c, r * 0.75, label, { al: "c", va: "m", mono: true });
  }

  /** Door leaf and 90° swing. hinge, closed direction (unit along wall), open direction (unit into room) */
  door(hinge: Pt, along: Pt, into: Pt, width: number, ref?: string) {
    const end: Pt = [hinge[0] + into[0] * width, hinge[1] + into[1] * width];
    this.line("A-DOOR", hinge, end, { w: 0.35, ref });
    const ac = (Math.atan2(along[1], along[0]) * 180) / Math.PI;
    const ao = (Math.atan2(into[1], into[0]) * 180) / Math.PI;
    const d = (((ao - ac) % 360) + 360) % 360;
    if (Math.abs(d - 90) < 1) this.arc("A-DOOR", hinge, width, ac, ao, { w: 0.13, ref });
    else this.arc("A-DOOR", hinge, width, ao, ac, { w: 0.13, ref });
  }

  /** Table in paper millimetres anchored at its top-left corner (sheet coords) */
  table(x: number, yTop: number, cols: { w: number; head: string; al?: "l" | "c" | "r"; mono?: boolean }[], rows: string[][], o: { rowH?: number; textH?: number; l?: string; refs?: (string | undefined)[] } = {}) {
    const l = o.l ?? "A-ANNO";
    const rh = this.mm(o.rowH ?? 4);
    const th = this.mm(o.textH ?? 1.6);
    const widths = cols.map((c) => this.mm(c.w));
    const total = widths.reduce((s, v) => s + v, 0);
    const n = rows.length + 1;
    this.rect("TITLE", x, yTop - rh * n, x + total, yTop, { w: 0.35 });
    for (let i = 1; i < n; i++) this.line("TITLE", [x, yTop - rh * i], [x + total, yTop - rh * i], { w: i === 1 ? 0.25 : 0.09 });
    let cx = x;
    widths.forEach((w, ci) => {
      if (ci > 0) this.line("TITLE", [cx, yTop], [cx, yTop - rh * n], { w: 0.13 });
      const c = cols[ci];
      const tx = c.al === "r" ? cx + w - this.mm(1) : c.al === "c" ? cx + w / 2 : cx + this.mm(1);
      this.text(l, [tx, yTop - rh * 0.5], th, c.head, { al: c.al, va: "m", bold: true });
      rows.forEach((r, ri) => {
        const v = r[ci];
        if (v) this.text(l, [tx, yTop - rh * (ri + 1.5)], th, v, { al: c.al, va: "m", mono: c.mono, ref: o.refs?.[ri] });
      });
      cx += w;
    });
    return rh * n;
  }

  northArrow(c: Pt, r = this.mm(6)) {
    this.circle("A-ANNO", c, r, { w: 0.25 });
    this.pline(
      "A-ANNO",
      [
        [c[0], c[1] + r * 0.9],
        [c[0] + r * 0.35, c[1] - r * 0.6],
        [c[0], c[1] - r * 0.3],
        [c[0] - r * 0.35, c[1] - r * 0.6],
      ],
      true,
      { w: 0.25 },
    );
    this.hatch(
      "A-ANNO",
      [
        [c[0], c[1] + r * 0.9],
        [c[0], c[1] - r * 0.3],
        [c[0] - r * 0.35, c[1] - r * 0.6],
      ],
      "solid",
    );
    this.text("A-ANNO", [c[0], c[1] + r * 1.25], r * 0.45, "N", { al: "c", bold: true });
  }
}
