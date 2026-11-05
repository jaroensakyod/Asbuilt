// Demo data for the engineering module. Deterministic, dated around TODAY (2026-11-04).
// All people, companies and licence numbers are fictional.

import { getProject, projects, TODAY } from "@/lib/data";
import { sheetIndex } from "@/lib/drawing/sheets";
import { addDays, DEFAULT_CONCRETE_RULE, planSets } from "./calc";
import { DEFAULT_ITP, defaultCloseoutItems } from "./defaults";
import type {
  ActionItem,
  Closeout,
  ConcreteTest,
  ControlledDoc,
  Disc,
  DocRevision,
  InspectionRequest,
  Licensee,
  Meeting,
  Ncr,
  PileTest,
  ProjectLicensing,
  RebarLot,
  Rfi,
  Submittal,
  SupervisionReport,
  SupervisorChange,
  Transmittal,
} from "./types";

const d = (n: number) => addDays(TODAY, n);
const at = (date: string, hm = "09:30") => `${date}T${hm}:00+07:00`;
const pad3 = (n: number) => String(n).padStart(3, "0");

// people
export const STRUCT_CONSULTANT = "คุณกิตติพงษ์ วงศ์วิศาล (ไทยสตรัคเจอร์ คอนซัลแตนท์)";
export const ARCH_CONSULTANT = "คุณชนิดา มีสุข (สถาปนิก)";
export const MEP_CONSULTANT = "คุณธีรวัฒน์ บุญมา (วิศวกรไฟฟ้า)";
const SUPERVISOR = "คุณภานุวัฒน์ ศักดิ์สิทธิ์";
const QC1 = "อรอุมา จันทร์หอม";
const QC2 = "จิราพร พูลสวัสดิ์";
const QC3 = "อนุชา ศรีสุข";
const FOREMAN = "สมศักดิ์ แก้วมณี";
const PM1 = "ศิริพร ตั้งเจริญ";
const PM2 = "วรเชษฐ์ อินทรประเสริฐ";

// ---------- RFI ----------

type RfiSeed = [string, Disc, string, string, string | undefined, string, string, number, number, Rfi["priority"], boolean, boolean, Rfi["status"], [number, string, string, boolean?][]];
const RFI_ROWS: RfiSeed[] = [
  ["HC-2025-03", "S", "ระยะทาบเหล็กคานชั้น 5 ไม่ตรงกับรายการประกอบแบบ", "แบบ S-105 ระบุระยะทาบเหล็กล่างคาน B5-12 เท่ากับ 40d แต่รายการประกอบแบบข้อ 3.4 ระบุ 50d ขอให้ยืนยันระยะที่ต้องใช้", "S-105", "คาน B5-12 แนวแกน C/3-4", STRUCT_CONSULTANT, -9, -1, "high", false, true, "open", [[-9, PM2, "แนบรูปหน้างานและตารางเหล็กคานชั้น 5 ครับ ทีมงานหยุดผูกเหล็กช่วงนี้ไว้ก่อน"]]],
  ["HC-2025-03", "E", "ตำแหน่งตู้ MDB ชนกับท่อระบายน้ำทิ้งรวม", "ตู้ MDB ตามแบบ E-101 อยู่ใต้แนวท่อระบายน้ำทิ้งรวมขนาด 6 นิ้ว ขอเสนอย้ายตู้ไปผนังด้านทิศเหนือห่างเดิม 2.40 ม.", "E-101", "ห้องไฟฟ้าชั้น 1", MEP_CONSULTANT, -3, 2, "normal", false, false, "open", []],
  ["HC-2025-03", "A", "วัสดุฝ้าทางเดินส่วนกลางชั้น 2–6", "แบบ A-102 ระบุฝ้ายิปซัมบอร์ดทนชื้น แต่ BOQ เป็นยิปซัมธรรมดา ขอยืนยันชนิด", "A-102", "ทางเดินส่วนกลาง", ARCH_CONSULTANT, -20, -13, "normal", true, false, "answered", [[-14, ARCH_CONSULTANT, "ใช้ยิปซัมบอร์ดทนชื้นหนา 9 มม. ตามแบบ ให้ทำราคาเพิ่มเป็นงานเปลี่ยนแปลง", true]]],
  ["HC-2026-02", "P", "ระดับท่อน้ำทิ้งชั้น 2 ไม่พอความลาดเอียง", "ท่อน้ำทิ้งห้องน้ำ 2 ไปช่องท่อมีระยะ 6.5 ม. ความลาดเอียงได้เพียง 1:150 ขอเพิ่มช่องท่อใหม่หรือยกระดับพื้นห้องน้ำ", "P-102", "ห้องน้ำ 2 ชั้น 2", MEP_CONSULTANT, -12, -5, "high", false, true, "answered", [[-11, FOREMAN, "วัดระดับแล้วตามรูปแนบ"], [-6, MEP_CONSULTANT, "ยกระดับพื้นห้องน้ำ 2 ขึ้น 5 ซม. ทำ step ที่ประตู และเปลี่ยนเป็นท่อ 3 นิ้ว", true]]],
  ["HC-2026-02", "A", "ขนาดช่องเปิดหน้าต่าง W3 ไม่ตรงรูปด้าน", "แปลน A-102 ระบุ W3 กว้าง 1.20 ม. รูปด้านระบุ 1.50 ม. ขอยืนยันก่อนสั่งผลิตบานอลูมิเนียม", "A-102", "ห้องนอน 2", ARCH_CONSULTANT, -2, 3, "normal", false, false, "open", []],
  ["HC-2026-04", "S", "เหล็กเสริมพิเศษรอบช่องเปิดพื้นโถงบันได", "ช่องเปิดพื้นขนาด 2.4 × 3.0 ม. ไม่มีรายละเอียดเหล็กเสริมพิเศษรอบช่องเปิด ขอแบบขยาย", "S-102", "โถงบันไดชั้น 2", STRUCT_CONSULTANT, -4, 6, "normal", false, false, "open", []],
  ["HC-2026-03", "S", "คานรับบันไดชั้น 3 ไม่มีในแบบโครงสร้าง", "แบบสถาปัตย์มีบันไดขึ้นชั้น 4 แต่แบบ S-103 ไม่มีคานรับชานพัก ขอรายละเอียดคานและเหล็กเสริม", "S-103", "บันไดหลัง ชั้น 3", STRUCT_CONSULTANT, -1, 1, "urgent", false, true, "open", [[-1, PM1, "งานแบบหล่อชั้น 3 จะเริ่มวันศุกร์ ขอคำตอบภายในวันพฤหัสครับ"]]],
  ["HC-2026-06", "A", "ความสูงฝ้าชั้น 1 ขัดกับรูปตัด", "แปลนฝ้าระบุ +2.70 รูปตัด A-301 ระบุ +2.80", "A-301", "ห้องนั่งเล่น", ARCH_CONSULTANT, -30, -23, "low", false, false, "closed", [[-25, ARCH_CONSULTANT, "ใช้ +2.70 ตามแปลนฝ้า รูปตัดจะแก้ใน Rev.B", true]]],
  ["HC-2026-07", "S", "ขนาดฐานราก F2 ต่างจากตารางฐานราก", "แปลนฐานรากระบุ F2 1.20 × 1.20 ม. ตารางระบุ 1.00 × 1.00 ม.", "S-100", "ฐานราก F2 ทั้งหมด", STRUCT_CONSULTANT, -60, -53, "high", false, false, "closed", [[-57, STRUCT_CONSULTANT, "ใช้ 1.20 × 1.20 ม. ตามแปลน ตารางพิมพ์ผิด", true]]],
  ["HC-2026-08", "S", "เสาเข็มต้นที่ 14 เยื้องศูนย์ 12 ซม.", "ตอกเสาเข็มต้นที่ 14 ฐาน F3 เยื้องศูนย์ 12 ซม. เกินเกณฑ์ 7.5 ซม. ขอแนวทางแก้ไข (ขยายฐานหรือเพิ่มเข็ม)", "S-100", "ฐานราก F3 แนวแกน B/2", STRUCT_CONSULTANT, -2, 3, "high", true, true, "open", [[-2, FOREMAN, "แนบผลสำรวจตำแหน่งเข็มทั้งฐาน"]]],
  ["HC-2026-01", "M", "ตำแหน่งคอยล์ร้อนบนหลังคา", "ตำแหน่งคอยล์ร้อนตามแบบ M-102 อยู่บนหลังคาเหนือห้องนอนใหญ่ เจ้าของบ้านกังวลเรื่องเสียง ขอย้ายไประเบียงหลัง", "M-102", "หลังคาชั้น 2", MEP_CONSULTANT, -15, -8, "normal", false, false, "answered", [[-10, MEP_CONSULTANT, "ย้ายได้ ระยะท่อน้ำยาเพิ่ม 4 ม. อยู่ในเกณฑ์ผู้ผลิต", true]]],
  ["HC-2026-05", "E", "จำนวนเต้ารับห้องครัว", "เจ้าของบ้านขอเพิ่มเต้ารับเหนือเคาน์เตอร์จาก 3 เป็น 6 จุด วงจรเดิมรองรับได้หรือไม่", "E-101", "ห้องครัว", MEP_CONSULTANT, -1, 8, "normal", true, false, "open", []],
  ["HC-2026-09", "S", "ระดับดินถมก่อนเทพื้น", "ระดับดินเดิมต่ำกว่าที่สำรวจ 25 ซม. ขอยืนยันระดับหลังถมและการบดอัด", "S-100", "ทั้งแปลง", STRUCT_CONSULTANT, -8, -1, "normal", true, false, "answered", [[-3, STRUCT_CONSULTANT, "ถมเป็นชั้นละ 20 ซม. บดอัด 95% Standard Proctor ระดับตามแบบเดิม", true]]],
  ["HC-2025-04", "A", "กระเบื้องห้องน้ำชั้น 2 เลิกผลิต", "กระเบื้องรุ่นที่ระบุเลิกผลิต ผู้ขายเสนอรุ่นทดแทนขนาดเดียวกัน ราคาเพิ่ม 12%", undefined, "ห้องน้ำ 2 และ 3", ARCH_CONSULTANT, -40, -33, "normal", true, false, "closed", [[-36, ARCH_CONSULTANT, "อนุมัติรุ่นทดแทน เจ้าของบ้านเลือกสีแล้ว", true]]],
];

