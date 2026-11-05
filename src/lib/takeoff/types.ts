// Architectural quantity takeoff: types shared by the engine, the store and the page.

export type Vec3 = [number, number, number];
export type Box = { pos: Vec3; size: Vec3 };

/** อ ก่ออิฐ · ฉ ฉาบ · ส ทาสี · สอ เสาเอ็น-คานเอ็น · ซ จับเซี้ยม · พ กระเบื้องพื้น · ผ กระเบื้องผนัง */
export type Cat = "masonry" | "plaster" | "paint" | "ties" | "bead" | "floorTile" | "wallTile";

export const CATS: { key: Cat; prefix: string; label: string; unit: string; note: string }[] = [
  { key: "masonry", prefix: "อ", label: "ก่ออิฐ", unit: "ตร.ม.", note: "พื้นที่ผนังสุทธิ หักช่องเปิดและเสา" },
  { key: "plaster", prefix: "ฉ", label: "ฉาบ", unit: "ตร.ม.", note: "ทุกด้านของผนัง รวมขอบช่องเปิด" },
  { key: "paint", prefix: "ส", label: "ทาสี", unit: "ตร.ม.", note: "พื้นที่ฉาบ หักส่วนที่ปูกระเบื้องผนัง" },
  { key: "ties", prefix: "สอ", label: "เสาเอ็น-คานเอ็น", unit: "ลบ.ม.", note: "ข้างช่องเปิด ทุกระยะที่กำหนด และเหนือ/ใต้ช่องเปิด" },
  { key: "bead", prefix: "ซ", label: "จับเซี้ยม", unit: "ม.", note: "ขอบช่องเปิดทั้งสองด้าน และมุมอาคาร" },
  { key: "floorTile", prefix: "พ", label: "กระเบื้องพื้น", unit: "ตร.ม.", note: "พื้นที่ห้อง" },
  { key: "wallTile", prefix: "ผ", label: "กระเบื้องผนัง", unit: "ตร.ม.", note: "ผนังห้องน้ำถึงความสูงที่กำหนด" },
];

export const CAT_OF = Object.fromEntries(CATS.map((c) => [c.key, c])) as Record<Cat, (typeof CATS)[number]>;

export type BlockType = "aac75" | "aac10" | "brick" | "cblock";

export const BLOCKS: Record<BlockType, { label: string; perM2: number; unit: string; thick: number }> = {
  aac75: { label: "อิฐมวลเบา 7.5 ซม. (20×60)", perM2: 8.33, unit: "ก้อน", thick: 0.075 },
  aac10: { label: "อิฐมวลเบา 10 ซม. (20×60)", perM2: 8.33, unit: "ก้อน", thick: 0.1 },
  brick: { label: "อิฐมอญ", perM2: 130, unit: "ก้อน", thick: 0.07 },
  cblock: { label: "อิฐบล็อก 7 ซม.", perM2: 12.5, unit: "ก้อน", thick: 0.07 },
};

export type TakeoffSettings = {
  id: string; // project id
  projectId: string;
  block: BlockType;
  /** waste % per category */
  waste: Record<Cat, number>;
  /** sample unit price per category (baht per unit after waste, labour + material) */
  price: Record<Cat, number>;
  /** labour per unit when the price book has no labour rate for the category (and the labour share of the sample price) */
  labour: Record<Cat, number>;
  /** "book": material from the company price book · "sample": flat sample prices */
  priceMode: "book" | "sample";
  /** which price source the book uses */
  bookChoice: "moc" | "cgd" | "supplier" | "lowest";
  /** max clear distance between vertical supports before an extra เสาเอ็น (m) */
  tieSpacing: number;
  /** add a continuous คานเอ็น at mid height when the wall is taller than this (m) */
  bandAbove: number;
  /** tie section, both sides (m) */
  tieSection: number;
  /** how far a lintel runs past each side of the opening (m) */
  bearing: number;
  /** corner bead stick length (m) */
  beadStick: number;
  /** include full-height corner bead at the outside building corners */
  outerCorners: boolean;
  /** floor tile side (m), wall tile size (m) */
  floorTile: number;
  wallTile: [number, number];
  /** bathroom wall tiles up to this height (m) */
  wallTileHeight: number;
};

