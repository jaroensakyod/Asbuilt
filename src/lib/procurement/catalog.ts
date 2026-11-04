// Procurement master data: supplier categories, item master, suppliers.
// Pure data (no React, no collections) so server code (generateStaticParams)
// and the seed generator can import it. All companies and people are fictional.

import type { CostCode } from "../biz";

// ---------- categories ----------

export const CATEGORIES = {
  cement: "ปูนซีเมนต์/ปูนสำเร็จรูป",
  readymix: "คอนกรีตผสมเสร็จ",
  steel: "เหล็กเส้น/เหล็กรูปพรรณ",
  aggregate: "หิน/ทราย",
  pile: "เสาเข็ม",
  masonry: "อิฐ/บล็อก",
  roof: "หลังคา/ฉนวน",
  electrical: "วัสดุไฟฟ้า",
  plumbing: "ท่อ/วัสดุประปา",
  sanitary: "สุขภัณฑ์",
  tile: "กระเบื้อง/วัสดุปูพื้น",
  paint: "สี/กันซึม",
  doorwindow: "ประตู/หน้าต่าง",
  hvac: "เครื่องปรับอากาศ",
  wood: "ฝ้า/ยิปซัม/ไม้",
  hardware: "ฮาร์ดแวร์/เบ็ดเตล็ด",
  transport: "ขนส่ง",
  rental: "เช่าเครื่องจักร/นั่งร้าน",
  sub_struct: "ผู้รับเหมาช่วงงานโครงสร้าง",
  sub_elec: "ช่างไฟฟ้า",
  sub_plumb: "ช่างประปา",
  sub_roof: "ช่างหลังคา",
  sub_finish: "ช่างก่อ/ฉาบ/ปูกระเบื้อง/สี",
  sub_hvac: "ช่างติดตั้งแอร์",
} as const;
export type Category = keyof typeof CATEGORIES;
export const isSubCategory = (c: Category) => c.startsWith("sub_");

// ---------- item master ----------

export type StockItem = {
  id: string; // item code, e.g. "CEM-PC"
  name: string;
  unit: string;
  category: Category;
  costCode: CostCode;
  price: number; // reference unit price excl. VAT
  stock: boolean; // kept in stock locations (false = consumed on delivery, e.g. ready-mix)
  min?: number; // re-order level at the central warehouse
};

const it = (id: string, name: string, unit: string, category: Category, costCode: CostCode, price: number, stock = true, min?: number): StockItem => ({ id, name, unit, category, costCode, price, stock, min });

