// Demo tenders, Factor F table, ค่า K formulas and monthly indices (fictional demo values).

import type { BoqLine, KFormula, Tender, TenderSettings } from "./types";

// Building-work Factor F (example table: advance 15%, retention 0%, interest 7%, VAT 7%).
// Demo values only — replace with the current table of กรมบัญชีกลาง.
const FACTOR_TABLE = [
  { cost: 500_000, factor: 1.3052 },
  { cost: 1_000_000, factor: 1.2941 },
  { cost: 2_000_000, factor: 1.2827 },
  { cost: 5_000_000, factor: 1.2685 },
  { cost: 10_000_000, factor: 1.2554 },
  { cost: 20_000_000, factor: 1.2443 },
  { cost: 50_000_000, factor: 1.2318 },
  { cost: 100_000_000, factor: 1.2236 },
  { cost: 200_000_000, factor: 1.2163 },
  { cost: 500_000_000, factor: 1.2101 },
];

// The building-work family from the price-adjustment conditions (สัญญาแบบปรับราคาได้).
export const K_FORMULAS: KFormula[] = [
  {
    id: "K-BLD",
    name: "งานอาคาร",
    constant: 0.25,
    terms: [
      { sym: "I", coef: 0.15 },
      { sym: "C", coef: 0.1 },
      { sym: "M", coef: 0.4 },
      { sym: "S", coef: 0.1 },
    ],
  },
  {
    id: "K-EARTH",
    name: "งานดิน",
    constant: 0.3,
    terms: [
      { sym: "I", coef: 0.1 },
      { sym: "E", coef: 0.4 },
      { sym: "F", coef: 0.2 },
    ],
  },
  {
    id: "K-STRUCT",
    name: "งานโครงสร้างคอนกรีตเสริมเหล็ก",
    constant: 0.3,
    terms: [
      { sym: "I", coef: 0.1 },
      { sym: "C", coef: 0.15 },
      { sym: "M", coef: 0.2 },
      { sym: "S", coef: 0.25 },
    ],
  },
  {
    id: "K-PIPE",
    name: "งานวางท่อ",
    constant: 0.4,
    terms: [
      { sym: "I", coef: 0.1 },
      { sym: "M", coef: 0.15 },
      { sym: "E", coef: 0.1 },
      { sym: "G", coef: 0.25 },
    ],
  },
];

function indices(): TenderSettings["indices"] {
  const out: TenderSettings["indices"] = {};
  const base = { I: 107.8, C: 114.2, M: 126.4, S: 138.5, E: 117.6, F: 152.0, A: 141.0, G: 121.5 };
  const drift = { I: 0.35, C: 1.0, M: 2.0, S: 4.0, E: 0.5, F: -1.2, A: 0.8, G: 0.7 };
  for (let i = 0; i < 16; i++) {
    const d = new Date(Date.UTC(2025, 6 + i, 1)).toISOString().slice(0, 7);
    const wave = Math.sin(i * 1.3) * 0.4;
    out[d] = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round((v + drift[k as keyof typeof drift] * i + wave * (k === "S" ? 2 : 1)) * 10) / 10]));
  }
  return out;
}

export function defaultSettings(): TenderSettings {
  return {
    id: "tender",
    factorTable: FACTOR_TABLE,
    factorBasis: "งานอาคาร · เงินล่วงหน้า 15% · เงินประกันผลงานหัก 0% · ดอกเบี้ยเงินกู้ 7% · VAT 7%",
    kFormulas: K_FORMULAS,
    kThresholdPct: 4,
    kDecimals: 3,
    kClaimDays: 90,
    penaltyRatePct: 0.1,
    penaltyMinPerDay: 100,
    bidBondPct: 5,
    perfBondPct: 5,
    indices: indices(),
  };
}

// ---------- BOQ template ----------

