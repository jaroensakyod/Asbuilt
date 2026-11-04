// Generated document register: ~350 files across all 40 projects.
// Deterministic (seeded) so server and client render the same list.

import { documents, getHouseModel, projects, seeded, team, TODAY, type Doc, type Role } from "./data";

export type DocCategory = "contract" | "permit" | "drawing" | "report" | "warranty" | "manual" | "boq" | "photo";
export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  contract: "สัญญา",
  permit: "ใบอนุญาต",
  drawing: "แบบก่อสร้าง",
  report: "รายงาน",
  warranty: "ใบรับประกัน",
  manual: "คู่มือ",
  boq: "BOQ",
  photo: "รูปถ่าย",
};
export const DOC_CATEGORIES = Object.keys(DOC_CATEGORY_LABEL) as DocCategory[];

export type DocFileType = "pdf" | "svg" | "image" | "dwg";
export const DOC_TYPE_LABEL: Record<DocFileType, string> = { pdf: "PDF", svg: "SVG", image: "รูปภาพ", dwg: "DWG" };
export const DOC_TYPES = Object.keys(DOC_TYPE_LABEL) as DocFileType[];

export type DocItem = {
  id: string;
  title: string;
  file: string;
  category: DocCategory;
  type: DocFileType;
  projectId: string;
  sizeKb: number;
  by: string;
  date: string;
  tags: string[];
  /** true for files uploaded in this browser */
  local?: boolean;
  mime?: string;
};

export function docSize(kb: number) {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

export function fileTypeOf(name: string, mime = ""): DocFileType {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "svg" || mime === "image/svg+xml") return "svg";
  if (ext === "dwg" || ext === "dxf") return "dwg";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  return "pdf";
}

// ---------- generation ----------

const byRole = (role: Role) => team.filter((m) => m.role === role).map((m) => m.name);

function addDays(iso: string, d: number) {
  return new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);
}

// fraction of the schedule at which each phase is finished
const PHASES: { key: string; label: string; end: number; photo: string }[] = [
  { key: "foundation", label: "งานฐานราก", end: 0.12, photo: "เทฐานรากและคานคอดิน" },
  { key: "structure", label: "งานโครงสร้าง", end: 0.38, photo: "งานเสา คาน พื้น" },
  { key: "masonry", label: "งานก่ออิฐ", end: 0.58, photo: "ก่ออิฐฉาบปูน" },
  { key: "roof", label: "งานหลังคา", end: 0.58, photo: "มุงหลังคาและรางน้ำ" },
  { key: "mep", label: "งานระบบ", end: 0.76, photo: "เดินท่อและสายไฟ" },
  { key: "finish", label: "งานตกแต่ง/ผิว", end: 0.9, photo: "งานผิวพื้นและผนัง" },
  { key: "fixture", label: "ติดตั้งสุขภัณฑ์/อุปกรณ์", end: 1, photo: "ติดตั้งสุขภัณฑ์และอุปกรณ์" },
];

function seedCategory(d: Doc): DocCategory {
  if (d.file.includes("boq")) return "boq";
  return d.kind;
}

