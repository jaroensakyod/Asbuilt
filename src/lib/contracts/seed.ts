// Demo data of the contracts module (fictional): contract terms of the projects billed by measured
// progress, variations, subcontractors, subcontracts and payment certificates (client IPC + subcontract).
// Shared collections are registered with provideSeed(); everything is deterministic.

import { projects, TODAY, type Project } from "../data";
import { provideSeed, type CostCode, type Subcontract } from "../biz";
import { SEED_SUPPLIERS, taxCheckDigit } from "../procurement/catalog";
import { budgetLinesFrom } from "../sales/boq";
import { modelBoq, plannedMargin } from "../sales/seed-biz";
import { r2, sum } from "../accounting/money";
import { addDaysIso, certCalc, contractValueOf, measuredGross, subcontractValue, voTotals } from "./calc";
import type { BackCharge, CertX, ContractTerms, SubcontractorX, SubcontractX, VariationX } from "./types";

const tax = (first12: string) => first12 + taxCheckDigit(first12);
const proj = (id: string) => projects.find((p) => p.id === id) as Project;
const baseValue = (id: string) => Math.round((proj(id)?.value ?? 0) * 1e6);
const monthEnd = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const nextPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const minIso = (a: string, b: string) => (a < b ? a : b);
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));

// ---------- contract terms (projects billed by measured progress) ----------

const MEASURED: { projectId: string; contractNo: string; retentionPct: number; retentionCapPct: number; advancePct: number; advanceDate?: string; advancePaidDate?: string; whtRate: number; certPayDays: number; taxId?: string; address: string; ldPerDay: number; finalPct: number }[] = [
  { projectId: "HC-2025-03", contractNo: "CT-2568-021", retentionPct: 10, retentionCapPct: 5, advancePct: 10, advanceDate: "2025-10-01", advancePaidDate: "2025-10-10", whtRate: 3, certPayDays: 21, taxId: tax("099350012461"), address: "71 ซอยลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ 10310", ldPerDay: 82000, finalPct: 59 },
  { projectId: "HC-2026-03", contractNo: "CT-2569-007", retentionPct: 5, retentionCapPct: 5, advancePct: 10, advanceDate: "2026-03-20", advancePaidDate: "2026-03-30", whtRate: 3, certPayDays: 30, taxId: tax("010555801734"), address: "88/4 ถนนรามอินทรา แขวงคันนายาว เขตคันนายาว กรุงเทพฯ 10230", ldPerDay: 9600, finalPct: 44 },
  { projectId: "HC-2024-05", contractNo: "CT-2566-014", retentionPct: 5, retentionCapPct: 5, advancePct: 0, whtRate: 0, certPayDays: 15, address: "99/9 หมู่ 5 ตำบลนาจอมเทียน อำเภอสัตหีบ ชลบุรี 20250", ldPerDay: 14500, finalPct: 100 },
];

export function seedTerms(): ContractTerms[] {
  return MEASURED.map((m) => {
    const p = proj(m.projectId);
    return {
      id: `CT-${m.projectId}`,
      projectId: m.projectId,
      billing: "measured",
      contractNo: m.contractNo,
      signedAt: p.contractDate ?? p.start,
      retentionPct: m.retentionPct,
      retentionCapPct: m.retentionCapPct,
      advancePct: m.advancePct,
      advanceDate: m.advanceDate,
      advancePaidDate: m.advancePaidDate,
      whtRate: m.whtRate,
      customerName: p.owner,
      customerTaxId: m.taxId,
      customerBranch: m.taxId ? "สำนักงานใหญ่" : undefined,
      customerAddress: m.address,
      defectsMonths: 12,
      certPayDays: m.certPayDays,
      ldPerDay: m.ldPerDay,
    };
  });
}

// ---------- variations ----------

