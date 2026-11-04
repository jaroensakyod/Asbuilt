// Demo data. All companies, people and addresses are fictional.

export const TODAY = "2026-11-04";
export const COMPANY = "บริษัท ตัวอย่างรับสร้างบ้าน จำกัด";

export type ProjectStatus = "planning" | "building" | "handover" | "delivered";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "วางแผน",
  building: "กำลังก่อสร้าง",
  handover: "ตรวจรับงาน",
  delivered: "ส่งมอบแล้ว",
};

export type Project = {
  id: string;
  name: string;
  owner: string;
  model: string;
  modelCode: string;
  province: string;
  pm: string;
  status: ProjectStatus;
  actual: number; // %
  plan: number; // %
  phase: string;
  start: string;
  finish: string;
  value: number; // million baht
  floors: number;
  area: number;
  openRepairs: number;
  handedOver?: string;
  warrantyUntil?: string;
  // filled in after the list is built (see bottom of file)
  companyId?: string;
  lat?: number;
  lng?: number;
  contractDate?: string;
  address?: string;
  phone?: string;
};

export const projects: Project[] = [
  { id: "HC-2025-04", name: "บ้านคุณอรวรรณ", owner: "อรวรรณ ทองมา", model: "Duo Living 240", modelCode: "HM-12", province: "กรุงเทพฯ", pm: "ศิริพร ตั้งเจริญ", status: "handover", actual: 96, plan: 99, phase: "งานตกแต่ง/ผิว", start: "2025-12-02", finish: "2026-11-13", value: 6.8, floors: 2, area: 240, openRepairs: 1 },
  { id: "HC-2026-01", name: "บ้านคุณพลวัฒน์", owner: "พลวัฒน์ แสงดี", model: "Cubic 220", modelCode: "HM-03", province: "สมุทรปราการ", pm: "วรเชษฐ์ อินทรประเสริฐ", status: "building", actual: 89, plan: 88, phase: "งานตกแต่ง/ผิว", start: "2026-02-11", finish: "2026-12-11", value: 5.9, floors: 2, area: 220, openRepairs: 0 },
  { id: "HC-2026-02", name: "บ้านคุณศิริรัตน์", owner: "ศิริรัตน์ โพธิ์ทอง", model: "Loft Industrial 200", modelCode: "HM-05", province: "สมุทรปราการ", pm: "ศิริพร ตั้งเจริญ", status: "building", actual: 75, plan: 81, phase: "งานระบบ", start: "2026-03-24", finish: "2026-12-24", value: 5.2, floors: 2, area: 204, openRepairs: 0 },
  { id: "HC-2026-05", name: "บ้านคุณวัชระ", owner: "วัชระ เลิศวิริยะ", model: "Japanese Minimal 165", modelCode: "HM-09", province: "ชลบุรี", pm: "วรเชษฐ์ อินทรประเสริฐ", status: "building", actual: 63, plan: 63, phase: "งานระบบ", start: "2026-05-21", finish: "2027-02-21", value: 4.1, floors: 2, area: 171, openRepairs: 0 },
  { id: "HC-2025-03", name: "อาคารชุดลาดพร้าว 71", owner: "นิติบุคคลอาคารชุด ลาดพร้าว 71", model: "Low-rise 6 ชั้น", modelCode: "CD-01", province: "กรุงเทพฯ", pm: "วรเชษฐ์ อินทรประเสริฐ", status: "building", actual: 60, plan: 63, phase: "งานหลังคา", start: "2025-09-26", finish: "2027-07-26", value: 82.0, floors: 6, area: 2220, openRepairs: 4 },
  { id: "HC-2026-04", name: "บ้านคุณพรทิพย์", owner: "พรทิพย์ ชาญวิทยา", model: "Contemporary 260", modelCode: "HM-06", province: "กรุงเทพฯ", pm: "วรเชษฐ์ อินทรประเสริฐ", status: "building", actual: 52, plan: 54, phase: "งานก่ออิฐ", start: "2026-04-07", finish: "2027-04-07", value: 7.3, floors: 2, area: 267, openRepairs: 0 },
  { id: "HC-2026-03", name: "โฮมออฟฟิศ ถนนรามอินทรา", owner: "บริษัท ทีเค อินเตอร์เทรด จำกัด", model: "Home Office 4F", modelCode: "HO-01", province: "กรุงเทพฯ", pm: "ศิริพร ตั้งเจริญ", status: "building", actual: 45, plan: 47, phase: "งานก่ออิฐ", start: "2026-03-17", finish: "2027-05-17", value: 9.6, floors: 4, area: 320, openRepairs: 0 },
  { id: "HC-2026-06", name: "บ้านคุณชยพล", owner: "ชยพล ศรีอุทัย", model: "Modern Farmhouse 210", modelCode: "HM-17", province: "เชียงใหม่", pm: "ธีรวัฒน์ บุญมา", status: "building", actual: 40, plan: 44, phase: "งานโครงสร้าง", start: "2026-06-01", finish: "2027-04-30", value: 5.6, floors: 2, area: 210, openRepairs: 0 },
  { id: "HC-2026-07", name: "บ้านคุณลัดดาวัลย์", owner: "ลัดดาวัลย์ ประทุมทอง", model: "Nordic Haus 150", modelCode: "HM-02", province: "ขอนแก่น", pm: "ธีรวัฒน์ บุญมา", status: "building", actual: 28, plan: 27, phase: "งานโครงสร้าง", start: "2026-07-15", finish: "2027-05-15", value: 3.9, floors: 2, area: 151, openRepairs: 0 },
  { id: "HC-2026-08", name: "บ้านคุณทวีศักดิ์", owner: "ทวีศักดิ์ แสงทอง", model: "Tropicana 180", modelCode: "HM-01", province: "นนทบุรี", pm: "ศิริพร ตั้งเจริญ", status: "building", actual: 14, plan: 15, phase: "งานฐานราก", start: "2026-08-20", finish: "2027-06-20", value: 4.6, floors: 2, area: 188, openRepairs: 0 },
  { id: "HC-2026-09", name: "บ้านคุณปาริชาติ", owner: "ปาริชาติ หอมจันทร์", model: "Sabai 120", modelCode: "HM-04", province: "ปทุมธานี", pm: "ธีรวัฒน์ บุญมา", status: "building", actual: 8, plan: 10, phase: "งานฐานราก", start: "2026-09-10", finish: "2027-05-10", value: 2.7, floors: 1, area: 125, openRepairs: 0 },
  { id: "HC-2026-10", name: "บ้านคุณอนันต์", owner: "อนันต์ ศรีเมือง", model: "Smart Modern 190", modelCode: "HM-14", province: "นนทบุรี", pm: "วรเชษฐ์ อินทรประเสริฐ", status: "planning", actual: 0, plan: 0, phase: "ขออนุญาต", start: "2026-12-01", finish: "2027-09-30", value: 5.1, floors: 2, area: 187, openRepairs: 0 },
  { id: "HC-2025-01", name: "บ้านคุณมยุรี", owner: "มยุรี เรืองฤทธิ์", model: "Modern Farmhouse 210", modelCode: "HM-17", province: "นนทบุรี", pm: "ศิริพร ตั้งเจริญ", status: "delivered", actual: 100, plan: 100, phase: "ส่งมอบ", start: "2025-02-01", finish: "2026-01-20", value: 5.4, floors: 2, area: 210, openRepairs: 1, handedOver: "2026-01-20", warrantyUntil: "2028-01-20" },
  { id: "HC-2025-02", name: "บ้านคุณธีระ", owner: "ธีระ จิตต์มั่น", model: "Compact Modern 130", modelCode: "HM-16", province: "นนทบุรี", pm: "วรเชษฐ์ อินทรประเสริฐ", status: "delivered", actual: 100, plan: 100, phase: "ส่งมอบ", start: "2025-04-10", finish: "2026-04-10", value: 3.2, floors: 2, area: 130, openRepairs: 1, handedOver: "2026-04-10", warrantyUntil: "2027-04-10" },
  { id: "HC-2021-03", name: "บ้านคุณรัตนาภรณ์", owner: "รัตนาภรณ์ เพชรรุ่ง", model: "Courtyard 280", modelCode: "HM-13", province: "กรุงเทพฯ", pm: "ธีรวัฒน์ บุญมา", status: "delivered", actual: 100, plan: 100, phase: "ส่งมอบ", start: "2021-12-01", finish: "2022-12-19", value: 6.1, floors: 2, area: 295, openRepairs: 1, handedOver: "2022-12-19", warrantyUntil: "2024-12-19" },
  { id: "HC-2024-05", name: "พูลวิลล่าคุณกัลยา", owner: "กัลยา อินทรสุวรรณ", model: "Resort Pool Villa 500", modelCode: "HM-07", province: "ชลบุรี", pm: "ศิริพร ตั้งเจริญ", status: "delivered", actual: 100, plan: 100, phase: "ส่งมอบ", start: "2023-11-15", finish: "2024-11-15", value: 14.5, floors: 2, area: 438, openRepairs: 1, handedOver: "2024-11-15", warrantyUntil: "2026-11-15" },
];

