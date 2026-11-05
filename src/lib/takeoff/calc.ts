// Quantity takeoff for the 7 finishing / masonry categories, every line with a code and its shapes
// (for the 3D highlight). Rules are simple and stated on screen; numbers are estimates to check
// against the drawings. Pure: relative imports only.

import type { BuildingModel } from "../house";
import { BLOCKS, CAT_OF, CATS, type Box, type Cat, type CatSummary, type Opening, type TakeoffEdits, type TakeoffItem, type TakeoffRoom, type TakeoffSettings, type TakeoffSource, type Wall } from "./types";
import { applyEdits, roomsBeside, sourceFromModel } from "./walls";
import type { CatRate } from "./pricing";

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const COL = 0.25; // RC column width in the model
const OUTSIDE = "ภายนอก";

/** World box for a span [s0,s1] × [y0,y1] on a wall, offset across the wall by `off` with thickness `t`. */
function wallBox(w: Wall, s0: number, s1: number, y0: number, y1: number, t: number, off = 0): Box {
  const ms = (s0 + s1) / 2;
  const my = w.base + (y0 + y1) / 2;
  return w.orient === "h"
    ? { pos: [ms, my, w.c + off], size: [Math.max(s1 - s0, 0.02), Math.max(y1 - y0, 0.02), t] }
    : { pos: [w.c + off, my, ms], size: [t, Math.max(y1 - y0, 0.02), Math.max(s1 - s0, 0.02)] };
}

/** Solid parts of a wall span up to height `top`: full-height between openings, sill/head pieces at openings. */
function solidBoxes(w: Wall, p: number, q: number, top: number, t: number, off = 0, bottom = 0): Box[] {
  const out: Box[] = [];
  const push = (s0: number, s1: number, y0: number, y1: number) => {
    const lo = Math.max(y0, bottom);
    if (y1 - lo > 0.02 && s1 - s0 > 0.01) out.push(wallBox(w, s0, s1, lo, y1, t, off));
  };
  let s = p;
  for (const o of w.openings) {
    const o0 = Math.max(o.s0, p);
    const o1 = Math.min(o.s1, q);
    if (o1 <= o0) continue;
    if (o0 > s) push(s, o0, 0, top);
    if (o.sill > 0.01) push(o0, o1, 0, Math.min(o.sill, top));
    if (o.head < top) push(o0, o1, o.head, top);
    s = o1;
  }
  if (q > s) push(s, q, 0, top);
  return out;
}

/** Opening area inside [p,q] and below `top`. */
function openingArea(w: Wall, p: number, q: number, top: number) {
  let a = 0;
  for (const o of w.openings) {
    const width = Math.min(o.s1, q) - Math.max(o.s0, p);
    const h = Math.min(o.head, top) - o.sill;
    if (width > 0 && h > 0) a += width * h;
  }
  return a;
}

/** Column faces inside [p,q] (the masonry stops at RC columns). */
function columnArea(w: Wall, p: number, q: number, top: number) {
  let a = 0;
  for (const s of w.columns) {
    const width = Math.min(s + COL / 2, q) - Math.max(s - COL / 2, p);
    if (width > 0) a += width * top;
  }
  return a;
}

const openingLabel = (o: Opening) => `${o.kind === "door" ? "ประตู" : "หน้าต่าง"} ${o.id} ${r2(o.s1 - o.s0).toFixed(2)}×${r2(o.head - o.sill).toFixed(2)} ม.`;

type Side = { dir: 1 | -1; p: number; q: number; roomId: string; roomName: string; bath: boolean };

function sidesOf(w: Wall, rooms: TakeoffRoom[]): Side[] {
  const beside: Side[] = roomsBeside(w, rooms).map((x) => ({ dir: x.dir, p: x.p, q: x.q, roomId: x.room.id, roomName: x.room.name, bath: x.room.bath }));
  if (w.exterior && w.outside) beside.push({ dir: w.outside, p: w.a, q: w.b, roomId: "", roomName: OUTSIDE, bath: false });
  // no room data on a side (IFC without spaces): still plaster / paint that face
  for (const dir of [-1, 1] as const)
    if (!beside.some((x) => x.dir === dir)) beside.push({ dir, p: w.a, q: w.b, roomId: "?", roomName: dir === 1 ? "ด้าน B" : "ด้าน A", bath: false });
  return beside.sort((x, y) => x.dir - y.dir || x.p - y.p);
}