export const ITEMS: StockItem[] = [
  // 02 ฐานราก
  it("PILE-I18", "เสาเข็มไอ 0.18×0.18 ม. ยาว 6 ม.", "ต้น", "pile", "02", 1350, false),
  it("PILE-SP30", "เสาเข็มสปัน Ø0.30 ม. ยาว 12 ม.", "ต้น", "pile", "02", 5800, false),
  it("RMC-240", "คอนกรีตผสมเสร็จ 240 ksc (ทรงกระบอก)", "ลบ.ม.", "readymix", "02", 2150, false),
  it("RB-DB12", "เหล็กข้ออ้อย DB12 SD40 ยาว 10 ม.", "เส้น", "steel", "02", 235, true, 120),
  it("RB-RB6", "เหล็กเส้นกลม RB6 SR24 ยาว 10 ม.", "เส้น", "steel", "02", 52, true, 200),
  it("WIRE-TIE", "ลวดผูกเหล็ก เบอร์ 18", "กก.", "hardware", "02", 48, true, 60),
  it("AGG-SAND", "ทรายหยาบ", "ลบ.ม.", "aggregate", "02", 520, true),
  it("AGG-STONE", "หิน 3/4", "ลบ.ม.", "aggregate", "02", 620, true),
  // 03 โครงสร้าง
  it("RMC-280", "คอนกรีตผสมเสร็จ 280 ksc", "ลบ.ม.", "readymix", "03", 2350, false),
  it("RB-DB16", "เหล็กข้ออ้อย DB16 SD40 ยาว 10 ม.", "เส้น", "steel", "03", 415, true, 60),
  it("RB-DB20", "เหล็กข้ออ้อย DB20 SD40 ยาว 10 ม.", "เส้น", "steel", "03", 650, true),
  it("RB-RB9", "เหล็กเส้นกลม RB9 SR24 ยาว 10 ม.", "เส้น", "steel", "03", 105, true, 200),
  it("CEM-PC", "ปูนซีเมนต์ปอร์ตแลนด์ 50 กก.", "ถุง", "cement", "03", 155, true, 200),
  it("SLAB-PC", "แผ่นพื้นสำเร็จรูปอัดแรง หนา 5 ซม.", "ตร.ม.", "cement", "03", 360, false),
  it("FORM-PLY", "ไม้อัดยางแบบหล่อ 10 มม.", "แผ่น", "wood", "03", 380, true, 40),
  // 04 ก่ออิฐ/ฉาบ
  it("BRK-AAC", "อิฐมวลเบา 7.5 ซม. (G4)", "ก้อน", "masonry", "04", 26, true, 2000),
  it("CEM-AAC", "ปูนก่ออิฐมวลเบา 50 กก.", "ถุง", "cement", "04", 145, true, 100),
  it("CEM-MRT", "ปูนฉาบสำเร็จรูป 50 กก.", "ถุง", "cement", "04", 130, true, 150),
  it("LINTEL", "ทับหลัง/เสาเอ็นสำเร็จรูป", "ท่อน", "cement", "04", 85, true),
  // 05 หลังคา
  it("ROOF-CT", "กระเบื้องหลังคาคอนกรีต", "แผ่น", "roof", "05", 24, true),
  it("ROOF-MS", "แผ่นเมทัลชีท 0.35 มม.", "ม.", "roof", "05", 165, true),
  it("ROOF-TRS", "เหล็กกล่องชุบกัลวาไนซ์ 2×4 นิ้ว ยาว 6 ม.", "เส้น", "steel", "05", 380, true),
  it("ROOF-INS", "ฉนวนใยแก้ว 3 นิ้ว", "ม้วน", "roof", "05", 1250, true),
  // 06 ไฟฟ้า
  it("EL-THW25", "สายไฟ THW 2.5 ตร.มม. (100 ม.)", "ม้วน", "electrical", "06", 1450, true, 20),
  it("EL-THW4", "สายไฟ THW 4 ตร.มม. (100 ม.)", "ม้วน", "electrical", "06", 2250, true, 8),
  it("EL-EMT", "ท่อร้อยสาย EMT 1/2 นิ้ว ยาว 3 ม.", "เส้น", "electrical", "06", 68, true, 150),
  it("EL-DB", "ตู้คอนซูมเมอร์ 12 ช่อง พร้อมเมน 63A", "ตู้", "electrical", "06", 4850, true, 2),
  it("EL-CB", "เบรกเกอร์ลูกย่อย 1P", "ตัว", "electrical", "06", 240, true, 30),
  it("EL-SW", "สวิตช์/เต้ารับ พร้อมหน้ากาก", "ชุด", "electrical", "06", 145, true, 120),
  it("EL-LED", "ดาวน์ไลท์ LED 9 W", "ดวง", "electrical", "06", 245, true, 40),
  // 07 ประปา
  it("PL-PPR20", "ท่อ PPR 20 มม. PN20 ยาว 4 ม.", "เส้น", "plumbing", "07", 165, true, 60),
  it("PL-PVC4", "ท่อ PVC 4 นิ้ว ชั้น 8.5 ยาว 4 ม.", "เส้น", "plumbing", "07", 520, true, 20),
  it("PL-PVC2", "ท่อ PVC 2 นิ้ว ชั้น 8.5 ยาว 4 ม.", "เส้น", "plumbing", "07", 210, true, 60),
  it("PL-FIT", "ข้อต่อ/อุปกรณ์ท่อ (ชุดต่อจุด)", "ชุด", "plumbing", "07", 850, true, 15),
  it("PL-SEPTIC", "ถังบำบัดน้ำเสีย 1,600 ลิตร", "ใบ", "plumbing", "07", 9800, false),
  it("PL-TANK", "ถังเก็บน้ำ 2,000 ลิตร", "ใบ", "plumbing", "07", 8900, false),
  it("PL-PUMP", "ปั๊มน้ำอัตโนมัติ 250 W", "เครื่อง", "plumbing", "07", 6900, false),
  // 08 ปรับอากาศ
  it("AC-12K", "แอร์ติดผนังอินเวอร์เตอร์ 12,000 BTU", "เครื่อง", "hvac", "08", 17900, false),
  it("AC-18K", "แอร์ติดผนังอินเวอร์เตอร์ 18,000 BTU", "เครื่อง", "hvac", "08", 24500, false),
  it("AC-PIPE", "ชุดท่อทองแดง/รางครอบท่อ", "ชุด", "hvac", "08", 2400, true),
  // 09 ประตู/หน้าต่าง
  it("DW-ALU", "หน้าต่างอะลูมิเนียมบานเลื่อน พร้อมกระจก", "ชุด", "doorwindow", "09", 6800, false),
  it("DW-SLIDE", "ประตูอะลูมิเนียมกระจกบานเลื่อน", "ชุด", "doorwindow", "09", 18500, false),
  it("DW-WOOD", "ประตูไม้จริงพร้อมวงกบ", "ชุด", "doorwindow", "09", 8500, false),
  it("DW-UPVC", "ประตู UPVC ห้องน้ำ พร้อมวงกบ", "ชุด", "doorwindow", "09", 3900, true, 4),
  it("DW-HW", "ชุดลูกบิด/บานพับสแตนเลส", "ชุด", "hardware", "09", 950, true, 15),
  // 10 ตกแต่งพื้น/ผนัง/ฝ้า
  it("TL-GR60", "กระเบื้องแกรนิตโต้ 60×60 ซม.", "ตร.ม.", "tile", "10", 420, true, 60),
  it("TL-CER", "กระเบื้องเซรามิกผนัง 30×60 ซม.", "ตร.ม.", "tile", "10", 260, true, 40),
  it("TL-ADH", "กาวซีเมนต์ปูกระเบื้อง 20 กก.", "ถุง", "tile", "10", 185, true, 80),
  it("TL-LAM", "พื้นไม้ลามิเนต 12 มม.", "ตร.ม.", "tile", "10", 390, true),
  it("WD-GYP", "แผ่นยิปซัม 9 มม. 1.20×2.40 ม.", "แผ่น", "wood", "10", 175, true, 100),
  it("WD-CLINE", "โครงซีลายฝ้า C-Line", "เส้น", "wood", "10", 52, true, 150),
  // 11 สี
  it("PT-PRM", "สีรองพื้นปูนใหม่ 18 ลิตร", "ถัง", "paint", "11", 1850, true, 6),
  it("PT-INT", "สีน้ำอะคริลิกภายใน 18 ลิตร", "ถัง", "paint", "11", 2350, true, 10),
  it("PT-EXT", "สีน้ำอะคริลิกภายนอก 18 ลิตร", "ถัง", "paint", "11", 3450, true, 10),
  it("PT-WP", "อะคริลิกกันซึม 20 กก.", "ถัง", "paint", "11", 2650, true, 6),
  // 12 สุขภัณฑ์
  it("SN-WC", "สุขภัณฑ์ชิ้นเดียว", "ชุด", "sanitary", "12", 7900, false),
  it("SN-BASIN", "อ่างล้างหน้าพร้อมก๊อก", "ชุด", "sanitary", "12", 3600, false),
  it("SN-SHOWER", "ชุดฝักบัวเรนชาวเวอร์", "ชุด", "sanitary", "12", 4800, false),
  it("SN-HEATER", "เครื่องทำน้ำอุ่น 4,500 W", "เครื่อง", "sanitary", "12", 5200, false),
  it("SN-SINK", "ซิงค์ล้างจานสแตนเลส 1 หลุม", "ชุด", "sanitary", "12", 4200, false),
  // 13 ภายนอก
  it("EX-PAVE", "บล็อกปูพื้นตัวหนอน", "ตร.ม.", "masonry", "13", 230, true),
  it("EX-FENCE", "รั้วบล็อกสำเร็จรูป", "ม.", "masonry", "13", 1650, false),
  it("EX-DRAIN", "รางระบายน้ำ คสล. พร้อมฝา", "ม.", "cement", "13", 480, false),
  // ขนส่ง / เช่า (ค่าดำเนินการ)
  it("TR-TRUCK", "ค่าขนส่งรถ 6 ล้อ", "เที่ยว", "transport", "90", 3500, false),
  it("RT-CRANE", "เช่ารถเครน 25 ตัน", "วัน", "rental", "03", 9500, false),
  it("RT-SCAF", "เช่านั่งร้าน (ชุด/เดือน)", "ชุด", "rental", "04", 450, false),
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

// ---------- Thai tax id (13 digits, mod-11 check digit) ----------

export function taxCheckDigit(first12: string) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(first12[i]) * (13 - i);
  return (11 - (s % 11)) % 10;
}
export function isValidTaxId(id: string) {
  return /^\d{13}$/.test(id) && taxCheckDigit(id.slice(0, 12)) === Number(id[12]);
}
const tax = (first12: string) => first12 + taxCheckDigit(first12);

