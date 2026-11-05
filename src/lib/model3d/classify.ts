// Uploaded 3D models (SketchUp → GLB/OBJ/FBX/DAE, or IFC): pure helpers that read the names a
// designer gave to tags, groups and components, and turn them into:
//   • the building system shown by the system toggles (same keys as the Structure 3D viewer)
//   • an asset code such as "AC-201", which links a part of the model to repairs and warranty
// No React, no three.js, no "@/" imports, so node --test can load it.

export type SysKey = "struct" | "arch" | "elec" | "plumb" | "sanitary" | "hvac" | "ext";

export const SYS_KEYS: SysKey[] = ["struct", "arch", "elec", "plumb", "sanitary", "hvac", "ext"];

export type ModelFormat = "glb" | "gltf" | "obj" | "fbx" | "dae" | "ifc";

export const FORMATS: { ext: ModelFormat; label: string; note: string }[] = [
  { ext: "glb", label: "GLB", note: "แนะนำ · ไฟล์เล็ก มีสีและวัสดุ" },
  { ext: "gltf", label: "glTF", note: "ต้องฝัง texture ไว้ในไฟล์ (embedded)" },
  { ext: "dae", label: "DAE (Collada)", note: "SketchUp export ได้ในตัว" },
  { ext: "obj", label: "OBJ", note: "รูปทรงอย่างเดียว ไม่มีวัสดุ" },
  { ext: "fbx", label: "FBX", note: "SketchUp Pro export ได้" },
  { ext: "ifc", label: "IFC", note: "BIM · แยกระบบงานจากชนิดชิ้นส่วนอัตโนมัติ" },
];

/** SketchUp files are accepted too: the server converts them to GLB (see lib/model3d/skp.ts). */
export const SKP_LABEL = "SKP (SketchUp)";

export const ACCEPT = [...FORMATS.map((f) => `.${f.ext}`), ".skp"].join(",");

/** Largest file we accept (bytes). Bigger models are slow on phones; ask for a lighter export. */
export const MAX_BYTES = 150 * 1024 * 1024;
/** SketchUp files are bigger than their GLB (textures, render-plugin data, 2D linework) */
export const MAX_SKP_BYTES = 200 * 1024 * 1024;

const extOf = (fileName: string) => fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];

export function formatOf(fileName: string): ModelFormat | null {
  const ext = extOf(fileName);
  return FORMATS.some((f) => f.ext === ext) ? (ext as ModelFormat) : null;
}

export const isSkpName = (fileName: string) => extOf(fileName) === "skp";

/** Why a file can't be used, or null when it can. Thai message for the upload form. */
export function rejectReason(fileName: string, size: number): string | null {
  const ext = extOf(fileName);
  if (ext === "dwg" || ext === "dxf") return "ไฟล์ DWG/DXF เป็นแบบ 2 มิติ ให้อัปโหลดที่หน้าเอกสารแทน";
  if (!formatOf(fileName) && ext !== "skp") return `รองรับเฉพาะ ${[...FORMATS.map((f) => f.label), SKP_LABEL].join(", ")}`;
  if (size <= 0) return "ไฟล์ว่าง";
  if (ext === "skp" && size > MAX_SKP_BYTES) return `ไฟล์ .skp ใหญ่เกิน ${Math.round(MAX_SKP_BYTES / 1048576)} MB ให้ purge ข้อมูลที่ไม่ใช้ใน SketchUp ก่อน`;
  if (ext !== "skp" && size > MAX_BYTES) return `ไฟล์ใหญ่เกิน ${Math.round(MAX_BYTES / 1048576)} MB ให้ลบเฟอร์นิเจอร์/ต้นไม้ที่ไม่จำเป็น หรือ purge ก่อน export`;
  return null;
}

// ---------- systems from names ----------

// Order matters: the first system whose keyword matches wins, so the specific ones
// (sanitary before plumbing, hvac before electrical) come first.
const KEYWORDS: [SysKey, RegExp][] = [
  ["sanitary", /สุขภัณฑ์|ชักโครก|อ่างล้าง|sanitary|toilet|\bwc\b|lavatory|basin|shower|ฝักบัว/i],
  ["hvac", /ปรับอากาศ|แอร์|\bhvac\b|air ?con|\bac\b|\bfcu\b|\bcdu\b|duct|ระบายอากาศ/i],
  ["elec", /ไฟฟ้า|สายไฟ|โคม|ปลั๊ก|สวิตช์|electric|\belec\b|lighting|light|lamp|socket|switch|\bdb\b|panel ?board/i],
  ["plumb", /ประปา|ท่อ|ปั๊มน้ำ|ถังน้ำ|plumb|pipe|water|drain|sewer|pump|tank/i],
  ["struct", /โครงสร้าง|เสา|คาน|ฐานราก|เข็ม|พื้น ?คสล|struct|column|beam|footing|foundation|pile|slab|rebar/i],
  ["ext", /ภายนอก|ภูมิทัศน์|ต้นไม้|สนาม|รั้ว|ถนน|exterior|landscape|site|tree|plant|fence|terrain|garden|driveway/i],
  ["arch", /สถาปัตย์|ผนัง|ประตู|หน้าต่าง|หลังคา|ฝ้า|บันได|arch|wall|door|window|roof|ceiling|stair|furniture/i],
];

/** System named by one label (tag, layer, group or component name), or null if none matches. */
export function systemOfName(name: string | undefined | null): SysKey | null {
  if (!name) return null;
  const n = name.replace(/[_.]+/g, " ");
  for (const [k, re] of KEYWORDS) if (re.test(n)) return k;
  return null;
}

/**
 * System of a model part from its own name and its ancestors' names (nearest first).
 * SketchUp tags usually end up as a parent group, so walking up finds them.
 */
