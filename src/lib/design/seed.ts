// Demo data for the design module: design jobs + stages, permits, project spec sets,
// customer-portal messages and satisfaction surveys. Deterministic (fixed arrays + seeded PRNG).

import { getHouseModel, getProject, projects, seeded, type Project } from "../data";
import { DEFAULT_DESIGN_SETTINGS, addDays, completionKindFor, permitChecklist, stageFees } from "./calc";
import { SPEC_LIBRARY } from "./spec-library";
import {
  STAGE_KEYS,
  STAGE_LABEL,
  type AuthorityKind,
  type BuildingUse,
  type Deliverable,
  type DesignJob,
  type DesignStage,
  type Permit,
  type PermitDoc,
  type PermitRoute,
  type PortalMessage,
  type SpecSet,
  type StageKey,
  type StageStatus,
  type SurveyResponse,
} from "./types";

export const ARCHITECTS = ["ชนิดา มีสุข", "ภูริช สายสุวรรณ", "กานต์ธิดา ศรีประเสริฐ"];
export const ENGINEERS = ["ธนากร ศักดิ์สิทธิ์ (โครงสร้าง)", "ธีรวัฒน์ บุญมา (ไฟฟ้า)", "สุเมธ วงศ์ไพศาล (สุขาภิบาล/เครื่องกล)"];

const TEMPLATE: Record<StageKey, string[]> = {
  concept: ["สรุปความต้องการลูกค้า (Design brief)", "วิเคราะห์ที่ดินและข้อกำหนด (ระยะร่น FAR/OSR)", "ผังแนวคิดและการจัดโซน", "ภาพอ้างอิงและ Mood", "ประมาณราคาเบื้องต้น"],
  schematic: ["ผังพื้นทุกชั้น 1:100", "รูปด้าน 4 ด้าน", "รูปตัด 2 รูป", "ภาพ 3 มิติภายนอก", "ประมาณราคาจากร่างแบบ"],
  dd: ["ผังพื้นพร้อมขนาด 1:50", "แบบขยายห้องน้ำ ครัว และบันได", "ระบบโครงสร้างเบื้องต้น", "ตำแหน่งระบบไฟฟ้า สุขาภิบาล และแอร์", "รายการวัสดุหลัก"],
  cd: ["แบบสถาปัตยกรรมชุดก่อสร้าง", "แบบโครงสร้างและรายการคำนวณ", "แบบระบบไฟฟ้า", "แบบระบบสุขาภิบาล", "รายการประกอบแบบ", "BOQ ชุดก่อสร้าง"],
  permit: ["ลงนามแบบโดยสถาปนิกและวิศวกร", "เตรียมเอกสารขออนุญาตครบชุด", "ยื่นต่อหน่วยงานท้องถิ่น", "ได้รับใบอนุญาต/ใบรับแจ้ง"],
};
const SPAN: Record<StageKey, number> = { concept: 21, schematic: 30, dd: 30, cd: 40, permit: 45 };

export const defaultDeliverables = (key: StageKey, done = false): Deliverable[] => TEMPLATE[key].map((text, i) => ({ id: `${key}-${i + 1}`, text, done }));

const stamp = (d: string, h = 10) => `${d}T${String(h).padStart(2, "0")}:00:00+07:00`;

type StagePlan = { status: StageStatus; done?: number; revisions?: number; submitted?: string; approved?: string; comments?: [string, string, string][] };