function build(): DocItem[] {
  const out: DocItem[] = [];
  const files = new Set<string>();
  const push = (d: DocItem) => {
    if (d.date > TODAY || files.has(d.file)) return;
    files.add(d.file);
    out.push(d);
  };

  for (const d of documents) {
    push({
      id: d.id,
      title: d.title,
      file: d.file,
      category: seedCategory(d),
      type: fileTypeOf(d.file),
      projectId: d.projectId,
      sizeKb: d.sizeKb,
      by: d.by,
      date: d.date,
      tags: [DOC_CATEGORY_LABEL[seedCategory(d)], d.projectId],
    });
  }

  const sales = byRole("sales");
  const admin = byRole("admin");
  const architect = byRole("architect");
  const engineer = byRole("engineer");
  const qc = byRole("qc");
  const foreman = byRole("foreman");
  const rnd = seeded(353);
  const pick = (list: string[]) => list[Math.floor(rnd() * list.length)] ?? list[0];
  const kb = (lo: number, hi: number) => Math.round(lo + (hi - lo) * rnd());
  let n = 100;

  projects.forEach((p, idx) => {
    const m = getHouseModel(p.modelCode);
    const cd0 = p.contractDate ?? addDays(p.start, -45);
    // projects still in planning may have a contract date ahead of today
    const cd = cd0 > addDays(TODAY, -24) ? addDays(TODAY, -24 + (idx % 5)) : cd0;
    const id = () => `D-${++n}`;
    const add = (d: Omit<DocItem, "id" | "projectId" | "type">) => push({ ...d, id: id(), projectId: p.id, type: fileTypeOf(d.file) });

    add({ title: "BOQ ใบแสดงปริมาณงานและราคา", file: `${p.id}_boq.pdf`, category: "boq", sizeKb: kb(3400, 4100), by: pick(sales), date: addDays(cd, -6), tags: ["BOQ", "ราคา"] });
    add({ title: `สัญญาจ้างก่อสร้าง เลขที่ ${p.id}/C`, file: `${p.id}_contract.pdf`, category: "contract", sizeKb: kb(4900, 5600), by: p.pm, date: cd, tags: ["สัญญา", "งวดงาน"] });
    add({ title: "คำขออนุญาตก่อสร้างอาคาร (แบบ ข.1)", file: `${p.id}_permit-application.pdf`, category: "permit", sizeKb: kb(2400, 2800), by: pick(admin), date: addDays(cd, 9), tags: ["ใบอนุญาต", "ข.1"] });
    add({ title: `ชุดแบบก่อสร้าง ${m?.name ?? p.model} (${m?.sheets ?? 18} แผ่น)`, file: `${p.modelCode}_${p.id}_drawing-set.pdf`, category: "drawing", sizeKb: kb(9000, 19000), by: pick(architect), date: addDays(cd, 16), tags: ["แบบก่อสร้าง", p.modelCode] });
    if (idx % 2 === 1 || idx < 16)
      add({ title: "ผังพื้นชั้น 1–" + (m?.floors ?? p.floors), file: `${p.id}_floor-plan.svg`, category: "drawing", sizeKb: kb(180, 420), by: pick(architect), date: addDays(cd, 18), tags: ["ผังพื้น", "SVG"] });
    if (idx % 2 === 0)
      add({ title: "แบบโครงสร้าง (ไฟล์ CAD)", file: `${p.id}_structure.dwg`, category: "drawing", sizeKb: kb(2200, 4800), by: pick(engineer), date: addDays(cd, 21), tags: ["โครงสร้าง", "CAD"] });

    if (p.status === "planning") return;

    add({ title: "ใบอนุญาตก่อสร้าง (อ.1)", file: `${p.id}_permit-a1.pdf`, category: "permit", sizeKb: kb(700, 1100), by: pick(admin), date: addDays(cd, 38), tags: ["ใบอนุญาต", "อ.1"] });

    const dur = Math.max(30, (Date.parse(p.finish) - Date.parse(p.start)) / 86400000);
    const frac = p.actual / 100;
    const done = PHASES.filter((ph) => ph.end <= frac + 0.001);
    // latest two photos and latest two inspection reports per project
    for (const ph of p.status === "delivered" ? [] : done.slice(-2)) {
      const at = addDays(p.start, Math.round(ph.end * dur) - 3);
      add({ title: `รูปถ่ายหน้างาน · ${ph.photo}`, file: `${p.id}_site-${ph.key}.jpg`, category: "photo", sizeKb: kb(2600, 4800), by: pick(foreman), date: at, tags: ["รูปถ่าย", ph.label] });
      add({ title: `รายงานตรวจ${ph.label}`, file: `${p.id}_inspection-${ph.key}.pdf`, category: "report", sizeKb: kb(900, 1500), by: pick(qc), date: addDays(at, 2), tags: ["รายงานตรวจ", ph.label] });
    }
    if (p.status !== "delivered" && done.length === 0) {
      add({ title: "รูปถ่ายหน้างาน · ปรับพื้นที่และวางผัง", file: `${p.id}_site-layout.jpg`, category: "photo", sizeKb: kb(2400, 3800), by: pick(foreman), date: addDays(p.start, 3), tags: ["รูปถ่าย", "วางผัง"] });
    }

    if (p.status === "delivered" && p.handedOver) {
      const h = p.handedOver;
      add({ title: "บันทึกส่งมอบบ้านและรายการตรวจรับ", file: `${p.id}_handover.pdf`, category: "report", sizeKb: kb(1100, 1800), by: p.pm, date: h, tags: ["ส่งมอบ", "รายงาน"] });
      add({ title: "ใบรับประกันโครงสร้าง 15 ปี", file: `${p.id}_warranty-structure.pdf`, category: "warranty", sizeKb: kb(700, 950), by: p.pm, date: h, tags: ["ประกัน", "โครงสร้าง"] });
      add({ title: "คู่มือการใช้งานบ้านและอุปกรณ์", file: `${p.id}_home-manual.pdf`, category: "manual", sizeKb: kb(5800, 6800), by: p.pm, date: h, tags: ["คู่มือ", "อุปกรณ์"] });
      if (idx % 3 === 0)
        add({ title: "รูปถ่ายวันส่งมอบ", file: `${p.id}_handover-photo.jpg`, category: "photo", sizeKb: kb(3000, 5200), by: pick(foreman), date: h, tags: ["รูปถ่าย", "ส่งมอบ"] });
    }
  });

  return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, "en", { numeric: true }));
}

export const allDocs: DocItem[] = build();

export function projectDocs(projectId: string) {
  return allDocs.filter((d) => d.projectId === projectId);
}