export function seedRfis(): Rfi[] {
  const count = new Map<string, number>();
  return RFI_ROWS.map(([projectId, disc, subject, question, sheet, location, assignedTo, raised, due, priority, costImpact, timeImpact, status, msgs]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    const raisedAt = d(raised);
    const p = getProject(projectId);
    const thread = msgs.map(([day, by, text, official], i) => ({ id: `M${i + 1}`, at: at(d(day), i % 2 ? "15:10" : "10:20"), by, text, official }));
    const official = thread.find((m) => m.official);
    return {
      id: `RFI-${projectId}-${pad3(no)}`,
      projectId,
      no,
      subject,
      question,
      disc,
      sheet,
      location,
      attachments: [],
      raisedBy: p?.pm ?? PM1,
      raisedAt,
      assignedTo: status === "open" ? assignedTo : (p?.pm ?? PM1),
      due: d(due),
      priority,
      costImpact,
      timeImpact,
      status,
      thread,
      answeredAt: official ? official.at.slice(0, 10) : undefined,
      closedAt: status === "closed" ? d(raised + 10) : undefined,
      closedBy: status === "closed" ? (p?.pm ?? PM1) : undefined,
    };
  });
}

// ---------- submittals ----------

type SubSeed = [string, Submittal["type"], Disc, string, string, string, string, [number, number, Submittal["revs"][number]["code"]?, string?][]];
const SUB_ROWS: SubSeed[] = [
  ["HC-2025-03", "material", "S", "คอนกรีตผสมเสร็จ 280 ksc (cylinder)", "03 30 00 คอนกรีตหล่อในที่", "ซีแพค คอนกรีต", STRUCT_CONSULTANT, [[-120, -113, "A"]]],
  ["HC-2025-03", "shop", "S", "Shop drawing เหล็กเสริมพื้น Post-tension ชั้น 5", "03 38 00 คอนกรีตอัดแรง", "พีที ซิสเต็ม", STRUCT_CONSULTANT, [[-30, -23, "C", "ระยะ tendon ช่วงหัวเสาไม่ตรงผลคำนวณ แก้ไขส่งใหม่"], [-8, -1]]],
  ["HC-2025-03", "material", "E", "สายไฟฟ้า THW / NYY และรางเดินสาย", "26 05 19 สายไฟฟ้าแรงต่ำ", "บางกอกเคเบิ้ล", MEP_CONSULTANT, [[-12, -5, "B", "ใช้ NYY ขนาด 4×95 ตร.มม. สำหรับสายเมนตามแบบ"]]],
  ["HC-2025-03", "method", "S", "Method statement งานติดตั้งนั่งร้านภายนอกอาคาร", "01 50 00 สิ่งอำนวยความสะดวกชั่วคราว", "", STRUCT_CONSULTANT, [[-5, 2]]],
  ["HC-2026-02", "material", "A", "กระเบื้องพื้น Porcelain 60×60 ซม.", "09 30 00 งานกระเบื้อง", "ไทยเซรามิค", ARCH_CONSULTANT, [[-25, -18, "D", "สีไม่ตรงกับ mood board ที่ลูกค้าอนุมัติ"], [-14, -7, "A"]]],
  ["HC-2026-02", "sample", "A", "ตัวอย่างสีทาภายนอก 3 เฉด", "09 91 00 งานสี", "ทีโอเอ", ARCH_CONSULTANT, [[-6, -1]]],
  ["HC-2026-04", "material", "S", "เหล็กเสริม SD40 ขนาด DB12–DB20", "03 20 00 เหล็กเสริมคอนกรีต", "ทาทาสตีล", STRUCT_CONSULTANT, [[-90, -83, "A"]]],
  ["HC-2026-04", "shop", "A", "Shop drawing บานอลูมิเนียมและกระจก", "08 50 00 หน้าต่าง", "อลูเทค", ARCH_CONSULTANT, [[-3, 4]]],
  ["HC-2026-03", "cert", "S", "ใบรับรองผลทดสอบเสาเข็มสปัน", "31 62 00 เสาเข็มตอก", "เอเชียไพล์", STRUCT_CONSULTANT, [[-100, -93, "A"]]],
  ["HC-2026-03", "material", "P", "ท่อ PPR สำหรับน้ำร้อน-น้ำเย็น", "22 11 16 ท่อน้ำประปา", "ไทยพีพีอาร์", MEP_CONSULTANT, [[-9, -2]]],
  ["HC-2026-06", "material", "A", "วัสดุมุงหลังคาเมทัลชีทพร้อมฉนวน", "07 41 00 หลังคาโลหะ", "บลูสโคป", ARCH_CONSULTANT, [[-7, 0, "B", "ให้ใช้ความหนา 0.40 มม. TCT"]]],
  ["HC-2026-08", "method", "S", "Method statement การตอกเสาเข็มใกล้บ้านข้างเคียง", "31 62 00 เสาเข็มตอก", "", STRUCT_CONSULTANT, [[-70, -63, "A"]]],
  ["HC-2026-01", "material", "M", "เครื่องปรับอากาศ Inverter 5 ชุด", "23 81 26 เครื่องปรับอากาศแยกส่วน", "แอร์เทค ซัพพลาย", MEP_CONSULTANT, [[-40, -33, "A"]]],
];

