// Safety records: toolbox talks, permits to work, inspections, incidents, PPE issue,
// environmental / dust log and settings. Types and label tables only.
import type { MediaRef } from "../media";

// ---------- toolbox talk ----------

export type Attendee = { employeeId?: string; name: string; group?: string };
export type ToolboxTalk = {
  id: string; // TBT-2026-0001
  projectId: string;
  date: string;
  time: string; // "07:45"
  topicId?: string;
  topic: string;
  presenter: string;
  attendees: Attendee[];
  /** headcount from subcontractor crews not listed by name */
  crews: { name: string; count: number }[];
  durationMin: number;
  notes?: string;
  photos: MediaRef[];
  signature?: MediaRef;
  signer?: string;
  source: "web" | "phone";
};
export const talkHeadcount = (t: Pick<ToolboxTalk, "attendees" | "crews">) => t.attendees.length + t.crews.reduce((s, c) => s + c.count, 0);

export type TopicCat = "general" | "height" | "lifting" | "electrical" | "hot" | "excavation" | "health" | "ppe" | "housekeeping" | "machine";
export const TOPIC_CAT_LABEL: Record<TopicCat, string> = {
  general: "ทั่วไป",
  height: "ที่สูง/นั่งร้าน",
  lifting: "ยก/ปั้นจั่น",
  electrical: "ไฟฟ้า",
  hot: "งานร้อน/ดับเพลิง",
  excavation: "ขุดดิน/ที่อับอากาศ",
  health: "สุขภาพ/อาชีวอนามัย",
  ppe: "อุปกรณ์ PPE",
  housekeeping: "ความเป็นระเบียบ",
  machine: "เครื่องจักร",
};
/** Thai toolbox-talk topic library */
export const TOPICS: { id: string; cat: TopicCat; title: string }[] = [
  { id: "T01", cat: "height", title: "การใช้เข็มขัดนิรภัยแบบเต็มตัวและจุดยึดที่มั่นคง" },
  { id: "T02", cat: "height", title: "ตรวจป้ายนั่งร้านก่อนขึ้นทำงาน (ป้ายเขียว/เหลือง/แดง)" },
  { id: "T03", cat: "height", title: "การปิดช่องเปิดพื้นและติดตั้งราวกันตก" },
  { id: "T04", cat: "height", title: "การใช้บันไดพาดอย่างปลอดภัย อัตราส่วน 1:4" },
  { id: "T05", cat: "lifting", title: "สัญญาณมือมาตรฐานสำหรับปั้นจั่น" },
  { id: "T06", cat: "lifting", title: "การตรวจสลิง ห่วง ตะขอ ก่อนยก และห้ามอยู่ใต้ของแขวน" },
  { id: "T07", cat: "lifting", title: "หยุดยกเมื่อลมแรงหรือฝนฟ้าคะนอง" },
  { id: "T08", cat: "electrical", title: "เครื่องตัดไฟรั่ว ปลั๊กพ่วง สายไฟชำรุด" },
  { id: "T09", cat: "electrical", title: "การล็อกและแขวนป้าย (Lockout/Tagout) ก่อนทำงานกับตู้ไฟ" },
  { id: "T10", cat: "hot", title: "งานเชื่อม ตัด เจียร: ถังดับเพลิงและผู้เฝ้าระวังไฟ" },
  { id: "T11", cat: "hot", title: "การใช้ถังดับเพลิง: ดึง ปลด กด ส่าย" },
  { id: "T12", cat: "excavation", title: "การป้องกันดินพังในงานขุดลึกเกิน 1.5 เมตร" },
  { id: "T13", cat: "excavation", title: "ที่อับอากาศ: ตรวจวัดก๊าซ ผู้เฝ้าระวัง ห้ามเข้าคนเดียว" },
  { id: "T14", cat: "health", title: "ป้องกันโรคลมร้อน: ดื่มน้ำ พักในที่ร่ม สังเกตอาการ" },
  { id: "T15", cat: "health", title: "ฝุ่น PM2.5 และการสวมหน้ากาก N95" },
  { id: "T16", cat: "health", title: "ห้ามดื่มสุราและใช้สารเสพติดก่อนและระหว่างทำงาน" },
  { id: "T17", cat: "health", title: "การยกของด้วยท่าทางที่ถูกต้อง ป้องกันปวดหลัง" },
  { id: "T18", cat: "ppe", title: "การสวมหมวกนิรภัยและรัดสายรัดคาง" },
  { id: "T19", cat: "ppe", title: "แว่นตานิรภัยและที่ครอบหูสำหรับงานเจียร/ตัด" },
  { id: "T20", cat: "housekeeping", title: "เก็บกวาดเศษวัสดุ ตะปู เหล็กปลายแหลม ทุกเย็น" },
  { id: "T21", cat: "housekeeping", title: "การจัดเก็บวัสดุไวไฟและถังแก๊ส" },
  { id: "T22", cat: "machine", title: "จุดบอดของรถขุดและรถบรรทุก ผู้ให้สัญญาณจราจรในไซต์" },
  { id: "T23", cat: "machine", title: "ใบเลื่อยวงเดือนและการ์ดป้องกัน" },
  { id: "T24", cat: "general", title: "การรายงานเหตุเกือบเกิดอุบัติเหตุ (Near miss)" },
  { id: "T25", cat: "general", title: "เส้นทางหนีไฟ จุดรวมพล และเบอร์ฉุกเฉิน 1669" },
  { id: "T26", cat: "general", title: "ปฐมนิเทศคนงานใหม่: กฎความปลอดภัยของไซต์" },
];