// ---------- suppliers ----------

export type SupplierStatus = "active" | "hold" | "inactive";
export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = { active: "ใช้งาน", hold: "ระงับชั่วคราว", inactive: "เลิกใช้" };

export type Supplier = {
  id: string; // SUP-001
  name: string;
  taxId: string;
  branch: string; // "สำนักงานใหญ่" or "สาขา 00001"
  juristic: boolean; // นิติบุคคล (tax id starts with 0) or บุคคลธรรมดา
  vatRegistered: boolean;
  address: string;
  contact: string;
  phone: string;
  email?: string;
  categories: Category[];
  paymentTerms: number; // days
  whtRate: number; // default % withheld on payment: 0 goods, 1 transport, 3 service/subcontract, 5 rent
  bank: { bank: string; account: string; name: string };
  rating: { quality: number; onTime: number; price: number }; // 1–5, initial assessment
  status: SupplierStatus;
  note?: string;
  since: string;
};

type S = Omit<Supplier, "id" | "juristic" | "taxId" | "since" | "bank"> & { tax12: string; bank: string; acct: string; since?: string };

const RAW: S[] = [
  { name: "บริษัท ศิลาไทย ซีเมนต์ เทรดดิ้ง จำกัด", tax12: "010555300418", branch: "สำนักงานใหญ่", vatRegistered: true, address: "88/12 ถนนลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900", contact: "คุณสุนทร วัฒนา", phone: "02-512-4410", email: "sales@silathai.example", categories: ["cement", "aggregate", "readymix"], paymentTerms: 30, whtRate: 0, bank: "กสิกรไทย", acct: "032-1-45871-2", rating: { quality: 4, onTime: 4, price: 4 }, status: "active" },
  { name: "บริษัท เหล็กสยามเจริญ สตีล จำกัด", tax12: "010554100762", branch: "สำนักงานใหญ่", vatRegistered: true, address: "199 หมู่ 4 ถนนสุขสวัสดิ์ ตำบลบางครุ อำเภอพระประแดง สมุทรปราการ 10130", contact: "คุณวันชัย เหล็กดี", phone: "02-463-2201", email: "order@siamcharoensteel.example", categories: ["steel"], paymentTerms: 45, whtRate: 0, bank: "กรุงเทพ", acct: "101-4-77210-9", rating: { quality: 5, onTime: 4, price: 3 }, status: "active" },
  { name: "บริษัท นครหลวง คอนกรีต จำกัด", tax12: "010553600215", branch: "สาขา 00003", vatRegistered: true, address: "55/7 ถนนรามอินทรา แขวงคันนายาว เขตคันนายาว กรุงเทพฯ 10230", contact: "คุณพิมพ์ชนก ศรีสุข", phone: "02-918-3340", categories: ["readymix"], paymentTerms: 30, whtRate: 0, bank: "ไทยพาณิชย์", acct: "405-2-33018-6", rating: { quality: 4, onTime: 5, price: 4 }, status: "active" },
  { name: "บริษัท เสาเข็มมั่นคง จำกัด", tax12: "013555800431", branch: "สำนักงานใหญ่", vatRegistered: true, address: "12 หมู่ 7 ตำบลคลองหนึ่ง อำเภอคลองหลวง ปทุมธานี 12120", contact: "คุณชาตรี มั่นคง", phone: "02-529-0071", categories: ["pile"], paymentTerms: 30, whtRate: 0, bank: "กรุงไทย", acct: "981-0-22145-3", rating: { quality: 4, onTime: 3, price: 4 }, status: "active" },
  { name: "ห้างหุ้นส่วนจำกัด รุ่งเรืองวัสดุก่อสร้าง", tax12: "012355100987", branch: "สำนักงานใหญ่", vatRegistered: true, address: "45 ถนนรัตนาธิเบศร์ ตำบลบางกระสอ อำเภอเมือง นนทบุรี 11000", contact: "คุณรุ่งเรือง แซ่ลิ้ม", phone: "02-526-8812", categories: ["cement", "masonry", "aggregate", "hardware", "pile"], paymentTerms: 30, whtRate: 0, bank: "กสิกรไทย", acct: "721-2-60913-1", rating: { quality: 4, onTime: 4, price: 5 }, status: "active" },
  { name: "บริษัท บล็อกเบา อินดัสตรี จำกัด", tax12: "010556200330", branch: "สำนักงานใหญ่", vatRegistered: true, address: "300 หมู่ 2 ถนนบางนา-ตราด กม.23 ตำบลบางเสาธง อำเภอบางเสาธง สมุทรปราการ 10570", contact: "คุณอรอนงค์ เบาสบาย", phone: "02-130-6620", categories: ["masonry"], paymentTerms: 45, whtRate: 0, bank: "กรุงเทพ", acct: "235-0-81120-4", rating: { quality: 4, onTime: 4, price: 4 }, status: "active" },
  { name: "บริษัท หลังคาทอง เมทัลชีท จำกัด", tax12: "010555900144", branch: "สำนักงานใหญ่", vatRegistered: true, address: "71 ถนนกาญจนาภิเษก แขวงบางแค เขตบางแค กรุงเทพฯ 10160", contact: "คุณทองใบ ศรีทอง", phone: "02-454-7731", categories: ["roof", "steel"], paymentTerms: 30, whtRate: 0, bank: "ไทยพาณิชย์", acct: "118-4-90231-0", rating: { quality: 4, onTime: 3, price: 4 }, status: "active" },
  { name: "บริษัท ไฟฟ้ารุ่งโรจน์ ซัพพลาย จำกัด", tax12: "010554800276", branch: "สำนักงานใหญ่", vatRegistered: true, address: "18/3 ถนนประดิษฐ์มนูธรรม แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพฯ 10230", contact: "คุณโรจน์ ไฟสว่าง", phone: "02-933-1840", email: "order@rungrojelectric.example", categories: ["electrical"], paymentTerms: 45, whtRate: 0, bank: "กสิกรไทย", acct: "044-1-27750-8", rating: { quality: 5, onTime: 4, price: 4 }, status: "active" },
  { name: "บริษัท ท่อทอง ประปาภัณฑ์ จำกัด", tax12: "010555400519", branch: "สำนักงานใหญ่", vatRegistered: true, address: "240 ถนนพหลโยธิน แขวงอนุสาวรีย์ เขตบางเขน กรุงเทพฯ 10220", contact: "คุณสมหมาย ท่อทอง", phone: "02-971-2260", categories: ["plumbing"], paymentTerms: 30, whtRate: 0, bank: "กรุงศรีอยุธยา", acct: "330-1-55870-2", rating: { quality: 4, onTime: 4, price: 4 }, status: "active" },
  { name: "บริษัท สุขภัณฑ์ดีไซน์ โฮม จำกัด", tax12: "010556000823", branch: "สาขา 00001", vatRegistered: true, address: "99 ถนนเกษตร-นวมินทร์ แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพฯ 10230", contact: "คุณนันทิดา ดีไซน์", phone: "02-019-4455", categories: ["sanitary"], paymentTerms: 60, whtRate: 0, bank: "กรุงเทพ", acct: "152-7-33006-1", rating: { quality: 5, onTime: 3, price: 3 }, status: "active" },
  { name: "บริษัท กระเบื้องงาม พาณิชย์ จำกัด", tax12: "010555700368", branch: "สำนักงานใหญ่", vatRegistered: true, address: "15 ถนนแจ้งวัฒนะ ตำบลปากเกร็ด อำเภอปากเกร็ด นนทบุรี 11120", contact: "คุณงามตา วิจิตร", phone: "02-583-9901", categories: ["tile"], paymentTerms: 45, whtRate: 0, bank: "ไทยพาณิชย์", acct: "290-2-41162-5", rating: { quality: 4, onTime: 4, price: 4 }, status: "active" },
  { name: "บริษัท สีสวย เคมีภัณฑ์ จำกัด", tax12: "010554900217", branch: "สำนักงานใหญ่", vatRegistered: true, address: "63 ถนนบรมราชชนนี แขวงตลิ่งชัน เขตตลิ่งชัน กรุงเทพฯ 10170", contact: "คุณสวยใส แก้วเจริญ", phone: "02-433-6618", categories: ["paint"], paymentTerms: 30, whtRate: 0, bank: "กสิกรไทย", acct: "613-1-08824-7", rating: { quality: 4, onTime: 5, price: 4 }, status: "active" },
  { name: "บริษัท อลูวินโดว์ เทค จำกัด", tax12: "010556300452", branch: "สำนักงานใหญ่", vatRegistered: true, address: "8/88 ถนนวิภาวดีรังสิต แขวงตลาดบางเขน เขตหลักสี่ กรุงเทพฯ 10210", contact: "คุณกิตติพงษ์ อลูเทค", phone: "02-551-3370", categories: ["doorwindow"], paymentTerms: 30, whtRate: 0, bank: "กรุงไทย", acct: "067-0-49913-8", rating: { quality: 4, onTime: 3, price: 4 }, status: "active" },
  { name: "บริษัท เย็นฉ่ำ แอร์ เซอร์วิส จำกัด", tax12: "010555600294", branch: "สำนักงานใหญ่", vatRegistered: true, address: "120 ถนนนวมินทร์ แขวงคลองกุ่ม เขตบึงกุ่ม กรุงเทพฯ 10240", contact: "คุณเย็น ใจเย็น", phone: "02-377-1240", categories: ["hvac", "sub_hvac"], paymentTerms: 30, whtRate: 0, bank: "กรุงเทพ", acct: "198-4-62280-3", rating: { quality: 4, onTime: 4, price: 4 }, status: "active", note: "ราคาเครื่องรวมติดตั้งมาตรฐาน ค่าติดตั้งส่วนเกินหัก ณ ที่จ่าย 3%" },
  { name: "บริษัท ยิปซัมพลัส ซัพพลาย จำกัด", tax12: "010556100563", branch: "สำนักงานใหญ่", vatRegistered: true, address: "27 ถนนเสรีไทย แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240", contact: "คุณพลอย ยิปซัม", phone: "02-375-0092", categories: ["wood"], paymentTerms: 30, whtRate: 0, bank: "ไทยพาณิชย์", acct: "072-3-19985-0", rating: { quality: 4, onTime: 4, price: 4 }, status: "active" },
  { name: "ห้างหุ้นส่วนจำกัด ไทยเจริญ ฮาร์ดแวร์", tax12: "012355500641", branch: "สำนักงานใหญ่", vatRegistered: true, address: "9 ถนนงามวงศ์วาน ตำบลบางกระสอ อำเภอเมือง นนทบุรี 11000", contact: "คุณเจริญ ทองไทย", phone: "02-580-7713", categories: ["hardware", "electrical", "plumbing"], paymentTerms: 15, whtRate: 0, bank: "กรุงศรีอยุธยา", acct: "414-0-07726-9", rating: { quality: 3, onTime: 5, price: 4 }, status: "active" },
  { name: "บริษัท โฮมมาร์ท วัสดุ จำกัด (มหาชน)", tax12: "010753700125", branch: "สาขา 00012", vatRegistered: true, address: "555 ถนนรามอินทรา แขวงท่าแร้ง เขตบางเขน กรุงเทพฯ 10220", contact: "ฝ่ายขายโครงการ", phone: "02-791-5500", email: "project@homemart.example", categories: ["cement", "steel", "tile", "paint", "sanitary", "electrical", "plumbing", "hardware"], paymentTerms: 30, whtRate: 0, bank: "กรุงเทพ", acct: "001-3-00125-5", rating: { quality: 4, onTime: 4, price: 3 }, status: "active" },
  { name: "บริษัท ขนส่งสินทวี โลจิสติกส์ จำกัด", tax12: "010555200877", branch: "สำนักงานใหญ่", vatRegistered: true, address: "301 ถนนลำลูกกา ตำบลลาดสวาย อำเภอลำลูกกา ปทุมธานี 12150", contact: "คุณสินชัย ทวีทรัพย์", phone: "02-563-4120", categories: ["transport"], paymentTerms: 15, whtRate: 1, bank: "กสิกรไทย", acct: "829-2-11402-6", rating: { quality: 4, onTime: 4, price: 5 }, status: "active" },
  { name: "บริษัท เครนแกร่ง ให้เช่า จำกัด", tax12: "011555300142", branch: "สำนักงานใหญ่", vatRegistered: true, address: "77 หมู่ 5 ถนนเทพารักษ์ ตำบลบางพลีใหญ่ อำเภอบางพลี สมุทรปราการ 10540", contact: "คุณแกร่ง ยกสูง", phone: "02-312-6680", categories: ["rental"], paymentTerms: 30, whtRate: 5, bank: "กรุงไทย", acct: "193-0-55418-1", rating: { quality: 4, onTime: 4, price: 3 }, status: "active" },
  { name: "บริษัท โครงสร้างมั่นคง คอนสตรัคชั่น จำกัด", tax12: "010556400778", branch: "สำนักงานใหญ่", vatRegistered: true, address: "160/4 ถนนสุขาภิบาล 1 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพฯ 10230", contact: "คุณมั่นคง ศักดิ์ดี", phone: "089-240-1186", categories: ["sub_struct"], paymentTerms: 30, whtRate: 3, bank: "ไทยพาณิชย์", acct: "466-2-70029-4", rating: { quality: 4, onTime: 4, price: 4 }, status: "active", note: "ผู้รับเหมาช่วงงานฐานราก/โครงสร้าง คสล. ทีมงาน 18 คน" },
  { name: "บริษัท ไพศาล วิศวกรรม จำกัด", tax12: "010555800339", branch: "สำนักงานใหญ่", vatRegistered: true, address: "52 ซอยลาดพร้าว 101 แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240", contact: "คุณไพศาล วิศวกุล", phone: "081-702-5531", categories: ["sub_struct", "sub_elec"], paymentTerms: 30, whtRate: 3, bank: "กรุงเทพ", acct: "211-0-39906-2", rating: { quality: 5, onTime: 4, price: 3 }, status: "active", note: "รับงานอาคารชุด/อาคารสูง" },
  { name: "นายสมพงษ์ ใจกล้า (ช่างไฟฟ้า)", tax12: "310050018427", branch: "-", vatRegistered: false, address: "41/2 หมู่ 3 ตำบลบางรักพัฒนา อำเภอบางบัวทอง นนทบุรี 11110", contact: "นายสมพงษ์ ใจกล้า", phone: "086-335-9102", categories: ["sub_elec"], paymentTerms: 15, whtRate: 3, bank: "กรุงไทย", acct: "678-0-12904-5", rating: { quality: 4, onTime: 4, price: 5 }, status: "active", note: "ช่างไฟฟ้าทีม 4 คน มีใบรับรองช่างไฟฟ้าภายในอาคาร" },
  { name: "นายประยุทธ ทองคำ (ช่างประปา)", tax12: "350990037215", branch: "-", vatRegistered: false, address: "8 ซอยวัดลาดปลาดุก ตำบลบางรักพัฒนา อำเภอบางบัวทอง นนทบุรี 11110", contact: "นายประยุทธ ทองคำ", phone: "089-118-4470", categories: ["sub_plumb"], paymentTerms: 15, whtRate: 3, bank: "กสิกรไทย", acct: "137-2-88410-3", rating: { quality: 4, onTime: 3, price: 5 }, status: "active" },
  { name: "ห้างหุ้นส่วนจำกัด ช่างหลังคาสุวรรณ", tax12: "012355800215", branch: "สำนักงานใหญ่", vatRegistered: true, address: "19 ถนนบางกรวย-ไทรน้อย ตำบลบางรักน้อย อำเภอเมือง นนทบุรี 11000", contact: "คุณสุวรรณ หลังคาดี", phone: "084-552-7741", categories: ["sub_roof"], paymentTerms: 30, whtRate: 3, bank: "ไทยพาณิชย์", acct: "350-4-01287-7", rating: { quality: 4, onTime: 4, price: 4 }, status: "active" },
  { name: "ห้างหุ้นส่วนจำกัด ฉาบเรียบ การช่าง", tax12: "013355900428", branch: "สำนักงานใหญ่", vatRegistered: true, address: "66/1 หมู่ 9 ตำบลบึงยี่โถ อำเภอธัญบุรี ปทุมธานี 12130", contact: "คุณเรียบร้อย ฉาบดี", phone: "087-901-3364", categories: ["sub_finish"], paymentTerms: 30, whtRate: 3, bank: "กรุงเทพ", acct: "620-0-44751-8", rating: { quality: 4, onTime: 4, price: 4 }, status: "active", note: "งานก่อ ฉาบ ปูกระเบื้อง และงานสี" },
  { name: "นายวีรชัย ศรีสวัสดิ์ (ทีมช่างสี)", tax12: "110060041833", branch: "-", vatRegistered: false, address: "203 ซอยรามอินทรา 40 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพฯ 10230", contact: "นายวีรชัย ศรีสวัสดิ์", phone: "092-664-0185", categories: ["sub_finish"], paymentTerms: 15, whtRate: 3, bank: "กรุงไทย", acct: "054-1-63320-0", rating: { quality: 3, onTime: 2, price: 5 }, status: "hold", note: "ระงับรับงานใหม่ชั่วคราว รอแก้งานสีภายนอก HC-2026-01" },
  { name: "บริษัท เชียงใหม่ วัสดุภัณฑ์ จำกัด", tax12: "010555500691", branch: "สาขา 00002", vatRegistered: true, address: "88 ถนนซุปเปอร์ไฮเวย์ ตำบลวัดเกต อำเภอเมือง เชียงใหม่ 50000", contact: "คุณเกศินี คำมา", phone: "053-240-118", categories: ["cement", "steel", "masonry", "aggregate", "readymix"], paymentTerms: 30, whtRate: 0, bank: "กรุงเทพ", acct: "540-3-11982-6", rating: { quality: 4, onTime: 4, price: 4 }, status: "active", note: "ผู้ขายประจำโครงการภาคเหนือ/อีสาน" },
];

const SINCE = ["2015-06-01", "2016-03-15", "2017-09-01", "2018-01-10", "2019-05-20", "2020-08-01", "2021-02-14", "2022-11-01", "2023-04-03", "2024-07-15"];

export const SEED_SUPPLIERS: Supplier[] = RAW.map((r, i) => {
  const { tax12, bank, acct, since, ...rest } = r;
  return {
    ...rest,
    id: `SUP-${String(i + 1).padStart(3, "0")}`,
    taxId: tax(tax12),
    juristic: tax12.startsWith("0"),
    bank: { bank, account: acct, name: r.name.replace(/ \(.+\)$/, "") },
    since: since ?? SINCE[i % SINCE.length],
  };
});

export const DEFAULT_WHT: Record<string, number> = { goods: 0, transport: 1, service: 3, rental: 5 };