export const DEFAULT_SETTINGS: Omit<TakeoffSettings, "id" | "projectId"> = {
  block: "aac75",
  waste: { masonry: 5, plaster: 5, paint: 5, ties: 5, bead: 5, floorTile: 5, wallTile: 7 },
  price: { masonry: 190, plaster: 150, paint: 85, ties: 12000, bead: 16, floorTile: 420, wallTile: 480 },
  labour: { masonry: 95, plaster: 90, paint: 35, ties: 4500, bead: 8, floorTile: 180, wallTile: 220 },
  priceMode: "book",
  bookChoice: "cgd",
  tieSpacing: 2.5,
  bandAbove: 3,
  tieSection: 0.1,
  bearing: 0.2,
  beadStick: 2.5,
  outerCorners: true,
  floorTile: 0.6,
  wallTile: [0.3, 0.6],
  wallTileHeight: 2.4,
};

export type OpeningKind = "door" | "window";

export type Opening = {
  id: string; // asset code, or a made-up id
  kind: OpeningKind;
  s0: number; // along the wall axis (world)
  s1: number;
  sill: number; // above floor level
  head: number;
};

/** One straight wall run on one floor (collinear pieces merged), with its openings. */
export type Wall = {
  id: string; // "1W3"
  floor: number;
  orient: "h" | "v"; // h: runs along x at z = c · v: runs along z at x = c
  c: number;
  a: number;
  b: number;
  base: number; // floor level y (m)
  height: number;
  thick: number; // structural thickness in the model (for drawing)
  exterior: boolean;
  openings: Opening[];
  columns: number[]; // RC column centres on this line (along the axis)
  /** exterior walls: which side faces outside (+1 = larger coordinate) */
  outside?: 1 | -1;
  /** per-wall block type (edit), otherwise the category setting */
  block?: BlockType;
  /** true when the user changed this wall */
  edited?: boolean;
};

/** A room as a plan rectangle (axis-aligned in the takeoff frame). */
export type TakeoffRoom = { id: string; name: string; floor: number; x0: number; x1: number; z0: number; z1: number; bath: boolean; floorTile: boolean };

/** Everything the engine needs, from the system house model or an uploaded IFC. */
export type TakeoffSource = {
  kind: "model" | "ifc";
  key: string; // "model" or the model file id
  label: string;
  floors: number;
  walls: Wall[];
  rooms: TakeoffRoom[];
  /** outside building corners for corner bead */
  corners: { x: number; z: number; floor: number; base: number; height: number; ox: number; oz: number }[];
  /** slabs to draw under each floor */
  slabs: Box[];
  bounds: { min: Vec3; max: Vec3 };
  /** things the reader could not use (shown to the user) */
  notes: string[];
};

export type WallEdit = { height?: number; block?: BlockType; excluded?: boolean };
export type AddedOpening = { id: string; wallId: string; kind: OpeningKind; offset: number; width: number; sill: number; head: number };

/** User edits on top of a source, per project + source. */
export type TakeoffEdits = {
  id: string; // TE-<project>-<source>
  projectId: string;
  source: string;
  walls: Record<string, WallEdit>;
  /** removed openings as "<wallId>:<openingId>" */
  removed: string[];
  added: AddedOpening[];
};

export type TakeoffItem = {
  code: string;
  cat: Cat;
  floor: number;
  roomIds: string[]; // "" = outside
  rooms: string[]; // display names
  kind: string; // ผนัง, ด้านภายใน, เสาเอ็น, คานเอ็น, วงกบซ้าย …
  detail: string;
  qty: number; // in the category unit
  /** purchase count for this line (blocks, sticks, tiles) */
  count?: number;
  countUnit?: string;
  /** purchase units per category unit (blocks per m² for masonry) */
  rate?: number;
  wallId?: string;
  shapes: Box[];
};

export type CatSummary = {
  cat: Cat;
  lines: number;
  qty: number;
  waste: number; // %
  qtyWithWaste: number;
  purchase: number;
  purchaseUnit: string;
  purchaseNote: string;
  price: number; // per unit, material + labour
  cost: number;
  unitMaterial: number;
  unitLabour: number;
  materialCost: number;
  labourCost: number;
  priceStatus: "book" | "partial" | "sample";
  priceNote: string;
};