// ---------- permit to work ----------

export type PermitType = "hot" | "height" | "confined" | "excavation" | "lift" | "electrical";
export const PERMIT_LABEL: Record<PermitType, string> = {
  hot: "งานที่ก่อให้เกิดความร้อน/ประกายไฟ",
  height: "งานบนที่สูง",
  confined: "งานในที่อับอากาศ",
  excavation: "งานขุด",
  lift: "งานยกด้วยปั้นจั่น",
  electrical: "งานตัดแยกระบบไฟฟ้า",
};
export const PERMIT_SHORT: Record<PermitType, string> = { hot: "งานร้อน", height: "ที่สูง", confined: "อับอากาศ", excavation: "ขุด", lift: "ยก", electrical: "ไฟฟ้า" };
export const PERMIT_HAZARDS: Record<PermitType, string[]> = {
  hot: ["ประกายไฟตกใส่วัสดุไวไฟ", "ควันและไอโลหะ", "แสงจ้า/รังสี UV", "ถังแก๊สรั่วหรือล้ม", "ไฟฟ้าดูดจากเครื่องเชื่อม"],
  height: ["ตกจากที่สูง", "วัสดุ/เครื่องมือตกใส่คนด้านล่าง", "นั่งร้านล้มหรือแผ่นพื้นหลุด", "ลมแรง", "สายไฟแรงสูงใกล้จุดทำงาน"],
  confined: ["ออกซิเจนไม่เพียงพอ", "ก๊าซพิษ (H2S, CO)", "ก๊าซไวไฟ", "ทางเข้าออกแคบ ช่วยเหลือยาก", "น้ำท่วม/ดินถล่ม"],
  excavation: ["ดินพังทลาย", "สาธารณูปโภคใต้ดิน (ท่อ/สายไฟ)", "คนหรือรถตกหลุม", "น้ำใต้ดิน", "รถขุดเฉี่ยวชน"],
  lift: ["ของแขวนตก", "ปั้นจั่นล้ม/รับน้ำหนักเกิน", "สลิงขาด", "แกว่งชนคน/โครงสร้าง", "สายไฟฟ้าแรงสูง"],
  electrical: ["ไฟฟ้าดูด", "อาร์กแฟลช", "มีผู้สับสวิตช์คืนระหว่างทำงาน", "ไฟย้อนจากเครื่องกำเนิดไฟฟ้า"],
};
export const PERMIT_CONTROLS: Record<PermitType, string[]> = {
  hot: ["ย้ายวัสดุไวไฟออกรัศมี 11 เมตร หรือคลุมด้วยผ้ากันไฟ", "ถังดับเพลิงพร้อมใช้ที่จุดทำงาน", "ผู้เฝ้าระวังไฟ (fire watch) อยู่ต่อ 30 นาทีหลังเลิกงาน", "อุปกรณ์กันย้อนกลับของเปลวไฟที่ถังแก๊ส", "ช่างเชื่อมสวม PPE ครบ"],
  height: ["นั่งร้านติดป้ายเขียว ตรวจแล้ววันนี้", "เข็มขัดนิรภัยเต็มตัว คล้องจุดยึดตลอดเวลา", "ราวกันตก/ตาข่ายกันตก", "กั้นเขตด้านล่างและติดป้ายเตือน", "หยุดงานเมื่อลมแรง"],
  confined: ["ตรวจวัดก๊าซก่อนเข้าและทุก 2 ชั่วโมง", "ระบายอากาศด้วยพัดลม", "ผู้ช่วยเหลือเฝ้าที่ทางเข้า พร้อมอุปกรณ์ช่วยชีวิต", "ผู้ปฏิบัติงานผ่านการอบรมที่อับอากาศ", "ป้าย 'ที่อับอากาศ อันตราย ห้ามเข้า'"],
  excavation: ["สำรวจแบบสาธารณูปโภคใต้ดินก่อนขุด", "ค้ำยัน/ลาดดินตามความลึก", "กองดินห่างขอบหลุมอย่างน้อย 0.6 เมตร", "ราวกั้นและบันไดขึ้นลงหลุม", "สูบน้ำออกก่อนลงหลุม"],
  lift: ["แผนการยก (lifting plan) และน้ำหนักของที่ยก", "ปั้นจั่นมีผลตรวจ ปจ.2 ยังไม่หมดอายุ", "ผู้บังคับ ผู้ให้สัญญาณ ผู้ยึดเกาะ ผ่านการอบรม", "ตรวจสลิงและอุปกรณ์ช่วยยก", "กั้นเขตรัศมีการยก"],
  electrical: ["ตัดไฟ ล็อก และแขวนป้ายชื่อผู้ปฏิบัติงาน", "ทดสอบว่าไม่มีไฟด้วยเครื่องวัด", "ต่อลงดินชั่วคราว", "ช่างไฟฟ้ามีหนังสือรับรอง", "ถุงมือและเครื่องมือหุ้มฉนวน"],
};

