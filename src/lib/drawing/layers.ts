// Layer standard (AIA-style names) with AutoCAD colour index, default
// lineweight and linetype, plus the paper themes used by the viewers.

import type { Discipline, LineType } from "./types";

export type LayerDef = {
  name: string;
  /** AutoCAD colour index */
  aci: number;
  /** default lineweight, mm on paper */
  lw: number;
  lt: LineType;
  desc: string;
  disc: Discipline | "G";
};

export const LAYERS: LayerDef[] = [
  { name: "A-WALL", aci: 7, lw: 0.5, lt: "CONTINUOUS", desc: "ผนัง", disc: "A" },
  { name: "A-DOOR", aci: 2, lw: 0.25, lt: "CONTINUOUS", desc: "ประตูและวงเปิด", disc: "A" },
  { name: "A-GLAZ", aci: 4, lw: 0.25, lt: "CONTINUOUS", desc: "หน้าต่าง กระจก", disc: "A" },
  { name: "A-STRS", aci: 8, lw: 0.18, lt: "CONTINUOUS", desc: "บันได ลิฟต์", disc: "A" },
  { name: "A-FIXT", aci: 6, lw: 0.18, lt: "CONTINUOUS", desc: "สุขภัณฑ์ เคาน์เตอร์", disc: "A" },
  { name: "A-ELEV", aci: 7, lw: 0.35, lt: "CONTINUOUS", desc: "เส้นรูปด้าน", disc: "A" },
  { name: "A-SECT", aci: 7, lw: 0.5, lt: "CONTINUOUS", desc: "เส้นตัด", disc: "A" },
  { name: "A-ROOF", aci: 30, lw: 0.35, lt: "CONTINUOUS", desc: "หลังคา", disc: "A" },
  { name: "A-HATC", aci: 8, lw: 0.09, lt: "CONTINUOUS", desc: "แรเงาวัสดุ", disc: "A" },
  { name: "A-SITE", aci: 8, lw: 0.35, lt: "CONTINUOUS", desc: "ผังบริเวณ ถนน รั้ว", disc: "A" },
  { name: "A-PLNT", aci: 3, lw: 0.18, lt: "CONTINUOUS", desc: "ต้นไม้ ภูมิทัศน์", disc: "A" },
  { name: "A-ANNO", aci: 2, lw: 0.18, lt: "CONTINUOUS", desc: "ข้อความ ชื่อห้อง ป้ายกำกับ", disc: "A" },
  { name: "A-DIMS", aci: 3, lw: 0.13, lt: "CONTINUOUS", desc: "เส้นบอกระยะ", disc: "A" },
  { name: "S-GRID", aci: 8, lw: 0.13, lt: "CENTER", desc: "เส้นกริดและหัวกริด", disc: "S" },
  { name: "S-COLS", aci: 1, lw: 0.5, lt: "CONTINUOUS", desc: "เสา", disc: "S" },
  { name: "S-FTNG", aci: 5, lw: 0.35, lt: "CONTINUOUS", desc: "ฐานราก เสาเข็ม", disc: "S" },
  { name: "S-BEAM", aci: 6, lw: 0.35, lt: "CONTINUOUS", desc: "คาน โครงหลังคา", disc: "S" },
  { name: "S-SLAB", aci: 8, lw: 0.18, lt: "CONTINUOUS", desc: "พื้น ช่องเปิดพื้น", disc: "S" },
  { name: "E-LITE", aci: 2, lw: 0.25, lt: "CONTINUOUS", desc: "ดวงโคม สวิตช์", disc: "E" },
  { name: "E-POWR", aci: 1, lw: 0.25, lt: "CONTINUOUS", desc: "เต้ารับ ตู้ไฟ อุปกรณ์ไฟฟ้า", disc: "E" },
  { name: "E-CIRC", aci: 6, lw: 0.18, lt: "CONTINUOUS", desc: "สายวงจร (Home run)", disc: "E" },
  { name: "P-FIXT", aci: 6, lw: 0.25, lt: "CONTINUOUS", desc: "สุขภัณฑ์", disc: "P" },
  { name: "P-WATR", aci: 5, lw: 0.25, lt: "DASHED", desc: "ท่อน้ำดี", disc: "P" },
  { name: "P-SANR", aci: 30, lw: 0.35, lt: "HIDDEN", desc: "ท่อน้ำทิ้ง ท่อโสโครก", disc: "P" },
  { name: "P-EQPM", aci: 4, lw: 0.35, lt: "CONTINUOUS", desc: "ถังน้ำ ปั๊ม ถังบำบัด", disc: "P" },
  { name: "M-HVAC", aci: 3, lw: 0.35, lt: "CONTINUOUS", desc: "แฟนคอยล์ คอยล์ร้อน", disc: "M" },
  { name: "M-PIPE", aci: 4, lw: 0.25, lt: "DASHED", desc: "ท่อน้ำยาและท่อน้ำทิ้งแอร์", disc: "M" },
  { name: "TITLE", aci: 7, lw: 0.35, lt: "CONTINUOUS", desc: "กรอบแผ่นและตารางชื่อแบบ", disc: "G" },
];