export const getProject = (id: string) => projects.find((p) => p.id === id);

export type Severity = "high" | "medium" | "low";
export type RepairStatus = "open" | "fixing" | "waiting" | "closed";
export type RepairSource = "inspection" | "customer" | "warranty" | "internal";

export const SEVERITY_LABEL: Record<Severity, string> = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };
export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  open: "รอดำเนินการ",
  fixing: "กำลังแก้ไข",
  waiting: "รออะไหล่",
  closed: "ปิดงานแล้ว",
};
export const SOURCE_LABEL: Record<RepairSource, string> = {
  inspection: "จากการตรวจ",
  customer: "ลูกค้าแจ้ง",
  warranty: "ในประกัน",
  internal: "ภายใน",
};

export type SystemKey = "arch" | "elec" | "plumb" | "hvac" | "struct" | "ext";
export const SYSTEM_LABEL: Record<SystemKey, string> = {
  struct: "โครงสร้าง",
  arch: "สถาปัตย์",
  elec: "ไฟฟ้า",
  plumb: "ประปา & สุขภัณฑ์",
  hvac: "ปรับอากาศ",
  ext: "ภายนอก",
};

export type Repair = {
  id: string;
  title: string;
  detail: string;
  asset: string;
  assetName: string;
  projectId: string;
  location: string;
  system: SystemKey;
  severity: Severity;
  status: RepairStatus;
  source: RepairSource;
  assignee: string;
  reported: string;
  slaHours: number; // remaining, negative = overdue
};

export const repairs: Repair[] = [
  { id: "REP-202611-0002", title: "เบรกเกอร์ทริปบ่อย", detail: "วงจรเต้ารับชั้น 1 ทริปเมื่อเปิดไมโครเวฟพร้อมกาต้มน้ำ", asset: "CB-112", assetName: "เบรกเกอร์ C16 เต้ารับชั้น 1", projectId: "HC-2021-03", location: "ชั้น 1 · ระเบียงทางเดิน", system: "elec", severity: "high", status: "open", source: "customer", assignee: "สุริยา คำแก้ว", reported: "2026-11-02", slaHours: 35 },
  { id: "REP-202610-0006", title: "แอร์ไม่เย็น", detail: "คอยล์เย็นมีน้ำแข็งเกาะ ลมออกอ่อน", asset: "AC-202", assetName: "แอร์ติดผนัง 12,000 BTU", projectId: "HC-2024-05", location: "ชั้น 2 · ห้องนอนใหญ่", system: "hvac", severity: "high", status: "fixing", source: "customer", assignee: "ไพโรจน์ ดวงจันทร์", reported: "2026-10-30", slaHours: -37 },
  { id: "REP-202610-0004", title: "ELCB เครื่องทำน้ำอุ่นตัด", detail: "ตัดทุกครั้งที่เปิดน้ำร้อนเกิน 2 นาที", asset: "WH-201", assetName: "เครื่องทำน้ำอุ่น 4,500 W", projectId: "HC-2025-01", location: "ชั้น 2 · ห้องน้ำ 2", system: "elec", severity: "high", status: "open", source: "warranty", assignee: "สุริยา คำแก้ว", reported: "2026-10-28", slaHours: -72 },
  { id: "REP-202610-0003", title: "หลังคารั่วซึม", detail: "น้ำซึมที่รอยต่อแผ่น คสล. หลังฝนตกหนัก", asset: "RF-302", assetName: "งานกันซึมหลังคา คสล.", projectId: "HC-2025-02", location: "ชั้น 3 · ดาดฟ้า", system: "arch", severity: "high", status: "fixing", source: "warranty", assignee: "บุญเลิศ ใจดี", reported: "2026-10-26", slaHours: -120 },
  { id: "REP-202610-0001", title: "กระเบื้องพื้นโก่งตัว", detail: "แกรนิตโต้ 60×60 ระเบิด 4 แผ่น มีเสียงดังตอนกลางคืน", asset: "FF-104", assetName: "แกรนิตโต้ 60×60 ห้องนั่งเล่น", projectId: "HC-2025-02", location: "ชั้น 1 · ห้องนั่งเล่น", system: "arch", severity: "high", status: "fixing", source: "warranty", assignee: "บุญเลิศ ใจดี", reported: "2026-10-17", slaHours: -360 },
  { id: "REP-202611-0003", title: "น้ำแอร์หยด", detail: "น้ำหยดจากตัวเครื่องลงพื้น", asset: "AC-201", assetName: "แอร์ติดผนัง 12,000 BTU", projectId: "HC-2025-01", location: "ชั้น 2 · ห้องนอน 2", system: "hvac", severity: "medium", status: "open", source: "customer", assignee: "ไพโรจน์ ดวงจันทร์", reported: "2026-11-03", slaHours: 60 },
  { id: "REP-202611-0001", title: "ชักโครกน้ำไม่หยุดไหล", detail: "ลูกลอยไม่ตัดน้ำ ได้ยินเสียงน้ำไหลตลอด", asset: "WC-201", assetName: "สุขภัณฑ์ชิ้นเดียว", projectId: "HC-2025-01", location: "ชั้น 2 · ห้องน้ำ 2", system: "plumb", severity: "medium", status: "waiting", source: "customer", assignee: "สมชาย ปานทอง", reported: "2026-11-01", slaHours: 22 },
  { id: "REP-202610-0009", title: "รอยร้าวผนังมุมหน้าต่าง", detail: "ร้าวแนวทแยงจากมุมวงกบ ยาวประมาณ 40 ซม.", asset: "W-105", assetName: "หน้าต่างบานเลื่อน ห้องทำงาน", projectId: "HC-2025-03", location: "ชั้น 1 · ห้อง 1.06", system: "arch", severity: "medium", status: "open", source: "inspection", assignee: "บุญเลิศ ใจดี", reported: "2026-10-29", slaHours: 18 },
  { id: "REP-202610-0010", title: "ปั๊มน้ำทำงานถี่", detail: "ปั๊มติดดับทุก 2–3 นาทีแม้ไม่มีการใช้น้ำ", asset: "PU-001", assetName: "ปั๊มน้ำอัตโนมัติ 250 W", projectId: "HC-2025-03", location: "ภายนอก · ห้องปั๊ม", system: "plumb", severity: "medium", status: "fixing", source: "inspection", assignee: "สมชาย ปานทอง", reported: "2026-10-27", slaHours: 4 },
  { id: "REP-202610-0011", title: "ประตูห้องน้ำปิดไม่สนิท", detail: "บานบวมจากความชื้น ขูดวงกบด้านล่าง", asset: "D-204", assetName: "ประตู UPVC ห้องน้ำ", projectId: "HC-2025-04", location: "ชั้น 2 · ห้องน้ำ 1", system: "arch", severity: "low", status: "open", source: "inspection", assignee: "บุญเลิศ ใจดี", reported: "2026-10-31", slaHours: 96 },
  { id: "REP-202610-0012", title: "ไฟดาวน์ไลท์กะพริบ", detail: "ดาวน์ไลท์ 2 ดวงกะพริบเป็นช่วง", asset: "LT-118", assetName: "ดาวน์ไลท์ LED 9 W", projectId: "HC-2025-03", location: "ชั้น 1 · โถงลิฟต์", system: "elec", severity: "low", status: "open", source: "inspection", assignee: "สุริยา คำแก้ว", reported: "2026-10-30", slaHours: 70 },
  { id: "REP-202609-0021", title: "ท่อน้ำทิ้งซิงค์ซึม", detail: "รอยต่อท่อใต้ซิงค์มีน้ำซึม", asset: "SK-101", assetName: "ซิงค์ล้างจาน 1 หลุม", projectId: "HC-2024-05", location: "ชั้น 1 · ครัว", system: "plumb", severity: "low", status: "closed", source: "customer", assignee: "สมชาย ปานทอง", reported: "2026-09-22", slaHours: 0 },
];