export type PermitStatus = "requested" | "issued" | "active" | "closed" | "cancelled";
export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  requested: "ขออนุญาต",
  issued: "ผู้ออกใบลงนามแล้ว รออนุมัติ",
  active: "อนุมัติ ทำงานได้",
  closed: "ปิดงานแล้ว",
  cancelled: "ยกเลิก",
};
export type SignOff = { name: string; at: string; signature?: MediaRef };
export type Permit = {
  id: string; // PTW-2026-0001
  projectId: string;
  type: PermitType;
  title: string;
  location: string;
  crew: string;
  workers: number;
  /** "2026-11-04T08:00" */
  validFrom: string;
  validTo: string;
  hazards: string[];
  controls: { text: string; done: boolean }[];
  /** confined space gas test */
  gas?: { o2: number; lel: number; h2s: number; co: number; at: string };
  requestedBy: string;
  requestedAt: string;
  issuer?: SignOff;
  approver?: SignOff;
  closeOut?: SignOff & { note: string; areaSafe: boolean };
  status: PermitStatus;
  photos: MediaRef[];
};

// ---------- inspections ----------

export type InspKind = "scaffold" | "ppe" | "walk";
export const INSP_LABEL: Record<InspKind, string> = { scaffold: "ตรวจนั่งร้าน (ป้ายนั่งร้าน)", ppe: "ตรวจ PPE", walk: "เดินตรวจความปลอดภัย" };
export const INSP_SHORT: Record<InspKind, string> = { scaffold: "นั่งร้าน", ppe: "PPE", walk: "เดินตรวจ" };
export const INSP_ITEMS: Record<InspKind, string[]> = {
  scaffold: ["ฐานรองแผ่นเหล็ก/ไม้รองมั่นคง ไม่ทรุด", "เสาตั้งดิ่ง ข้อต่อล็อกครบ", "ค้ำยันทแยงครบทุกช่วง", "ยึดโยงกับโครงสร้างทุก 4 เมตร", "แผ่นพื้นเต็มช่อง ไม่มีช่องว่าง ยึดแน่น", "ราวกันตกบน-กลาง และขอบกันของตก", "บันไดขึ้นลงมั่นคง", "ไม่บรรทุกวัสดุเกินพิกัด"],
  ppe: ["หมวกนิรภัยมีสายรัดคาง", "รองเท้านิรภัย", "เสื้อสะท้อนแสง", "ถุงมือเหมาะกับงาน", "แว่นตานิรภัย (งานเจียร/ตัด)", "เข็มขัดนิรภัยเต็มตัว (งานที่สูง)", "ที่ครอบหู/อุดหู (งานเสียงดัง)", "หน้ากากกันฝุ่น"],
  walk: ["ความเป็นระเบียบ ทางเดินโล่ง", "ช่องเปิดพื้นปิด/มีราวกั้น", "ระบบไฟฟ้าชั่วคราวมีเครื่องตัดไฟรั่ว", "ถังดับเพลิงพร้อมใช้", "ป้ายเตือนและเขตอันตราย", "การจัดเก็บวัสดุและสารเคมี", "เครื่องจักรมีการ์ดป้องกัน", "ห้องน้ำ-น้ำดื่มเพียงพอ", "ทางหนีไฟและจุดรวมพล", "ป้องกันฝุ่น/เศษวัสดุตกนอกไซต์"],
};
export type ItemResult = "pass" | "fail" | "na";
export type ScaffoldTag = "green" | "yellow" | "red";
export const TAG_LABEL: Record<ScaffoldTag, string> = { green: "ป้ายเขียว ใช้งานได้", yellow: "ป้ายเหลือง ใช้ได้มีเงื่อนไข", red: "ป้ายแดง ห้ามใช้" };
export type SafetyInspection = {
  id: string; // SIN-2026-0001
  projectId: string;
  kind: InspKind;
  date: string;
  inspector: string;
  location: string;
  /** scaffold tag set after inspection */
  tag?: ScaffoldTag;
  scaffoldNo?: string;
  heightM?: number;
  items: { text: string; result: ItemResult; note?: string }[];
  photos: MediaRef[];
  actions?: string;
  followUpDue?: string;
  closed: boolean;
};