function buildStages(p: Project, job: DesignJob, plan: Partial<Record<StageKey, StagePlan>>, inContract: boolean): DesignStage[] {
  const fees = stageFees(job.feeTotal, DEFAULT_DESIGN_SETTINGS.feePct);
  let cursor = job.start;
  return STAGE_KEYS.map((key, i) => {
    const pl = plan[key] ?? { status: "approved" as StageStatus };
    const start = cursor;
    const due = addDays(start, SPAN[key]);
    cursor = pl.approved ? addDays(pl.approved, 1) : due;
    const total = TEMPLATE[key].length;
    const doneN = pl.status === "approved" ? total : (pl.done ?? 0);
    const reviews: DesignStage["reviews"] = [];
    if (pl.submitted) reviews.push({ id: `${key}-r1`, at: stamp(pl.submitted, 9), by: job.leadArchitect, side: "company", action: "submitted", comment: `ส่งแบบขั้น${STAGE_LABEL[key]}ให้ลูกค้าพิจารณา` });
    for (const [at, by, text] of pl.comments ?? []) reviews.push({ id: `${key}-c${reviews.length}`, at: stamp(at, 14), by, side: "client", action: "changes", comment: text });
    if (pl.approved) reviews.push({ id: `${key}-ok`, at: stamp(pl.approved, 16), by: p.owner, side: "client", action: "approved", comment: "อนุมัติแบบ" });
    return {
      id: `DS-${p.id}-${key}`,
      projectId: p.id,
      key,
      start: pl.status === "not_started" ? undefined : start,
      due,
      finishedAt: pl.approved,
      architect: job.leadArchitect,
      engineers: key === "concept" ? [] : key === "schematic" ? [job.structural] : [job.structural, job.mep],
      deliverables: TEMPLATE[key].map((text, j) => ({ id: `${key}-${j + 1}`, text, done: j < doneN })),
      status: pl.status,
      revisions: pl.revisions ?? (i === 1 ? 1 : 0),
      submittedAt: pl.submitted,
      approvedAt: pl.approved,
      approvedBy: pl.approved ? p.owner : undefined,
      fee: fees[key],
      feeStatus: inContract ? "in_contract" : pl.status === "approved" ? "ready" : "pending",
      reviews,
      attachments: [],
    };
  });
}

const DESIGN_PROJECTS = ["HC-2025-04", "HC-2026-01", "HC-2026-02", "HC-2026-05", "HC-2025-03", "HC-2026-04", "HC-2026-03", "HC-2026-06", "HC-2026-07", "HC-2026-08", "HC-2026-09", "HC-2026-10", "HC-2026-11", "HC-2026-12"];