export type Inspection = {
  id: string;
  title: string;
  projectId: string;
  location: string;
  inspector: string;
  date: string;
  time: string;
  items: number;
  phase: string;
  score?: number;
  result: "scheduled" | "pass" | "fail";
};

export const inspections: Inspection[] = [
  { id: "INS-2026-0156", title: "ทดสอบระบบไฟฟ้า สุขภัณฑ์ และแอร์ก่อนส่งมอบ", projectId: "HC-2025-04", location: "ทั้งหลัง", inspector: "อรอุมา จันทร์หอม", date: "2026-11-04", time: "09:30", items: 15, phase: "ติดตั้งสุขภัณฑ์/อุปกรณ์", result: "scheduled" },
  { id: "INS-2026-0157", title: "ทดสอบแรงดันท่อน้ำดี PPR 10 บาร์ 1 ชั่วโมง", projectId: "HC-2026-02", location: "ชั้น 1–2", inspector: "จิราพร พูลสวัสดิ์", date: "2026-11-04", time: "10:00", items: 8, phase: "งานระบบ", result: "scheduled" },
  { id: "INS-2026-0158", title: "ตรวจรับงานฐานราก คานคอดิน และพื้นชั้นล่าง", projectId: "HC-2026-08", location: "ชั้น 1", inspector: "จิราพร พูลสวัสดิ์", date: "2026-11-04", time: "10:45", items: 11, phase: "งานฐานราก", result: "scheduled" },
  { id: "INS-2026-0159", title: "ตรวจงานสถาปัตยกรรมและงานผิว ชั้น 1", projectId: "HC-2025-03", location: "ชั้น 1", inspector: "อนุชา ศรีสุข", date: "2026-11-05", time: "15:00", items: 11, phase: "งานตกแต่ง/ผิว", result: "scheduled" },
  { id: "INS-2026-0160", title: "ทดสอบฉนวนสายไฟ (Megger test) ก่อนปิดฝ้า", projectId: "HC-2026-02", location: "ชั้น 2", inspector: "ธีรวัฒน์ บุญมา", date: "2026-11-06", time: "10:30", items: 11, phase: "งานระบบ", result: "scheduled" },
  { id: "INS-2026-0161", title: "ตรวจเหล็กเสริมเสาชั้น 1 และแบบหล่อก่อนเทคอนกรีต", projectId: "HC-2026-07", location: "ชั้น 1", inspector: "จิราพร พูลสวัสดิ์", date: "2026-11-09", time: "14:30", items: 9, phase: "งานโครงสร้าง", result: "scheduled" },
  { id: "INS-2026-0151", title: "ตรวจงานหลังคาและรางน้ำ", projectId: "HC-2025-03", location: "ชั้น 6", inspector: "อนุชา ศรีสุข", date: "2026-11-02", time: "09:00", items: 14, phase: "งานหลังคา", score: 82, result: "pass" },
  { id: "INS-2026-0149", title: "ตรวจงานก่ออิฐฉาบปูน ชั้น 2", projectId: "HC-2026-04", location: "ชั้น 2", inspector: "อรอุมา จันทร์หอม", date: "2026-10-30", time: "13:00", items: 12, phase: "งานก่ออิฐ", score: 74, result: "fail" },
  { id: "INS-2026-0147", title: "ตรวจท่อร้อยสายไฟในผนัง ชั้น 1", projectId: "HC-2026-05", location: "ชั้น 1", inspector: "ธีรวัฒน์ บุญมา", date: "2026-10-28", time: "10:00", items: 10, phase: "งานระบบ", score: 95, result: "pass" },
  { id: "INS-2026-0144", title: "ตรวจรับงานผิวพื้นและบัว ชั้น 2", projectId: "HC-2026-01", location: "ชั้น 2", inspector: "อนุชา ศรีสุข", date: "2026-10-24", time: "15:00", items: 16, phase: "งานตกแต่ง/ผิว", score: 91, result: "pass" },
];

export type Maintenance = {
  id: string;
  task: string;
  projectId: string;
  owner: string;
  date: string;
  system: SystemKey;
  state: "overdue" | "soon" | "planned" | "done";
  cycle: string;
};