export function systemOfPath(names: (string | undefined | null)[]): SysKey {
  for (const n of names) {
    const s = systemOfName(n);
    if (s) return s;
  }
  return "arch";
}

// IFC entity type (upper case, as web-ifc reports it) → system.
const IFC_TYPES: [SysKey, RegExp][] = [
  ["struct", /^IFC(COLUMN|BEAM|SLAB|FOOTING|PILE|MEMBER|PLATE|REINFORCING\w*|TENDON\w*)$/],
  ["sanitary", /^IFC(SANITARYTERMINAL|WASTETERMINAL)$/],
  ["hvac", /^IFC(AIRTERMINAL\w*|DUCT\w*|UNITARYEQUIPMENT|FAN|COIL|CHILLER|BOILER|COMPRESSOR|CONDENSER|EVAPORAT\w*|DAMPER|AIRTOAIR\w*)$/],
  ["elec", /^IFC(LIGHTFIXTURE|LAMP|OUTLET|SWITCHINGDEVICE|ELECTRIC\w*|CABLE\w*|PROTECTIVEDEVICE|JUNCTIONBOX|DISTRIBUTIONBOARD|TRANSFORMER|SOLARDEVICE)$/],
  ["plumb", /^IFC(PIPE\w*|PUMP|TANK|VALVE|FLOWMETER|FIRESUPPRESSIONTERMINAL|INTERCEPTOR)$/],
  ["ext", /^IFC(SITE|GEOGRAPHICELEMENT|CIVILELEMENT|COURSE|PAVEMENT|EARTHWORKS\w*|KERB)$/],
];

export function systemOfIfcType(type: string | undefined | null, name?: string | null): SysKey {
  const t = (type ?? "").toUpperCase();
  for (const [k, re] of IFC_TYPES) if (re.test(t)) return k;
  return systemOfName(name) ?? "arch";
}

// ---------- asset codes ----------

/**
 * Asset code inside a label, e.g. "AC-201", "ac201", "WC-01#2", "Daikin AC-201" → "AC-201".
 * Codes are 1–3 latin letters, optional dash or underscore, 2–4 digits. Digits are padded to 3 like the registry.
 */
export function assetCodeOf(name: string | undefined | null): string | null {
  if (!name) return null;
  const m = name.match(/(?:^|[^A-Za-z0-9])([A-Za-z]{1,3})[-_]?(\d{2,4})(?=$|[^0-9])/);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  // plain words that happen to end in a number are not codes ("Group 12", "Layer 3", "Mesh 0")
  if (/^(GROUP|LAYER|TAG|MESH|NODE|OBJ|ID|L|V|COMP|COM|DEF)$/.test(letters) && !/-/.test(m[0])) return null;
  return `${letters}-${m[2].padStart(3, "0")}`;
}

/** First asset code found on the part or its ancestors (nearest first). */
export function assetCodeOfPath(names: (string | undefined | null)[]): string | null {
  for (const n of names) {
    const c = assetCodeOf(n);
    if (c) return c;
  }
  return null;
}

// ---------- units / orientation ----------

/**
 * Scale that brings a model to metres, guessed from its largest dimension.
 * A house is ~5–60 m across. SketchUp exports in inches or millimetres are common.
 */
export type Unit = "m" | "cm" | "mm" | "in" | "ft";

export const UNIT_SCALE: Record<Unit, number> = { m: 1, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 };
export const UNIT_LABEL: Record<Unit, string> = { m: "เมตร", cm: "เซนติเมตร", mm: "มิลลิเมตร", in: "นิ้ว", ft: "ฟุต" };

export function unitScale(maxDim: number, fmt?: ModelFormat, forced?: Unit): { scale: number; unit: Unit } {
  if (forced) return { scale: UNIT_SCALE[forced], unit: forced };
  if (!(maxDim > 0)) return { scale: 1, unit: "m" };
  if (maxDim <= 400) return { scale: 1, unit: "m" };
  // FBX from SketchUp/3ds Max is usually centimetres; OBJ from SketchUp is usually inches
  if (fmt === "fbx" && maxDim <= 8000) return { scale: 0.01, unit: "cm" };
  // inches: a 10–60 m house is ~400–2400 in
  if (maxDim <= 2400) return { scale: 0.0254, unit: "in" };
  if (maxDim <= 8000) return { scale: 0.01, unit: "cm" };
  return { scale: 0.001, unit: "mm" };
}

export type ViewFix = { unit?: Unit; zUp?: boolean };

/** Should the model be turned upright? An explicit choice wins over the guess. */
export function needsUpright(size: { x: number; y: number; z: number }, fmt: ModelFormat, forced?: boolean): boolean {
  return forced ?? looksZUp(size, fmt);
}

/**
 * Z-up exports (OBJ/FBX without "swap YZ") put the model on its side. Only the clear cases are
 * caught here (the "up" side is much longer than the depth); the viewer has a manual 90° turn.
 */
export function looksZUp(size: { x: number; y: number; z: number }, fmt: ModelFormat): boolean {
  if (fmt === "glb" || fmt === "gltf" || fmt === "ifc" || fmt === "dae") return false; // these loaders already give Y-up
  // a building is wider than it is tall: if Y is the longest side and Z is short, it's lying down
  return size.y > size.z * 1.4 && size.y >= size.x * 0.6;
}

// ---------- summary ----------

export type PartInfo = { sys: SysKey; asset: string | null };

export function summarize(parts: PartInfo[]) {
  const bySys = Object.fromEntries(SYS_KEYS.map((k) => [k, 0])) as Record<SysKey, number>;
  const assets = new Set<string>();
  for (const p of parts) {
    bySys[p.sys]++;
    if (p.asset) assets.add(p.asset);
  }
  return { parts: parts.length, bySys, assets: [...assets].sort() };
}