let cache: { jobs: DesignJob[]; stages: DesignStage[] } | null = null;
function designSeed() {
  if (cache) return cache;
  const jobs: DesignJob[] = [];
  const stages: DesignStage[] = [];
  DESIGN_PROJECTS.forEach((id, i) => {
    const p = getProject(id);
    if (!p) return;
    const ownContract = id === "HC-2026-11" || id === "HC-2026-12";
    const job: DesignJob = {
      id: `DJ-${id}`,
      projectId: id,
      feeTotal: ownContract ? (id === "HC-2026-11" ? 250000 : 180000) : Math.round(p.value * 1e6 * 0.03),
      leadArchitect: ARCHITECTS[i % ARCHITECTS.length],
      structural: ENGINEERS[0],
      mep: ENGINEERS[i % 2 === 0 ? 1 : 2],
      start: id === "HC-2026-11" ? "2026-08-03" : id === "HC-2026-12" ? "2026-09-07" : id === "HC-2026-10" ? "2026-05-11" : addDays(p.contractDate ?? p.start, -170),
      note: ownContract ? "สัญญาออกแบบแยกจากสัญญาก่อสร้าง ชำระตามขั้นตอนที่ลูกค้าอนุมัติ" : "ค่าออกแบบรวมอยู่ในสัญญาก่อสร้าง",
    };
    jobs.push(job);
    let plan: Partial<Record<StageKey, StagePlan>> = {};
    if (id === "HC-2026-10")
      plan = {
        concept: { status: "approved", submitted: "2026-05-29", approved: "2026-06-02" },
        schematic: { status: "approved", submitted: "2026-06-30", approved: "2026-07-08", revisions: 1, comments: [["2026-07-03", p.owner, "ขอขยายห้องครัวไปทางทิศใต้อีก 1 เมตร"]] },
        dd: { status: "approved", submitted: "2026-08-05", approved: "2026-08-12" },
        cd: { status: "approved", submitted: "2026-09-08", approved: "2026-09-14" },
        permit: { status: "in_progress", done: 3 },
      };
    else if (id === "HC-2026-11")
      plan = {
        concept: { status: "approved", submitted: "2026-08-21", approved: "2026-08-27" },
        schematic: { status: "approved", submitted: "2026-09-22", approved: "2026-10-01", revisions: 1, comments: [["2026-09-25", p.owner, "อยากได้ห้องพระชั้นบน และย้ายห้องซักล้างไปด้านหลัง"]] },
        dd: { status: "client_review", done: 5, submitted: "2026-10-24" },
        cd: { status: "not_started" },
        permit: { status: "not_started" },
      };
    else if (id === "HC-2026-12")
      plan = {
        concept: { status: "approved", submitted: "2026-09-24", approved: "2026-09-29" },
        schematic: {
          status: "changes_requested",
          done: 4,
          submitted: "2026-10-27",
          revisions: 2,
          comments: [
            ["2026-10-12", p.owner, "หน้าบ้านดูทึบไป อยากได้ช่องแสงมากขึ้น"],
            ["2026-10-30", p.owner, "ขอเพิ่มที่จอดรถเป็น 3 คัน และให้ห้องนอนใหญ่หันทิศเหนือ"],
          ],
        },
        dd: { status: "not_started" },
        cd: { status: "not_started" },
        permit: { status: "not_started" },
      };
    else {
      // already under construction: every stage approved long ago
      const s = job.start;
      const a = (k: StageKey) => addDays(s, STAGE_KEYS.slice(0, STAGE_KEYS.indexOf(k) + 1).reduce((t, x) => t + SPAN[x], 0) - 2);
      plan = Object.fromEntries(STAGE_KEYS.map((k) => [k, { status: "approved", submitted: addDays(a(k), -5), approved: a(k) } satisfies StagePlan])) as Record<StageKey, StagePlan>;
    }
    stages.push(...buildStages(p, job, plan, !ownContract));
  });
  cache = { jobs, stages };
  return cache;
}
export const seedDesignJobs = () => designSeed().jobs;
export const seedDesignStages = () => designSeed().stages;

// ---------- permits ----------

const buildingUseOf = (p: Project): BuildingUse => {
  const t = getHouseModel(p.modelCode)?.type;
  return t === "condo" ? "condo" : t === "homeoffice" ? "homeoffice" : t === "townhome" ? "townhome" : "house";
};
const heightOf = (p: Project) => Math.round((p.floors * 3.3 + 2.2) * 10) / 10;

type PermitPlan = {
  route: PermitRoute;
  authority: [AuthorityKind, string];
  status: Permit["status"];
  submitted?: string;
  issued?: string;
  no?: string;
  ready?: number; // number of docs ready (others missing)
  queries?: Permit["queries"];
  extensions?: Permit["extensions"];
  completion?: [string, string?, string?];
  officer?: string;
  units?: number;
  note?: string;
};