export function seedSubmittals(): Submittal[] {
  const count = new Map<string, number>();
  return SUB_ROWS.map(([projectId, type, disc, title, specSection, supplier, reviewer, revs]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    const p = getProject(projectId);
    return {
      id: `SBM-${projectId}-${pad3(no)}`,
      projectId,
      no,
      title,
      type,
      disc,
      specSection,
      supplier: supplier || undefined,
      reviewer,
      revs: revs.map(([sub, due, code, comments], rev) => ({
        rev,
        submittedAt: d(sub),
        submittedBy: p?.pm ?? PM1,
        due: d(due),
        attachments: [],
        code,
        comments: code ? (comments ?? (code === "A" ? "อนุมัติให้ใช้ได้" : undefined)) : undefined,
        reviewedAt: code ? d(Math.min(due, sub + 5)) : undefined,
        reviewedBy: code ? reviewer : undefined,
      })),
    };
  });
}

// ---------- NCR ----------

type NcrSeed = [string, Disc, string, string, string, Ncr["severity"], string, string | undefined, number, number, Ncr["status"], string?, string?, string?];
const NCR_ROWS: NcrSeed[] = [
  ["HC-2025-03", "S", "รูพรุนคอนกรีตเสาชั้น 4", "ผิวคอนกรีตเสา C4-07 ถึง C4-09 มีรูพรุนลึก 2–4 ซม. เห็นเหล็กเสริม", "เสาแนวแกน D ชั้น 4", "major", "ช่างไม้แบบ ทีมคุณประยุทธ", "SUB-0001", -21, -7, "verify", "จี้เขย่าไม่ทั่วถึง ช่วงเทความสูงเกิน 2 ม.", "สกัดผิวที่หลวม ซ่อมด้วย non-shrink grout", "ใช้ท่อเทลงถึงฐานเสา และเพิ่มเครื่องจี้ 1 เครื่อง"],
  ["HC-2025-03", "S", "ระยะหุ้มเหล็กพื้นชั้น 5 ไม่พอ", "วัดระยะหุ้มก่อนเทได้ 1.0–1.2 ซม. ต่ำกว่าที่กำหนด 2.0 ซม.", "พื้นชั้น 5 โซน B", "major", "ทีมเหล็ก คุณสมนึก", "SUB-0002", -3, 4, "action", "ลูกปูนไม่พอและหลุดระหว่างเดิน", "เพิ่มลูกปูนทุก 60 ซม. ตรวจซ้ำก่อนเท"],
  ["HC-2025-03", "A", "ผนังก่ออิฐชั้น 3 ไม่ได้ดิ่ง", "ผนังห้อง 305 เอียง 12 มม. ต่อ 2.4 ม.", "ห้อง 305", "minor", FOREMAN, undefined, -30, -16, "open"],
  ["HC-2026-02", "P", "ท่อน้ำทิ้งรั่วซึมที่ข้อต่อ", "ทดสอบขังน้ำพบรอยซึมที่ข้อต่อท่อ 4 นิ้วใต้ห้องน้ำ 1", "ห้องน้ำ 1 ชั้น 2", "major", "ช่างประปา ทีมคุณสมชาย", undefined, -10, -3, "closed", "ทากาวไม่ทั่วถึง", "ตัดเปลี่ยนข้อต่อใหม่ ทดสอบซ้ำผ่าน", "ทดสอบขังน้ำทุกห้องก่อนปูกระเบื้อง"],
  ["HC-2026-04", "S", "เหล็กเสริมคานชั้น 2 ขาด 1 เส้น", "คาน B2-04 เหล็กบน 3-DB16 ตามแบบ หน้างานพบ 2-DB16", "คาน B2-04", "critical", "ทีมเหล็ก คุณสมนึก", "SUB-0002", -1, 2, "open"],
  ["HC-2026-06", "S", "แบบหล่อเสาโป่งออก", "แบบหล่อเสา C1-03 โป่ง 2 ซม. ระหว่างเท", "เสา C1-03", "minor", FOREMAN, undefined, -12, -5, "closed", "ค้ำยันแบบไม่พอ", "ขัดแต่งผิว", "เพิ่มเหล็กรัดแบบทุก 50 ซม."],
  ["HC-2026-08", "S", "เสาเข็มเยื้องศูนย์เกินเกณฑ์", "เข็มต้นที่ 14 ฐาน F3 เยื้องศูนย์ 12 ซม.", "ฐาน F3", "major", "ผู้รับเหมาเสาเข็ม", "SUB-0003", -2, 12, "open"],
  ["HC-2026-03", "E", "ท่อร้อยสายไฟในพื้นแตก", "ท่อ PVC ร้อยสายในพื้นชั้น 3 แตกจากการเดินทับก่อนเท", "พื้นชั้น 3", "minor", "ทีมไฟฟ้า คุณสุริยา", undefined, -18, -11, "action", "ไม่มีการป้องกันท่อ", "เปลี่ยนท่อเป็น IMC ช่วงทางเดิน"],
];

export function seedNcrs(): Ncr[] {
  const count = new Map<string, number>();
  return NCR_ROWS.map(([projectId, disc, title, description, location, severity, responsible, subcontractorId, raised, due, status, rootCause, corrective, preventive]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    return {
      id: `NCR-${projectId}-${pad3(no)}`,
      projectId,
      no,
      title,
      description,
      location,
      disc,
      severity,
      raisedBy: [QC1, QC2, QC3][no % 3],
      raisedAt: d(raised),
      responsible,
      subcontractorId,
      rootCause,
      corrective,
      preventive,
      due: d(due),
      status,
      photos: [],
      closePhotos: [],
      verifiedBy: status === "closed" ? SUPERVISOR : undefined,
      closedAt: status === "closed" ? d(due) : undefined,
    };
  });
}