type L = [description: string, qty: number, unit: string, unitPrice: number, unitCost: number, costCode: CostCode];
type VoRaw = Omit<VariationX, "id" | "lines" | "amount" | "cost"> & { lines: L[] };
const VO_RAW: VoRaw[] = [
  {
    projectId: "HC-2025-03", no: 1, title: "เพิ่มห้องเก็บของและห้องอเนกประสงค์ชั้นดาดฟ้า", reason: "นิติบุคคลขอเพิ่มพื้นที่ส่วนกลางบนดาดฟ้าตามมติที่ประชุมกรรมการ", origin: "client", status: "approved", days: 21, raisedBy: "วรเชษฐ์ อินทรประเสริฐ", raisedAt: "2026-01-12", submittedAt: "2026-01-20", approvedAt: "2026-02-10", approvedBy: "คุณสมชาย วงศ์ทอง (ประธานกรรมการนิติบุคคล)",
    lines: [["งานโครงสร้าง คสล. ห้องดาดฟ้า", 38, "ลบ.ม.", 9800, 7600, "03"], ["งานก่ออิฐฉาบปูนผนังห้อง", 210, "ตร.ม.", 980, 760, "04"], ["งานหลังคาเมทัลชีทพร้อมฉนวน", 160, "ตร.ม.", 1450, 1120, "05"], ["งานระบบไฟฟ้าและแสงสว่าง", 1, "งาน", 168000, 128000, "06"]],
  },
  {
    projectId: "HC-2025-03", no: 2, title: "ระบบดับเพลิงเพิ่มเติมตามข้อกำหนดกรุงเทพมหานคร", reason: "สำนักการโยธาแจ้งให้เพิ่มหัวกระจายน้ำดับเพลิงและตู้ดับเพลิงในโถงทางเดินทุกชั้น", origin: "authority", status: "approved", days: 14, raisedBy: "ธีรวัฒน์ บุญมา", raisedAt: "2026-04-18", submittedAt: "2026-04-25", approvedAt: "2026-05-20", approvedBy: "คุณสมชาย วงศ์ทอง (ประธานกรรมการนิติบุคคล)",
    lines: [["ระบบหัวกระจายน้ำดับเพลิง (sprinkler) โถงทางเดิน", 6, "ชั้น", 248000, 196000, "07"], ["ตู้ดับเพลิงพร้อมสายฉีดและถังดับเพลิง", 12, "ชุด", 38500, 29800, "07"], ["ระบบสัญญาณแจ้งเหตุเพลิงไหม้เพิ่มเติม", 1, "งาน", 465000, 362000, "06"]],
  },
  {
    projectId: "HC-2025-03", no: 3, title: "เปลี่ยนวัสดุผนังภายนอกด้านหน้าเป็นแผ่นอะลูมิเนียมคอมโพสิต", reason: "สถาปนิกปรับแบบฟาซาดด้านหน้าให้ลดความร้อนและลดงานบำรุงรักษาสี", origin: "design", status: "submitted", days: 10, raisedBy: "ชนิดา มีสุข", raisedAt: "2026-10-12", submittedAt: "2026-10-20",
    lines: [["แผ่นอะลูมิเนียมคอมโพสิตพร้อมโครงเคร่า", 540, "ตร.ม.", 2350, 1840, "10"], ["หัก งานฉาบและทาสีผนังภายนอกเดิม", -540, "ตร.ม.", 780, 610, "11"]],
  },
  {
    projectId: "HC-2025-03", no: 4, title: "ลดงานถนนภายในโครงการเป็นบล็อกปูพื้น", reason: "หน้างานพบว่าพื้นที่ถนนภายในน้อยกว่าแบบ ปรับเป็นบล็อกปูพื้นเพื่อระบายน้ำ", origin: "site", status: "draft", days: 0, raisedBy: "สมศักดิ์ แก้วมณี", raisedAt: "2026-10-30",
    lines: [["หัก งานถนน คสล. หนา 15 ซม.", -420, "ตร.ม.", 1180, 920, "13"], ["บล็อกปูพื้นตัวหนอนพร้อมทรายรองพื้น", 420, "ตร.ม.", 420, 330, "13"]],
  },
  {
    projectId: "HC-2026-03", no: 1, title: "เพิ่มลิฟต์โดยสารขนาด 6 คน", reason: "ลูกค้าต้องการลิฟต์สำหรับพนักงานและผู้มาติดต่อชั้น 1–4", origin: "client", status: "approved", days: 30, raisedBy: "ศิริพร ตั้งเจริญ", raisedAt: "2026-05-22", submittedAt: "2026-05-28", approvedAt: "2026-06-15", approvedBy: "คุณธนกฤต วิริยะกุล (กรรมการผู้จัดการ บริษัท ทีเค อินเตอร์เทรด จำกัด)",
    lines: [["ลิฟต์โดยสาร 450 กก. 4 จุดจอด พร้อมติดตั้ง", 1, "ชุด", 1180000, 960000, "12"], ["งานโครงสร้างช่องลิฟต์และบ่อลิฟต์", 1, "งาน", 186000, 142000, "03"], ["งานระบบไฟฟ้ากำลังสำหรับลิฟต์", 1, "งาน", 64000, 48000, "06"]],
  },
  {
    projectId: "HC-2026-03", no: 2, title: "เพิ่มหลังคากันสาดที่จอดรถด้านหน้า", reason: "ลูกค้าขอเพิ่มกันสาดโครงเหล็กสำหรับที่จอดรถ 4 คัน", origin: "client", status: "priced", days: 7, raisedBy: "ศิริพร ตั้งเจริญ", raisedAt: "2026-10-26",
    lines: [["โครงหลังคาเหล็กรูปพรรณพร้อมทาสีกันสนิม", 48, "ตร.ม.", 2650, 2050, "05"], ["แผ่นหลังคาโพลีคาร์บอเนต", 48, "ตร.ม.", 890, 680, "05"]],
  },
  {
    projectId: "HC-2026-01", no: 1, title: "เปลี่ยนกระเบื้องพื้นชั้นล่างเป็นแกรนิตโต้ 60×120", reason: "ลูกค้าเลือกวัสดุพื้นรุ่นใหม่จากโชว์รูม", origin: "selection", status: "approved", days: 5, raisedBy: "วรเชษฐ์ อินทรประเสริฐ", raisedAt: "2026-07-28", submittedAt: "2026-08-02", approvedAt: "2026-08-12", approvedBy: "พลวัฒน์ แสงดี",
    lines: [["กระเบื้องแกรนิตโต้ 60×120 พร้อมปู", 96, "ตร.ม.", 2150, 1680, "10"], ["หัก กระเบื้องเดิมตามสัญญา 60×60", -96, "ตร.ม.", 820, 640, "10"], ["บัวเชิงผนังสีเดียวกับพื้น", 62, "ม.", 180, 130, "10"]],
  },
  {
    projectId: "HC-2026-01", no: 2, title: "ชุดครัวบิลต์อินพร้อมท็อปหินควอตซ์", reason: "ลูกค้าขอให้ทำครัวบิลต์อินแทนการจ้างร้านภายนอก", origin: "client", status: "submitted", days: 12, raisedBy: "วรเชษฐ์ อินทรประเสริฐ", raisedAt: "2026-10-18", submittedAt: "2026-10-25",
    lines: [["ตู้ครัวบน-ล่าง ไม้ HMR ปิดผิวลามิเนต", 5.4, "ม.", 28500, 21800, "12"], ["ท็อปหินควอตซ์หนา 20 มม.", 5.4, "ม.", 12800, 9600, "12"], ["งานประปาและไฟฟ้าย้ายจุด", 1, "งาน", 18500, 13200, "07"]],
  },
  {
    projectId: "HC-2026-02", no: 1, title: "ยกเลิกรั้วด้านหลังบ้าน", reason: "ลูกค้าใช้รั้วร่วมกับเพื่อนบ้านที่สร้างไว้แล้ว", origin: "client", status: "approved", days: 0, raisedBy: "ศิริพร ตั้งเจริญ", raisedAt: "2026-08-20", submittedAt: "2026-08-24", approvedAt: "2026-09-02", approvedBy: "ศิริรัตน์ โพธิ์ทอง",
    lines: [["หัก รั้วบล็อกสำเร็จรูปสูง 1.8 ม.", -28, "ม.", 2450, 1900, "13"], ["หัก ฐานรากรั้ว", -28, "ม.", 650, 500, "13"]],
  },
  {
    projectId: "HC-2026-02", no: 2, title: "เพิ่มหน้าต่างบานเกล็ดห้องน้ำชั้นบน", reason: "ลูกค้าขอเพิ่มช่องระบายอากาศ แต่สถาปนิกไม่อนุมัติเพราะกระทบผนังรับแรง", origin: "client", status: "rejected", days: 3, raisedBy: "ศิริพร ตั้งเจริญ", raisedAt: "2026-09-15", submittedAt: "2026-09-18", rejectedReason: "ลูกค้าเปลี่ยนใจหลังทราบราคาและผลกระทบต่อโครงสร้าง",
    lines: [["หน้าต่างบานเกล็ดอะลูมิเนียม 0.6×0.8 ม.", 2, "ชุด", 6800, 5100, "09"], ["งานเจาะผนังและทับหลัง", 2, "จุด", 3500, 2600, "04"]],
  },
  {
    projectId: "HC-2026-04", no: 1, title: "ตอกเสาเข็มเพิ่มบริเวณที่จอดรถ", reason: "ผลเจาะสำรวจดินเพิ่มพบชั้นดินอ่อนลึกกว่าที่ออกแบบไว้", origin: "site", status: "submitted", days: 6, raisedBy: "ธีรวัฒน์ บุญมา", raisedAt: "2026-10-28", submittedAt: "2026-11-01",
    lines: [["เสาเข็มเจาะ ø0.35 ม. ลึก 21 ม.", 8, "ต้น", 9800, 7700, "02"], ["งานฐานรากเพิ่ม F3", 4, "ฐาน", 4600, 3500, "02"]],
  },
  {
    projectId: "HC-2026-05", no: 1, title: "เพิ่มคานรับถังเก็บน้ำบนดาดฟ้า", reason: "ตอบ RFI เรื่องตำแหน่งถังเก็บน้ำ 2,000 ลิตร วิศวกรให้เพิ่มคานรับน้ำหนัก", origin: "rfi", status: "approved", days: 3, raisedBy: "ธีรวัฒน์ บุญมา", raisedAt: "2026-09-24", submittedAt: "2026-09-28", approvedAt: "2026-10-05", approvedBy: "วัชระ เลิศวิริยะ",
    lines: [["คาน คสล. 0.20×0.40 ม. พร้อมเหล็กเสริม", 1.6, "ลบ.ม.", 14500, 11200, "03"], ["ฐานรองถังและท่อเชื่อมต่อ", 1, "งาน", 18800, 14200, "07"]],
  },
  {
    projectId: "HC-2026-06", no: 1, title: "ปรับแบบระเบียงชั้นสองเป็นหลังคาคลุม", reason: "สถาปนิกปรับแบบให้กันฝนสาดตามสภาพอากาศเชียงใหม่", origin: "design", status: "draft", days: 0, raisedBy: "ชนิดา มีสุข", raisedAt: "2026-11-02",
    lines: [["โครงหลังคาเหล็กและกระเบื้องคอนกรีต", 22, "ตร.ม.", 2280, 1760, "05"]],
  },
  {
    projectId: "HC-2026-07", no: 1, title: "เปลี่ยนสีภายนอกเป็นสีระบบกันร้อน", reason: "ลูกค้าเปลี่ยนใจภายหลัง ใช้สีตามสัญญาเดิม", origin: "selection", status: "void", days: 0, raisedBy: "ธีรวัฒน์ บุญมา", raisedAt: "2026-09-08",
    lines: [["สีทาภายนอกระบบกันร้อน ส่วนต่างราคา", 320, "ตร.ม.", 85, 62, "11"]],
  },
  {
    projectId: "HC-2025-04", no: 1, title: "ม่านจีบและมุ้งลวดทุกห้อง", reason: "ลูกค้าขอให้ติดตั้งก่อนส่งมอบเพื่อเข้าอยู่ได้ทันที", origin: "client", status: "approved", days: 4, raisedBy: "ศิริพร ตั้งเจริญ", raisedAt: "2026-07-08", submittedAt: "2026-07-12", approvedAt: "2026-07-20", approvedBy: "อรวรรณ ทองมา",
    lines: [["ม่านจีบผ้ากันแสง พร้อมราง", 42, "ตร.ม.", 1150, 860, "10"], ["มุ้งลวดอะลูมิเนียมบานเลื่อน", 14, "ชุด", 2150, 1620, "09"]],
  },
];