// ---------- incidents ----------

export type IncidentClass = "near_miss" | "first_aid" | "lost_time" | "fatal";
export const INC_LABEL: Record<IncidentClass, string> = { near_miss: "เกือบเกิดอุบัติเหตุ", first_aid: "ปฐมพยาบาล", lost_time: "หยุดงาน (LTI)", fatal: "เสียชีวิต" };
export const INC_TONE: Record<IncidentClass, "neutral" | "warn" | "neg"> = { near_miss: "neutral", first_aid: "warn", lost_time: "neg", fatal: "neg" };
export const isSerious = (c: IncidentClass) => c === "lost_time" || c === "fatal";
export const BODY_PARTS = ["ศีรษะ", "ตา", "ใบหน้า", "คอ", "ไหล่", "แขน", "มือ/นิ้วมือ", "หลัง", "ลำตัว/หน้าอก", "สะโพก", "ขา", "เข่า", "เท้า/นิ้วเท้า", "หลายส่วน"];
export const CAUSE_CATS = ["สภาพการทำงานไม่ปลอดภัย", "การกระทำไม่ปลอดภัย", "ไม่สวม PPE", "ขาดการอบรม", "เครื่องมือชำรุด", "ขาดการควบคุมงาน", "ขั้นตอนงานไม่ชัดเจน", "สภาพอากาศ"];
export type CorrectiveAction = { id: string; text: string; owner: string; due: string; done: boolean; doneAt?: string };
export type Incident = {
  id: string; // INC-2026-0001
  projectId: string;
  cls: IncidentClass;
  date: string;
  time: string;
  place: string;
  description: string;
  people: string[];
  injured?: { employeeId?: string; name: string; trade?: string; nationality?: string; bodyParts: string[]; injury: string; treatment: string; hospital?: string };
  cause: { immediate: string; root: string; cats: string[] };
  actions: CorrectiveAction[];
  daysLost: number;
  returnedAt?: string;
  status: "open" | "investigating" | "closed";
  reportedBy: string;
  /** checklist for serious cases (labour inspector, SSO …) keyed by item text */
  notify: { item: string; done: boolean; at?: string }[];
  /** กท.16 workmen's compensation notification record */
  kt16?: { no: string; submittedAt: string; office: string; wage?: number; note?: string };
  photos: MediaRef[];
};