// ---------- inspection requests ----------

type IrSeed = [string, string, string, string, number, InspectionRequest["status"], number, ("pass" | "fail")?];
const IR_ROWS: IrSeed[] = [
  ["HC-2025-03", "ITP-RB", "เหล็กเสริมพื้นชั้น 6 โซน A", "พื้นชั้น 6 โซน A", 0, "inprogress", 1],
  ["HC-2025-03", "ITP-POUR", "เทคอนกรีตพื้นชั้น 5 โซน B", "พื้นชั้น 5 โซน B", -7, "approved", 5],
  ["HC-2025-03", "ITP-ELC", "ระบบไฟฟ้าก่อนปิดฝ้า ชั้น 2", "ทางเดินส่วนกลางชั้น 2", 1, "requested", 0],
  ["HC-2026-04", "ITP-RB", "เหล็กเสริมคานและพื้นชั้น 2", "ชั้น 2 ทั้งหมด", -1, "rejected", 2, "fail"],
  ["HC-2026-03", "ITP-FW", "แบบหล่อคานและพื้นชั้น 4", "ชั้น 4", 0, "inprogress", 1],
  ["HC-2026-08", "ITP-FDN", "ฐานราก F1–F6", "ฐานรากทั้งหมด", -2, "inprogress", 1],
  ["HC-2026-09", "ITP-FDN", "ฐานราก F1–F4", "ฐานรากทั้งหมด", -6, "approved", 6],
  ["HC-2026-02", "ITP-PRS", "ทดสอบแรงดันท่อประปาชั้น 2", "ห้องน้ำ 1–3 ชั้น 2", -1, "inprogress", 1],
  ["HC-2026-05", "ITP-ELC", "ระบบไฟฟ้าก่อนปิดฝ้าชั้น 1", "ชั้น 1", 2, "requested", 0],
  ["HC-2026-07", "ITP-FW", "แบบหล่อเสาชั้น 1", "เสาชั้น 1", -4, "approved", 5],
];

export function seedInspectionRequests(): InspectionRequest[] {
  const count = new Map<string, number>();
  return IR_ROWS.map(([projectId, templateId, title, location, day, status, done, lastFail]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    const tpl = DEFAULT_ITP.find((t) => t.id === templateId)!;
    const date = d(day);
    const steps = tpl.steps.slice(0, done).map((s, i) => ({
      stepId: s.id,
      result: (lastFail && i === done - 1 ? lastFail : "pass") as "pass" | "fail",
      by: s.point === "H" ? SUPERVISOR : QC1,
      at: at(date, `${String(9 + i).padStart(2, "0")}:00`),
      note: lastFail && i === done - 1 ? "เหล็กบนคาน B2-04 ขาด 1 เส้น เปิด NCR" : undefined,
    }));
    return {
      id: `IR-${projectId}-${pad3(no)}`,
      projectId,
      no,
      templateId,
      title,
      location,
      requestedBy: FOREMAN,
      requestedAt: d(day - 1),
      date,
      time: "10:00",
      inspector: SUPERVISOR,
      steps,
      status,
      signedBy: status === "approved" ? SUPERVISOR : undefined,
      signedAt: status === "approved" ? at(date, "16:00") : undefined,
      ncrId: lastFail ? `NCR-${projectId}-001` : undefined,
    };
  });
}

// ---------- material tests ----------

type CtSeed = [string, number, string, number, Specimen, number, number[] | null, number[] | null, number?];
type Specimen = ConcreteTest["specimen"];
const CT_ROWS: CtSeed[] = [
  ["HC-2025-03", -45, "พื้นชั้น 4 โซน A", 280, "cylinder", 10, [205, 212, 199], [298, 305, 291]],
  ["HC-2025-03", -38, "เสาชั้น 5", 280, "cylinder", 9.5, [198, 207, 201], [287, 279, 293]],
  ["HC-2025-03", -28, "พื้นชั้น 5 โซน A", 280, "cylinder", 11, [190, 186, 195], [262, 271, 240]],
  ["HC-2025-03", -7, "พื้นชั้น 5 โซน B", 280, "cylinder", 10, [], null],
  ["HC-2025-03", -2, "เสาชั้น 6", 280, "cylinder", 9, null, null],
  ["HC-2026-04", -28, "คานและพื้นชั้น 2", 240, "cube", 8.5, [178, 172, 181], [], 15],
  ["HC-2026-04", -40, "เสาชั้น 1", 240, "cube", 9, [175, 169, 172], [262, 255, 270]],
  ["HC-2026-03", -10, "คานและพื้นชั้น 3", 240, "cube", 10, [150, 146, 141], null],
  ["HC-2026-06", -20, "เสาชั้น 1", 240, "cube", 9, [168, 171, 165], null],
  ["HC-2026-08", -14, "ฐานราก F1–F3", 240, "cube", 8, [166, 170, 159], null],
  ["HC-2026-09", -21, "ฐานราก F1–F4", 240, "cube", 7.5, [172, 168, 175], null],
  ["HC-2026-07", -50, "ฐานรากและตอม่อ", 240, "cube", 8, [170, 176, 168], [258, 249, 261]],
];

export function seedConcreteTests(): ConcreteTest[] {
  const count = new Map<string, number>();
  return CT_ROWS.map(([projectId, pour, element, fc, specimen, slump, r7, r28, slumpOver]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    const pourDate = d(pour);
    const sets = planSets(pourDate, DEFAULT_CONCRETE_RULE.ages).map((s) => {
      const r = s.age === 7 ? r7 : r28;
      return r && r.length ? { ...s, results: r, testedAt: s.due, lab: "ห้องปฏิบัติการ ซีแพค" } : s;
    });
    return {
      id: `CT-${projectId}-${pad3(no)}`,
      projectId,
      pourDate,
      element,
      supplier: projectId === "HC-2025-03" ? "ซีแพค คอนกรีต" : "คอนกรีตผสมเสร็จ ท้องถิ่น",
      ticketNo: `DT-${String(2600 + no * 37).padStart(5, "0")}`,
      volume: projectId === "HC-2025-03" ? 48 : 12,
      fc,
      specimen,
      slump: slumpOver ?? slump,
      slumpMin: 7.5,
      slumpMax: 12.5,
      sets,
    };
  });
}