const PERMIT_PLAN: Record<string, PermitPlan> = {
  "HC-2026-10": {
    route: "permit",
    authority: ["municipality", "เทศบาลนครนนทบุรี"],
    status: "query",
    submitted: "2026-09-21",
    officer: "นายช่างโยธา สุรพงษ์ แก้วกาญจน์",
    queries: [
      { id: "Q1", date: "2026-10-12", officer: "นายช่างโยธา สุรพงษ์ แก้วกาญจน์", text: "ขอแก้ไขแผนผังบริเวณ แสดงระยะร่นด้านข้างทิศตะวันออกให้ชัดเจน (ไม่น้อยกว่า 2.00 ม.)", reply: "ส่งแผนผังบริเวณแก้ไขพร้อมลงนามสถาปนิกแล้ว", repliedAt: "2026-10-16" },
      { id: "Q2", date: "2026-10-29", officer: "นายช่างโยธา สุรพงษ์ แก้วกาญจน์", text: "ขอสำเนาใบอนุญาตประกอบวิชาชีพวิศวกรผู้ควบคุมงานฉบับปัจจุบัน (ฉบับเดิมหมดอายุ)" },
    ],
  },
  "HC-2026-11": { route: "m39", authority: ["municipality", "เทศบาลเมืองบางกรวย"], status: "preparing", ready: 5, note: "เลือกแจ้งตาม ม.39 ทวิ เพื่อเริ่มงานได้เร็ว ลูกค้าเป็นเจ้าของที่ดินเอง" },
  "HC-2026-12": { route: "permit", authority: ["district", "สำนักงานเขตบางเขน"], status: "preparing", ready: 2 },
  "HC-2025-04": { route: "permit", authority: ["district", "สำนักงานเขตลาดพร้าว"], status: "completion", submitted: "2025-10-06", issued: "2025-11-10", no: "อ.1 ที่ 318/2568", completion: ["2026-10-28"] },
  "HC-2026-01": { route: "permit", authority: ["municipality", "เทศบาลนครสมุทรปราการ"], status: "approved", submitted: "2025-12-10", issued: "2026-01-20", no: "อ.1 ที่ 12/2569" },
  "HC-2026-02": { route: "permit", authority: ["municipality", "เทศบาลเมืองปู่เจ้าสมิงพราย"], status: "approved", submitted: "2025-11-14", issued: "2025-12-20", no: "อ.1 ที่ 402/2568", note: "ได้ใบอนุญาตก่อนเริ่มงาน 3 เดือน ต้องยื่นขอต่ออายุก่อนหมดอายุ" },
  "HC-2026-05": { route: "permit", authority: ["municipality", "เทศบาลเมืองแสนสุข"], status: "approved", submitted: "2026-03-30", issued: "2026-05-02", no: "อ.1 ที่ 77/2569" },
  "HC-2025-03": {
    route: "permit",
    authority: ["district", "สำนักงานเขตวังทองหลาง"],
    status: "approved",
    submitted: "2025-06-02",
    issued: "2025-09-01",
    no: "อ.1 ที่ 205/2568",
    units: 48,
    officer: "วิศวกรโยธา กิตติพงษ์ ศรีวิไล",
    extensions: [{ id: "E1", requestedAt: "2026-07-20", approvedAt: "2026-08-18", newExpiry: "2027-09-01", note: "ต่ออายุครั้งที่ 1 (งานโครงสร้างยังไม่แล้วเสร็จ)" }],
  },
  "HC-2026-04": { route: "m39", authority: ["district", "สำนักงานเขตบางกะปิ"], status: "approved", submitted: "2026-03-16", issued: "2026-03-16", no: "ใบรับแจ้ง ที่ 41/2569", note: "เจ้าหน้าที่ตรวจแบบครบ 120 วันแล้ว ไม่มีคำสั่งให้แก้ไข" },
  "HC-2026-03": { route: "permit", authority: ["district", "สำนักงานเขตบางเขน"], status: "approved", submitted: "2026-01-12", issued: "2026-02-26", no: "อ.1 ที่ 58/2569" },
  "HC-2026-06": { route: "permit", authority: ["sao", "องค์การบริหารส่วนตำบลสันผักหวาน"], status: "approved", submitted: "2026-04-08", issued: "2026-05-15", no: "อ.1 ที่ 9/2569" },
  "HC-2026-07": { route: "permit", authority: ["municipality", "เทศบาลนครขอนแก่น"], status: "approved", submitted: "2026-05-25", issued: "2026-06-30", no: "อ.1 ที่ 133/2569" },
  "HC-2026-08": { route: "m39", authority: ["municipality", "เทศบาลนครนนทบุรี"], status: "approved", submitted: "2026-08-03", issued: "2026-08-03", no: "ใบรับแจ้ง ที่ 27/2569" },
  "HC-2026-09": { route: "permit", authority: ["sao", "องค์การบริหารส่วนตำบลบางพูด"], status: "approved", submitted: "2026-07-01", issued: "2026-08-26", no: "อ.1 ที่ 31/2569" },
  "HC-2025-01": { route: "permit", authority: ["municipality", "เทศบาลนครนนทบุรี"], status: "completed", submitted: "2024-12-02", issued: "2025-01-10", no: "อ.1 ที่ 15/2568", completion: ["2026-01-22", "2026-02-05", "รับแจ้งเลขที่ 4/2569"] },
  "HC-2025-02": { route: "m39", authority: ["municipality", "เทศบาลเมืองบางบัวทอง"], status: "completed", submitted: "2025-03-18", issued: "2025-03-18", no: "ใบรับแจ้ง ที่ 19/2568", completion: ["2026-04-12", "2026-04-30", "รับแจ้งเลขที่ 11/2569"] },
};