export const LAYER: Record<string, LayerDef> = Object.fromEntries(LAYERS.map((l) => [l.name, l]));

/** AutoCAD colour index → hex (the subset we use, on a dark background) */
export const ACI_HEX: Record<number, string> = {
  1: "#ff4d4d",
  2: "#ffe14d",
  3: "#5ee85e",
  4: "#4de8e8",
  5: "#5b8cff",
  6: "#ff5bff",
  7: "#ededed",
  8: "#8a8a8a",
  30: "#ff9f40",
};

export type ThemeId = "blueprint" | "paper" | "mono" | "cad";

export type Theme = {
  id: ThemeId;
  label: string;
  /** paper colour */
  bg: string;
  /** backdrop behind the paper in the viewer */
  backdrop: string;
  /** frame and title block colour */
  frame: string;
  dark: boolean;
  color: (l: LayerDef) => string;
};

const DISC_PAPER: Record<string, string> = { E: "#b4530a", P: "#1d5f99", M: "#2f7d4f" };

export const THEMES: Theme[] = [
  {
    id: "blueprint",
    label: "พิมพ์เขียว",
    bg: "#123a6b",
    backdrop: "#0c2a50",
    frame: "#e8f0ff",
    dark: true,
    color: (l) => {
      if (l.name === "A-DIMS" || l.name === "A-ANNO") return "#9fe3c4";
      if (l.name === "S-GRID") return "#8fb5e6";
      if (l.name === "A-GLAZ") return "#a6dcff";
      if (l.disc === "E") return "#ffd37a";
      if (l.disc === "P") return "#8de4ff";
      if (l.disc === "M") return "#b6f2a8";
      if (l.name === "A-HATC" || l.name === "A-SITE" || l.name === "A-PLNT") return "#b9cbe6";
      return "#f2f6ff";
    },
  },
  {
    id: "paper",
    label: "กระดาษขาว",
    bg: "#ffffff",
    backdrop: "#e9e5dd",
    frame: "#1f1b16",
    dark: false,
    color: (l) => {
      if (DISC_PAPER[l.disc]) return DISC_PAPER[l.disc];
      if (l.name === "A-GLAZ") return "#2a6fb0";
      if (l.name === "A-DIMS" || l.name === "S-GRID" || l.name === "A-HATC" || l.name === "A-SITE") return "#6b645b";
      if (l.name === "A-PLNT") return "#4d7a52";
      if (l.name === "S-COLS" || l.name === "S-FTNG" || l.name === "S-BEAM") return "#3b3631";
      return "#1f1b16";
    },
  },
  {
    id: "mono",
    label: "ขาวดำ",
    bg: "#fbfaf7",
    backdrop: "#e4e1da",
    frame: "#111111",
    dark: false,
    color: () => "#111111",
  },
  {
    id: "cad",
    label: "จอมืด",
    bg: "#19191b",
    backdrop: "#141415",
    frame: "#ededed",
    dark: true,
    color: (l) => ACI_HEX[l.aci] ?? "#ededed",
  },
];

export const THEME: Record<ThemeId, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, Theme>;

export const layerDef = (name: string): LayerDef => LAYER[name] ?? { name, aci: 7, lw: 0.25, lt: "CONTINUOUS", desc: name, disc: "G" };
