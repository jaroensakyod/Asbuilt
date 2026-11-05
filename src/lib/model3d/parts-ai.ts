// AI labelling of model parts. SketchUp files rarely carry useful names ("Component_947313"),
// so each group of the model is described by what little name it has PLUS its size, height
// above ground and colour; the model then says what it is (wall, slab, column, furniture …).
// The label decides the system (โครงสร้าง / สถาปัตย์ / ไฟฟ้า …) and gives the viewer part toggles,
// a first step toward quantity takeoff straight from SketchUp.
// Pure: no three.js and no fetch — the viewer collects the groups, ai/client sends the request.

import type { JsonSchema } from "@/lib/ai/types";
import type { SysKey } from "./classify";

export const PART_KINDS = [
  { key: "slab", label: "พื้น / พื้นชั้น", sys: "struct" },
  { key: "column", label: "เสา / คาน", sys: "struct" },
  { key: "wall", label: "ผนัง", sys: "arch" },
  { key: "roof", label: "หลังคา / กันสาด", sys: "arch" },
  { key: "opening", label: "ประตู / หน้าต่าง / กระจก", sys: "arch" },
  { key: "stair", label: "บันได / ราวกันตก", sys: "arch" },
  { key: "ceiling", label: "ฝ้าเพดาน", sys: "arch" },
  { key: "furniture", label: "เฟอร์นิเจอร์ / ของตกแต่ง", sys: "arch" },
  { key: "sanitary", label: "สุขภัณฑ์", sys: "sanitary" },
  { key: "lighting", label: "โคมไฟ / ไฟฟ้า", sys: "elec" },
  { key: "hvac", label: "แอร์ / ระบายอากาศ", sys: "hvac" },
  { key: "plumbing", label: "ท่อ / ประปา", sys: "plumb" },
  { key: "site", label: "ภายนอก / ต้นไม้ / รถ / คน", sys: "ext" },
  { key: "other", label: "อื่น ๆ", sys: "arch" },
] as const satisfies readonly { key: string; label: string; sys: SysKey }[];

export type PartKind = (typeof PART_KINDS)[number]["key"];
const KIND_KEYS = PART_KINDS.map((k) => k.key) as PartKind[];
export const KIND_SYS = Object.fromEntries(PART_KINDS.map((k) => [k.key, k.sys])) as Record<PartKind, SysKey>;
export const KIND_LABEL = Object.fromEntries(PART_KINDS.map((k) => [k.key, k.label])) as Record<PartKind, string>;

/** One group of the model as the AI sees it (metres, Y up, ground at 0). */
export type PartGroup = {
  id: string; // path of child indexes from the file's root, stable across loads
  names: string[]; // meaningful names inside and above the group
  size: [number, number, number]; // width (x), depth (z), height (y)
  base: number; // bottom above ground
  top: number;
  tris: number;
  meshes: number;
  color?: string; // dominant material colour, hex
};

/** Labels saved on the model file after a run. */
export type PartLabels = {
  at: string;
  provider: string;
  model: string;
  costThb: number;
  ms: number;
  kinds: Record<string, PartKind>; // group id → kind
};

/** Names that tell nothing: Component_947313, Group#12, 群组#258, obj_08, Mesh 3 … */
export const isGenericName = (n: string) =>
  !n.trim() ||
  /^(root|scene|model|uploaded-model|sketchup)$/i.test(n.trim()) ||
  /^(component|componente|komponente|composant|group|grouper|groupe|gruppe|grupo|群组|组|组件|obj|object|mesh|node|geometry|instance|layer\d*|defaultmaterial)[\s_#-]*\d*$/i.test(n.trim()) ||
  /^[\d\s_#.-]+$/.test(n);

const r2 = (n: number) => Math.round(n * 100) / 100;

export const CLASSIFY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "integer", description: "หมายเลขกลุ่มจากรายการ" }, kind: { type: "string", enum: KIND_KEYS } },
        required: ["n", "kind"],
      },
    },
  },
  required: ["items"],
};

export function classifyPrompt(groups: PartGroup[], overall: [number, number, number]) {
  const lines = groups.map((g, i) => {
    const [w, d, h] = g.size.map(r2);
    const name = g.names.length ? g.names.slice(0, 4).join(" / ").slice(0, 120) : "-";
    return `${i + 1} | ${name} | ${w}×${d}×${h} | ${r2(g.base)}–${r2(g.top)} | ${g.tris} | ${g.meshes} | ${g.color ?? "-"}`;
  });
  return {
    system: [
      "คุณเป็นสถาปนิก/ผู้ถอดปริมาณงานก่อสร้าง ดูรายการกลุ่มชิ้นส่วนจากโมเดล SketchUp ของอาคาร แล้วบอกว่าแต่ละกลุ่มคืออะไร",
      "ชื่อกลุ่มส่วนใหญ่ไม่มีความหมาย ให้ตัดสินจากขนาด ความสูงจากพื้น จำนวนสามเหลี่ยม และสีประกอบกัน เช่น",
      "- แผ่นบางกว้างใหญ่ที่ระดับพื้นชั้น = slab, แท่งสูงเล็ก 0.2–0.8 ม. สูงเท่าชั้น = column, แผ่นบางตั้งยาว = wall",
      "- ชิ้นที่อยู่บนสุดคลุมอาคาร = roof, แผ่นบางแนวนอนใต้พื้นชั้นถัดไป ~2.4–3.5 ม. = ceiling",
      "- ชิ้นเล็กสูงไม่เกิน ~2 ม. ตั้งบนพื้น ทรงละเอียด (สามเหลี่ยมเยอะ) = furniture, ชิ้นละเอียดห้อยใต้ฝ้า = lighting",
      "- ต้นไม้ รถ คน รั้ว ถนน ชิ้นที่อยู่นอกตัวอาคาร = site, กลุ่มใหญ่ที่รวมหลายอย่างให้เลือกสิ่งที่เป็นส่วนใหญ่",
      "ตอบทุกหมายเลข ใช้ kind จากรายการที่กำหนดเท่านั้น ไม่แน่ใจให้ตอบ other",
    ].join("\n"),
    prompt: [
      `ขนาดอาคารทั้งหมด กว้าง×ลึก×สูง ${overall.map(r2).join("×")} ม.`,
      "คอลัมน์: หมายเลข | ชื่อ | กว้าง×ลึก×สูง (ม.) | ระดับล่าง–บน จากพื้น (ม.) | สามเหลี่ยม | จำนวนชิ้น | สี",
      ...lines,
    ].join("\n"),
  };
}

/** Map the model's answer back to group ids; anything unanswered or unknown becomes "other". */
export function normalizeKinds(raw: unknown, groups: PartGroup[]): Record<string, PartKind> {
  const out: Record<string, PartKind> = {};
  const items = (raw as { items?: { n?: unknown; kind?: unknown }[] } | null)?.items;
  for (const it of Array.isArray(items) ? items : []) {
    const g = groups[Number(it?.n) - 1];
    const k = String(it?.kind ?? "") as PartKind;
    if (g) out[g.id] = KIND_KEYS.includes(k) ? k : "other";
  }
  for (const g of groups) out[g.id] ??= "other";
  return out;
}

/**
 * Asset codes are only counted when the company actually registered them: names such as
 * BOX-085 or LEG-048 in downloaded furniture look like codes but are not equipment.
 */
export const registeredCode = (code: string | null | undefined, known: ReadonlySet<string>) => (code && known.has(code.toUpperCase()) ? code.toUpperCase() : null);