export function seedRebarLots(): RebarLot[] {
  const rows: [string, number, RebarLot["grade"], string, number, string, number?, number?, number?][] = [
    ["HC-2025-03", -60, "SD40", "DB16", 18.5, "TS-6612-A", 4420, 6150, 19],
    ["HC-2025-03", -32, "SD40", "DB20", 12.0, "TS-6680-C", 4380, 6080, 18],
    ["HC-2025-03", -5, "SD40", "DB12", 9.2, "MS-2251-B"],
    ["HC-2026-04", -70, "SD40", "DB12", 4.1, "TS-6590-B", 4310, 6020, 18],
    ["HC-2026-04", -70, "SR24", "RB9", 1.2, "NS-1120-A", 2950, 4450, 25],
    ["HC-2026-03", -40, "SD40", "DB16", 6.4, "MS-2190-A", 3820, 5710, 16],
    ["HC-2026-08", -12, "SD40", "DB12", 3.0, "TS-6702-A"],
  ];
  const count = new Map<string, number>();
  return rows.map(([projectId, day, grade, size, tons, heatNo, y, t, e]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    return {
      id: `RB-${projectId}-${pad3(no)}`,
      projectId,
      date: d(day),
      grade,
      size,
      tons,
      supplier: heatNo.startsWith("TS") ? "ทาทาสตีล (ประเทศไทย)" : heatNo.startsWith("MS") ? "มิลเลนเนียมสตีล" : "นครไทยสตริปมิล",
      heatNo,
      millCert: [],
      yieldKsc: y,
      tensileKsc: t,
      elongation: e,
      lab: y ? "ศูนย์ทดสอบวัสดุ มหาวิทยาลัยตัวอย่าง" : undefined,
      testedAt: y ? d(day + 6) : undefined,
    };
  });
}

export function seedPileTests(): PileTest[] {
  const rows: [string, number, PileTest["method"], string, string, number, number | undefined, PileTest["result"], string?][] = [
    ["HC-2025-03", -300, "seismic", "P1–P86 (86 ต้น)", "เสาเข็มเจาะ Ø 0.60 ม.", 80, undefined, "pass", "สมบูรณ์ทุกต้น"],
    ["HC-2025-03", -295, "dynamic", "P42", "เสาเข็มเจาะ Ø 0.60 ม.", 80, 214, "pass", "FS 2.68"],
    ["HC-2026-08", -10, "seismic", "เข็ม 1–24", "เสาเข็มสปัน Ø 0.30 ม.", 25, undefined, "doubt", "เข็มต้นที่ 14 สัญญาณผิดปกติที่ความลึก 6 ม."],
    ["HC-2026-03", -180, "dynamic", "P7", "เสาเข็มเจาะ Ø 0.35 ม.", 35, 92, "pass", "FS 2.63"],
    ["HC-2026-09", -40, "seismic", "เข็ม 1–16", "เสาเข็มหกเหลี่ยม 0.30 ม.", 20, undefined, "pass"],
  ];
  const count = new Map<string, number>();
  return rows.map(([projectId, day, method, pileNo, pileType, designLoad, capacity, result, note]) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    return { id: `PT-${projectId}-${pad3(no)}`, projectId, date: d(day), method, pileNo, pileType, designLoad, capacity, result, lab: "บริษัท ทดสอบเสาเข็ม ตัวอย่าง จำกัด", note, report: [] };
  });
}

// ---------- licences ----------

export function seedLicensees(): Licensee[] {
  return [
    { id: "LIC-001", name: "ภานุวัฒน์ ศักดิ์สิทธิ์", company: "พนักงานบริษัท", council: "coe", branch: "โยธา", level: 2, licenseNo: "สย. 21874", expiry: "2027-08-31", phone: "081-552-1180" },
    { id: "LIC-002", name: "ธีรวัฒน์ บุญมา", memberId: "U04", council: "coe", branch: "ไฟฟ้ากำลัง", level: 1, licenseNo: "ภฟก. 40211", expiry: d(41), phone: "086-551-7720" },
    { id: "LIC-003", name: "ชนิดา มีสุข", memberId: "U15", council: "act", branch: "สถาปัตยกรรมหลัก", level: 2, licenseNo: "ส-สถ. 8812", expiry: "2028-03-15", phone: "091-772-0098" },
    { id: "LIC-004", name: "กิตติพงษ์ วงศ์วิศาล", company: "ไทยสตรัคเจอร์ คอนซัลแตนท์", council: "coe", branch: "โยธา", level: 3, licenseNo: "วย. 3105", expiry: "2029-01-10", phone: "02-711-4550" },
    { id: "LIC-005", name: "ณัฐพล ชัยมงคล", company: "พนักงานบริษัท", council: "coe", branch: "โยธา", level: 1, licenseNo: "ภย. 128840", expiry: d(-12), phone: "089-114-2276" },
    { id: "LIC-006", name: "สุภาวดี ทองประเสริฐ", company: "สตูดิโอ เอส อาร์คิเทค", council: "act", branch: "สถาปัตยกรรมหลัก", level: 1, licenseNo: "ภ-สถ. 22917", expiry: "2027-11-30", phone: "02-118-9090" },
    { id: "LIC-007", name: "อภิชาติ เรืองศรี", company: "พนักงานบริษัท", council: "coe", branch: "โยธา", level: 1, licenseNo: "ภย. 131552", expiry: "2028-06-30", phone: "084-339-2810" },
    { id: "LIC-008", name: "วศิน พรหมรักษ์", company: "เอ็มอีพี โซลูชั่น", council: "coe", branch: "ไฟฟ้ากำลัง", level: 2, licenseNo: "สฟก. 9921", expiry: "2027-05-20", phone: "02-640-7712" },
  ];
}

export function seedProjectLicensing(): ProjectLicensing[] {
  const rows: [string, Partial<Record<"arch" | "struct" | "elec" | "supervise", string>>][] = [
    ["HC-2025-03", { arch: "LIC-003", struct: "LIC-007", elec: "LIC-008", supervise: "LIC-001" }],
    ["HC-2025-04", { arch: "LIC-003", struct: "LIC-004", supervise: "LIC-001" }],
    ["HC-2026-01", { arch: "LIC-003", struct: "LIC-004", supervise: "LIC-007" }],
    ["HC-2026-02", { arch: "LIC-006", struct: "LIC-004", supervise: "LIC-007" }],
    ["HC-2026-03", { arch: "LIC-003", struct: "LIC-004", supervise: "LIC-001" }],
    ["HC-2026-04", { arch: "LIC-003", struct: "LIC-004", supervise: "LIC-005" }],
    ["HC-2026-05", { arch: "LIC-006", struct: "LIC-004", supervise: "LIC-007" }],
    ["HC-2026-06", { arch: "LIC-003", struct: "LIC-004", supervise: "LIC-007" }],
    ["HC-2026-07", { arch: "LIC-006", struct: "LIC-004", supervise: "LIC-007" }],
    ["HC-2026-08", { arch: "LIC-003", struct: "LIC-004", supervise: "LIC-001" }],
    ["HC-2026-09", { arch: "LIC-003", struct: "LIC-004" }],
  ];
  return rows.map(([projectId, assigned]) => ({ id: projectId, projectId, assigned }));
}

// ---------- supervision ----------