function seedVariations(): VariationX[] {
  return VO_RAW.map(({ lines, ...v }) => {
    const ls = lines.map(([description, qty, unit, unitPrice, unitCost, costCode]) => ({ description, qty, unit, unitPrice, unitCost, costCode }));
    const t = voTotals(ls);
    return { ...v, id: `VO-${v.projectId}-${v.no}`, lines: ls, amount: t.amount, cost: t.cost } as VariationX;
  });
}

// ---------- client interim payment certificates ----------

const CLIENT_OPEN: Record<string, Record<number, CertX["status"]>> = {
  // last cert submitted, the one before certified and overdue
  "HC-2025-03": { 13: "submitted", 12: "certified" },
  "HC-2026-03": { 7: "draft", 6: "certified" },
};

function clientCerts(): CertX[] {
  const vos = seedVariations();
  const out: CertX[] = [];
  let seq = 0;
  for (const m of MEASURED) {
    const p = proj(m.projectId);
    const cv0 = baseValue(m.projectId);
    const advance = r2((cv0 * m.advancePct) / 100);
    const delivered = p.status === "delivered";
    const periods: string[] = [];
    const firstPer = Number(p.start.slice(8, 10)) >= 15 ? nextPeriod(p.start.slice(0, 7)) : p.start.slice(0, 7);
    for (let per = firstPer; ; per = nextPeriod(per)) {
      const end = delivered ? (monthEnd(per) >= p.finish ? p.finish : monthEnd(per)) : monthEnd(per);
      periods.push(end);
      if (delivered ? end >= p.finish : per >= "2026-10") break;
    }
    const t0 = Date.parse(p.start);
    const t1 = Date.parse(periods[periods.length - 1]);
    let prevGross = 0,
      retBefore = 0,
      advBefore = 0;
    periods.forEach((periodTo, i) => {
      const no = i + 1;
      const x = (Date.parse(periodTo) - t0) / Math.max(1, t1 - t0);
      const pct = r2(i === periods.length - 1 ? m.finalPct : m.finalPct * ease(Math.min(1, Math.max(0, x))));
      const date = addDaysIso(periodTo, 3);
      const cv = contractValueOf(cv0, vos, m.projectId, date);
      const gross = Math.max(prevGross, Math.round((cv * pct) / 100));
      const c = certCalc({ grossToDate: gross, previous: prevGross, contractValue: cv, retentionPct: m.retentionPct, retentionCapPct: m.retentionCapPct, retentionBefore: retBefore, advance, advanceBefore: advBefore, vatRate: 7, whtRate: m.whtRate });
      const status = CLIENT_OPEN[m.projectId]?.[no] ?? "paid";
      const year = date.slice(0, 4);
      const billed = status === "certified" || status === "paid";
      if (billed) seq++;
      out.push({
        id: `IPC-${m.projectId}-${no}`,
        projectId: m.projectId,
        side: "client",
        no,
        periodTo,
        date,
        grossToDate: gross,
        previous: prevGross,
        thisPeriod: c.thisPeriod,
        retention: c.retention,
        advanceRecovery: c.advanceRecovery,
        backCharges: 0,
        vat: c.vat,
        wht: c.wht,
        net: c.net,
        status,
        certifiedBy: billed ? "คุณประภาส ศรีวิไล (ผู้ควบคุมงานฝ่ายผู้ว่าจ้าง)" : undefined,
        paidDate: status === "paid" ? minIso(addDaysIso(date, 10 + (no % 6)), addDaysIso(TODAY, -1)) : undefined,
        pctToDate: pct,
        basis: "actual",
        contractValue: cv,
        retentionPct: m.retentionPct,
        whtRate: m.whtRate,
        vatRate: 7,
        submittedAt: addDaysIso(periodTo, 2),
        certifiedAt: billed ? date : undefined,
        dueDate: addDaysIso(date, m.certPayDays),
        invoiceNo: billed ? `INV-${year}-9${String(seq).padStart(3, "0")}` : undefined,
        receiptNo: status === "paid" ? `RCP-${year}-9${String(seq).padStart(3, "0")}` : undefined,
      });
      prevGross = gross;
      retBefore = c.retentionToDate;
      advBefore = c.advanceToDate;
    });
  }
  return out;
}