export function seedPermits(): Permit[] {
  const out: Permit[] = [];
  for (const [id, pl] of Object.entries(PERMIT_PLAN)) {
    const p = getProject(id);
    if (!p) continue;
    const use = buildingUseOf(p);
    const input = { route: pl.route, use, height: heightOf(p), floorArea: p.area, units: pl.units, ownerIsApplicant: id !== "HC-2026-03" };
    const blank = permitChecklist(input, DEFAULT_DESIGN_SETTINGS);
    const submitted = pl.status !== "preparing";
    const docs: PermitDoc[] = blank.map((d, i) => ({ ...d, status: submitted ? "submitted" : i < (pl.ready ?? 0) ? "ready" : "missing" }));
    if (id === "HC-2026-10") {
      const lic = docs.find((d) => d.key === "licenses");
      if (lic) {
        lic.status = "missing";
        lic.note = "ใบอนุญาต กว. ผู้ควบคุมงานหมดอายุ รอฉบับต่ออายุ";
      }
    }
    out.push({
      id: `PMT-${id}`,
      projectId: id,
      route: pl.route,
      authorityKind: pl.authority[0],
      authorityName: pl.authority[1],
      officer: pl.officer,
      use,
      height: input.height,
      floorArea: p.area,
      units: pl.units,
      ownerIsApplicant: input.ownerIsApplicant,
      docs,
      submittedAt: pl.submitted,
      queries: pl.queries ?? [],
      status: pl.status,
      permitNo: pl.no,
      issuedAt: pl.issued,
      expiresAt: pl.issued ? addDays(pl.issued, DEFAULT_DESIGN_SETTINGS.permitValidityDays) : undefined,
      extensions: pl.extensions ?? [],
      completionKind: completionKindFor(use),
      completionSubmittedAt: pl.completion?.[0],
      completionIssuedAt: pl.completion?.[1],
      completionRef: pl.completion?.[2],
      fee: Math.round(p.area * (pl.route === "m39" ? 4 : 2)),
      note: pl.note,
    });
  }
  return out;
}

// ---------- spec sets ----------

const SPEC_PROJECTS = ["HC-2025-04", "HC-2026-01", "HC-2026-02", "HC-2026-05", "HC-2025-03", "HC-2026-04", "HC-2026-03", "HC-2026-06", "HC-2026-07", "HC-2026-08", "HC-2026-09", "HC-2026-10", "HC-2026-11"];
export function seedSpecSets(): SpecSet[] {
  return SPEC_PROJECTS.map((id, i): SpecSet => {
    const p = getProject(id)!;
    const condo = p.modelCode === "CD-01";
    const all = SPEC_LIBRARY.map((s) => s.id);
    return {
      id: `SPEC-${id}`,
      projectId: id,
      title: `รายการประกอบแบบ ${p.name}`,
      revision: id === "HC-2026-11" ? 0 : 1 + (i % 2),
      issuedAt: id === "HC-2026-11" ? "2026-10-20" : addDays(p.contractDate ?? p.start, -20),
      preparedBy: ARCHITECTS[i % ARCHITECTS.length],
      sectionIds: condo ? all : all.filter((s) => s !== "SPS-01" || i % 3 === 0),
      excluded: condo ? ["SPC-08-04"] : i % 2 ? ["SPC-06-03"] : [],
      overrides:
        id === "HC-2026-02"
          ? { "SPC-08-01": { text: "กระเบื้องแกรนิตโต้ผิวด้าน 60×120 ซม. เกรด A ปูชนแนว ร่องยาแนว 2 มม. สีตามที่ลูกค้าเลือก (ลูกค้าอัปเกรดจากมาตรฐาน)", brands: ["กระเบื้องงาม"] } }
          : condo
            ? { "SPC-03-01": { text: "คอนกรีตโครงสร้างกำลังอัดไม่น้อยกว่า 280 กก./ตร.ซม. (ทรงกระบอก) สำหรับเสาและคานชั้น 1–3 และ 240 กก./ตร.ซม. สำหรับชั้นที่เหลือ" } }
            : {},
    };
  });
}