const BASE: Omit<BoqLine, "id">[] = [
  { group: "งานเตรียมการ", description: "งานรื้อถอน ปรับพื้นที่ และวางผัง", qty: 1, unit: "งาน", material: 15000, labour: 10000 },
  { group: "งานโครงสร้าง", description: "เสาเข็มคอนกรีตอัดแรง I-0.22 ยาว 18 ม.", qty: 24, unit: "ต้น", material: 4200, labour: 800 },
  { group: "งานโครงสร้าง", description: "คอนกรีตโครงสร้าง 240 ksc", qty: 60, unit: "ลบ.ม.", material: 2350, labour: 450 },
  { group: "งานโครงสร้าง", description: "เหล็กเสริม SD40 / SR24", qty: 6000, unit: "กก.", material: 24, labour: 4 },
  { group: "งานโครงสร้าง", description: "ไม้แบบและค้ำยัน", qty: 380, unit: "ตร.ม.", material: 180, labour: 120 },
  { group: "งานสถาปัตยกรรม", description: "ผนังก่ออิฐมวลเบา ฉาบเรียบ 2 ด้าน", qty: 520, unit: "ตร.ม.", material: 390, labour: 210 },
  { group: "งานสถาปัตยกรรม", description: "พื้นกระเบื้องแกรนิตโต้ 60×60 ซม.", qty: 300, unit: "ตร.ม.", material: 520, labour: 160 },
  { group: "งานสถาปัตยกรรม", description: "ฝ้าเพดานยิปซัมบอร์ด 9 มม. โครงเคร่าชุบสังกะสี", qty: 300, unit: "ตร.ม.", material: 260, labour: 120 },
  { group: "งานสถาปัตยกรรม", description: "งานสีอะครีลิกภายในและภายนอก", qty: 1100, unit: "ตร.ม.", material: 55, labour: 45 },
  { group: "งานสถาปัตยกรรม", description: "ประตูหน้าต่างอะลูมิเนียมพร้อมกระจก", qty: 1, unit: "ชุด", material: 180000, labour: 30000 },
  { group: "งานสถาปัตยกรรม", description: "หลังคาเมทัลชีทพร้อมโครงเหล็กและฉนวน", qty: 340, unit: "ตร.ม.", material: 650, labour: 200 },
  { group: "งานระบบไฟฟ้า", description: "ระบบไฟฟ้าแสงสว่าง เต้ารับ และตู้ควบคุม", qty: 1, unit: "งาน", material: 150000, labour: 60000 },
  { group: "งานระบบสุขาภิบาล", description: "ระบบประปา สุขาภิบาล และสุขภัณฑ์", qty: 1, unit: "งาน", material: 120000, labour: 50000 },
];
const BASE_COST = BASE.reduce((s, l) => s + l.qty * (l.material + l.labour), 0);

export function boqTemplate(targetDirect: number, withFurniture = false): BoqLine[] {
  const k = targetDirect / BASE_COST;
  const lines: BoqLine[] = BASE.map((l, i) =>
    l.unit === "งาน" || l.unit === "ชุด"
      ? { ...l, id: `L${i + 1}`, material: Math.round(l.material * k), labour: Math.round(l.labour * k) }
      : { ...l, id: `L${i + 1}`, qty: Math.max(1, Math.round(l.qty * k)) },
  );
  if (withFurniture) lines.push({ id: `L${lines.length + 1}`, group: "ครุภัณฑ์", description: "ครุภัณฑ์ติดตั้งเคลื่อนที่ได้ (ไม่คูณ Factor F)", qty: 1, unit: "ชุด", material: Math.round(targetDirect * 0.02), labour: 0, noF: true });
  return lines;
}

// ---------- tenders ----------