export function seedSupervisionReports(): SupervisionReport[] {
  const rows: [string, "daily" | "weekly", number, number, string, string, string, string?][] = [
    ["HC-2025-03", "weekly", -13, -7, "ตรวจงานเหล็กเสริมและแบบหล่อพื้นชั้น 5 โซน A–B ตรวจงานก่ออิฐชั้น 3", "ทดสอบค่ายุบตัวและเก็บตัวอย่างคอนกรีตพื้นชั้น 5 โซน B จำนวน 6 ก้อน", "ให้เพิ่มลูกปูนรองเหล็กพื้นชั้น 5 ทุก 60 ซม. และแก้ไขผนังห้อง 305 ให้ได้ดิ่งก่อนฉาบ", "รอคำตอบ RFI ระยะทาบเหล็กคานชั้น 5"],
    ["HC-2025-03", "weekly", -6, 0, "ตรวจงานเหล็กเสริมพื้นชั้น 6 โซน A ตรวจระบบไฟฟ้าก่อนปิดฝ้าชั้น 2", "ทดสอบกำลังอัดคอนกรีตอายุ 28 วัน พื้นชั้น 5 โซน A", "ผลทดสอบก้อนตัวอย่างพื้นชั้น 5 โซน A ไม่ผ่านเกณฑ์รายก้อน ให้เจาะแกนคอนกรีตทดสอบเพิ่ม 3 จุด"],
    ["HC-2026-04", "daily", -1, -1, "ตรวจเหล็กเสริมคานและพื้นชั้น 2", "–", "คาน B2-04 เหล็กบนขาด 1 เส้น ให้เสริมให้ครบก่อนขอตรวจใหม่ ห้ามเทคอนกรีต"],
    ["HC-2026-03", "weekly", -6, 0, "ตรวจแบบหล่อชั้น 4 ตรวจท่อร้อยสายในพื้นชั้น 3", "ทดสอบกำลังอัดคอนกรีต 7 วัน คานและพื้นชั้น 3", "ผล 7 วันต่ำกว่าเป้า ให้ขยายเวลาค้ำยันพื้นชั้น 3 ออกไปจนกว่าจะได้ผล 28 วัน"],
    ["HC-2026-08", "daily", -2, -2, "ตรวจตำแหน่งเสาเข็มหลังตอก ฐาน F1–F6", "Seismic test เสาเข็ม 24 ต้น", "เข็มต้นที่ 14 เยื้องศูนย์และผล seismic ไม่ชัดเจน ให้หยุดงานฐาน F3 รอผู้ออกแบบ"],
    ["HC-2026-02", "weekly", -13, -7, "ตรวจงานระบบประปาชั้น 2 และงานฉาบภายนอก", "ทดสอบขังน้ำห้องน้ำ 1–3", "แก้ไขรอยซึมข้อต่อท่อห้องน้ำ 1 แล้ว ทดสอบซ้ำผ่าน"],
    ["HC-2026-09", "weekly", -13, -7, "ตรวจฐานราก F1–F4 ก่อนเทคอนกรีต", "ทดสอบค่ายุบตัวคอนกรีตฐานราก", "อนุญาตให้เทคอนกรีตฐานราก F1–F4"],
  ];
  const count = new Map<string, number>();
  return rows.map(([projectId, kind, from, to, work, tests, instructions, issues], i) => {
    const no = (count.get(projectId) ?? 0) + 1;
    count.set(projectId, no);
    const signed = i % 3 !== 1;
    return {
      id: `SVR-${projectId}-${pad3(no)}`,
      projectId,
      no,
      kind,
      from: d(from),
      to: d(to),
      engineer: "ภานุวัฒน์ ศักดิ์สิทธิ์",
      licenseeId: "LIC-001",
      progress: getProject(projectId)?.actual,
      work,
      tests,
      instructions,
      issues,
      diaryIds: [],
      photos: [],
      status: signed ? "signed" : "draft",
      signedBy: signed ? "ภานุวัฒน์ ศักดิ์สิทธิ์" : undefined,
      signedAt: signed ? at(d(to), "17:00") : undefined,
    };
  });
}

export function seedSupervisorChanges(): SupervisorChange[] {
  return [
    { id: "SVC-HC-2026-04-1", projectId: "HC-2026-04", date: d(-40), fromName: "อภิชาติ เรืองศรี", toName: "ณัฐพล ชัยมงคล", toLicenseeId: "LIC-005", reason: "ย้ายผู้ควบคุมงานเดิมไปประจำโครงการอาคารชุด", authority: "สำนักงานเขตบางกะปิ", notifiedAt: d(-38), letterNo: "ตส. 118/2569" },
    { id: "SVC-HC-2025-03-1", projectId: "HC-2025-03", date: d(-120), fromName: "สมพงษ์ ใจกล้า", toName: "ภานุวัฒน์ ศักดิ์สิทธิ์", toLicenseeId: "LIC-001", reason: "ผู้ควบคุมงานเดิมลาออก", authority: "สำนักงานเขตลาดพร้าว", notifiedAt: d(-118), letterNo: "ตส. 077/2569" },
  ];
}

// ---------- document control ----------

const DOC_PROJECTS = ["HC-2025-03", "HC-2026-02", "HC-2026-04", "HC-2026-03"];
const DISC_OF: Record<string, Disc> = { A: "A", S: "S", E: "E", P: "P", M: "M" };

export function seedDocuments(): ControlledDoc[] {
  const out: ControlledDoc[] = [];
  for (const pid of DOC_PROJECTS) {
    const p = getProject(pid);
    if (!p) continue;
    const start = p.start;
    let no = 0;
    for (const s of sheetIndex(p.modelCode)) {
      no++;
      const disc = DISC_OF[s.disc] ?? "A";
      const designer = disc === "A" ? ARCH_CONSULTANT : disc === "S" ? STRUCT_CONSULTANT : MEP_CONSULTANT;
      const sheetRef = `${p.modelCode}/${s.id}`;
      const base = (rev: string, date: string, status: DocRevision["status"], wf: DocRevision["wf"], note?: string): DocRevision => ({
        id: `${s.id}-${rev}`,
        rev,
        date,
        status,
        note,
        by: designer,
        files: [],
        sheetRef,
        wf,
        submittedAt: wf !== "draft" ? date : undefined,
        reviewedBy: wf === "reviewed" || wf === "approved" ? p.pm : undefined,
        reviewedAt: wf === "reviewed" || wf === "approved" ? addDays(date, 2) : undefined,
        approvedBy: wf === "approved" ? SUPERVISOR : undefined,
        approvedAt: wf === "approved" ? addDays(date, 4) : undefined,
        pins: [],
      });
      const revs: DocRevision[] = [base("A", addDays(start, -40), "superseded", "approved", "ฉบับขออนุญาต"), base("0", addDays(start, -10), "afc", "approved", "ฉบับก่อสร้าง")];
      // a few sheets went through a revision during construction
      if (no % 5 === 2) {
        revs[1] = { ...revs[1], status: "superseded" };
        const late = (no * 7) % 30;
        revs.push(base("1", d(-late - 3), late % 2 ? "afc" : "approval", late % 2 ? "approved" : "submitted", "แก้ไขตาม RFI"));
      }
      if (pid === "HC-2025-03" && s.id === "S-105")
        revs[revs.length - 1] = {
          ...revs[revs.length - 1],
          pins: [
            { id: "PIN-1", n: 1, x: 38, y: 42, text: "ระยะทาบเหล็กล่างคาน B5-12 ไม่ตรงรายการประกอบแบบ (RFI-001)", by: PM2, at: at(d(-9)), fileId: "sheet" },
            { id: "PIN-2", n: 2, x: 62, y: 55, text: "ตรวจตำแหน่งช่องเปิดท่อ", by: QC1, at: at(d(-4)), fileId: "sheet" },
          ],
        };
      out.push({ id: `DC-${pid}-${pad3(no)}`, projectId: pid, number: s.id, title: s.titleTh, disc, kind: "drawing", revs });
    }
    // specification + calculation documents
    no++;
    out.push({
      id: `DC-${pid}-${pad3(no)}`,
      projectId: pid,
      number: "SP-01",
      title: "รายการประกอบแบบก่อสร้าง",
      disc: "A",
      kind: "spec",
      revs: [{ id: "SP-01-0", rev: "0", date: addDays(start, -10), status: "afc", by: ARCH_CONSULTANT, files: [], wf: "approved", submittedAt: addDays(start, -10), reviewedBy: p.pm, reviewedAt: addDays(start, -8), approvedBy: SUPERVISOR, approvedAt: addDays(start, -6), pins: [] }],
    });
    no++;
    out.push({
      id: `DC-${pid}-${pad3(no)}`,
      projectId: pid,
      number: "CAL-01",
      title: "รายการคำนวณโครงสร้าง",
      disc: "S",
      kind: "calc",
      revs: [{ id: "CAL-01-0", rev: "0", date: addDays(start, -12), status: "afc", by: STRUCT_CONSULTANT, files: [], wf: "approved", submittedAt: addDays(start, -12), reviewedBy: p.pm, reviewedAt: addDays(start, -10), approvedBy: SUPERVISOR, approvedAt: addDays(start, -8), pins: [] }],
    });
  }
  return out;
}