// ---------- PPE ----------

export const PPE_ITEMS = ["หมวกนิรภัย", "รองเท้านิรภัย", "เสื้อสะท้อนแสง", "ถุงมือผ้า", "ถุงมือหนัง", "แว่นตานิรภัย", "ที่อุดหู", "หน้ากาก N95", "เข็มขัดนิรภัยเต็มตัว", "หน้ากากเชื่อม", "รองเท้าบูทยาง"];
export type PpeIssue = {
  id: string; // PPE-2026-0001
  employeeId: string;
  projectId?: string;
  date: string;
  items: { item: string; qty: number; size?: string }[];
  issuedBy: string;
  /** replacement of a damaged / lost item */
  reason: "new" | "replace" | "lost";
  signature?: MediaRef;
};
export const PPE_REASON_LABEL: Record<PpeIssue["reason"], string> = { new: "เบิกครั้งแรก", replace: "เปลี่ยนชำรุด", lost: "สูญหาย" };

// ---------- environment / dust ----------

export type EnvLog = {
  id: string; // ENV-<projectId>-<date>
  projectId: string;
  date: string;
  pm25: number; // µg/m³
  noiseDb?: number;
  dustScreen: boolean;
  wheelWash: boolean;
  waterSprayTimes: number;
  complaints: { text: string; from: string; resolved: boolean }[];
  by: string;
  photos: MediaRef[];
  note?: string;
};

// ---------- settings ----------

export type JpLevel = "supervisor" | "technical" | "advanced" | "professional";
export const JP_LABEL: Record<JpLevel, string> = { supervisor: "จป.หัวหน้างาน", technical: "จป.เทคนิค", advanced: "จป.เทคนิคขั้นสูง", professional: "จป.วิชาชีพ" };
export type JpRung = { min: number; level: JpLevel; committee?: boolean };

export type SafetySettings = {
  id: "safety-settings";
  /** จป. staffing ladder by headcount (กฎกระทรวง จป. 2565, verify the latest) */
  ladder: JpRung[];
  /** LTIFR per this many man-hours (1,000,000 or 200,000) */
  ltifrBase: number;
  hoursPerDay: number;
  /** PM2.5 level that triggers extra dust controls, µg/m³ */
  pm25Limit: number;
  /** follow-up checklist for lost-time / fatal incidents */
  notifyItems: string[];
};

/** Safety officer assigned to a site (from the team with role "safety" or a certified employee). */
export type SafetyOfficer = {
  id: string; // JPA-0001
  projectId: string;
  name: string;
  level: JpLevel;
  memberId?: string;
  employeeId?: string;
  from: string;
};