export function seedTenders(): Tender[] {
  const T = (x: Partial<Tender> & Pick<Tender, "id" | "title" | "client" | "source" | "status" | "submitDue" | "province">, direct: number): Tender => ({
    method: x.source === "egp" ? "e-bidding" : "invitation",
    owner: "ปริญญา ราคาดี",
    docs: [],
    lines: boqTemplate(direct, x.source === "egp"),
    markupPct: x.source === "egp" ? 6 : 15,
    vatPct: 7,
    createdAt: x.announced ?? x.submitDue,
    ...x,
  });
  return [
    T(
      {
        id: "TD-2026-0001",
        title: "ก่อสร้างอาคารเรียน 3 ชั้น 12 ห้องเรียน",
        client: "โรงเรียนบ้านหนองบัว สำนักงานเขตพื้นที่การศึกษา (ตัวอย่าง)",
        source: "egp",
        egpNo: "69039876543",
        province: "นนทบุรี",
        budget: 14_500_000,
        medianPrice: 14_212_000,
        status: "won",
        announced: "2026-03-20",
        siteVisit: "2026-03-30",
        questionsDue: "2026-04-03",
        submitDue: "2026-04-10",
        openDate: "2026-04-11",
        bidBond: { type: "bank", bank: "ธนาคารตัวอย่างไทย สาขางามวงศ์วาน", ref: "LG-26-0411", amount: 725_000, issue: "2026-04-08", expiry: "2026-08-08", returned: "2026-06-20" },
        bidPrice: 13_380_000,
        result: {
          date: "2026-05-02",
          competitors: [
            { name: "บริษัทของเรา", price: 13_380_000, winner: true },
            { name: "หจก. ศรีนนท์ก่อสร้าง", price: 13_590_000 },
            { name: "บจ. ไทยรุ่งเรืองวิศวกรรม", price: 13_845_000 },
            { name: "หจก. ส.สมบูรณ์โยธา", price: 14_020_000 },
          ],
        },
        award: {
          contractNo: "สัญญาเลขที่ 12/2569",
          value: 13_380_000,
          signDate: "2026-06-15",
          start: "2026-06-20",
          finish: "2027-03-16",
          perfBond: { type: "bank", bank: "ธนาคารตัวอย่างไทย สาขางามวงศ์วาน", ref: "LG-26-0615", amount: 669_000, issue: "2026-06-12", expiry: "2029-03-16" },
          penaltyRatePct: 0.1,
          penaltyMinPerDay: 100,
          adjustable: true,
          kFormulaId: "K-BLD",
          kBaseMonth: "2026-04",
          installments: [
            { no: 1, month: "2026-07", amount: 1_250_467, paidDate: "2026-08-12" },
            { no: 2, month: "2026-08", amount: 1_875_701, paidDate: "2026-09-15" },
            { no: 3, month: "2026-10", amount: 2_500_935, paidDate: "2026-10-30" },
            { no: 4, month: "2026-12", amount: 2_500_935 },
            { no: 5, month: "2027-02", amount: 2_500_935 },
            { no: 6, month: "2027-03", amount: 1_875_701 },
          ],
        },
      },
      9_900_000,
    ),
    T(
      {
        id: "TD-2026-0002",
        title: "ปรับปรุงอาคารสำนักงานเทศบาล 2 ชั้น",
        client: "เทศบาลเมืองตัวอย่าง",
        source: "egp",
        egpNo: "69109912345",
        province: "นนทบุรี",
        budget: 4_800_000,
        medianPrice: 4_735_000,
        status: "submitted",
        announced: "2026-10-01",
        siteVisit: "2026-10-09",
        questionsDue: "2026-10-16",
        submitDue: "2026-10-28",
        openDate: "2026-11-10",
        bidBond: { type: "eguarantee", bank: "ธนาคารตัวอย่างไทย", ref: "eLG-69-10288", amount: 240_000, issue: "2026-10-26", expiry: "2027-02-25" },
        bidPrice: 4_498_000,
      },
      3_420_000,
    ),
    T(
      {
        id: "TD-2026-0003",
        title: "บ้านพักอาศัย 2 ชั้น พื้นที่ 320 ตร.ม.",
        client: "คุณวิโรจน์ ทรัพย์มาก",
        source: "private",
        province: "กรุงเทพฯ",
        status: "preparing",
        announced: "2026-10-25",
        siteVisit: "2026-11-05",
        questionsDue: "2026-11-06",
        submitDue: "2026-11-09",
        torNote: "แบบสถาปัตย์และโครงสร้างครบ ยังไม่มีแบบงานระบบ เจ้าของต้องการส่งมอบภายใน 10 เดือน",
      },
      6_100_000,
    ),
    T(
      {
        id: "TD-2026-0004",
        title: "อาคารคลังสินค้า 1,200 ตร.ม. พร้อมสำนักงาน",
        client: "บจ. สยามโลจิสติกส์ (ตัวอย่าง)",
        source: "private",
        province: "สมุทรปราการ",
        status: "preparing",
        announced: "2026-10-20",
        siteVisit: "2026-10-30",
        submitDue: "2026-11-20",
      },
      18_500_000,
    ),
    T(
      {
        id: "TD-2026-0005",
        title: "ก่อสร้างอาคารศูนย์พัฒนาเด็กเล็ก ขนาด 100 คน",
        client: "องค์การบริหารส่วนตำบลตัวอย่าง",
        source: "egp",
        egpNo: "69059988776",
        province: "ปทุมธานี",
        budget: 3_200_000,
        medianPrice: 3_164_000,
        status: "lost",
        announced: "2026-05-10",
        submitDue: "2026-05-29",
        openDate: "2026-06-01",
        bidPrice: 2_980_000,
        result: {
          date: "2026-06-15",
          reason: "ราคาสูงกว่าผู้ชนะ 4.4%",
          competitors: [
            { name: "หจก. ปทุมการโยธา", price: 2_855_000, winner: true },
            { name: "บริษัทของเรา", price: 2_980_000 },
            { name: "บจ. เอเชียบิลด์", price: 3_050_000 },
          ],
        },
      },
      2_240_000,
    ),
    T(
      {
        id: "TD-2026-0006",
        title: "ก่อสร้างถนนคอนกรีตเสริมเหล็ก หมู่ 5",
        client: "องค์การบริหารส่วนตำบลตัวอย่าง",
        source: "egp",
        province: "อยุธยา",
        budget: 2_100_000,
        status: "nobid",
        submitDue: "2026-07-20",
        torNote: "งานทาง ไม่ตรงกับประเภทงานของบริษัท",
      },
      1_500_000,
    ),
    T(
      {
        id: "TD-2025-0011",
        title: "อาคารพาณิชย์ 4 ชั้น 4 คูหา",
        client: "คุณสมพงษ์ เจริญทรัพย์",
        source: "private",
        province: "นนทบุรี",
        status: "won",
        submitDue: "2025-12-05",
        bidPrice: 11_950_000,
        result: {
          date: "2025-12-20",
          competitors: [
            { name: "บริษัทของเรา", price: 11_950_000, winner: true },
            { name: "บจ. นนท์พัฒนาการ", price: 12_400_000 },
          ],
        },
      },
      9_000_000,
    ),
    T(
      {
        id: "TD-2026-0007",
        title: "รีโนเวทบ้านเดี่ยว 2 ชั้น ต่อเติมครัวและห้องนอน",
        client: "คุณนวลจันทร์ ใจงาม",
        source: "private",
        province: "กรุงเทพฯ",
        status: "lost",
        submitDue: "2026-08-14",
        bidPrice: 1_870_000,
        result: { date: "2026-08-30", reason: "ลูกค้าเลือกผู้รับเหมาที่ให้ระยะเวลาสั้นกว่า", competitors: [{ name: "บริษัทของเรา", price: 1_870_000 }, { name: "ช่างรายย่อย (ไม่ระบุ)", price: 1_640_000, winner: true }] },
      },
      1_420_000,
    ),
    T(
      {
        id: "TD-2026-0008",
        title: "ก่อสร้างอาคารที่ทำการ อบต. 2 ชั้น",
        client: "องค์การบริหารส่วนตำบลบางตัวอย่าง",
        source: "egp",
        province: "นครปฐม",
        budget: 8_600_000,
        status: "prospect",
        announced: "2026-11-02",
        siteVisit: "2026-11-12",
        questionsDue: "2026-11-18",
        submitDue: "2026-12-02",
      },
      6_250_000,
    ),
    T(
      {
        id: "TD-2026-0009",
        title: "ก่อสร้างอาคารผู้ป่วยนอก โรงพยาบาลส่งเสริมสุขภาพตำบล",
        client: "สำนักงานสาธารณสุขจังหวัด (ตัวอย่าง)",
        source: "egp",
        egpNo: "69019911223",
        province: "ปทุมธานี",
        budget: 5_600_000,
        medianPrice: 5_540_000,
        status: "won",
        submitDue: "2026-01-20",
        openDate: "2026-01-21",
        bidPrice: 5_210_000,
        result: { date: "2026-02-05", competitors: [{ name: "บริษัทของเรา", price: 5_210_000, winner: true }, { name: "หจก. รุ่งโรจน์ก่อสร้าง", price: 5_380_000 }] },
        award: {
          contractNo: "สัญญาเลขที่ 3/2569",
          value: 5_210_000,
          signDate: "2026-02-20",
          start: "2026-03-01",
          finish: "2026-10-27",
          perfBond: { type: "bank", bank: "ธนาคารตัวอย่างไทย สาขารังสิต", ref: "LG-26-0220", amount: 260_500, issue: "2026-02-18", expiry: "2026-12-10" },
          penaltyRatePct: 0.1,
          penaltyMinPerDay: 100,
          adjustable: true,
          kFormulaId: "K-BLD",
          kBaseMonth: "2026-01",
          installments: [
            { no: 1, month: "2026-04", amount: 1_217_290, paidDate: "2026-05-08", claimedDate: "2026-05-20" },
            { no: 2, month: "2026-06", amount: 1_460_748, paidDate: "2026-07-10" },
            { no: 3, month: "2026-08", amount: 1_460_748, paidDate: "2026-09-04" },
            { no: 4, month: "2026-11", amount: 730_374 },
          ],
        },
      },
      3_900_000,
    ),
  ];
}
