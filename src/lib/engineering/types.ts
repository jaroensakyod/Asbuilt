// Engineering, quality & document-control records (RFI, submittals, NCR, ITP,
// material tests, supervision reports, licences, controlled documents,
// transmittals, meetings, closeout). Type-only file: safe to import from tests.

import type { MediaRef } from "../media";

// ---------- shared ----------

/** same keys as the drawing sheet disciplines in src/lib/drawing */
export type Disc = "A" | "S" | "E" | "P" | "M";
export const DISC_LABEL: Record<Disc, string> = { A: "สถาปัตย์", S: "โครงสร้าง", E: "ไฟฟ้า", P: "สุขาภิบาล", M: "ปรับอากาศ" };
export const DISCS = Object.keys(DISC_LABEL) as Disc[];

export type Priority = "low" | "normal" | "high" | "urgent";
export const PRIORITY_LABEL: Record<Priority, string> = { low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วนมาก" };

// ---------- RFI ----------

export type RfiStatus = "open" | "answered" | "closed";
export const RFI_STATUS_LABEL: Record<RfiStatus, string> = { open: "รอตอบ", answered: "ตอบแล้ว", closed: "ปิดแล้ว" };

export type RfiMessage = {
  id: string;
  at: string; // ISO datetime
  by: string;
  text: string;
  /** the official answer from the designer / consultant */
  official?: boolean;
  attachments?: MediaRef[];
};

export type Rfi = {
  id: string; // RFI-<projectId>-001
  projectId: string;
  no: number;
  subject: string;
  question: string;
  /** proposed solution from site (optional) */
  proposal?: string;
  disc: Disc;
  sheet?: string; // drawing sheet number, e.g. "S-101"
  location?: string;
  attachments: MediaRef[];
  raisedBy: string;
  raisedAt: string; // ISO date
  /** ball in court: who must answer next */
  assignedTo: string;
  due: string;
  priority: Priority;
  costImpact: boolean;
  timeImpact: boolean;
  status: RfiStatus;
  thread: RfiMessage[];
  answeredAt?: string;
  closedAt?: string;
  closedBy?: string;
  variationId?: string;
};

// ---------- submittals ----------

export type SubmittalType = "material" | "shop" | "sample" | "method" | "cert";
export const SUBMITTAL_TYPE_LABEL: Record<SubmittalType, string> = {
  material: "วัสดุ/อุปกรณ์",
  shop: "Shop drawing",
  sample: "ตัวอย่าง",
  method: "Method statement",
  cert: "เอกสารรับรอง",
};
export type ReviewCode = "A" | "B" | "C" | "D";
export const REVIEW_CODE_LABEL: Record<ReviewCode, string> = { A: "อนุมัติ", B: "อนุมัติตามแก้ไข", C: "แก้ไขส่งใหม่", D: "ไม่อนุมัติ" };

export type SubmittalRev = {
  rev: number; // 0, 1, 2 …
  submittedAt: string;
  submittedBy: string;
  due: string;
  note?: string;
  attachments: MediaRef[];
  code?: ReviewCode;
  comments?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type Submittal = {
  id: string; // SBM-<projectId>-001
  projectId: string;
  no: number;
  title: string;
  type: SubmittalType;
  disc: Disc;
  specSection: string; // e.g. "03 30 00 คอนกรีตหล่อในที่"
  supplier?: string;
  subcontractorId?: string;
  reviewer: string;
  revs: SubmittalRev[];
};
/** derived state of the latest revision */
export type SubmittalState = "review" | "overdue" | "approved" | "approvedNotes" | "resubmit" | "rejected";
export const SUBMITTAL_STATE_LABEL: Record<SubmittalState, string> = {
  review: "รอพิจารณา",
  overdue: "เลยกำหนดพิจารณา",
  approved: "อนุมัติ (A)",
  approvedNotes: "อนุมัติตามแก้ไข (B)",
  resubmit: "แก้ไขส่งใหม่ (C)",
  rejected: "ไม่อนุมัติ (D)",
};

// ---------- NCR ----------

export type NcrSeverity = "minor" | "major" | "critical";
export const NCR_SEVERITY_LABEL: Record<NcrSeverity, string> = { minor: "เล็กน้อย", major: "สำคัญ", critical: "ร้ายแรง" };
export type NcrStatus = "open" | "action" | "verify" | "closed";
export const NCR_STATUS_LABEL: Record<NcrStatus, string> = { open: "เปิด", action: "กำลังแก้ไข", verify: "รอตรวจยืนยัน", closed: "ปิดแล้ว" };

export type Ncr = {
  id: string; // NCR-<projectId>-001
  projectId: string;
  no: number;
  title: string;
  description: string;
  location: string;
  disc: Disc;
  severity: NcrSeverity;
  raisedBy: string;
  raisedAt: string;
  /** person / company responsible for the fix */
  responsible: string;
  subcontractorId?: string;
  rootCause?: string;
  corrective?: string;
  preventive?: string;
  due: string;
  status: NcrStatus;
  photos: MediaRef[];
  closePhotos: MediaRef[];
  verifiedBy?: string;
  closedAt?: string;
  inspectionRequestId?: string;
};

// ---------- ITP + request for inspection ----------

/** H hold point (stop until approved), W witness (notify, may proceed), R record / document review */
export type PointType = "H" | "W" | "R";
export const POINT_LABEL: Record<PointType, string> = { H: "Hold point", W: "Witness", R: "ตรวจเอกสาร/บันทึก" };

export type ItpStep = { id: string; text: string; criteria: string; point: PointType };
export type ItpTemplate = { id: string; name: string; workType: string; disc: Disc; steps: ItpStep[] };

export type StepResult = "pass" | "fail" | "na";
export type StepRecord = { stepId: string; result?: StepResult; by?: string; at?: string; note?: string; photos?: MediaRef[] };

export type InspReqStatus = "requested" | "inprogress" | "approved" | "rejected";
export const INSP_REQ_STATUS_LABEL: Record<InspReqStatus, string> = { requested: "ขอตรวจ", inprogress: "กำลังตรวจ", approved: "อนุมัติให้ทำงานต่อ", rejected: "ไม่ผ่าน" };

export type InspectionRequest = {
  id: string; // IR-<projectId>-001
  projectId: string;
  no: number;
  templateId: string;
  title: string;
  location: string;
  requestedBy: string;
  requestedAt: string;
  date: string; // requested inspection date
  time?: string;
  /** supervising engineer who must release hold points */
  inspector: string;
  steps: StepRecord[];
  status: InspReqStatus;
  signature?: MediaRef;
  signedBy?: string;
  signedAt?: string;
  ncrId?: string;
};

// ---------- material tests ----------

export type Specimen = "cube" | "cylinder";
export const SPECIMEN_LABEL: Record<Specimen, string> = { cube: "ก้อนลูกบาศก์ 15 ซม.", cylinder: "ทรงกระบอก 15×30 ซม." };
export type TestSet = { age: number; due: string; results: number[]; testedAt?: string; lab?: string };

export type ConcreteTest = {
  id: string; // CT-<projectId>-001
  projectId: string;
  pourDate: string;
  element: string; // ฐานราก F1, เสาชั้น 1 …
  location?: string;
  supplier?: string;
  ticketNo?: string;
  volume?: number; // m³
  fc: number; // design strength for the specimen type, ksc
  specimen: Specimen;
  slump?: number; // cm measured
  slumpMin?: number;
  slumpMax?: number;
  sets: TestSet[];
  report?: MediaRef[];
  note?: string;
};

export type RebarGrade = "SR24" | "SD40" | "SD50";
export type RebarLot = {
  id: string; // RB-<projectId>-001
  projectId: string;
  date: string;
  grade: RebarGrade;
  size: string; // DB12, RB9 …
  tons: number;
  supplier: string;
  heatNo: string;
  millCert: MediaRef[];
  yieldKsc?: number;
  tensileKsc?: number;
  elongation?: number; // %
  lab?: string;
  testedAt?: string;
  report?: MediaRef[];
};

export type PileMethod = "seismic" | "dynamic" | "static";
export const PILE_METHOD_LABEL: Record<PileMethod, string> = { seismic: "Seismic test (ความสมบูรณ์)", dynamic: "Dynamic load test", static: "Static load test" };
export type PileResult = "pending" | "pass" | "fail" | "doubt";
export const PILE_RESULT_LABEL: Record<PileResult, string> = { pending: "รอผล", pass: "ผ่าน", fail: "ไม่ผ่าน", doubt: "ผลไม่ชัดเจน/ต้องทดสอบเพิ่ม" };
export type PileTest = {
  id: string; // PT-<projectId>-001
  projectId: string;
  date: string;
  method: PileMethod;
  pileNo: string;
  pileType: string;
  designLoad: number; // ton
  capacity?: number; // ton (dynamic/static)
  settlement?: number; // mm
  result: PileResult;
  lab: string;
  note?: string;
  report: MediaRef[];
};

// ---------- supervision ----------

export type SupervisionReport = {
  id: string; // SVR-<projectId>-001
  projectId: string;
  no: number;
  kind: "daily" | "weekly";
  from: string;
  to: string;
  engineer: string;
  licenseeId?: string;
  progress?: number; // % overall
  work: string; // work inspected
  tests: string; // tests witnessed
  instructions: string; // instructions given
  issues?: string;
  diaryIds: string[];
  photos: MediaRef[];
  signature?: MediaRef;
  signedBy?: string;
  signedAt?: string;
  status: "draft" | "signed";
};

export type SupervisorChange = {
  id: string; // SVC-<projectId>-1
  projectId: string;
  date: string;
  fromName: string;
  toName: string;
  toLicenseeId?: string;
  reason: string;
  authority: string; // เจ้าพนักงานท้องถิ่น
  notifiedAt?: string;
  letterNo?: string;
};

export type Council = "coe" | "act";
export const COUNCIL_LABEL: Record<Council, string> = { coe: "สภาวิศวกร", act: "สภาสถาปนิก" };
export type LicLevel = 1 | 2 | 3;
export const LEVEL_LABEL: Record<Council, Record<LicLevel, string>> = {
  coe: { 1: "ภาคีวิศวกร", 2: "สามัญวิศวกร", 3: "วุฒิวิศวกร" },
  act: { 1: "ภาคีสถาปนิก", 2: "สามัญสถาปนิก", 3: "วุฒิสถาปนิก" },
};
export const BRANCHES: Record<Council, string[]> = {
  coe: ["โยธา", "ไฟฟ้ากำลัง", "เครื่องกล", "สิ่งแวดล้อม", "อุตสาหการ"],
  act: ["สถาปัตยกรรมหลัก", "สถาปัตยกรรมภายใน", "ภูมิสถาปัตยกรรม"],
};

export type Licensee = {
  id: string; // LIC-001
  name: string;
  memberId?: string; // team member id when staff
  company?: string; // external consultant company
  council: Council;
  branch: string;
  level: LicLevel;
  licenseNo: string;
  expiry: string;
  phone?: string;
};

/** design / supervision duties that need a licence */
export type Duty = "arch" | "struct" | "elec" | "supervise";
export const DUTY_LABEL: Record<Duty, string> = { arch: "ผู้ออกแบบสถาปัตยกรรม", struct: "ผู้ออกแบบและคำนวณโครงสร้าง", elec: "ผู้ออกแบบระบบไฟฟ้า", supervise: "ผู้ควบคุมงาน" };

/** a rule row matches when floors ≥ minFloors OR area ≥ minArea (0 = always) */
export type LicenseRule = { id: string; label: string; minFloors: number; minArea: number; duty: Duty; council: Council; branch: string; minLevel: LicLevel };

export type ProjectLicensing = {
  id: string; // = projectId
  projectId: string;
  floors?: number; // override of the project figure
  area?: number;
  assigned: Partial<Record<Duty, string>>; // licensee ids
};

// ---------- document control ----------

export type DocStatus = "prelim" | "approval" | "afc" | "superseded" | "asbuilt";
export const DOC_STATUS_LABEL: Record<DocStatus, string> = { prelim: "แบบร่าง", approval: "ส่งขออนุมัติ", afc: "อนุมัติก่อสร้าง", superseded: "ยกเลิก (มีฉบับใหม่)", asbuilt: "แบบก่อสร้างจริง" };
export type DocKind = "drawing" | "spec" | "calc" | "report" | "other";
export const DOC_KIND_LABEL: Record<DocKind, string> = { drawing: "แบบ", spec: "รายการประกอบแบบ", calc: "รายการคำนวณ", report: "รายงาน", other: "เอกสารอื่น" };
export type DocWorkflow = "draft" | "submitted" | "reviewed" | "approved" | "rejected";
export const WF_LABEL: Record<DocWorkflow, string> = { draft: "ร่าง", submitted: "ส่งตรวจ", reviewed: "ตรวจแล้ว รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ตีกลับ" };

export type Pin = { id: string; n: number; x: number; y: number; text: string; by: string; at: string; fileId: string; resolved?: boolean };

export type DocRevision = {
  id: string;
  rev: string; // "A", "B", "0", "1"
  date: string;
  status: DocStatus;
  note?: string;
  by: string;
  files: MediaRef[];
  /** generated drawing sheet of the project's model (`<modelCode>/<sheetId>`), shown when no file is uploaded */
  sheetRef?: string;
  wf: DocWorkflow;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  wfNote?: string;
  pins: Pin[];
};

export type ControlledDoc = {
  id: string; // DC-<projectId>-001
  projectId: string;
  number: string; // A-101
  title: string;
  disc: Disc;
  kind: DocKind;
  revs: DocRevision[];
};

export type TransmittalPurpose = "approval" | "construction" | "info" | "record" | "tender";
export const PURPOSE_LABEL: Record<TransmittalPurpose, string> = { approval: "เพื่อพิจารณาอนุมัติ", construction: "เพื่อใช้ก่อสร้าง", info: "เพื่อทราบ", record: "เพื่อเก็บเป็นหลักฐาน", tender: "เพื่อประกวดราคา" };
export type Transmittal = {
  id: string; // TR-<projectId>-001
  projectId: string;
  no: number;
  date: string;
  to: string; // company / person
  attn?: string;
  purpose: TransmittalPurpose;
  items: { docId: string; revId: string; copies: number }[];
  note?: string;
  sentBy: string;
  ackBy?: string;
  ackAt?: string;
  ackSignature?: MediaRef;
};

// ---------- meetings ----------

export type MeetingType = "site" | "client" | "sub" | "safety";
export const MEETING_TYPE_LABEL: Record<MeetingType, string> = { site: "ประชุมประจำสัปดาห์ไซต์", client: "ประชุมลูกค้า", sub: "ประชุมผู้รับเหมาช่วง", safety: "ประชุมความปลอดภัย" };
export type Attendee = { name: string; org: string; present: boolean };
export type Meeting = {
  id: string; // MTG-<projectId>-001
  projectId: string;
  no: number;
  type: MeetingType;
  title: string;
  date: string;
  time: string;
  place: string;
  chair: string;
  attendees: Attendee[];
  agenda: string[];
  minutes: string;
  decisions: string[];
  /** open action items reviewed in this meeting (carried forward from earlier ones) */
  carried: string[];
  status: "draft" | "issued";
  nextDate?: string;
};
export type ActionStatus = "open" | "done" | "cancelled";
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { open: "ค้าง", done: "เสร็จแล้ว", cancelled: "ยกเลิก" };
export type ActionItem = {
  id: string; // ACT-<projectId>-001
  projectId: string;
  meetingId: string; // raised in
  text: string;
  owner: string;
  due: string;
  status: ActionStatus;
  doneAt?: string;
  note?: string;
};

// ---------- closeout ----------

export type CloseoutItem = { key: string; label: string; group: string; done: boolean; na?: boolean; files: MediaRef[]; note?: string; doneBy?: string; doneAt?: string };
export type Handover = {
  date: string;
  customerName: string;
  customerSig?: MediaRef;
  companyName: string;
  companySig?: MediaRef;
  keys?: string;
  meters?: string; // meter readings at handover
  remarks?: string;
  signedAt?: string;
};
export type Closeout = { id: string; projectId: string; items: CloseoutItem[]; handover?: Handover };

// ---------- settings ----------

export type ConcreteRule = {
  /** average of a set ≥ fc' + avgOffset */
  avgOffset: number;
  /** every specimen ≥ fc' − tolKsc */
  tolKsc: number;
  /** test ages in days */
  ages: number[];
  specimensPerAge: number;
  /** indicative early-age target, % of fc' at the first (7-day) age */
  earlyPct: number;
};
export type RebarSpec = Record<RebarGrade, { yieldKsc: number; tensileKsc: number; elongation: number }>;
export type EngSettings = {
  id: "eng";
  concrete: ConcreteRule;
  rebar: RebarSpec;
  rfiWarnDays: number;
  ncrOpenDays: number;
  licenseDays: number;
  rules: LicenseRule[];
};