export type Takeoff = { items: TakeoffItem[]; walls: Wall[]; summary: CatSummary[]; source: TakeoffSource };

/** Takeoff of the system house model (no edits). */
export function computeTakeoff(m: BuildingModel, s: TakeoffSettings, edits?: TakeoffEdits | null): Takeoff {
  return computeFromSource(sourceFromModel(m), s, edits);
}

export function computeFromSource(src: TakeoffSource, s: TakeoffSettings, edits?: TakeoffEdits | null): Takeoff {
  const walls = applyEdits(src.walls, edits);
  const rooms = src.rooms;
  const items: Omit<TakeoffItem, "code">[] = [];
  const add = (x: Omit<TakeoffItem, "code">) => {
    if (x.qty > 0.0005) items.push(x);
  };

  for (const w of walls) {
    const h = w.height;
    const len = r2(w.b - w.a);
    const block = BLOCKS[w.block ?? s.block];
    const sides = sidesOf(w, rooms);
    const roomNames = [...new Set(sides.map((x) => x.roomName))];
    const roomIds = [...new Set(sides.map((x) => x.roomId))];
    const face = (dir: 1 | -1) => dir * (w.thick / 2 + 0.012);

    // ---- อ masonry: one line per wall
    const gross = len * h;
    const open = openingArea(w, w.a, w.b, h);
    const cols = columnArea(w, w.a, w.b, h);
    const net = r2(gross - open - cols);
    add({
      cat: "masonry",
      floor: w.floor,
      roomIds,
      rooms: roomNames,
      kind: w.exterior ? "ผนังภายนอก" : "ผนังภายใน",
      detail: `ผนัง ${w.id} ยาว ${len.toFixed(2)} ม. สูง ${h.toFixed(2)} ม. หักช่องเปิด ${r2(open).toFixed(2)} ตร.ม.${cols ? ` หักเสา ${r2(cols).toFixed(2)} ตร.ม.` : ""} · ${block.label}${w.edited ? " · แก้ไขแล้ว" : ""}`,
      qty: net,
      count: Math.ceil(net * block.perM2),
      countUnit: block.unit,
      rate: block.perM2,
      wallId: w.id,
      shapes: solidBoxes(w, w.a, w.b, h, w.thick),
    });

    // ---- ฉ ส ผ: each side of the wall, split by the room it faces
    for (const sd of sides) {
      const plaster = r2((sd.q - sd.p) * h - openingArea(w, sd.p, sd.q, h) - columnArea(w, sd.p, sd.q, h));
      const sideName = sd.roomId === "?" ? sd.roomName : sd.roomId ? `ด้าน${sd.roomName}` : "ด้านภายนอก";
      const base = { floor: w.floor, roomIds: [sd.roomId], rooms: [sd.roomName], wallId: w.id };
      const shape = solidBoxes(w, sd.p, sd.q, h, 0.02, face(sd.dir));
      add({ ...base, cat: "plaster", kind: sideName, detail: `ผนัง ${w.id} ${sideName} ช่วง ${r2(sd.q - sd.p).toFixed(2)} ม. สูง ${h.toFixed(2)} ม.`, qty: plaster, shapes: shape });
      const tileTop = sd.bath ? Math.min(s.wallTileHeight, h) : 0;
      const tile = tileTop ? r2((sd.q - sd.p) * tileTop - openingArea(w, sd.p, sd.q, tileTop) - columnArea(w, sd.p, sd.q, tileTop)) : 0;
      if (tile > 0) {
        const tileArea = s.wallTile[0] * s.wallTile[1];
        add({
          ...base,
          cat: "wallTile",
          kind: sideName,
          detail: `ผนัง ${w.id} ${sideName} สูง ${tileTop.toFixed(2)} ม. · กระเบื้อง ${Math.round(s.wallTile[0] * 100)}×${Math.round(s.wallTile[1] * 100)} ซม.`,
          qty: tile,
          count: Math.ceil(tile / tileArea),
          countUnit: "แผ่น",
          shapes: solidBoxes(w, sd.p, sd.q, tileTop, 0.025, face(sd.dir) * 1.15),
        });
      }
      const paint = r2(plaster - tile);
      if (paint > 0) add({ ...base, cat: "paint", kind: sideName, detail: `ผนัง ${w.id} ${sideName}${tile ? ` หักกระเบื้อง ${tile.toFixed(2)} ตร.ม.` : ""}`, qty: paint, shapes: tile ? solidBoxes(w, sd.p, sd.q, h, 0.02, face(sd.dir), tileTop) : shape });
    }

    // ---- ฉ/ส reveals: the returns around each opening (wall thickness × edges)
    for (const o of w.openings) {
      const edges = o.kind === "door" ? 2 * (o.head - o.sill) + (o.s1 - o.s0) : 2 * (o.head - o.sill) + 2 * (o.s1 - o.s0);
      const area = r2(edges * block.thick);
      const near = sides.filter((x) => x.p <= (o.s0 + o.s1) / 2 && x.q >= (o.s0 + o.s1) / 2);
      const base = { floor: w.floor, roomIds: near.map((x) => x.roomId), rooms: near.map((x) => x.roomName), wallId: w.id, kind: "ขอบช่องเปิด" };
      const shapes = [wallBox(w, o.s0, o.s1, o.sill, o.head, w.thick + 0.03)];
      add({ ...base, cat: "plaster", detail: `ขอบ${openingLabel(o)} ลึก ${block.thick.toFixed(3)} ม.`, qty: area, shapes });
      add({ ...base, cat: "paint", detail: `ขอบ${openingLabel(o)}`, qty: area, shapes });
    }

    // ---- สอ ties: vertical at opening jambs + spacing, lintels/sills at openings, band if tall
    const sec = s.tieSection;
    const tieVol = (length: number) => r3(length * sec * sec);
    const supports: { s: number; free: boolean }[] = [{ s: w.a, free: false }, { s: w.b, free: false }, ...w.columns.map((x) => ({ s: x, free: false }))];
    const near = (x: number) => supports.some((p) => Math.abs(p.s - x) < 0.35);
    const ties: { s: number; why: string }[] = [];
    for (const o of w.openings) {
      for (const [x, why] of [
        [o.s0 - sec / 2, `ข้าง${o.kind === "door" ? "ประตู" : "หน้าต่าง"} ${o.id} (ซ้าย)`],
        [o.s1 + sec / 2, `ข้าง${o.kind === "door" ? "ประตู" : "หน้าต่าง"} ${o.id} (ขวา)`],
      ] as [number, string][]) {
        if (x <= w.a || x >= w.b || near(x)) continue;
        supports.push({ s: x, free: true });
        ties.push({ s: x, why });
      }
    }
    supports.sort((p, q) => p.s - q.s);
    const spans = supports.slice(1).map((p, i) => [supports[i].s, p.s] as [number, number]);
    for (const [p, q] of spans) {
      if (w.openings.some((o) => o.s0 >= p - 0.2 && o.s1 <= q + 0.2)) continue; // the span is an opening
      const gap = q - p;
      if (gap <= s.tieSpacing + 1e-6) continue;
      const n = Math.ceil(gap / s.tieSpacing) - 1;
      for (let k = 1; k <= n; k++) {
        const x = p + (gap * k) / (n + 1);
        if (w.openings.some((o) => x > o.s0 - 0.1 && x < o.s1 + 0.1)) continue;
        ties.push({ s: x, why: `ทุกระยะไม่เกิน ${s.tieSpacing.toFixed(2)} ม.` });
      }
    }
    ties.sort((p, q) => p.s - q.s);
    for (const t of ties) {
      const vol = tieVol(h);
      add({
        cat: "ties",
        floor: w.floor,
        roomIds,
        rooms: roomNames,
        kind: "เสาเอ็น",
        detail: `เสาเอ็น ${w.id} ที่ระยะ ${r2(t.s - w.a).toFixed(2)} ม. สูง ${h.toFixed(2)} ม. · ${t.why}`,
        qty: vol,
        count: 1,
        countUnit: "ต้น",
        wallId: w.id,
        shapes: [wallBox(w, t.s - sec / 2, t.s + sec / 2, 0, h, w.thick + 0.04)],
      });
    }
    for (const o of w.openings) {
      const beams: [number, string][] = [];
      if (o.head < h - 0.05) beams.push([o.head, "เหนือ"]);
      if (o.kind === "window" && o.sill > 0.05) beams.push([o.sill - sec, "ใต้"]);
      for (const [y, where] of beams) {
        const s0 = Math.max(w.a, o.s0 - s.bearing);
        const s1 = Math.min(w.b, o.s1 + s.bearing);
        const L = r2(s1 - s0);
        add({
          cat: "ties",
          floor: w.floor,
          roomIds,
          rooms: roomNames,
          kind: "คานเอ็น",
          detail: `คานเอ็น${where}${openingLabel(o)} ยาว ${L.toFixed(2)} ม. (ฝากข้างละ ${s.bearing.toFixed(2)} ม.)`,
          qty: tieVol(L),
          count: 1,
          countUnit: "ตัว",
          wallId: w.id,
          shapes: [wallBox(w, s0, s1, y, y + sec, w.thick + 0.04)],
        });
      }
    }
    if (h > s.bandAbove) {
      const y = h / 2;
      let L = len;
      for (const o of w.openings) if (o.sill < y && o.head > y) L -= o.s1 - o.s0;
      add({
        cat: "ties",
        floor: w.floor,
        roomIds,
        rooms: roomNames,
        kind: "คานเอ็น",
        detail: `คานเอ็นกลางผนัง ${w.id} ยาว ${r2(L).toFixed(2)} ม. (ผนังสูงเกิน ${s.bandAbove.toFixed(2)} ม.)`,
        qty: tieVol(L),
        count: 1,
        countUnit: "แนว",
        wallId: w.id,
        shapes: [wallBox(w, w.a, w.b, y, y + sec, w.thick + 0.04)],
      });
    }

    // ---- ซ corner bead: every opening edge on each face of the wall
    for (const o of w.openings) {
      const mid = (o.s0 + o.s1) / 2;
      const faces = sides.filter((x) => x.p <= mid && x.q >= mid);
      for (const f of faces) {
        const side = f.roomId === "?" ? f.roomName : f.roomId ? `ด้าน${f.roomName}` : "ด้านภายนอก";
        const off = face(f.dir) * 1.3;
        const hgt = r2(o.head - o.sill);
        const wid = r2(o.s1 - o.s0);
        const edges: [string, number, Box][] = [
          ["วงกบซ้าย", hgt, wallBox(w, o.s0 - 0.015, o.s0 + 0.015, o.sill, o.head, 0.03, off)],
          ["วงกบขวา", hgt, wallBox(w, o.s1 - 0.015, o.s1 + 0.015, o.sill, o.head, 0.03, off)],
          ["ขอบบน", wid, wallBox(w, o.s0, o.s1, o.head - 0.015, o.head + 0.015, 0.03, off)],
        ];
        if (o.sill > 0.05) edges.push(["ขอบล่าง", wid, wallBox(w, o.s0, o.s1, o.sill - 0.015, o.sill + 0.015, 0.03, off)]);
        for (const [kind, L, box] of edges)
          add({
            cat: "bead",
            floor: w.floor,
            roomIds: [f.roomId],
            rooms: [f.roomName],
            kind,
            detail: `${o.kind === "door" ? "ประตู" : "หน้าต่าง"} ${o.id} ${kind} · ${side}`,
            qty: L,
            count: Math.ceil(L / s.beadStick - 1e-9) || 1,
            countUnit: "เส้น",
            wallId: w.id,
            shapes: [box],
          });
      }
    }
  }

  // outside building corners, full storey height
  if (s.outerCorners)
    for (const k of src.corners) {
      const L = r2(k.height);
      items.push({
        cat: "bead",
        floor: k.floor,
        roomIds: [""],
        rooms: [OUTSIDE],
        kind: "มุมอาคาร",
        detail: `มุมอาคารภายนอก (${r2(k.x)}, ${r2(k.z)}) สูง ${L.toFixed(2)} ม.`,
        qty: L,
        count: Math.ceil(L / s.beadStick - 1e-9),
        countUnit: "เส้น",
        shapes: [{ pos: [k.x + k.ox, k.base + L / 2, k.z + k.oz], size: [0.04, L, 0.04] }],
      });
    }

  // ---- พ floor tiles per room (floor level = the lowest wall base on that floor)
  const floorBase = new Map<number, number>();
  for (const w of src.walls) floorBase.set(w.floor, Math.min(floorBase.get(w.floor) ?? Infinity, w.base));
  for (const r of rooms) {
    if (!r.floorTile) continue;
    const area = r2((r.x1 - r.x0) * (r.z1 - r.z0));
    const y = (floorBase.get(r.floor) ?? 0) + 0.02;
    add({
      cat: "floorTile",
      floor: r.floor,
      roomIds: [r.id],
      rooms: [r.name],
      kind: "พื้นห้อง",
      detail: `${r.name} ${r2(r.x1 - r.x0).toFixed(2)}×${r2(r.z1 - r.z0).toFixed(2)} ม. · กระเบื้อง ${Math.round(s.floorTile * 100)}×${Math.round(s.floorTile * 100)} ซม.`,
      qty: area,
      count: Math.ceil(area / (s.floorTile * s.floorTile)),
      countUnit: "แผ่น",
      shapes: [{ pos: [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2], size: [r.x1 - r.x0 - 0.04, 0.03, r.z1 - r.z0 - 0.04] }],
    });
  }

  // codes: per category, in floor order
  const order = new Map(CATS.map((c, i) => [c.key, i]));
  const counter = new Map<Cat, number>();
  const sorted = items.sort((x, y) => (order.get(x.cat)! - order.get(y.cat)!) || x.floor - y.floor);
  const coded: TakeoffItem[] = sorted.map((x) => {
    const n = (counter.get(x.cat) ?? 0) + 1;
    counter.set(x.cat, n);
    return { ...x, code: `${CAT_OF[x.cat].prefix}${n}` };
  });

  return { items: coded, walls, summary: summarize(coded, s), source: src };
}