// ---------- subcontractors ----------

const sup = (name: string) => SEED_SUPPLIERS.find((s) => s.name === name);
type SubRaw = Omit<SubcontractorX, "id" | "taxId" | "supplierId" | "contact" | "phone"> & { supplier?: string; taxId?: string; contact?: string; phone?: string };
const SUB_RAW: SubRaw[] = [
  { name: "บริษัท โครงสร้างมั่นคง คอนสตรัคชั่น จำกัด", supplier: "บริษัท โครงสร้างมั่นคง คอนสตรัคชั่น จำกัด", trades: ["งานโครงสร้าง", "งานฐานราก/เสาเข็ม"], prequal: "approved", prequalChecklist: { experience: 27, financial: 21, safety: 20, references: 17 }, prequalDate: "2025-08-18", insuranceExpiry: "2027-03-31", compFundExpiry: "2026-12-31", workers: 46, since: "2022-05-10" },
  { name: "บริษัท ไพศาล วิศวกรรม จำกัด", supplier: "บริษัท ไพศาล วิศวกรรม จำกัด", trades: ["งานไฟฟ้า", "งานโครงสร้าง"], prequal: "approved", prequalChecklist: { experience: 25, financial: 20, safety: 21, references: 16 }, prequalDate: "2026-03-02", insuranceExpiry: "2026-11-25", compFundExpiry: "2026-12-31", workers: 28, since: "2023-01-16", note: "ใบรับรองประกันภัยความรับผิดต่อบุคคลภายนอกใกล้หมดอายุ ขอสำเนาฉบับต่ออายุแล้ว" },
  { name: "นายสมพงษ์ ใจกล้า (ช่างไฟฟ้า)", supplier: "นายสมพงษ์ ใจกล้า (ช่างไฟฟ้า)", trades: ["งานไฟฟ้า"], prequal: "approved", prequalChecklist: { experience: 22, financial: 14, safety: 19, references: 17 }, prequalDate: "2025-11-04", insuranceExpiry: "2027-01-15", workers: 6, since: "2021-09-01" },
  { name: "นายประยุทธ ทองคำ (ช่างประปา)", supplier: "นายประยุทธ ทองคำ (ช่างประปา)", trades: ["งานประปา/สุขาภิบาล"], prequal: "approved", prequalChecklist: { experience: 21, financial: 13, safety: 18, references: 16 }, prequalDate: "2025-12-10", insuranceExpiry: "2026-11-18", workers: 5, since: "2022-02-14" },
  { name: "ห้างหุ้นส่วนจำกัด ช่างหลังคาสุวรรณ", supplier: "ห้างหุ้นส่วนจำกัด ช่างหลังคาสุวรรณ", trades: ["งานหลังคา", "งานกันซึม"], prequal: "approved", prequalChecklist: { experience: 24, financial: 18, safety: 17, references: 15 }, prequalDate: "2025-10-20", insuranceExpiry: "2027-06-30", compFundExpiry: "2026-12-31", workers: 14, since: "2022-07-22" },
  { name: "ห้างหุ้นส่วนจำกัด ฉาบเรียบ การช่าง", supplier: "ห้างหุ้นส่วนจำกัด ฉาบเรียบ การช่าง", trades: ["งานก่ออิฐ/ฉาบ", "งานกระเบื้อง"], prequal: "approved", prequalChecklist: { experience: 26, financial: 17, safety: 16, references: 18 }, prequalDate: "2025-06-12", insuranceExpiry: "2027-02-28", compFundExpiry: "2026-12-31", workers: 32, since: "2021-03-08" },
  { name: "นายวีรชัย ศรีสวัสดิ์ (ทีมช่างสี)", supplier: "นายวีรชัย ศรีสวัสดิ์ (ทีมช่างสี)", trades: ["งานสี"], prequal: "approved", prequalChecklist: { experience: 20, financial: 12, safety: 17, references: 18 }, prequalDate: "2026-02-20", insuranceExpiry: "2026-10-31", workers: 8, since: "2023-06-01", note: "ประกันอุบัติเหตุทีมช่างหมดอายุ 31 ต.ค. 69 รอหลักฐานต่ออายุ" },
  { name: "บริษัท เย็นฉ่ำ แอร์ เซอร์วิส จำกัด", supplier: "บริษัท เย็นฉ่ำ แอร์ เซอร์วิส จำกัด", trades: ["งานปรับอากาศ"], prequal: "approved", prequalChecklist: { experience: 24, financial: 20, safety: 20, references: 17 }, prequalDate: "2025-09-15", insuranceExpiry: "2027-04-30", compFundExpiry: "2026-12-31", workers: 12, since: "2022-11-11" },
  { name: "ห้างหุ้นส่วนจำกัด ฐานรากแกร่ง", taxId: tax("013356600812"), contact: "คุณมานพ แกร่งกล้า", phone: "081-447-2290", trades: ["งานฐานราก/เสาเข็ม"], prequal: "pending", prequalChecklist: { experience: 18, financial: 12, safety: 14, references: 9 }, prequalDate: "2026-10-30", insuranceExpiry: "2027-01-31", workers: 18, since: "2026-10-28", note: "ยื่นเอกสารครบ รอตรวจสอบผลงานอ้างอิง 2 โครงการ" },
  { name: "บริษัท แสงทอง อะลูมิเนียม จำกัด", taxId: tax("010555902216"), contact: "คุณกิตติ แสงทอง", phone: "02-918-3340", trades: ["งานอลูมิเนียม/กระจก"], prequal: "approved", prequalChecklist: { experience: 23, financial: 19, safety: 18, references: 16 }, prequalDate: "2025-12-02", insuranceExpiry: "2026-11-30", compFundExpiry: "2026-12-31", workers: 15, since: "2024-01-10" },
  { name: "บริษัท กันซึมโปร จำกัด", taxId: tax("010556100437"), contact: "คุณอำนาจ ทองสุข", phone: "089-221-4478", trades: ["งานกันซึม"], prequal: "suspended", prequalChecklist: { experience: 19, financial: 10, safety: 9, references: 8 }, prequalDate: "2026-07-14", insuranceExpiry: "2026-06-30", workers: 7, since: "2023-08-20", note: "ระงับชั่วคราว: งานกันซึมดาดฟ้าโครงการ HC-2025-01 รั่วซ้ำ 2 ครั้ง และไม่ส่งหลักฐานประกันภัยฉบับใหม่" },
  { name: "นายบุญมา ช่างกระเบื้อง", taxId: tax("350010042871"), contact: "นายบุญมา ศรีจันทร์", phone: "086-334-9012", trades: ["งานกระเบื้อง"], prequal: "blacklisted", prequalChecklist: { experience: 14, financial: 6, safety: 8, references: 4 }, prequalDate: "2026-04-02", workers: 4, since: "2024-05-01", note: "ห้ามใช้: ทิ้งงานกลางคันที่โครงการ HC-2026-02 และเบิกค่าแรงล่วงหน้าเกินผลงาน" },
];