// ---------- portal: messages ----------

type Msg = [projectId: string, side: PortalMessage["side"], author: string, at: string, text: string, read?: boolean];
const MSGS: Msg[] = [
  ["HC-2026-02", "customer", "ศิริรัตน์ โพธิ์ทอง", "2026-10-28T19:12:00+07:00", "สอบถามค่ะ ปลั๊กห้องนอนใหญ่ขอเพิ่มข้างหัวเตียงอีก 2 จุดได้ไหมคะ", true],
  ["HC-2026-02", "company", "ศิริพร ตั้งเจริญ", "2026-10-29T09:05:00+07:00", "ได้ครับ จะแจ้งช่างไฟเดินท่อเพิ่มก่อนฉาบผนัง ค่าใช้จ่ายเพิ่มจุดละประมาณ 850 บาท จะส่งใบงานเพิ่มให้อนุมัติในพอร์ทัลครับ"],
  ["HC-2026-02", "customer", "ศิริรัตน์ โพธิ์ทอง", "2026-11-03T20:41:00+07:00", "ขอบคุณค่ะ แล้วกระเบื้องห้องน้ำชั้นบนต้องเลือกภายในวันไหนคะ"],
  ["HC-2026-05", "customer", "วัชระ เลิศวิริยะ", "2026-10-30T18:20:00+07:00", "สัปดาห์หน้าจะเข้าไปดูหน้างานวันเสาร์ สะดวกไหมครับ", true],
  ["HC-2026-05", "company", "วรเชษฐ์ อินทรประเสริฐ", "2026-10-31T08:40:00+07:00", "สะดวกครับ วันเสาร์ที่ 7 พ.ย. 10:00 น. โฟร์แมนจะรออยู่หน้างาน"],
  ["HC-2025-04", "customer", "อรวรรณ ทองมา", "2026-11-02T10:15:00+07:00", "นัดตรวจรับบ้านรอบสองวันที่ 10 ได้เลยค่ะ ขอดูเรื่องประตูห้องน้ำชั้นบนด้วยนะคะ", true],
  ["HC-2025-04", "company", "ศิริพร ตั้งเจริญ", "2026-11-02T11:02:00+07:00", "รับทราบครับ ยืนยันวันที่ 10 พ.ย. 13:30 น. ทีม QC จะตรวจประตูห้องน้ำและงานที่แก้ไขรอบแรกทั้งหมด"],
  ["HC-2026-11", "company", "ภูริช สายสุวรรณ", "2026-10-24T16:30:00+07:00", "ส่งแบบพัฒนาแบบ (DD) ให้พิจารณาในพอร์ทัลแล้วครับ รบกวนตรวจและกดอนุมัติหรือแจ้งแก้ไขได้เลย"],
  ["HC-2026-11", "customer", "เบญจวรรณ วงศ์ทอง", "2026-11-04T07:55:00+07:00", "ขอเวลาดูแบบกับครอบครัวอีกนิดนะคะ มีคำถามเรื่องความสูงฝ้าห้องนั่งเล่น"],
  ["HC-2025-01", "customer", "มยุรี เรืองฤทธิ์", "2026-10-28T12:10:00+07:00", "เครื่องทำน้ำอุ่นห้องน้ำ 2 ตัดบ่อยค่ะ แจ้งซ่อมไปแล้ว ช่างจะเข้าวันไหนคะ", true],
  ["HC-2025-01", "company", "นภัสสร วงศ์ใหญ่", "2026-10-28T14:00:00+07:00", "ช่างสุริยาจะติดต่อนัดภายในวันนี้ค่ะ ขออภัยในความไม่สะดวก"],
];
export function seedMessages(): PortalMessage[] {
  const seq: Record<string, number> = {};
  return MSGS.map(([projectId, side, author, at, text, read]) => {
    seq[projectId] = (seq[projectId] ?? 0) + 1;
    return { id: `MSG-${projectId}-${String(seq[projectId]).padStart(4, "0")}`, projectId, side, author, text, at, readAt: side === "customer" && read ? at : undefined };
  });
}