/** Totals per category for a (filtered) list of lines. */
export function summarize(items: TakeoffItem[], s: TakeoffSettings, rates?: Record<Cat, CatRate> | null): CatSummary[] {
  const block = BLOCKS[s.block];
  return CATS.map(({ key }) => {
    const lines = items.filter((x) => x.cat === key);
    const qty = r2(lines.reduce((a, x) => a + x.qty, 0));
    const waste = s.waste[key];
    const k = 1 + waste / 100;
    const qtyWithWaste = key === "ties" ? r3(qty * k) : r2(qty * k);
    let purchase = 0;
    let purchaseUnit = CAT_OF[key].unit;
    let purchaseNote = "";
    switch (key) {
      case "masonry":
        // walls may use different blocks: sum each line's blocks
        purchase = Math.ceil(lines.reduce((a, x) => a + x.qty * k * (x.rate ?? block.perM2), 0) - 1e-9);
        purchaseUnit = block.unit;
        purchaseNote = lines.some((x) => x.rate != null && x.rate !== block.perM2) ? "รวมผนังที่ใช้อิฐต่างชนิด" : `${block.label} ${block.perM2} ก้อน/ตร.ม.`;
        break;
      case "ties":
        purchase = Math.ceil(qtyWithWaste * 10) / 10;
        purchaseNote = "ปัดขึ้นทีละ 0.1 ลบ.ม.";
        break;
      case "bead":
        // each line is cut from whole sticks: round per line, not on the total
        purchase = lines.reduce((a, x) => a + Math.ceil((x.qty * k) / s.beadStick - 1e-9), 0);
        purchaseUnit = "เส้น";
        purchaseNote = `เส้นยาว ${s.beadStick} ม. ปัดรายแนว`;
        break;
      case "floorTile":
        purchase = Math.ceil(qtyWithWaste / (s.floorTile * s.floorTile));
        purchaseUnit = "แผ่น";
        purchaseNote = `${Math.round(s.floorTile * 100)}×${Math.round(s.floorTile * 100)} ซม.`;
        break;
      case "wallTile":
        purchase = Math.ceil(qtyWithWaste / (s.wallTile[0] * s.wallTile[1]));
        purchaseUnit = "แผ่น";
        purchaseNote = `${Math.round(s.wallTile[0] * 100)}×${Math.round(s.wallTile[1] * 100)} ซม.`;
        break;
      default:
        purchase = Math.ceil(qtyWithWaste);
        purchaseNote = "ปัดขึ้นเป็นจำนวนเต็ม";
    }
    const rate = rates?.[key];
    const unitMaterial = rate ? rate.material : Math.max(0, s.price[key] - s.labour[key]);
    const unitLabour = rate ? rate.labour : Math.min(s.labour[key], s.price[key]);
    const price = r2(unitMaterial + unitLabour);
    const materialCost = Math.round(qtyWithWaste * unitMaterial);
    const labourCost = Math.round(qtyWithWaste * unitLabour);
    return {
      cat: key,
      lines: lines.length,
      qty,
      waste,
      qtyWithWaste,
      purchase,
      purchaseUnit,
      purchaseNote,
      price,
      cost: materialCost + labourCost,
      unitMaterial,
      unitLabour,
      materialCost,
      labourCost,
      priceStatus: rate?.status ?? "sample",
      priceNote: rate?.note ?? "ราคาตัวอย่างต่อหน่วย (ปรับได้)",
    };
  });
}