function seedSubcontractors(): SubcontractorX[] {
  return SUB_RAW.map(({ supplier, ...r }, i) => {
    const s = supplier ? sup(supplier) : undefined;
    const score = sum(Object.values(r.prequalChecklist ?? {}));
    return {
      ...r,
      id: `SUB-${String(i + 1).padStart(4, "0")}`,
      taxId: r.taxId ?? s?.taxId,
      contact: r.contact ?? s?.contact ?? "",
      phone: r.phone ?? s?.phone ?? "",
      address: s?.address,
      email: s?.email,
      supplierId: s?.id,
      prequalScore: Math.round(score),
      ratings: [],
    } as SubcontractorX;
  });
}

// ---------- subcontracts and their payment certificates ----------

type ScLine = [description: string, qty: number, unit: string, rate: number];
type ScRaw = {
  projectId: string;
  sub: number; // index in SUB_RAW (1-based)
  title: string;
  costCode: CostCode;
  lines: ScLine[];
  retentionPct: number;
  advancePct: number;
  start: string;
  finish: string;
  status: Subcontract["status"];
  completedAt?: string;
  /** cumulative fraction measured per certificate: [periodTo, fraction, status] */
  certs: [string, number, CertX["status"]][];
  backCharges?: [date: string, reason: string, amount: number, certNo: number][];
  overMeasureLine?: number; // line index measured above contract qty on the last cert
  /** keep the rates even when the subcontract exceeds the cost-code budget (demo of the over-budget alert) */
  overBudget?: boolean;
  rating?: { quality: number; time: number; safety: number; cooperation: number; note: string };
};
const SC_RAW: ScRaw[] = [
  {
    projectId: "HC-2025-03", sub: 1, title: "งานโครงสร้าง คสล. อาคาร 6 ชั้น (ค่าแรงและวัสดุสิ้นเปลือง)", costCode: "03", retentionPct: 5, advancePct: 10, start: "2025-10-15", finish: "2026-09-30", status: "completed", completedAt: "2026-09-30",
    lines: [["งานเสาเข็มตัดหัวและฐานราก", 1, "งาน", 1450000], ["งานเสาและผนัง คสล.", 620, "ลบ.ม.", 5200], ["งานคานและพื้น คสล. ชั้น 2–ดาดฟ้า", 1480, "ลบ.ม.", 4600], ["งานบันไดและช่องลิฟต์", 1, "งาน", 980000], ["งานแบบหล่อและค้ำยัน", 8600, "ตร.ม.", 420]],
    certs: [["2025-12-31", 0.22, "paid"], ["2026-03-31", 0.55, "paid"], ["2026-06-30", 0.86, "paid"], ["2026-09-30", 1, "certified"]],
    backCharges: [["2026-06-18", "ค่าทำความสะอาดเศษคอนกรีตและไม้แบบที่ทิ้งค้างชั้น 3–4", 18500, 3], ["2026-09-12", "ค่าเหล็กเสริมที่บริษัทจัดหาแทนเนื่องจากผู้รับเหมาสั่งไม่ทัน", 64200, 4]],
    rating: { quality: 4, time: 3, safety: 4, cooperation: 4, note: "งานโครงสร้างได้มาตรฐาน ล่าช้าช่วงพื้นชั้น 5 ประมาณ 2 สัปดาห์" },
  },
  {
    projectId: "HC-2025-03", sub: 2, title: "งานระบบไฟฟ้าและสื่อสารอาคาร", costCode: "06", retentionPct: 5, advancePct: 0, start: "2026-05-15", finish: "2027-05-15", status: "active",
    lines: [["งานเดินท่อร้อยสายและสายไฟห้องชุด", 64, "ห้อง", 42000], ["งานตู้ไฟฟ้าหลักและสายป้อน", 1, "งาน", 1280000], ["งานไฟฟ้าแสงสว่างส่วนกลาง", 1, "งาน", 860000], ["งานระบบสื่อสารและกล้องวงจรปิด", 1, "งาน", 720000]],
    certs: [["2026-08-31", 0.18, "paid"], ["2026-10-31", 0.36, "certified"]],
  },
  {
    projectId: "HC-2025-03", sub: 5, title: "งานหลังคาและกันซึมดาดฟ้า", costCode: "05", retentionPct: 5, advancePct: 0, start: "2026-09-01", finish: "2026-12-31", status: "active",
    lines: [["งานโครงหลังคาเหล็กและเมทัลชีท", 640, "ตร.ม.", 1850], ["งานกันซึมดาดฟ้าระบบโพลียูรีเทน", 720, "ตร.ม.", 620], ["งานรางน้ำและท่อระบายน้ำฝน", 1, "งาน", 168000]],
    certs: [["2026-10-31", 0.42, "submitted"]],
  },
  {
    projectId: "HC-2025-03", sub: 6, title: "งานก่ออิฐ ฉาบปูน และปูกระเบื้องห้องชุด", costCode: "04", retentionPct: 5, advancePct: 5, start: "2026-04-01", finish: "2027-03-31", status: "active",
    lines: [["งานก่ออิฐมวลเบา", 9200, "ตร.ม.", 165], ["งานฉาบปูนภายใน-ภายนอก", 17600, "ตร.ม.", 120], ["งานปูกระเบื้องพื้นและผนังห้องน้ำ", 4100, "ตร.ม.", 210]],
    certs: [["2026-06-30", 0.15, "paid"], ["2026-08-31", 0.38, "paid"], ["2026-10-31", 0.55, "draft"]],
    backCharges: [["2026-08-22", "ค่าแก้ไขผนังฉาบไม่ได้ดิ่ง ชั้น 2 (จ้างทีมอื่นแก้)", 26800, 2]],
  },
  {
    projectId: "HC-2026-03", sub: 1, title: "งานโครงสร้าง คสล. อาคาร 4 ชั้น", costCode: "03", retentionPct: 5, advancePct: 10, start: "2026-04-01", finish: "2026-10-31", status: "active",
    lines: [["งานฐานรากและคานคอดิน", 1, "งาน", 420000], ["งานเสา คาน พื้น คสล.", 260, "ลบ.ม.", 5100], ["งานบันได คสล.", 1, "งาน", 165000], ["งานแบบหล่อ", 2400, "ตร.ม.", 410]],
    certs: [["2026-06-30", 0.4, "paid"], ["2026-09-30", 0.82, "certified"]],
  },
  {
    projectId: "HC-2026-01", sub: 7, title: "งานสีภายในและภายนอก", costCode: "11", retentionPct: 5, advancePct: 0, start: "2026-09-20", finish: "2026-11-30", status: "active",
    lines: [["งานสีภายนอก รองพื้นและทับหน้า 2 เที่ยว", 380, "ตร.ม.", 145], ["งานสีภายใน", 720, "ตร.ม.", 105], ["งานสีฝ้าและบัว", 240, "ตร.ม.", 95]],
    certs: [["2026-10-31", 0.6, "certified"]],
  },
  {
    projectId: "HC-2026-02", sub: 3, title: "งานระบบไฟฟ้าภายในบ้าน", costCode: "06", retentionPct: 5, advancePct: 0, start: "2026-07-01", finish: "2026-11-30", status: "active",
    lines: [["งานเดินท่อร้อยสายฝังผนัง", 1, "งาน", 68000], ["งานจุดไฟฟ้า สวิตช์ ปลั๊ก", 96, "จุด", 850], ["งานตู้ควบคุมและสายเมน", 1, "งาน", 42000], ["งานติดตั้งดวงโคม", 54, "จุด", 380]],
    certs: [["2026-08-31", 0.45, "paid"], ["2026-10-31", 0.92, "submitted"]],
    overMeasureLine: 1,
    overBudget: true,
  },
  {
    projectId: "HC-2026-04", sub: 5, title: "งานหลังคาและฉนวนกันความร้อน", costCode: "05", retentionPct: 5, advancePct: 0, start: "2026-11-15", finish: "2027-01-15", status: "draft",
    lines: [["งานโครงหลังคาเหล็กกล่อง", 210, "ตร.ม.", 680], ["งานมุงกระเบื้องคอนกรีต", 210, "ตร.ม.", 290], ["งานฉนวนใยแก้ว 6 นิ้ว", 190, "ตร.ม.", 120]],
    certs: [],
  },
  {
    projectId: "HC-2026-05", sub: 4, title: "งานระบบประปาและสุขาภิบาล", costCode: "07", retentionPct: 5, advancePct: 0, start: "2026-10-15", finish: "2027-01-31", status: "active",
    lines: [["งานท่อน้ำดีและน้ำทิ้ง", 1, "งาน", 72000], ["งานติดตั้งสุขภัณฑ์", 9, "ชุด", 2400], ["งานถังบำบัดและบ่อพัก", 1, "งาน", 36000]],
    certs: [],
  },
  {
    projectId: "HC-2025-04", sub: 8, title: "งานติดตั้งเครื่องปรับอากาศและท่อน้ำยา", costCode: "08", retentionPct: 5, advancePct: 0, start: "2026-08-15", finish: "2026-10-20", status: "completed", completedAt: "2026-10-20",
    lines: [["งานเดินท่อน้ำยาและท่อน้ำทิ้ง", 6, "ชุด", 14500], ["งานติดตั้งเครื่องปรับอากาศ", 6, "เครื่อง", 3800], ["งานไฟฟ้าสำหรับแอร์", 6, "จุด", 2200]],
    certs: [["2026-09-30", 0.5, "paid"], ["2026-10-20", 1, "paid"]],
    rating: { quality: 5, time: 5, safety: 4, cooperation: 5, note: "งานเรียบร้อย ตรงเวลา ทดสอบระบบผ่านครั้งแรก" },
  },
  {
    projectId: "HC-2025-01", sub: 6, title: "งานก่ออิฐ ฉาบปูน และปูกระเบื้อง", costCode: "04", retentionPct: 5, advancePct: 0, start: "2025-06-01", finish: "2025-11-20", status: "completed", completedAt: "2025-11-20",
    lines: [["งานก่ออิฐมวลเบา", 420, "ตร.ม.", 160], ["งานฉาบปูน", 860, "ตร.ม.", 115], ["งานปูกระเบื้อง", 230, "ตร.ม.", 205]],
    certs: [["2025-08-31", 0.45, "paid"], ["2025-11-20", 1, "paid"]],
    rating: { quality: 4, time: 4, safety: 4, cooperation: 4, note: "งานดี ต้องเก็บรายละเอียดมุมกระเบื้องห้องน้ำ" },
  },
];