export function seedTransmittals(docs: ControlledDoc[]): Transmittal[] {
  const pick = (pid: string, n: number, purposeRev: "first" | "last") =>
    docs
      .filter((x) => x.projectId === pid)
      .slice(0, n)
      .map((x) => ({ docId: x.id, revId: (purposeRev === "first" ? x.revs[0] : x.revs[x.revs.length - 1]).id, copies: 2 }));
  return [
    { id: "TR-HC-2025-03-001", projectId: "HC-2025-03", no: 1, date: d(-60), to: "บริษัท ไทยสตรัคเจอร์ คอนซัลแตนท์ จำกัด", attn: "คุณกิตติพงษ์", purpose: "approval", items: pick("HC-2025-03", 6, "last"), sentBy: PM2, ackBy: "กิตติพงษ์ วงศ์วิศาล", ackAt: d(-58) },
    { id: "TR-HC-2025-03-002", projectId: "HC-2025-03", no: 2, date: d(-5), to: "ผู้รับเหมาช่วงงานระบบ เอ็มอีพี โซลูชั่น", attn: "คุณวศิน", purpose: "construction", items: pick("HC-2025-03", 4, "last"), sentBy: PM2 },
    { id: "TR-HC-2026-02-001", projectId: "HC-2026-02", no: 1, date: d(-200), to: "สำนักงานเขต/เทศบาล (ขออนุญาตก่อสร้าง)", purpose: "record", items: pick("HC-2026-02", 5, "first"), sentBy: PM1, ackBy: "เจ้าหน้าที่รับเรื่อง", ackAt: d(-200) },
    { id: "TR-HC-2026-04-001", projectId: "HC-2026-04", no: 1, date: d(-2), to: "คุณพรทิพย์ ชาญวิทยา (เจ้าของบ้าน)", purpose: "info", items: pick("HC-2026-04", 3, "last"), sentBy: PM2 },
  ];
}

// ---------- meetings ----------