// ---------- portal: satisfaction surveys ----------

const COMMENTS = {
  quality: ["งานเรียบร้อยดีมาก", "งานละเอียด ผนังเรียบ", "มีจุดแก้ไขเล็กน้อยแต่แก้ไวดี", "วัสดุตรงตามสเปก"],
  onTime: ["ส่งมอบตรงตามสัญญา", "ช้ากว่ากำหนดเล็กน้อยช่วงหน้าฝน", "เร็วกว่าที่คิด"],
  communication: ["PM ตอบไวมาก", "อัปเดตความคืบหน้าทุกสัปดาห์", "ได้รับรูปหน้างานสม่ำเสมอ"],
  afterSales: ["ช่างบริการมาตรงเวลา", "แจ้งซ่อมผ่านพอร์ทัลสะดวก", "ติดตามงานดี"],
};
export function seedSurveys(): SurveyResponse[] {
  const rnd = seeded(4540);
  const out: SurveyResponse[] = [];
  const delivered = projects.filter((p) => p.status === "delivered" && p.handedOver && p.handedOver >= "2019-01-01");
  for (const p of delivered) {
    const pick = (arr: string[]) => arr[Math.floor(rnd() * arr.length)];
    const sc = () => (rnd() < 0.62 ? 5 : rnd() < 0.85 ? 4 : 3);
    const low = p.id === "HC-2025-02";
    const scores = low ? { quality: 3, onTime: 2, communication: 4, afterSales: 2 } : { quality: sc(), onTime: sc(), communication: sc(), afterSales: sc() };
    out.push({
      id: `SRV-${p.id}-handover`,
      projectId: p.id,
      trigger: "handover",
      at: addDays(p.handedOver!, 3 + Math.floor(rnd() * 10)),
      by: p.owner,
      scores,
      comments: low
        ? { onTime: "ส่งมอบช้ากว่าสัญญาเกือบเดือน", afterSales: "หลังคารั่วซ้ำหลังแจ้งซ่อม ยังรอช่างอยู่" }
        : { quality: pick(COMMENTS.quality), communication: rnd() < 0.5 ? pick(COMMENTS.communication) : undefined, onTime: rnd() < 0.3 ? pick(COMMENTS.onTime) : undefined },
      general: low ? undefined : rnd() < 0.4 ? "จะแนะนำเพื่อนให้มาสร้างด้วย" : undefined,
    });
  }
  // after a closed repair
  out.push({
    id: "SRV-HC-2024-05-REP-202609-0021",
    projectId: "HC-2024-05",
    trigger: "repair",
    repairId: "REP-202609-0021",
    at: "2026-09-26",
    by: "กัลยา อินทรสุวรรณ",
    scores: { quality: 5, onTime: 4, communication: 5, afterSales: 5 },
    comments: { afterSales: "ช่างสมชายมาเร็ว อธิบายสาเหตุชัดเจน" },
  });
  return out;
}