/** Budget of a cost code as the sales module seeds it (value × (1 − margin) split by the model's BOQ). */
function budgetOf(projectId: string, code: CostCode) {
  const p = proj(projectId);
  if (!p) return 0;
  const lines = budgetLinesFrom(modelBoq(p.modelCode), baseValue(projectId) * (1 - plannedMargin(projectId) / 100));
  return sum(lines.filter((l) => l.costCode === code).map((l) => l.amount));
}

type ScSeed = { subcontracts: SubcontractX[]; certs: CertX[]; ratings: Map<number, SubcontractorX["ratings"]> };
let scCache: ScSeed | null = null;
function scSeed(): ScSeed {
  if (scCache) return scCache;
  const subcontracts: SubcontractX[] = [];
  const certs: CertX[] = [];
  const ratings = new Map<number, SubcontractorX["ratings"]>();
  SC_RAW.forEach((r, i) => {
    const id = `SC-${r.start.slice(0, 4)}-${String(i + 1).padStart(4, "0")}`;
    // subcontract rates sized to about 80% of the cost-code budget, so the demo budgets are not overrun
    const raw = sum(r.lines.map(([, qty, , rate]) => qty * rate));
    const cap = 0.8 * budgetOf(r.projectId, r.costCode);
    const k = !r.overBudget && cap > 0 && raw > cap ? cap / raw : 1;
    const lines = r.lines.map(([description, qty, unit, rate], j) => ({ id: `${id}-L${j + 1}`, description, qty, unit, rate: k < 1 ? Math.max(1, Math.round(rate * k)) : rate, costCode: r.costCode }));
    const value = subcontractValue(lines);
    const s = SUB_RAW[r.sub - 1];
    const supplier = s.supplier ? sup(s.supplier) : undefined;
    const vat = supplier ? supplier.vatRegistered : true;
    const advance = r2((value * r.advancePct) / 100);
    const backCharges: BackCharge[] = (r.backCharges ?? []).map(([date, reason, amount, certNo], k) => ({ id: `BC-${id}-${k + 1}`, date, reason, amount, certId: `SPC-${id}-${certNo}` }));
    subcontracts.push({
      id,
      projectId: r.projectId,
      subcontractorId: `SUB-${String(r.sub).padStart(4, "0")}`,
      title: r.title,
      lines,
      value,
      retentionPct: r.retentionPct,
      advance,
      whtRate: 3,
      vat,
      start: r.start,
      finish: r.finish,
      status: r.status,
      signedAt: r.status === "draft" ? undefined : addDaysIso(r.start, -10),
      costCode: r.costCode,
      backCharges,
      completedAt: r.completedAt,
      defectsMonths: 12,
    });
    let prev = 0,
      retBefore = 0,
      advBefore = 0;
    r.certs.forEach(([periodTo, frac, status], k) => {
      const no = k + 1;
      const last = k === r.certs.length - 1;
      const measured = lines.map((l, j) => {
        const f = frac >= 1 ? 1 : Math.min(1, frac * (0.85 + ((j * 7 + no * 3) % 6) * 0.06));
        const over = last && r.overMeasureLine === j ? 1.12 : 1;
        return { lineId: l.id, qtyToDate: Math.round(l.qty * Math.max(f, over > 1 ? over : f) * 100) / 100 };
      });
      const gross = Math.max(prev, Math.round(measuredGross(lines, measured)));
      const certId = `SPC-${id}-${no}`;
      const bcs = backCharges.filter((b) => b.certId === certId);
      const c = certCalc({ grossToDate: gross, previous: prev, contractValue: value, retentionPct: r.retentionPct, retentionCapPct: r.retentionPct, retentionBefore: retBefore, advance, advanceBefore: advBefore, backCharges: sum(bcs.map((b) => b.amount)), vatRate: vat ? 7 : 0, whtRate: 3, whtOnRetention: true });
      const date = addDaysIso(periodTo, 4);
      const billed = status === "certified" || status === "paid";
      certs.push({
        id: certId,
        projectId: r.projectId,
        side: "sub",
        subcontractId: id,
        no,
        periodTo,
        date,
        grossToDate: gross,
        previous: prev,
        thisPeriod: c.thisPeriod,
        retention: c.retention,
        advanceRecovery: c.advanceRecovery,
        backCharges: c.backCharges,
        vat: c.vat,
        wht: c.wht,
        net: c.net,
        status,
        certifiedBy: billed ? (proj(r.projectId)?.pm ?? "") : undefined,
        paidDate: status === "paid" ? minIso(addDaysIso(date, 15), addDaysIso(TODAY, -1)) : undefined,
        lines: measured,
        backChargeItems: bcs,
        retentionPct: r.retentionPct,
        whtRate: 3,
        vatRate: vat ? 7 : 0,
        contractValue: value,
        submittedAt: addDaysIso(periodTo, 1),
        certifiedAt: billed ? date : undefined,
        dueDate: addDaysIso(date, 30),
      });
      prev = gross;
      retBefore = c.retentionToDate;
      advBefore = c.advanceToDate;
    });
    if (r.rating && r.completedAt) {
      const list = ratings.get(r.sub) ?? [];
      list.push({ subcontractId: id, date: r.completedAt, ...r.rating, by: proj(r.projectId)?.pm ?? "" });
      ratings.set(r.sub, list);
    }
  });
  scCache = { subcontracts, certs, ratings };
  return scCache;
}

function seedSubcontractorsWithRatings(): SubcontractorX[] {
  const { ratings } = scSeed();
  return seedSubcontractors().map((s, i) => ({ ...s, ratings: ratings.get(i + 1) ?? [] }));
}

provideSeed("variations", seedVariations);
provideSeed("subcontractors", seedSubcontractorsWithRatings);
provideSeed("subcontracts", () => scSeed().subcontracts);
provideSeed("payment_certs", () => [...clientCerts(), ...scSeed().certs]);