export function seedMeetings(): { meetings: Meeting[]; actions: ActionItem[] } {
  const meetings: Meeting[] = [];
  const actions: ActionItem[] = [];
  const mk = (projectId: string, type: Meeting["type"], day: number, title: string, chair: string, attendees: [string, string, boolean?][], agenda: string[], minutes: string, decisions: string[], acts: [string, string, number, ActionItem["status"]?][], status: Meeting["status"] = "issued") => {
    const no = meetings.filter((m) => m.projectId === projectId).length + 1;
    const id = `MTG-${projectId}-${pad3(no)}`;
    const carried = actions.filter((a) => a.projectId === projectId && (a.status === "open" || (a.doneAt && a.doneAt >= d(day - 7)))).map((a) => a.id);
    meetings.push({ id, projectId, no, type, title, date: d(day), time: "09:00", place: "สำนักงานสนาม", chair, attendees: attendees.map(([name, org, absent]) => ({ name, org, present: !absent })), agenda, minutes, decisions, carried, status, nextDate: d(day + 7) });
    for (const [text, owner, due, st] of acts) {
      const n = actions.filter((a) => a.projectId === projectId).length + 1;
      actions.push({ id: `ACT-${projectId}-${pad3(n)}`, projectId, meetingId: id, text, owner, due: d(due), status: st ?? "open", doneAt: st === "done" ? d(Math.min(due, -1)) : undefined });
    }
  };
  const condoTeam: [string, string, boolean?][] = [
    [PM2, "ผู้จัดการโครงการ"],
    ["ภานุวัฒน์ ศักดิ์สิทธิ์", "ผู้ควบคุมงาน"],
    [QC1, "QC"],
    [FOREMAN, "โฟร์แมน"],
    ["วศิน พรหมรักษ์", "เอ็มอีพี โซลูชั่น"],
    ["นิติบุคคลฯ (คุณมาลี)", "ผู้แทนเจ้าของ", true],
  ];
  mk("HC-2025-03", "site", -14, "ประชุมประจำสัปดาห์ครั้งที่ 52", PM2, condoTeam, ["ติดตามเรื่องค้าง", "ความคืบหน้างานโครงสร้างชั้น 5–6", "งานระบบชั้น 2", "ความปลอดภัย"], "งานโครงสร้างชั้น 5 ช้ากว่าแผน 6 วันจากฝน แผนเร่งเพิ่มทีมเหล็ก 1 ทีม", ["เพิ่มทีมผูกเหล็กชั้น 6 ตั้งแต่สัปดาห์หน้า", "ให้ผู้รับเหมาระบบส่ง shop drawing ท่อสายไฟชั้น 3–6 ภายใน 2 สัปดาห์"], [
    ["ส่ง shop drawing ท่อร้อยสายชั้น 3–6", "วศิน พรหมรักษ์", -1],
    ["จัดทีมผูกเหล็กเพิ่ม 1 ทีม", FOREMAN, -8, "done"],
    ["ติดตามคำตอบ RFI ระยะทาบเหล็กคานชั้น 5", PM2, -5],
  ]);
  mk("HC-2025-03", "site", -7, "ประชุมประจำสัปดาห์ครั้งที่ 53", PM2, condoTeam, ["ติดตามเรื่องค้าง", "ผลทดสอบคอนกรีตพื้นชั้น 5 โซน A", "แผนเทพื้นชั้น 6"], "ผลทดสอบ 28 วันพื้นชั้น 5 โซน A มีก้อนต่ำกว่าเกณฑ์ ผู้ควบคุมงานให้เจาะแกนทดสอบ", ["เจาะแกนคอนกรีต 3 จุด ส่งทดสอบ", "เลื่อนเทพื้นชั้น 6 โซน A ไป 6 พ.ย."], [
    ["นัดห้องแล็บเจาะแกนคอนกรีตพื้นชั้น 5 โซน A", QC1, 1],
    ["ปรับแผนงานเทพื้นชั้น 6 ส่งลูกค้า", PM2, -2, "done"],
  ]);
  mk("HC-2025-03", "safety", -3, "ประชุมความปลอดภัยประจำเดือน", "จป.วิชาชีพ ประจำโครงการ", [[PM2, "ผู้จัดการโครงการ"], [FOREMAN, "โฟร์แมน"], ["หัวหน้าทีมเหล็ก", "ผู้รับเหมาช่วง"], ["หัวหน้าทีมแบบหล่อ", "ผู้รับเหมาช่วง"]], ["สถิติอุบัติเหตุเดือนตุลาคม", "การทำงานบนที่สูงชั้น 6", "ตรวจนั่งร้าน"], "ไม่มีอุบัติเหตุถึงขั้นหยุดงาน พบการไม่คล้องเข็มขัดนิรภัย 3 ครั้ง", ["ติดตั้งราวกันตกรอบพื้นชั้น 6 ก่อนเริ่มงาน"], [["ติดตั้งราวกันตกรอบพื้นชั้น 6", FOREMAN, 2]]);
  mk("HC-2026-02", "client", -10, "ประชุมลูกค้าเลือกวัสดุตกแต่ง", PM1, [[PM1, "ผู้จัดการโครงการ"], ["ศิริรัตน์ โพธิ์ทอง", "เจ้าของบ้าน"], ["ชนิดา มีสุข", "สถาปนิก"]], ["กระเบื้องพื้นชั้น 1", "สีภายนอก", "สุขภัณฑ์"], "ลูกค้าไม่อนุมัติกระเบื้องที่ส่งครั้งแรก เลือกรุ่นใหม่ สีเทาอ่อน", ["ใช้กระเบื้อง Porcelain 60×60 สีเทาอ่อน", "ส่งตัวอย่างสีภายนอก 3 เฉดให้เลือก"], [
    ["ส่งตัวอย่างสีภายนอก 3 เฉด", "ชนิดา มีสุข", -4, "done"],
    ["สรุปราคาส่วนต่างสุขภัณฑ์ที่ลูกค้าเปลี่ยน", PM1, -3],
  ]);
  mk("HC-2026-02", "site", -3, "ประชุมประจำสัปดาห์ไซต์", PM1, [[PM1, "ผู้จัดการโครงการ"], [FOREMAN, "โฟร์แมน"], [QC2, "QC"], ["สมชาย ปานทอง", "ช่างประปา"]], ["ติดตามเรื่องค้าง", "งานระบบประปาชั้น 2", "แผนปูกระเบื้อง"], "ทดสอบขังน้ำผ่านแล้ว เริ่มปูกระเบื้องห้องน้ำสัปดาห์หน้า", ["เริ่มปูกระเบื้องห้องน้ำ 9 พ.ย."], [["ทดสอบแรงดันท่อประปาชั้น 2", "สมชาย ปานทอง", 1]]);
  mk("HC-2026-04", "sub", -1, "ประชุมผู้รับเหมาช่วงงานเหล็ก", PM2, [[PM2, "ผู้จัดการโครงการ"], ["หัวหน้าทีมเหล็ก คุณสมนึก", "ผู้รับเหมาช่วง"], [QC3, "QC"]], ["NCR เหล็กเสริมคาน B2-04", "คุณภาพงานผูกเหล็ก"], "ทีมเหล็กยอมรับข้อบกพร่อง จะเสริมเหล็กและขอตรวจใหม่", ["หักค่าแรงตรวจซ้ำตามสัญญาหากพบซ้ำ"], [["เสริมเหล็ก B2-04 และขอตรวจใหม่", "หัวหน้าทีมเหล็ก คุณสมนึก", 1], ["ตรวจเหล็กคานชั้น 2 ทุกตัวซ้ำ", QC3, 2]]);
  mk("HC-2026-03", "site", -6, "ประชุมประจำสัปดาห์ไซต์", PM1, [[PM1, "ผู้จัดการโครงการ"], [FOREMAN, "โฟร์แมน"], ["ภานุวัฒน์ ศักดิ์สิทธิ์", "ผู้ควบคุมงาน"]], ["ติดตามเรื่องค้าง", "แบบหล่อชั้น 4", "RFI คานรับบันได"], "รอคำตอบ RFI คานรับบันไดชั้น 3 ก่อนเริ่มแบบหล่อชานพัก", ["ทำแบบหล่อส่วนอื่นของชั้น 4 ไปก่อน"], [["ติดตาม RFI คานรับบันไดกับผู้ออกแบบ", PM1, -2], ["ขยายเวลาค้ำยันพื้นชั้น 3", FOREMAN, 5]], "draft");
  return { meetings, actions };
}

// ---------- closeout ----------

export function seedCloseouts(): Closeout[] {
  const mk = (pid: string, doneKeys: string[], handover?: Closeout["handover"]): Closeout => {
    const p = getProject(pid);
    const needsCertificate = !!p && (p.floors >= 4 || p.area >= 1000 || p.modelCode.startsWith("CD") || p.modelCode.startsWith("HO"));
    const items = defaultCloseoutItems({ needsCertificate }).map((it) => (doneKeys.includes(it.key) || doneKeys.includes("*") ? { ...it, done: true, doneBy: p?.pm, doneAt: handover?.date ?? d(-5) } : it));
    return { id: `CO-${pid}`, projectId: pid, items, handover };
  };
  return [
    mk("HC-2025-04", ["om", "warranty", "tests", "systems", "meters", "cleaning"]),
    mk("HC-2026-01", ["tests", "warranty"]),
    mk("HC-2025-01", ["*"], { date: "2026-01-20", customerName: "มยุรี เรืองฤทธิ์", companyName: PM1, keys: "กุญแจบ้าน 3 ชุด รีโมทประตูรั้ว 2 ตัว", meters: "ไฟฟ้า 00412 · ประปา 0087", remarks: "ส่งมอบครบถ้วน", signedAt: "2026-01-20T15:00:00+07:00" }),
    mk("HC-2025-02", ["*"], { date: "2026-04-10", customerName: "ธีระ จิตต์มั่น", companyName: PM2, keys: "กุญแจบ้าน 2 ชุด", meters: "ไฟฟ้า 00218 · ประปา 0041", signedAt: "2026-04-10T14:00:00+07:00" }),
  ];
}

export const projectIdsWithWork = () => projects.filter((p) => p.status === "building" || p.status === "handover").map((p) => p.id);