export const maintenance: Maintenance[] = [
  { id: "PM-0412", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2025-01", owner: "คุณมยุรี", date: "2026-11-03", system: "plumb", state: "done", cycle: "ทุก 3 เดือน" },
  { id: "PM-0413", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2025-02", owner: "คุณธีระ", date: "2026-11-03", system: "plumb", state: "done", cycle: "ทุก 3 เดือน" },
  { id: "PM-0414", task: "ล้างแอร์ 6 เครื่อง", projectId: "HC-2021-03", owner: "คุณรัตนาภรณ์", date: "2026-11-03", system: "hvac", state: "done", cycle: "ทุก 6 เดือน" },
  { id: "PM-0420", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2025-03", owner: "นิติฯ ลาดพร้าว 71", date: "2026-11-09", system: "plumb", state: "soon", cycle: "ทุก 3 เดือน" },
  { id: "PM-0421", task: "ตรวจ ELCB เครื่องทำน้ำอุ่น", projectId: "HC-2025-04", owner: "คุณอรวรรณ", date: "2026-11-11", system: "elec", state: "soon", cycle: "ทุก 12 เดือน" },
  { id: "PM-0422", task: "ล้างถังเก็บน้ำ 2,000 ลิตร", projectId: "HC-2024-05", owner: "คุณกัลยา", date: "2026-11-14", system: "plumb", state: "soon", cycle: "ทุก 12 เดือน" },
  { id: "PM-0423", task: "ล้างแอร์ 8 เครื่อง", projectId: "HC-2024-05", owner: "คุณกัลยา", date: "2026-11-15", system: "hvac", state: "soon", cycle: "ทุก 6 เดือน" },
  { id: "PM-0424", task: "ตรวจเครื่องกรองสระว่ายน้ำ", projectId: "HC-2024-05", owner: "คุณกัลยา", date: "2026-11-15", system: "ext", state: "soon", cycle: "ทุก 3 เดือน" },
  { id: "PM-0425", task: "สูบถังบำบัดน้ำเสีย", projectId: "HC-2024-05", owner: "คุณกัลยา", date: "2026-11-15", system: "plumb", state: "soon", cycle: "ทุก 24 เดือน" },
  { id: "PM-0426", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2021-03", owner: "คุณรัตนาภรณ์", date: "2026-11-19", system: "plumb", state: "planned", cycle: "ทุก 3 เดือน" },
  { id: "PM-0427", task: "ตรวจปั๊มน้ำและถังแรงดัน", projectId: "HC-2025-02", owner: "คุณธีระ", date: "2026-11-19", system: "plumb", state: "planned", cycle: "ทุก 6 เดือน" },
  { id: "PM-0428", task: "ทดสอบเบรกเกอร์กันดูดทั้งตู้", projectId: "HC-2025-01", owner: "คุณมยุรี", date: "2026-11-24", system: "elec", state: "planned", cycle: "ทุก 12 เดือน" },
  { id: "PM-0401", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2020-02", owner: "คุณวีระพงษ์", date: "2026-09-26", system: "plumb", state: "overdue", cycle: "ทุก 3 เดือน" },
  { id: "PM-0402", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2024-02", owner: "คุณวีระพงษ์", date: "2026-10-02", system: "plumb", state: "overdue", cycle: "ทุก 3 เดือน" },
  { id: "PM-0403", task: "ตักไขมันและล้างถังดักไขมัน", projectId: "HC-2016-01", owner: "คุณวีระพงษ์", date: "2026-10-09", system: "plumb", state: "overdue", cycle: "ทุก 3 เดือน" },
  { id: "PM-0404", task: "ตรวจเครื่องทำน้ำอุ่นและทดสอบ ELCB", projectId: "HC-2017-03", owner: "คุณสุริยา", date: "2026-10-14", system: "elec", state: "overdue", cycle: "ทุก 12 เดือน" },
];

export type DocKind = "contract" | "permit" | "drawing" | "report" | "warranty" | "manual";
export const DOC_LABEL: Record<DocKind, string> = {
  contract: "สัญญา",
  permit: "ใบอนุญาต",
  drawing: "แบบก่อสร้าง",
  report: "รายงาน",
  warranty: "ใบรับประกัน",
  manual: "คู่มือ",
};

export type Doc = {
  id: string;
  title: string;
  file: string;
  kind: DocKind;
  projectId: string;
  sizeKb: number;
  by: string;
  date: string;
};

export const documents: Doc[] = [
  { id: "D-1", title: "คำขออนุญาตก่อสร้างอาคาร (ข.1)", file: "HC-2026-10_permit-application.pdf", kind: "permit", projectId: "HC-2026-10", sizeKb: 2610, by: "ณัฐวุฒิ พงษ์ไพบูลย์", date: "2026-10-31" },
  { id: "D-2", title: "สัญญาจ้างก่อสร้าง HC-2026-10/C", file: "HC-2026-10_contract.pdf", kind: "contract", projectId: "HC-2026-10", sizeKb: 5240, by: "ศิริพร ตั้งเจริญ", date: "2026-10-28" },
  { id: "D-3", title: "ใบแสดงปริมาณงานและราคา (BOQ)", file: "HC-2026-10_boq.pdf", kind: "contract", projectId: "HC-2026-10", sizeKb: 3720, by: "ศิริพร ตั้งเจริญ", date: "2026-10-21" },
  { id: "D-4", title: "ชุดแบบก่อสร้าง Rev.2 (42 แผ่น)", file: "CD-01_drawing-set_R2.pdf", kind: "drawing", projectId: "HC-2025-03", sizeKb: 18420, by: "วรเชษฐ์ อินทรประเสริฐ", date: "2026-08-17" },
  { id: "D-5", title: "รายงานตรวจงานหลังคา INS-2026-0151", file: "INS-2026-0151_report.pdf", kind: "report", projectId: "HC-2025-03", sizeKb: 1260, by: "อนุชา ศรีสุข", date: "2026-11-02" },
  { id: "D-6", title: "ใบรับประกันโครงสร้าง 15 ปี", file: "HC-2025-01_warranty-structure.pdf", kind: "warranty", projectId: "HC-2025-01", sizeKb: 840, by: "ศิริพร ตั้งเจริญ", date: "2026-01-20" },
  { id: "D-7", title: "คู่มือการใช้งานบ้านและอุปกรณ์", file: "HC-2025-01_home-manual.pdf", kind: "manual", projectId: "HC-2025-01", sizeKb: 6310, by: "ศิริพร ตั้งเจริญ", date: "2026-01-20" },
  { id: "D-8", title: "รายงานตรวจงานก่ออิฐ ชั้น 2", file: "INS-2026-0149_report.pdf", kind: "report", projectId: "HC-2026-04", sizeKb: 1180, by: "อรอุมา จันทร์หอม", date: "2026-10-30" },
  { id: "D-9", title: "สัญญาจ้างก่อสร้าง HC-2026-09/C", file: "HC-2026-09_contract.pdf", kind: "contract", projectId: "HC-2026-09", sizeKb: 5110, by: "วรเชษฐ์ อินทรประเสริฐ", date: "2026-08-25" },
  { id: "D-10", title: "แบบขยายห้องน้ำ Rev.1", file: "HM-17_bathroom-details_R1.pdf", kind: "drawing", projectId: "HC-2026-06", sizeKb: 3920, by: "วรเชษฐ์ อินทรประเสริฐ", date: "2026-07-08" },
];

// helpers
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const TH_MONTH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function thDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTH[m - 1]} ${String(y + 543).slice(2)}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function slaText(h: number) {
  if (h < 0) {
    const o = -h;
    return o >= 48 ? `เกิน ${Math.round(o / 24)} วัน` : `เกิน ${o} ชม.`;
  }
  return h >= 48 ? `เหลือ ${Math.round(h / 24)} วัน` : `เหลือ ${h} ชม.`;
}

// =====================================================================
// Phase 1 additions: tenant, house-model catalog, 40 projects, team,
// work orders, inspection checklists, contract history.
// =====================================================================

export const COMPANY_ID = "c-demo";
export const COMPANY_INFO = {
  id: COMPANY_ID,
  name: COMPANY,
  nameEn: "Example Home Builder Co., Ltd.",
  address: "168/9 ถนนประเสริฐมนูกิจ แขวงจรเข้บัว เขตลาดพร้าว กรุงเทพฯ 10230",
  phone: "02-943-8800",
  hotline: "095-168-8800",
  taxId: "0105557081236",
  line: "@examplebuilder",
  since: 2557,
};

/** Small deterministic PRNG so generated demo data is stable between renders */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- house-model catalog ----------

export type ModelType = "house" | "townhome" | "homeoffice" | "condo";
export const MODEL_TYPE_LABEL: Record<ModelType, string> = {
  house: "บ้านเดี่ยว",
  townhome: "ทาวน์โฮม",
  homeoffice: "โฮมออฟฟิศ",
  condo: "อาคารชุด",
};

export type HouseModel = {
  code: string;
  name: string;
  nameTh: string;
  type: ModelType;
  floors: number;
  area: number;
  beds: number;
  baths: number;
  parking: number;
  style: string;
  roof: "gable" | "hip" | "flat";
  W: number; // footprint x (m)
  D: number; // footprint z (m)
  land: string; // recommended plot
  priceMin: number; // million baht
  priceMax: number;
  months: number; // build duration
  sheets: number; // drawing sheets in set
  palette: { wall: string; accent: string; roof: string };
};

export const houseModels: HouseModel[] = [
  { code: "CD-01", name: "The Residence Six", nameTh: "คอนโดมิเนียม Low-rise 6 ชั้น", type: "condo", floors: 6, area: 2220, beds: 2, baths: 1, parking: 28, style: "Modern Minimal", roof: "flat", W: 30, D: 14, land: "42.2 × 33.0 ม.", priceMin: 72, priceMax: 90, months: 22, sheets: 42, palette: { wall: "#efece6", accent: "#8c8577", roof: "#9a958c" } },
  { code: "HM-01", name: "Tropicana 180", nameTh: "บ้านโมเดิร์นทรอปิคอล 2 ชั้น", type: "house", floors: 2, area: 188, beds: 3, baths: 3, parking: 2, style: "Modern Tropical", roof: "hip", W: 12, D: 9, land: "18 × 22 ม.", priceMin: 4.2, priceMax: 4.9, months: 10, sheets: 17, palette: { wall: "#f1ece2", accent: "#8a6a4a", roof: "#5a4a3e" } },
  { code: "HM-02", name: "Nordic Haus 150", nameTh: "บ้านนอร์ดิก 2 ชั้น", type: "house", floors: 2, area: 151, beds: 3, baths: 2, parking: 1, style: "Nordic", roof: "gable", W: 10, D: 8, land: "16 × 20 ม.", priceMin: 3.6, priceMax: 4.1, months: 10, sheets: 18, palette: { wall: "#f4f2ee", accent: "#a0764f", roof: "#3c3a38" } },
  { code: "HM-03", name: "Cubic 220", nameTh: "บ้านโมเดิร์นคิวบิก 2 ชั้น", type: "house", floors: 2, area: 227, beds: 4, baths: 3, parking: 2, style: "Modern Cubic", roof: "flat", W: 13, D: 9.5, land: "20 × 24 ม.", priceMin: 5.4, priceMax: 6.2, months: 10, sheets: 18, palette: { wall: "#f3f1ec", accent: "#7d5a44", roof: "#bdb7ad" } },
  { code: "HM-04", name: "Sabai 120", nameTh: "บ้านชั้นเดียวโมเดิร์นไทย", type: "house", floors: 1, area: 125, beds: 3, baths: 2, parking: 2, style: "Modern Thai", roof: "hip", W: 14, D: 9, land: "18 × 20 ม.", priceMin: 2.5, priceMax: 2.9, months: 8, sheets: 13, palette: { wall: "#f2ede3", accent: "#9a7552", roof: "#6b4e3a" } },
  { code: "HM-05", name: "Loft Industrial 200", nameTh: "บ้านลอฟท์อินดัสเทรียล 2 ชั้น", type: "house", floors: 2, area: 204, beds: 3, baths: 3, parking: 2, style: "Loft Industrial", roof: "flat", W: 12, D: 9, land: "18 × 24 ม.", priceMin: 4.9, priceMax: 5.6, months: 9, sheets: 18, palette: { wall: "#d9d5cf", accent: "#8e4b32", roof: "#8f8a83" } },
  { code: "HM-06", name: "Contemporary 260", nameTh: "บ้านคอนเทมโพรารี 2 ชั้น โถงสูงโปร่ง", type: "house", floors: 2, area: 267, beds: 4, baths: 4, parking: 2, style: "Contemporary", roof: "flat", W: 14, D: 10, land: "22 × 26 ม.", priceMin: 6.8, priceMax: 7.6, months: 12, sheets: 18, palette: { wall: "#f1eee8", accent: "#5b6a6e", roof: "#a7a29a" } },
  { code: "HM-07", name: "Luxury Villa 420", nameTh: "ลักชัวรี่วิลล่า 2 ชั้น พร้อมสระว่ายน้ำ", type: "house", floors: 2, area: 438, beds: 5, baths: 6, parking: 3, style: "Resort Luxury", roof: "hip", W: 18, D: 12, land: "30 × 36 ม.", priceMin: 13.5, priceMax: 15.8, months: 14, sheets: 18, palette: { wall: "#f5f1e8", accent: "#8a6a4a", roof: "#4a3f37" } },
  { code: "HM-08", name: "Modern Classic 350", nameTh: "บ้านโมเดิร์นคลาสสิก 2 ชั้น หน้าบ้านสมมาตร", type: "house", floors: 2, area: 364, beds: 5, baths: 5, parking: 2, style: "Modern Classic", roof: "hip", W: 16, D: 11.5, land: "26 × 30 ม.", priceMin: 9.6, priceMax: 11.2, months: 13, sheets: 18, palette: { wall: "#f6f2ea", accent: "#6f6253", roof: "#3f3a36" } },
  { code: "HM-09", name: "Japanese Minimal 165", nameTh: "บ้านสไตล์ญี่ปุ่นมินิมอล 2 ชั้น", type: "house", floors: 2, area: 171, beds: 3, baths: 2, parking: 2, style: "Japanese Minimal", roof: "gable", W: 11, D: 8.5, land: "18 × 22 ม.", priceMin: 3.9, priceMax: 4.4, months: 9, sheets: 18, palette: { wall: "#f3f0ea", accent: "#9b7a57", roof: "#3a3835" } },
  { code: "HM-10", name: "Lanna Bungalow 140", nameTh: "บ้านชั้นเดียวไทยประยุกต์ล้านนา", type: "house", floors: 1, area: 140, beds: 3, baths: 2, parking: 2, style: "Thai Lanna", roof: "gable", W: 15, D: 9.5, land: "20 × 22 ม.", priceMin: 2.9, priceMax: 3.4, months: 8, sheets: 13, palette: { wall: "#f0e9dc", accent: "#7a4e2e", roof: "#5a3d2b" } },
  { code: "HM-11", name: "Urban Three 300", nameTh: "บ้าน 3 ชั้น หน้าแคบ สไตล์เออร์เบิน", type: "townhome", floors: 3, area: 299, beds: 4, baths: 4, parking: 2, style: "Urban", roof: "flat", W: 6, D: 16, land: "8 × 24 ม.", priceMin: 6.1, priceMax: 6.9, months: 11, sheets: 23, palette: { wall: "#eeebe5", accent: "#5f564c", roof: "#9f9a92" } },
  { code: "HM-12", name: "Duo Living 240", nameTh: "บ้าน 2 เจเนอเรชัน 2 ชั้น", type: "house", floors: 2, area: 248, beds: 4, baths: 4, parking: 2, style: "Modern", roof: "hip", W: 14, D: 9, land: "20 × 24 ม.", priceMin: 6.2, priceMax: 7.0, months: 11, sheets: 18, palette: { wall: "#f2efe8", accent: "#7f6a55", roof: "#4b4540" } },
  { code: "HM-13", name: "Courtyard 280", nameTh: "บ้านคอร์ทยาร์ด 2 ชั้น ล้อมสวนกลางบ้าน", type: "house", floors: 2, area: 295, beds: 4, baths: 4, parking: 2, style: "Courtyard", roof: "gable", W: 15, D: 11, land: "24 × 28 ม.", priceMin: 6.6, priceMax: 7.4, months: 12, sheets: 18, palette: { wall: "#f1ece3", accent: "#8a6a4a", roof: "#504840" } },
  { code: "HM-14", name: "Smart Modern 190", nameTh: "บ้านโมเดิร์นสมาร์ทโฮม 2 ชั้น", type: "house", floors: 2, area: 187, beds: 3, baths: 3, parking: 2, style: "Smart Modern", roof: "flat", W: 11.5, D: 9, land: "18 × 22 ม.", priceMin: 4.7, priceMax: 5.3, months: 10, sheets: 17, palette: { wall: "#f0eeea", accent: "#55606a", roof: "#a4a09a" } },
  { code: "HM-15", name: "Garden Cottage 110", nameTh: "บ้านชั้นเดียวสไตล์คอทเทจ", type: "house", floors: 1, area: 112, beds: 2, baths: 2, parking: 1, style: "Cottage", roof: "gable", W: 12, D: 9, land: "16 × 20 ม.", priceMin: 2.2, priceMax: 2.6, months: 7, sheets: 13, palette: { wall: "#f4efe6", accent: "#7d8a6a", roof: "#5e4a3c" } },
  { code: "HM-16", name: "Compact Modern 130", nameTh: "บ้านโมเดิร์นกะทัดรัด 2 ชั้น", type: "house", floors: 2, area: 130, beds: 3, baths: 2, parking: 1, style: "Compact Modern", roof: "flat", W: 8.5, D: 8, land: "14 × 20 ม.", priceMin: 3.0, priceMax: 3.4, months: 9, sheets: 18, palette: { wall: "#f1efea", accent: "#6a5c4f", roof: "#a9a49c" } },
  { code: "HM-17", name: "Modern Farmhouse 210", nameTh: "บ้านโมเดิร์นฟาร์มเฮาส์ 2 ชั้น", type: "house", floors: 2, area: 210, beds: 3, baths: 3, parking: 2, style: "Modern Farmhouse", roof: "gable", W: 12, D: 9, land: "18 × 24 ม.", priceMin: 5.1, priceMax: 5.8, months: 11, sheets: 18, palette: { wall: "#f4f1ea", accent: "#3b3631", roof: "#2f2c29" } },
  { code: "TH-01", name: "Town Living 3F", nameTh: "ทาวน์โฮม 3 ชั้น คูหาคู่", type: "townhome", floors: 3, area: 240, beds: 3, baths: 3, parking: 1, style: "Urban Townhome", roof: "flat", W: 5.5, D: 14, land: "6 × 18 ม.", priceMin: 3.8, priceMax: 4.4, months: 10, sheets: 23, palette: { wall: "#efebe4", accent: "#7a5c46", roof: "#a39e96" } },
  { code: "HO-01", name: "Home Office 4F", nameTh: "โฮมออฟฟิศ 4 ชั้น", type: "homeoffice", floors: 4, area: 320, beds: 2, baths: 5, parking: 2, style: "Commercial Modern", roof: "flat", W: 7, D: 14, land: "8 × 20 ม.", priceMin: 8.8, priceMax: 10.2, months: 14, sheets: 26, palette: { wall: "#ecebe7", accent: "#4f5a62", roof: "#9d9a94" } },
];

export const getHouseModel = (code: string) => houseModels.find((m) => m.code === code);

// ---------- team ----------

export type Role = "admin" | "exec" | "sales" | "architect" | "engineer" | "pm" | "foreman" | "qc" | "technician" | "purchasing" | "accounting";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  exec: "ผู้บริหาร",
  sales: "ฝ่ายขาย",
  architect: "สถาปนิก",
  engineer: "วิศวกร",
  pm: "ผู้จัดการโครงการ",
  foreman: "โฟร์แมน",
  qc: "ผู้ตรวจคุณภาพ (QC)",
  technician: "ช่างบริการ",
  purchasing: "จัดซื้อ",
  accounting: "บัญชี",
};

export type Member = { id: string; name: string; role: Role; phone: string; email: string; skill?: string; active: boolean; lastSeen: string };

export const team: Member[] = [
  { id: "U01", name: "ณัฐวุฒิ พงษ์ไพบูลย์", role: "admin", phone: "081-220-4411", email: "nattawut@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U02", name: "ศิริพร ตั้งเจริญ", role: "pm", phone: "081-334-1290", email: "siriporn@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U03", name: "วรเชษฐ์ อินทรประเสริฐ", role: "pm", phone: "089-771-0045", email: "worachet@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U04", name: "ธีรวัฒน์ บุญมา", role: "engineer", phone: "086-551-7720", email: "teerawat@example.co.th", skill: "วิศวกรไฟฟ้า", active: true, lastSeen: "2026-11-03" },
  { id: "U05", name: "อรอุมา จันทร์หอม", role: "qc", phone: "092-118-3341", email: "onuma@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U06", name: "จิราพร พูลสวัสดิ์", role: "qc", phone: "095-402-7781", email: "jiraporn@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U07", name: "อนุชา ศรีสุข", role: "qc", phone: "084-660-1932", email: "anucha@example.co.th", active: true, lastSeen: "2026-11-02" },
  { id: "U08", name: "สุริยา คำแก้ว", role: "technician", phone: "087-230-5518", email: "suriya@example.co.th", skill: "ช่างไฟฟ้า", active: true, lastSeen: "2026-11-04" },
  { id: "U09", name: "ไพโรจน์ ดวงจันทร์", role: "technician", phone: "089-145-6630", email: "pairoj@example.co.th", skill: "ช่างแอร์", active: true, lastSeen: "2026-11-04" },
  { id: "U10", name: "บุญเลิศ ใจดี", role: "technician", phone: "081-993-2207", email: "boonlert@example.co.th", skill: "ช่างซ่อมบำรุงทั่วไป (ปูน/สี/กระเบื้อง)", active: true, lastSeen: "2026-11-03" },
  { id: "U11", name: "สมชาย ปานทอง", role: "technician", phone: "086-772-4401", email: "somchai@example.co.th", skill: "ช่างประปา", active: true, lastSeen: "2026-11-04" },
  { id: "U12", name: "นภัสสร วงศ์ใหญ่", role: "admin", phone: "02-943-8801", email: "napatsorn@example.co.th", skill: "ธุรการบริการหลังการขาย", active: true, lastSeen: "2026-11-04" },
  { id: "U13", name: "ประเสริฐ อุดมสุข", role: "exec", phone: "081-100-2020", email: "prasert@example.co.th", active: true, lastSeen: "2026-11-01" },
  { id: "U14", name: "กมลวรรณ รัตนชัย", role: "sales", phone: "090-551-3380", email: "kamonwan@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U15", name: "ชนิดา มีสุข", role: "architect", phone: "091-772-0098", email: "chanida@example.co.th", active: true, lastSeen: "2026-10-31" },
  { id: "U16", name: "สมศักดิ์ แก้วมณี", role: "foreman", phone: "083-440-1187", email: "somsak@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U17", name: "วิภาวรรณ ทองดี", role: "purchasing", phone: "089-338-7712", email: "wipawan@example.co.th", active: true, lastSeen: "2026-11-04" },
  { id: "U18", name: "ปิยะนุช ศรีวงศ์", role: "accounting", phone: "086-990-1145", email: "piyanuch@example.co.th", active: true, lastSeen: "2026-11-03" },
  { id: "U19", name: "อดิศร พงษ์ศักดิ์", role: "foreman", phone: "082-118-6690", email: "adisorn@example.co.th", active: false, lastSeen: "2026-08-15" },
];

// ---------- generate the remaining projects (40 total) ----------

const PROVINCE_LL: Record<string, [number, number]> = {
  "กรุงเทพฯ": [13.79, 100.6],
  "นนทบุรี": [13.87, 100.47],
  "ปทุมธานี": [14.0, 100.6],
  "สมุทรปราการ": [13.6, 100.63],
  "นครปฐม": [13.82, 100.2],
  "ชลบุรี": [13.15, 100.95],
  "เชียงใหม่": [18.79, 98.98],
  "ขอนแก่น": [16.43, 102.83],
  "อยุธยา": [14.35, 100.57],
};

const FIRST = ["สมศรี", "ธนพล", "วิไลวรรณ", "ประเสริฐ", "ชุติมา", "อนุสรณ์", "กัลยาณี", "พิชิต", "รัชนี", "ศุภชัย", "นันทนา", "จันทร์เพ็ญ", "วีระพงษ์", "สุดารัตน์", "ภูมิพัฒน์", "ณัฐธิดา", "เกียรติศักดิ์", "ดวงใจ", "สุรเชษฐ์", "วรุฒม์", "ไพศาล", "อัญชลี", "มานพ", "ปิยะพร"];
const LAST = ["เจริญผล", "ศรีบุญเรือง", "ตันติวัฒนา", "แก้วประดิษฐ์", "พรหมวงศ์", "สุขเจริญ", "ลิ้มทองกุล", "ธนวันต์", "อินทรสุวรรณ", "กาญจนวงศ์", "ศรีสมบูรณ์", "บุญประเสริฐ", "วงศ์ทอง", "ประทุมทอง", "ชาญวิทยา", "ศรีเมือง"];

{
  const rnd = seeded(2569);
  const houseCodes = houseModels.filter((m) => m.type === "house" || m.type === "townhome").map((m) => m.code);
  const provinces = Object.keys(PROVINCE_LL);
  const extra: Project[] = [];
  // 22 delivered houses (2016–2025), 2 planning
  const deliveredYears = [2016, 2017, 2017, 2018, 2019, 2019, 2020, 2020, 2021, 2021, 2021, 2022, 2022, 2023, 2023, 2023, 2024, 2024, 2024, 2025, 2025, 2025];
  const seq: Record<number, number> = {};
  deliveredYears.forEach((y, i) => {
    const code = houseCodes[Math.floor(rnd() * houseCodes.length)];
    const m = getHouseModel(code)!;
    seq[y] = (seq[y] ?? 10) + 1;
    const id = `HC-${y}-${String(seq[y]).padStart(2, "0")}`;
    const first = FIRST[i % FIRST.length];
    const last = LAST[Math.floor(rnd() * LAST.length)];
    const month = 1 + Math.floor(rnd() * 12);
    const start = `${y - 1}-${String(month).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`;
    const finishDate = new Date(Date.parse(start) + m.months * 30.4 * 86400000);
    const finish = finishDate.toISOString().slice(0, 10);
    const warranty = new Date(finishDate);
    warranty.setUTCFullYear(warranty.getUTCFullYear() + 2);
    extra.push({
      id,
      name: `บ้านคุณ${first}`,
      owner: `${first} ${last}`,
      model: m.name,
      modelCode: code,
      province: provinces[Math.floor(rnd() * provinces.length)],
      pm: ["ศิริพร ตั้งเจริญ", "วรเชษฐ์ อินทรประเสริฐ", "ธีรวัฒน์ บุญมา"][i % 3],
      status: "delivered",
      actual: 100,
      plan: 100,
      phase: "ส่งมอบ",
      start,
      finish,
      value: Math.round((m.priceMin + (m.priceMax - m.priceMin) * rnd()) * 10) / 10,
      floors: m.floors,
      area: m.area,
      openRepairs: 0,
      handedOver: finish,
      warrantyUntil: warranty.toISOString().slice(0, 10),
    });
  });
  for (const [i, code] of ["HM-08", "HM-13"].entries()) {
    const m = getHouseModel(code)!;
    extra.push({
      id: `HC-2026-1${i + 1}`,
      name: ["บ้านคุณเบญจวรรณ", "บ้านคุณสิทธิชัย"][i],
      owner: ["เบญจวรรณ วงศ์ทอง", "สิทธิชัย บุญประเสริฐ"][i],
      model: m.name,
      modelCode: code,
      province: ["นนทบุรี", "กรุงเทพฯ"][i],
      pm: "ศิริพร ตั้งเจริญ",
      status: "planning",
      actual: 0,
      plan: 0,
      phase: "ขออนุญาต",
      start: ["2027-01-10", "2027-02-01"][i],
      finish: ["2028-02-10", "2028-02-28"][i],
      value: [10.4, 7.1][i],
      floors: m.floors,
      area: m.area,
      openRepairs: 0,
    });
  }
  projects.push(...extra);

  // align model names, add coordinates, contract dates and contact details
  const rnd2 = seeded(71);
  for (const p of projects) {
    const m = getHouseModel(p.modelCode);
    if (m) p.model = m.name;
    p.companyId = COMPANY_ID;
    const base = PROVINCE_LL[p.province] ?? PROVINCE_LL["กรุงเทพฯ"];
    p.lat = Math.round((base[0] + (rnd2() - 0.5) * 0.16) * 10000) / 10000;
    p.lng = Math.round((base[1] + (rnd2() - 0.5) * 0.16) * 10000) / 10000;
    const sd = new Date(Date.parse(p.start) - (30 + Math.floor(rnd2() * 40)) * 86400000);
    p.contractDate = sd.toISOString().slice(0, 10);
    p.address = `เลขที่ ${10 + Math.floor(rnd2() * 280)}/${1 + Math.floor(rnd2() * 120)} ${p.province}`;
    p.phone = `08${Math.floor(rnd2() * 10)}-${String(Math.floor(rnd2() * 900) + 100)}-${String(Math.floor(rnd2() * 9000) + 1000)}`;
  }
}

/** Contract value and handovers per month for the last N months ending this month */
export function monthlySeries(months = 24) {
  const out: { key: string; label: string; contract: number; contracts: number; handovers: number }[] = [];
  const [ty, tm] = TODAY.split("-").map(Number);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const inMonth = projects.filter((p) => p.contractDate?.startsWith(key));
    out.push({
      key,
      label: `${TH_MONTH[d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(2)}`,
      contract: Math.round(inMonth.reduce((s, p) => s + p.value, 0) * 10) / 10,
      contracts: inMonth.length,
      handovers: projects.filter((p) => p.handedOver?.startsWith(key)).length,
    });
  }
  return out;
}

// ---------- work orders ----------

export type WorkOrderStatus = "assigned" | "in_progress" | "on_hold" | "done" | "cancelled";
export const WO_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  assigned: "มอบหมายแล้ว",
  in_progress: "กำลังดำเนินการ",
  on_hold: "พักงาน",
  done: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

export type WorkOrder = {
  id: string;
  repairId: string;
  title: string;
  asset: string;
  projectId: string;
  technician: string;
  issuedBy: string;
  issued: string;
  scheduled: string;
  status: WorkOrderStatus;
  severity: Severity;
  billing: "warranty" | "charge";
  hours?: number;
  cost?: number;
  summary?: string;
  log: { at: string; text: string }[];
};

export const workOrders: WorkOrder[] = [
  { id: "WO-202610-0010", repairId: "REP-202610-0001", title: "ซ่อมกระเบื้องโก่ง/ระเบิด ห้องนั่งเล่น", asset: "FF-104", projectId: "HC-2025-02", technician: "บุญเลิศ ใจดี", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-10-17", scheduled: "2026-10-18", status: "in_progress", severity: "high", billing: "warranty", log: [{ at: "2026-10-18 13:30", text: "ช่างเข้าดำเนินการซ่อม" }, { at: "2026-10-17 13:51", text: "รับแจ้งซ่อม กระเบื้องพื้นโก่งตัวระเบิดเสียงดังตอนกลางคืน 4 แผ่น" }] },
  { id: "WO-202610-0011", repairId: "REP-202610-0003", title: "ซ่อมกันซึมหลังคา คสล.", asset: "RF-302", projectId: "HC-2025-02", technician: "บุญเลิศ ใจดี", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-10-26", scheduled: "2026-10-29", status: "on_hold", severity: "high", billing: "warranty", log: [{ at: "2026-10-29 09:10", text: "พักงาน รอฝนหยุด 3 วันก่อนทาวัสดุกันซึม" }, { at: "2026-10-26 10:02", text: "รับแจ้งซ่อมจากลูกค้า" }] },
  { id: "WO-202610-0012", repairId: "REP-202610-0006", title: "แก้แอร์ไม่เย็น ห้องนอนใหญ่", asset: "AC-202", projectId: "HC-2024-05", technician: "ไพโรจน์ ดวงจันทร์", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-10-30", scheduled: "2026-11-01", status: "in_progress", severity: "high", billing: "charge", log: [{ at: "2026-11-01 10:40", text: "ตรวจพบน้ำยาแอร์รั่วที่ข้อต่อแฟลร์ สั่งอะไหล่" }, { at: "2026-10-30 16:20", text: "รับแจ้งซ่อม" }] },
  { id: "WO-202610-0013", repairId: "REP-202610-0004", title: "ตรวจ ELCB เครื่องทำน้ำอุ่นตัด", asset: "WH-201", projectId: "HC-2025-01", technician: "สุริยา คำแก้ว", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-10-28", scheduled: "2026-11-05", status: "assigned", severity: "high", billing: "warranty", log: [{ at: "2026-10-28 11:15", text: "รับแจ้งซ่อมในระยะประกัน" }] },
  { id: "WO-202610-0014", repairId: "REP-202610-0010", title: "ปรับตั้งปั๊มน้ำและถังแรงดัน", asset: "PU-001", projectId: "HC-2025-03", technician: "สมชาย ปานทอง", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-10-27", scheduled: "2026-10-30", status: "in_progress", severity: "medium", billing: "warranty", log: [{ at: "2026-10-30 14:00", text: "เปลี่ยนสวิตช์แรงดัน รอทดสอบ 48 ชม." }] },
  { id: "WO-202611-0001", repairId: "REP-202611-0001", title: "เปลี่ยนชุดลูกลอยชักโครก", asset: "WC-201", projectId: "HC-2025-01", technician: "สมชาย ปานทอง", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-11-01", scheduled: "2026-11-06", status: "on_hold", severity: "medium", billing: "warranty", log: [{ at: "2026-11-02 09:00", text: "รออะไหล่ชุดลูกลอยจากตัวแทนจำหน่าย" }] },
  { id: "WO-202609-0031", repairId: "REP-202609-0021", title: "เปลี่ยนข้อต่อท่อน้ำทิ้งซิงค์", asset: "SK-101", projectId: "HC-2024-05", technician: "สมชาย ปานทอง", issuedBy: "นภัสสร วงศ์ใหญ่", issued: "2026-09-22", scheduled: "2026-09-23", status: "done", severity: "low", billing: "charge", hours: 1.5, cost: 650, summary: "เปลี่ยนข้อต่อ PVC 1½ นิ้ว ทากาวใหม่ ทดสอบไม่รั่ว", log: [{ at: "2026-09-23 15:10", text: "ปิดงาน ลูกค้าเซ็นรับ" }] },
];

// ---------- inspection checklists (keyed by phase label) ----------

export type CheckItem = { id: string; text: string; standard: string };
export const checklists: Record<string, CheckItem[]> = {
  "งานฐานราก": [
    { id: "F1", text: "ตำแหน่งและระดับเสาเข็มตรงตามแบบ", standard: "คลาดเคลื่อนไม่เกิน ±5 ซม." },
    { id: "F2", text: "ขนาดฐานรากตามแบบ S-101", standard: "ตามแบบ" },
    { id: "F3", text: "เหล็กเสริมขนาด จำนวน ระยะห่าง", standard: "DB12 @0.15 ม." },
    { id: "F4", text: "ระยะหุ้มคอนกรีต (Covering)", standard: "ไม่น้อยกว่า 7.5 ซม." },
    { id: "F5", text: "ค่ายุบตัวคอนกรีต (Slump)", standard: "7.5–10 ซม." },
    { id: "F6", text: "เก็บตัวอย่างลูกปูนทดสอบกำลังอัด", standard: "240 ksc ที่ 28 วัน" },
    { id: "F7", text: "ระดับหลังคานคอดิน", standard: "±1 ซม." },
    { id: "F8", text: "ท่อร้อยสายและท่อน้ำผ่านคานคอดินวางตามแบบ", standard: "ตามแบบ E/P" },
    { id: "F9", text: "การบ่มคอนกรีต", standard: "อย่างน้อย 7 วัน" },
  ],
  "งานโครงสร้าง": [
    { id: "S1", text: "ขนาดหน้าตัดเสาและคาน", standard: "ตามแบบ S-102" },
    { id: "S2", text: "เหล็กเสริมหลัก/เหล็กปลอก ระยะทาบ", standard: "ทาบ 40 เท่าของเส้นผ่านศูนย์กลาง" },
    { id: "S3", text: "แบบหล่อแข็งแรง ได้ดิ่ง ไม่รั่ว", standard: "ดิ่ง ±3 มม./ม." },
    { id: "S4", text: "ค้ำยันแบบพื้นและคาน", standard: "ระยะไม่เกิน 1.0 ม." },
    { id: "S5", text: "ค่ายุบตัวคอนกรีต", standard: "7.5–10 ซม." },
    { id: "S6", text: "ผิวคอนกรีตหลังถอดแบบ ไม่มีโพรง", standard: "ไม่มีรูพรุนเกิน 5 มม." },
  ],
  "งานก่ออิฐ": [
    { id: "M1", text: "แนวผนังได้ดิ่งและได้ฉาก", standard: "±3 มม./ม." },
    { id: "M2", text: "เสาเอ็น/ทับหลังทุกช่องเปิดและทุก 3 ม.", standard: "ตามแบบ" },
    { id: "M3", text: "ใส่หนวดกุ้งยึดเสาโครงสร้าง", standard: "ทุก 40 ซม." },
    { id: "M4", text: "ฉาบเรียบ ไม่ร้าวลายงา", standard: "ความหนา 1.5 ซม." },
    { id: "M5", text: "มุมช่องเปิดเสริมตะแกรงกันร้าว", standard: "ตามมาตรฐานบริษัท" },
  ],
  "งานหลังคา": [
    { id: "R1", text: "โครงหลังคาเหล็กเชื่อมเต็มแนว ทากันสนิม", standard: "รองพื้น 2 รอบ" },
    { id: "R2", text: "ระยะแป/จันทันตามแบบ", standard: "ตามแบบ A-190" },
    { id: "R3", text: "มุงกระเบื้องได้แนว ยึดครบทุกแผ่น", standard: "ตามคู่มือผู้ผลิต" },
    { id: "R4", text: "ครอบสันและปีกนกปิดสนิท", standard: "ไม่มีช่องลม" },
    { id: "R5", text: "ทดสอบรั่วซึมด้วยการฉีดน้ำ 30 นาที", standard: "ไม่รั่วซึม" },
    { id: "R6", text: "รางน้ำมีความลาดเอียง", standard: "1:200" },
  ],
  "งานระบบ": [
    { id: "E1", text: "ท่อร้อยสายยึดทุก 1.0 ม.", standard: "ตามแบบ E-101" },
    { id: "E2", text: "ขนาดสายไฟแต่ละวงจรตามแบบ", standard: "ตามตารางโหลด" },
    { id: "E3", text: "ทดสอบความต้านทานฉนวน (Megger)", standard: "≥ 1 MΩ" },
    { id: "E4", text: "หลักดินความต้านทาน", standard: "≤ 5 Ω" },
    { id: "P1", text: "ทดสอบแรงดันท่อน้ำดี 10 บาร์ 1 ชม.", standard: "ความดันไม่ตก" },
    { id: "P2", text: "ความลาดเอียงท่อน้ำทิ้ง", standard: "1:50 – 1:100" },
    { id: "P3", text: "ท่อระบายอากาศ (Vent) ครบทุกสุขภัณฑ์", standard: "ตามแบบ P-101" },
    { id: "H1", text: "ตำแหน่งท่อน้ำยาแอร์และท่อน้ำทิ้งแอร์", standard: "ตามแบบ M-101" },
  ],
  "งานตกแต่ง/ผิว": [
    { id: "T1", text: "ปูกระเบื้องได้ระดับ ไม่โก่ง ไม่กลวง", standard: "เคาะแล้วไม่มีเสียงกลวง" },
    { id: "T2", text: "ร่องยาแนวเต็ม สม่ำเสมอ", standard: "2–3 มม." },
    { id: "T3", text: "งานสีเรียบ ไม่ด่าง ไม่เป็นคราบ", standard: "รองพื้น 1 + ทับหน้า 2" },
    { id: "T4", text: "ฝ้าเพดานได้ระดับ ไม่เห็นรอยต่อ", standard: "±3 มม." },
    { id: "T5", text: "ประตูหน้าต่างเปิดปิดสะดวก ยาซิลิโคนรอบวงกบ", standard: "ไม่รั่วซึม" },
    { id: "T6", text: "ความลาดเอียงพื้นห้องน้ำเข้าหาท่อ", standard: "1:100" },
  ],
  "ติดตั้งสุขภัณฑ์/อุปกรณ์": [
    { id: "X1", text: "ทดสอบการทำงานสวิตช์และปลั๊กทุกจุด", standard: "ทำงานครบทุกจุด" },
    { id: "X2", text: "ทดสอบเครื่องตัดไฟรั่ว (RCBO/ELCB)", standard: "ตัดภายใน 0.04 วินาที" },
    { id: "X3", text: "สุขภัณฑ์ติดตั้งแน่น ไม่รั่ว ชักโครกตัดน้ำ", standard: "ไม่รั่วซึม" },
    { id: "X4", text: "เครื่องทำน้ำอุ่นต่อสายดิน", standard: "มีสายดินแยก" },
    { id: "X5", text: "แอร์ทำความเย็นได้ตามสเปก", standard: "ลมออก 12–14 °C" },
    { id: "X6", text: "ปั๊มน้ำและถังเก็บน้ำทำงานปกติ", standard: "ไม่มีเสียงผิดปกติ" },
  ],
};
