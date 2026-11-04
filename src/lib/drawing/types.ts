// Vector drawing model shared by the SVG renderer, DXF exporter and viewers.
// All coordinates are metres in sheet space, y pointing up (CAD convention).

export type Pt = [number, number];
export type BBox = [number, number, number, number]; // x0, y0, x1, y1

export type Discipline = "A" | "S" | "E" | "P" | "M";
export type LineType = "CONTINUOUS" | "DASHED" | "CENTER" | "HIDDEN" | "PHANTOM";
export type HatchPattern = "solid" | "lines" | "cross" | "earth";

type Base = {
  /** layer name */
  l: string;
  /** asset code when the entity is part of an equipment symbol */
  ref?: string;
  /** opacity 0..1 — used to screen the architectural background on MEP sheets */
  o?: number;
};

export type LinePrim = Base & { t: "line"; a: Pt; b: Pt; w?: number; lt?: LineType };
export type PlinePrim = Base & { t: "pline"; pts: Pt[]; closed?: boolean; w?: number; lt?: LineType };
export type CirclePrim = Base & { t: "circle"; c: Pt; r: number; w?: number; fill?: boolean };
/** a0 → a1 counter-clockwise, degrees */
export type ArcPrim = Base & { t: "arc"; c: Pt; r: number; a0: number; a1: number; w?: number; lt?: LineType };
export type TextPrim = Base & {
  t: "text";
  p: Pt;
  /** cap height in metres */
  h: number;
  s: string;
  al?: "l" | "c" | "r";
  va?: "b" | "m" | "t";
  /** rotation in degrees, counter-clockwise */
  rot?: number;
  mono?: boolean;
  bold?: boolean;
};
/** Aligned dimension between a and b. `off` is the signed distance of the dimension line, positive to the left of a→b. */
export type DimPrim = Base & { t: "dim"; a: Pt; b: Pt; off: number; h: number; s?: string };
export type HatchPrim = Base & { t: "hatch"; pts: Pt[]; pat: HatchPattern; sp?: number; ang?: number };

export type Prim = LinePrim | PlinePrim | CirclePrim | ArcPrim | TextPrim | DimPrim | HatchPrim;

export type SheetKind = "site" | "plan" | "roof" | "elev" | "section" | "detail" | "found" | "struct" | "schedule" | "elec" | "plumb" | "hvac";

export type SheetRoom = { id: string; name: string; pts: Pt[]; area: number };
export type SheetHit = { code: string; bb: BBox };

export type SheetMeta = {
  id: string;
  index: number; // 1-based position in the set
  total: number;
  disc: Discipline;
  kind: SheetKind;
  titleTh: string;
  titleEn: string;
  floor?: number;
  /** printed scale denominator (100 → 1:100). Schedules print "ไม่มีมาตราส่วน" */
  scale: number;
  nts?: boolean;
  /** drawing code, e.g. CD-01-A-101-R2 */
  code: string;
};

export type Sheet = SheetMeta & {
  w: number;
  h: number;
  /** sheet coordinates of the building origin (x = 0, z = 0) */
  origin: Pt;
  /** bounding box of the drawing itself, without frame and title block */
  content: BBox;
  prims: Prim[];
  rooms: SheetRoom[];
  hits: SheetHit[];
  layers: string[];
  level: string;
};

export type DisciplineInfo = { key: Discipline; th: string; en: string };

export const DISCIPLINES: DisciplineInfo[] = [
  { key: "A", th: "สถาปัตยกรรม", en: "Architectural" },
  { key: "S", th: "โครงสร้าง", en: "Structural" },
  { key: "E", th: "ไฟฟ้า", en: "Electrical" },
  { key: "P", th: "สุขาภิบาล", en: "Sanitary & plumbing" },
  { key: "M", th: "ปรับอากาศ", en: "Air conditioning" },
];

export const DISC_BY_KEY = Object.fromEntries(DISCIPLINES.map((d) => [d.key, d])) as Record<Discipline, DisciplineInfo>;
