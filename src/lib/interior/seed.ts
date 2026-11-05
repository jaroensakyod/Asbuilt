// Demo data for interior / fit-out and client selections. Deterministic fixed arrays.
// Makers that are not procurement suppliers are fictional.

import { getProject, TODAY } from "../data";
import { addDays, defaultFeeSchedule, expectedDelivery, priceFromMarkup } from "./calc";
import type { FfeItem, FfeStatus, InstallJob, InteriorProject, MoodBoard, Product, ProductCat, PunchItem, Sample, SelCategory, Selection, SelectionOption } from "./types";

export const DESIGNERS = ["พิมพ์ชนก อัครวงศ์", "ณัฐชา วัฒนกุล"];
export const CREWS = ["ทีมช่างบิวท์อิน ช่างเอก", "ทีมติดตั้งเฟอร์นิเจอร์ บ้านไม้งาม", "ทีมผ้าม่าน วิมานผ้า", "ทีมไฟฟ้า สุริยา"];

// ---------- product catalogue ----------

type P = [sku: string, name: string, cat: ProductCat, supplier: string, dims: string, finish: string, colour: string, swatch: string, lead: number, cost: number, markup: number, unit: string];
const RAW: P[] = [
  ["SF-301", "โซฟา 3 ที่นั่ง ผ้ากำมะหยี่", "furniture", "MK:บ้านไม้งาม เฟอร์นิเจอร์", "2200×950×820", "ผ้ากำมะหยี่ ขาไม้โอ๊ค", "เทาอมเขียว", "#7d8a7f", 45, 28500, 35, "ตัว"],
  ["SF-L02", "โซฟาตัวแอล ผ้าลินิน", "furniture", "MK:บ้านไม้งาม เฟอร์นิเจอร์", "2800×1700×800", "ผ้าลินินกันน้ำ", "ครีม", "#e4dccb", 50, 42000, 35, "ตัว"],
  ["CT-120", "โต๊ะกลางหินอ่อน กลม Ø90", "furniture", "MK:สโตนคราฟท์ ดีไซน์", "900×900×380", "หินอ่อนขาวคาราร่า", "ขาว", "#eeeae4", 30, 14500, 40, "ตัว"],
  ["DT-180", "โต๊ะทานอาหารไม้โอ๊ค 6 ที่นั่ง", "furniture", "MK:บ้านไม้งาม เฟอร์นิเจอร์", "1800×900×750", "ไม้โอ๊คย้อมธรรมชาติ", "โอ๊ค", "#c2a27c", 40, 22000, 35, "ตัว"],
  ["DC-01", "เก้าอี้ทานอาหาร บุผ้า", "furniture", "MK:บ้านไม้งาม เฟอร์นิเจอร์", "480×540×820", "ผ้าบูเคล่", "ขาวนวล", "#efe7da", 40, 3200, 40, "ตัว"],
  ["BD-6F", "เตียงนอน 6 ฟุต หัวเตียงบุผ้า", "furniture", "MK:บ้านไม้งาม เฟอร์นิเจอร์", "1980×2150×1100", "ผ้ากำมะหยี่", "น้ำตาลอ่อน", "#a8896b", 45, 24500, 35, "ตัว"],
  ["NS-02", "โต๊ะข้างเตียง 2 ลิ้นชัก", "furniture", "MK:บ้านไม้งาม เฟอร์นิเจอร์", "500×400×500", "ไม้โอ๊ค", "โอ๊ค", "#c2a27c", 40, 4800, 40, "ตัว"],
  ["WD-BI", "ตู้เสื้อผ้าบิวท์อิน บานเปิด", "builtin", "MK:ช่างเอก บิวท์อิน", "ต่อ ม. ยาว ×600×2600", "ลามิเนต HPL ลายไม้", "วอลนัท", "#6f4e37", 35, 14500, 30, "ม."],
  ["KT-BI", "ชุดครัวบิวท์อิน บน–ล่าง", "builtin", "MK:ช่างเอก บิวท์อิน", "ต่อ ม. ยาว", "บานเมลามีน ท็อปควอตซ์", "ขาว/เทา", "#d9d6cf", 40, 26000, 30, "ม."],
  ["TV-BI", "ผนังทีวีบิวท์อิน พร้อมไฟซ่อน", "builtin", "MK:ช่างเอก บิวท์อิน", "3600×400×2600", "ระแนงไม้ + ลามิเนต", "โอ๊ค", "#b8976f", 30, 38000, 30, "ชุด"],
  ["VN-BI", "ตู้ใต้อ่างล้างหน้า แขวนผนัง", "builtin", "MK:ช่างเอก บิวท์อิน", "900×480×500", "บาน HMR กันชื้น", "เทาเข้ม", "#57585a", 25, 9500, 30, "ชุด"],
  ["PD-08", "โคมไฟแขวนทองเหลือง 3 ดวง", "lighting", "SUP-008", "Ø600×H500", "ทองเหลืองปัด", "ทอง", "#b08d57", 21, 6800, 45, "ชุด"],
  ["FL-12", "โคมไฟตั้งพื้น โค้ง", "lighting", "SUP-008", "Ø380×H1900", "เหล็กพ่นสีดำด้าน", "ดำ", "#2c2a28", 14, 3900, 45, "ตัว"],
  ["LS-5M", "ไฟเส้น LED ซ่อนฝ้า 3000K", "lighting", "SUP-008", "ม้วน 5 ม.", "อะลูมิเนียมโปรไฟล์", "วอร์มไวท์", "#f3e3b5", 7, 650, 60, "ม้วน"],
  ["CR-BO", "ผ้าม่านจีบ Blackout", "fabric", "MK:วิมานผ้า ม่านและมู่ลี่", "ต่อ ตร.ม.", "โพลีเอสเตอร์ทึบแสง", "เทาควันบุหรี่", "#8b8781", 21, 950, 50, "ตร.ม."],
  ["CR-SH", "ผ้าม่านโปร่ง Sheer", "fabric", "MK:วิมานผ้า ม่านและมู่ลี่", "ต่อ ตร.ม.", "ผ้าโปร่งลินิน", "ขาว", "#f4f1ea", 21, 620, 50, "ตร.ม."],
  ["RG-200", "พรมทอมือ 200×300", "rug", "MK:สโตนคราฟท์ ดีไซน์", "2000×3000", "ขนสัตว์ผสม", "ครีม/น้ำตาล", "#d8c7ad", 60, 18500, 40, "ผืน"],
  ["DC-VS", "แจกันเซรามิก ชุด 3 ใบ", "decor", "SUP-017", "H200–400", "เซรามิกเคลือบด้าน", "เอิร์ธโทน", "#b5835a", 7, 1800, 60, "ชุด"],
  ["DC-AR", "ภาพพิมพ์กรอบไม้ 60×90", "decor", "SUP-017", "600×900", "กรอบไม้โอ๊ค", "หลากสี", "#9aa39b", 10, 2400, 60, "ภาพ"],
  ["SN-RS", "ชุดฝักบัว Rain shower 10 นิ้ว", "sanitary", "SUP-010", "Ø250", "สแตนเลสสีดำด้าน", "ดำด้าน", "#2f2f30", 14, 7200, 35, "ชุด"],
  ["SN-WC1", "ชักโครกแขวนผนัง พร้อมฝารองนั่ง", "sanitary", "SUP-010", "540×360×350", "เซรามิกเคลือบ", "ขาว", "#f5f5f2", 21, 15800, 30, "ชุด"],
  ["SF-OAK", "พื้นไม้เอ็นจิเนียร์ โอ๊ค 15 มม.", "surface", "SUP-011", "190×1900", "เคลือบด้าน UV", "โอ๊คธรรมชาติ", "#c9a77d", 30, 1650, 35, "ตร.ม."],
  ["SF-TZ", "กระเบื้องลายเทอราซโซ่ 60×60", "surface", "SUP-011", "600×600", "ผิวด้าน", "ขาวจุดเทา", "#e6e3dd", 21, 890, 35, "ตร.ม."],
  ["WC-LN", "วอลเปเปอร์ลายลินิน", "wallcover", "MK:วิมานผ้า ม่านและมู่ลี่", "ม้วน 0.53×10 ม.", "ไวนิลลายผ้า", "เบจ", "#d9cbb4", 14, 1450, 50, "ม้วน"],
  ["AP-HD", "เครื่องดูดควันกระโจม 90 ซม.", "appliance", "SUP-017", "900×500×650", "สแตนเลส", "เงิน", "#bfc1c2", 10, 12900, 15, "เครื่อง"],
  ["AP-HB", "เตาไฟฟ้าอินดักชัน 3 หัว", "appliance", "SUP-017", "780×520", "กระจกเซรามิก", "ดำ", "#1f1f21", 10, 16500, 15, "เครื่อง"],
];

export function seedProducts(): Product[] {
  return RAW.map(([sku, name, category, sup, dims, finish, colour, swatch, leadDays, tradeCost, markupPct, unit], i) => ({
    id: `PRD-${String(i + 1).padStart(4, "0")}`,
    sku,
    name,
    category,
    supplierId: sup.startsWith("SUP-") ? sup : undefined,
    supplierName: sup.startsWith("MK:") ? sup.slice(3) : undefined,
    dims,
    finish,
    colour,
    swatch,
    leadDays,
    images: [],
    tradeCost,
    markupPct,
    clientPrice: priceFromMarkup(tradeCost, markupPct),
    unit,
  }));
}
const prd = (sku: string) => {
  const i = RAW.findIndex((r) => r[0] === sku);
  return { id: `PRD-${String(i + 1).padStart(4, "0")}`, raw: RAW[i] };
};

// ---------- interior projects ----------

export function seedInteriorProjects(): InteriorProject[] {
  const mk = (x: Omit<InteriorProject, "fees"> & { paid?: number; invoiced?: number }): InteriorProject => {
    const { paid = 0, invoiced = 0, ...rest } = x;
    const fees = defaultFeeSchedule(x.designFee, x.start, x.due).map((f, i) => (i < paid ? { ...f, status: "paid" as const, paidAt: addDays(f.due, 2) } : i < paid + invoiced ? { ...f, status: "invoiced" as const } : f));
    return { ...rest, fees };
  };
  const p1 = getProject("HC-2025-04");
  const p2 = getProject("HC-2026-01");
  return [
    mk({
      id: "INT-2026-01",
      name: "ตกแต่งภายใน บ้านคุณอรวรรณ",
      projectId: "HC-2025-04",
      client: p1?.owner ?? "อรวรรณ ทองมา",
      phone: p1?.phone,
      address: p1?.address,
      designer: DESIGNERS[0],
      status: "install",
      start: "2026-06-15",
      due: "2026-11-25",
      rooms: [
        { name: "ห้องนั่งเล่น", budget: 420000 },
        { name: "ห้องทานอาหาร", budget: 160000 },
        { name: "ห้องครัว", budget: 360000 },
        { name: "ห้องนอนใหญ่", budget: 330000 },
        { name: "ห้องน้ำห้องนอนใหญ่", budget: 90000 },
      ],
      designFee: 150000,
      paid: 2,
      note: "ติดตั้งให้เสร็จก่อนส่งมอบบ้าน ลูกค้าย้ายเข้า 1 ธ.ค.",
    }),
    mk({
      id: "INT-2026-02",
      name: "ตกแต่งภายใน บ้านคุณพลวัฒน์",
      projectId: "HC-2026-01",
      client: p2?.owner ?? "พลวัฒน์ แสงดี",
      phone: p2?.phone,
      address: p2?.address,
      designer: DESIGNERS[1],
      status: "procurement",
      start: "2026-08-17",
      due: "2027-01-20",
      rooms: [
        { name: "ห้องนั่งเล่น", budget: 380000 },
        { name: "ห้องครัว", budget: 300000 },
        { name: "ห้องนอนใหญ่", budget: 260000 },
        { name: "ห้องทำงาน", budget: 120000 },
      ],
      designFee: 120000,
      paid: 1,
      invoiced: 1,
    }),
    mk({
      id: "INT-2026-03",
      name: "คอนโดริเวอร์วิว ห้อง 2805",
      client: "กิตติพัฒน์ ลือชา",
      phone: "081-449-2087",
      address: "อาคารริเวอร์วิว ชั้น 28 ห้อง 2805 เขตบางคอแหลม กรุงเทพฯ",
      designer: DESIGNERS[0],
      status: "design",
      start: "2026-10-05",
      due: "2027-02-26",
      rooms: [
        { name: "ห้องนั่งเล่น", budget: 280000 },
        { name: "ห้องนอน", budget: 190000 },
        { name: "ครัว/แพนทรี", budget: 150000 },
      ],
      designFee: 85000,
      paid: 1,
      note: "ลูกค้าภายนอก (ไม่ได้สร้างบ้านกับบริษัท) เข้าทำงานได้จันทร์–เสาร์ 9:00–17:00 ตามระเบียบนิติบุคคล",
    }),
    mk({
      id: "INT-2026-04",
      name: "รีโนเวทห้องนั่งเล่น บ้านคุณนันทนา",
      client: "นันทนา ศรีสมบูรณ์",
      phone: "089-210-6634",
      address: "หมู่บ้านลดาวัลย์ ถนนราชพฤกษ์ นนทบุรี",
      designer: DESIGNERS[1],
      status: "closed",
      start: "2026-04-01",
      due: "2026-07-31",
      rooms: [{ name: "ห้องนั่งเล่น", budget: 240000 }],
      designFee: 45000,
      paid: 3,
      handover: { signedBy: "นันทนา ศรีสมบูรณ์", signedAt: "2026-07-29", note: "ตรวจรับครบ ไม่มีรายการค้าง" },
    }),
  ];
}

// ---------- FF&E ----------

type F = [interiorId: string, room: string, code: string, sku: string, qty: number, status: FfeStatus, orderedAt?: string, extra?: Partial<FfeItem>];
const FFE: F[] = [
  ["INT-2026-01", "ห้องนั่งเล่น", "FF-01", "SF-L02", 1, "installed", "2026-08-20", { installedAt: "2026-10-28" }],
  ["INT-2026-01", "ห้องนั่งเล่น", "FF-02", "CT-120", 1, "received", "2026-09-10", { damage: { ok: false, note: "ขอบหินบิ่น 1 จุด ส่งเคลมกับผู้ผลิตแล้ว", photos: [] } }],
  ["INT-2026-01", "ห้องนั่งเล่น", "BI-01", "TV-BI", 1, "installed", "2026-09-01", { installedAt: "2026-10-22" }],
  ["INT-2026-01", "ห้องนั่งเล่น", "LT-01", "FL-12", 1, "shipped", "2026-10-20"],
  ["INT-2026-01", "ห้องนั่งเล่น", "TX-01", "CR-SH", 18, "confirmed", "2026-10-02"],
  ["INT-2026-01", "ห้องนั่งเล่น", "RG-01", "RG-200", 1, "confirmed", "2026-08-25"],
  ["INT-2026-01", "ห้องทานอาหาร", "FF-03", "DT-180", 1, "received", "2026-09-15", { damage: { ok: true, photos: [] } }],
  ["INT-2026-01", "ห้องทานอาหาร", "FF-04", "DC-01", 6, "received", "2026-09-15", { damage: { ok: true, photos: [] } }],
  ["INT-2026-01", "ห้องทานอาหาร", "LT-02", "PD-08", 1, "installed", "2026-09-20", { installedAt: "2026-10-25" }],
  ["INT-2026-01", "ห้องครัว", "BI-02", "KT-BI", 5.4, "installed", "2026-08-28", { installedAt: "2026-10-18" }],
  ["INT-2026-01", "ห้องครัว", "AP-01", "AP-HD", 1, "installed", "2026-10-01", { installedAt: "2026-10-30" }],
  ["INT-2026-01", "ห้องครัว", "AP-02", "AP-HB", 1, "received", "2026-10-01", { damage: { ok: true, photos: [] } }],
  ["INT-2026-01", "ห้องนอนใหญ่", "FF-05", "BD-6F", 1, "shipped", "2026-09-28"],
  ["INT-2026-01", "ห้องนอนใหญ่", "FF-06", "NS-02", 2, "shipped", "2026-09-28"],
  ["INT-2026-01", "ห้องนอนใหญ่", "BI-03", "WD-BI", 3.6, "installed", "2026-08-28", { installedAt: "2026-10-20" }],
  ["INT-2026-01", "ห้องนอนใหญ่", "TX-02", "CR-BO", 14, "confirmed", "2026-10-16"],
  ["INT-2026-01", "ห้องน้ำห้องนอนใหญ่", "BI-04", "VN-BI", 1, "installed", "2026-09-05", { installedAt: "2026-10-16" }],
  ["INT-2026-01", "ห้องน้ำห้องนอนใหญ่", "SN-01", "SN-RS", 1, "installed", "2026-09-05", { installedAt: "2026-10-16" }],
  ["INT-2026-02", "ห้องนั่งเล่น", "FF-01", "SF-301", 1, "ordered", "2026-10-26"],
  ["INT-2026-02", "ห้องนั่งเล่น", "BI-01", "TV-BI", 1, "confirmed", "2026-09-28"],
  ["INT-2026-02", "ห้องนั่งเล่น", "LT-01", "LS-5M", 6, "confirmed", "2026-10-15", { expectedAt: "2026-10-22" }],
  ["INT-2026-02", "ห้องนั่งเล่น", "TX-01", "CR-SH", 22, "specified"],
  ["INT-2026-02", "ห้องครัว", "BI-02", "KT-BI", 4.2, "confirmed", "2026-09-28"],
  ["INT-2026-02", "ห้องครัว", "AP-01", "AP-HD", 1, "specified"],
  ["INT-2026-02", "ห้องนอนใหญ่", "BI-03", "WD-BI", 3, "confirmed", "2026-09-28"],
  ["INT-2026-02", "ห้องนอนใหญ่", "FF-02", "BD-6F", 1, "specified"],
  ["INT-2026-02", "ห้องทำงาน", "SF-01", "SF-OAK", 16, "ordered", "2026-10-30"],
  ["INT-2026-03", "ห้องนั่งเล่น", "FF-01", "SF-301", 1, "specified"],
  ["INT-2026-03", "ห้องนั่งเล่น", "WC-01", "WC-LN", 8, "specified"],
  ["INT-2026-03", "ห้องนอน", "BI-01", "WD-BI", 2.4, "specified"],
  ["INT-2026-03", "ครัว/แพนทรี", "BI-02", "KT-BI", 2.6, "specified"],
  ["INT-2026-04", "ห้องนั่งเล่น", "FF-01", "SF-L02", 1, "installed", "2026-05-10", { installedAt: "2026-07-20" }],
  ["INT-2026-04", "ห้องนั่งเล่น", "BI-01", "TV-BI", 1, "installed", "2026-05-10", { installedAt: "2026-07-15" }],
  ["INT-2026-04", "ห้องนั่งเล่น", "RG-01", "RG-200", 1, "installed", "2026-05-12", { installedAt: "2026-07-22" }],
];

export function seedFfe(): FfeItem[] {
  const ints = new Map(seedInteriorProjects().map((x) => [x.id, x]));
  const seq: Record<string, number> = {};
  return FFE.map(([interiorId, room, code, sku, qty, status, orderedAt, extra]) => {
    const { id: productId, raw } = prd(sku);
    seq[interiorId] = (seq[interiorId] ?? 0) + 1;
    const lead = raw[8];
    const expectedAt = orderedAt ? expectedDelivery(orderedAt, lead) : undefined;
    const rank = ["specified", "ordered", "confirmed", "shipped", "received", "installed"].indexOf(status);
    return {
      id: `FFE-${interiorId}-${String(seq[interiorId]).padStart(3, "0")}`,
      interiorId,
      projectId: ints.get(interiorId)?.projectId,
      room,
      code,
      productId,
      description: raw[1],
      qty,
      unit: raw[11],
      unitCost: raw[9],
      unitSell: priceFromMarkup(raw[9], raw[10]),
      status,
      orderedAt,
      confirmedAt: rank >= 2 && orderedAt ? addDays(orderedAt, 2) : undefined,
      shippedAt: rank >= 3 && expectedAt ? (addDays(expectedAt, -3) < TODAY ? addDays(expectedAt, -3) : addDays(TODAY, -1)) : undefined,
      expectedAt,
      receivedAt: rank >= 4 && expectedAt ? (expectedAt < TODAY ? expectedAt : addDays(TODAY, -2)) : undefined,
      ...extra,
    };
  });
}

// ---------- boards ----------

export function seedBoards(): MoodBoard[] {
  const tiles = (skus: string[]) => skus.map((s, i) => ({ id: `T${i + 1}`, productId: prd(s).id }));
  return [
    { id: "MB-INT-2026-01-1", interiorId: "INT-2026-01", projectId: "HC-2025-04", room: "ห้องนั่งเล่น", title: "ห้องนั่งเล่น · Warm minimal", tiles: tiles(["SF-L02", "CT-120", "TV-BI", "FL-12", "CR-SH", "RG-200", "DC-VS"]), notes: "โทนครีม–ไม้โอ๊ค ไฟซ่อนฝ้า 3000K ให้บรรยากาศอบอุ่น", shared: true, sharedAt: "2026-07-20", clientComment: "ชอบมากค่ะ ขอเปลี่ยนพรมเป็นโทนน้ำตาลเข้มขึ้นนิดหนึ่ง", clientCommentAt: "2026-07-22", clientLiked: true },
    { id: "MB-INT-2026-01-2", interiorId: "INT-2026-01", projectId: "HC-2025-04", room: "ห้องนอนใหญ่", title: "ห้องนอนใหญ่ · Soft wood", tiles: tiles(["BD-6F", "NS-02", "WD-BI", "CR-BO", "DC-AR"]), notes: "หัวเตียงบุผ้าสีน้ำตาลอ่อน ตู้เสื้อผ้าลายวอลนัท ม่านทึบแสงกันแดดฝั่งตะวันตก", shared: true, sharedAt: "2026-07-20", clientLiked: true },
    { id: "MB-INT-2026-02-1", interiorId: "INT-2026-02", projectId: "HC-2026-01", room: "ห้องนั่งเล่น", title: "ห้องนั่งเล่น · Modern tropical", tiles: tiles(["SF-301", "TV-BI", "LS-5M", "CR-SH", "DC-VS", "DC-AR"]), notes: "โซฟาสีเขียวหม่น ระแนงไม้ผนังทีวี เน้นต้นไม้ในร่ม", shared: true, sharedAt: "2026-10-12" },
    { id: "MB-INT-2026-02-2", interiorId: "INT-2026-02", projectId: "HC-2026-01", room: "ห้องครัว", title: "ห้องครัว · White & grey", tiles: tiles(["KT-BI", "AP-HD", "AP-HB", "SF-TZ"]), notes: "รอลูกค้ายืนยันสีท็อปควอตซ์", shared: false },
    { id: "MB-INT-2026-03-1", interiorId: "INT-2026-03", room: "ห้องนั่งเล่น", title: "ห้องนั่งเล่น · River view", tiles: tiles(["SF-301", "WC-LN", "PD-08", "RG-200"]), notes: "เปิดมุมมองแม่น้ำ ใช้วอลเปเปอร์ลายลินินผนังหลังโซฟา", shared: false },
  ];
}

// ---------- samples ----------

export function seedSamples(): Sample[] {
  const s = (n: number, interiorId: string, sku: string | undefined, description: string, status: Sample["status"], requestedAt: string, extra: Partial<Sample>, supplierName?: string): Sample => ({
    id: `SMP-${String(n).padStart(4, "0")}`,
    interiorId,
    productId: sku ? prd(sku).id : undefined,
    description,
    supplierName,
    status,
    requestedAt,
    location: "ห้องตัวอย่าง สำนักงานใหญ่ ชั้น 2",
    ...extra,
  });
  return [
    s(1, "INT-2026-01", "CR-SH", "ตัวอย่างผ้าม่านโปร่ง 3 สี", "returned", "2026-07-02", { receivedAt: "2026-07-06", shownAt: "2026-07-10", returnedAt: "2026-07-18" }, "วิมานผ้า ม่านและมู่ลี่"),
    s(2, "INT-2026-01", "RG-200", "ตัวอย่างพรม 50×50 โทนครีม/น้ำตาล", "shown", "2026-07-15", { receivedAt: "2026-07-19", shownAt: "2026-07-22", returnBy: "2026-08-05", location: "ฝากไว้ที่บ้านลูกค้า" }, "สโตนคราฟท์ ดีไซน์"),
    s(3, "INT-2026-01", "WD-BI", "แผ่นลามิเนตลายวอลนัท", "kept", "2026-07-02", { receivedAt: "2026-07-05", shownAt: "2026-07-10" }, "ช่างเอก บิวท์อิน"),
    s(4, "INT-2026-02", "KT-BI", "ตัวอย่างท็อปควอตซ์ 4 สี", "shown", "2026-10-06", { receivedAt: "2026-10-12", shownAt: "2026-10-20" }, "ช่างเอก บิวท์อิน"),
    s(5, "INT-2026-02", "SF-OAK", "ตัวอย่างพื้นไม้เอ็นจิเนียร์ 3 สี", "received", "2026-10-15", { receivedAt: "2026-10-21" }),
    s(6, "INT-2026-03", "WC-LN", "ตัวอย่างวอลเปเปอร์ลายลินิน", "requested", "2026-10-28", {}, "วิมานผ้า ม่านและมู่ลี่"),
    s(7, "INT-2026-03", "SF-301", "ตัวอย่างผ้าบุโซฟากำมะหยี่ 6 สี", "shown", "2026-10-08", { receivedAt: "2026-10-12", shownAt: "2026-10-16", returnBy: "2026-10-30" }, "บ้านไม้งาม เฟอร์นิเจอร์"),
  ].map((x) => (x.productId && !x.supplierName && !x.supplierId ? { ...x, supplierId: "SUP-011" } : x));
}

// ---------- installation + punch list ----------

export function seedInstallJobs(): InstallJob[] {
  return [
    { id: "IJ-INT-2026-01-1", interiorId: "INT-2026-01", room: "ห้องครัว", crew: CREWS[0], start: "2026-10-14", end: "2026-10-19", ffeIds: ["FFE-INT-2026-01-010"], status: "done" },
    { id: "IJ-INT-2026-01-2", interiorId: "INT-2026-01", room: "ห้องนั่งเล่น", crew: CREWS[1], start: "2026-11-03", end: "2026-11-07", ffeIds: ["FFE-INT-2026-01-002", "FFE-INT-2026-01-004", "FFE-INT-2026-01-006"], status: "in_progress", note: "รอโต๊ะกลางตัวเคลม" },
    { id: "IJ-INT-2026-01-3", interiorId: "INT-2026-01", room: "ห้องนอนใหญ่", crew: CREWS[2], start: "2026-11-10", end: "2026-11-12", ffeIds: ["FFE-INT-2026-01-005", "FFE-INT-2026-01-016"], status: "planned" },
    { id: "IJ-INT-2026-01-4", interiorId: "INT-2026-01", room: "ห้องนอนใหญ่", crew: CREWS[1], start: "2026-11-13", end: "2026-11-14", ffeIds: ["FFE-INT-2026-01-013", "FFE-INT-2026-01-014"], status: "planned" },
    { id: "IJ-INT-2026-02-1", interiorId: "INT-2026-02", room: "ห้องครัว", crew: CREWS[0], start: "2026-12-07", end: "2026-12-12", ffeIds: ["FFE-INT-2026-02-005"], status: "planned" },
    { id: "IJ-INT-2026-02-2", interiorId: "INT-2026-02", room: "ห้องนอนใหญ่", crew: CREWS[0], start: "2026-12-14", end: "2026-12-17", ffeIds: ["FFE-INT-2026-02-007"], status: "planned" },
  ];
}

export function seedPunch(): PunchItem[] {
  return [
    { id: "PL-INT-2026-01-1", interiorId: "INT-2026-01", room: "ห้องครัว", text: "บานตู้ลอยล่างขวาไม่ได้ระดับ ปิดแล้วชนกัน", assignee: CREWS[0], photos: [], status: "open", createdAt: "2026-10-31", by: DESIGNERS[0] },
    { id: "PL-INT-2026-01-2", interiorId: "INT-2026-01", room: "ห้องนั่งเล่น", text: "ไฟซ่อนผนังทีวีมีช่วงมืด 30 ซม. ด้านซ้าย", assignee: CREWS[3], photos: [], status: "open", createdAt: "2026-10-31", by: DESIGNERS[0] },
    { id: "PL-INT-2026-01-3", interiorId: "INT-2026-01", room: "ห้องนอนใหญ่", text: "ขอบลามิเนตตู้เสื้อผ้าบานกลางลอก", assignee: CREWS[0], photos: [], status: "fixed", createdAt: "2026-10-24", by: DESIGNERS[0], fixedAt: "2026-10-29" },
    { id: "PL-INT-2026-01-4", interiorId: "INT-2026-01", room: "ห้องน้ำห้องนอนใหญ่", text: "ยาซิลิโคนรอบตู้ใต้อ่างไม่เต็มแนว", assignee: CREWS[0], photos: [], status: "verified", createdAt: "2026-10-18", by: DESIGNERS[0], fixedAt: "2026-10-20" },
    { id: "PL-INT-2026-04-1", interiorId: "INT-2026-04", room: "ห้องนั่งเล่น", text: "รอยขีดข่วนผนังข้างโซฟา", assignee: CREWS[1], photos: [], status: "verified", createdAt: "2026-07-23", by: DESIGNERS[1], fixedAt: "2026-07-26" },
  ];
}

// ---------- client selections ----------

type O = [name: string, brand: string, price: number, cost: number, swatch: string];
type T = [room: string, cat: SelCategory, item: string, qty: number, unit: string, opts: O[], blocks: string];
const TEMPLATE: T[] = [
  ["ห้องนั่งเล่น", "floor", "กระเบื้องพื้นชั้น 1", 62, "ตร.ม.", [["แกรนิตโต้ 60×60 สีครีมผิวด้าน (มาตรฐาน)", "กระเบื้องงาม", 450, 345, "#e8dfd0"], ["แกรนิตโต้ 60×120 ลายหินอ่อน", "กระเบื้องงาม", 780, 590, "#efece8"], ["พื้นไม้ SPC ลายโอ๊ค 5 มม.", "ฟลอร์ลิงก์", 690, 520, "#b89a74"]], "งานปูพื้นชั้น 1"],
  ["ห้องนอนใหญ่", "floor", "พื้นห้องนอนใหญ่", 22, "ตร.ม.", [["ไม้ลามิเนต 8 มม. (มาตรฐาน)", "วู้ดเทค", 520, 400, "#b99470"], ["ไม้เอ็นจิเนียร์โอ๊ค 15 มม.", "วู้ดเทค", 1650, 1220, "#c9a77d"], ["พื้นไม้ SPC ลายวอลนัท", "ฟลอร์ลิงก์", 690, 520, "#7a5a40"]], "งานปูพื้นชั้น 2"],
  ["ห้องน้ำ 1", "wall", "กระเบื้องผนังห้องน้ำ 1", 30, "ตร.ม.", [["เซรามิก 30×60 สีขาวด้าน (มาตรฐาน)", "เซรามิคโฮม", 380, 290, "#f1efea"], ["พอร์ซเลน 60×120 ลายหินเทา", "กระเบื้องงาม", 920, 700, "#a8a6a1"], ["ซับเวย์ 7.5×30 สีเขียวเสจ", "เซรามิคโฮม", 640, 480, "#a9b5a0"]], "งานปูกระเบื้องผนังห้องน้ำ"],
  ["ห้องน้ำ 1", "sanitary", "ชักโครกห้องน้ำ 1", 1, "ชุด", [["ชักโครกชิ้นเดียว 3/4.5 ลิตร (มาตรฐาน)", "สุขภัณฑ์ดีไซน์", 6500, 5000, "#f5f5f2"], ["ชักโครกแขวนผนังพร้อมถังซ่อน", "อควาเฮาส์", 15800, 12100, "#f5f5f2"], ["ชักโครกอัจฉริยะ ฝาอุ่น", "อควาเฮาส์", 28900, 22800, "#e9e9e6"]], "งานติดตั้งสุขภัณฑ์"],
  ["ห้องน้ำ 1", "faucet", "ชุดฝักบัวห้องน้ำ 1", 1, "ชุด", [["ฝักบัวสายอ่อนพร้อมวาล์ว (มาตรฐาน)", "สุขภัณฑ์ดีไซน์", 2800, 2150, "#c9cacc"], ["Rain shower 10 นิ้ว สีดำด้าน", "อควาเฮาส์", 7200, 5600, "#2f2f30"], ["Rain shower โครเมียม พร้อมก๊อกผสม", "สุขภัณฑ์ดีไซน์", 5400, 4150, "#d4d6d8"]], "งานติดตั้งสุขภัณฑ์"],
  ["ห้องครัว", "kitchen", "ท็อปเคาน์เตอร์ครัว", 3.2, "ม.", [["ท็อปแกรนิตดำ (มาตรฐาน)", "สโตนเวิร์ค", 4500, 3500, "#2b2b2d"], ["ท็อปควอตซ์สีขาว", "สโตนเวิร์ค", 8200, 6300, "#f0efeb"], ["ท็อปสแตนเลส ขัดลาย", "ครัวไทยเมทัล", 6400, 4900, "#bfc1c2"]], "งานติดตั้งชุดครัว"],
  ["ทั้งบ้าน", "lighting", "โคมดาวน์ไลท์", 36, "ดวง", [["ดาวน์ไลท์ LED 9 W 3000K (มาตรฐาน)", "ไลท์เฮาส์", 350, 260, "#f3e3b5"], ["ดาวน์ไลท์ปรับมุม กันแสงบาด", "ไลท์เฮาส์", 690, 520, "#f6eccc"], ["ดาวน์ไลท์อัจฉริยะ ปรับสีได้", "ไลท์เฮาส์", 1250, 950, "#e9f0f6"]], "งานติดตั้งโคมและฝ้า"],
  ["ทั้งบ้าน", "door", "ชุดลูกบิด/มือจับประตูห้อง", 7, "ชุด", [["ลูกบิดสแตนเลส (มาตรฐาน)", "ไทยฮาร์ดแวร์", 650, 500, "#c9cacc"], ["มือจับก้านโยก สีดำด้าน", "ล็อกเทค", 1450, 1100, "#2c2a28"], ["มือจับก้านโยก ทองเหลืองปัด", "ล็อกเทค", 1850, 1400, "#b08d57"]], "งานติดตั้งประตู"],
  ["ประตูหน้า", "door", "กุญแจประตูหน้าบ้าน", 1, "ชุด", [["มือจับก้านโยกพร้อมกุญแจ (มาตรฐาน)", "ไทยฮาร์ดแวร์", 2400, 1850, "#c9cacc"], ["ดิจิทัลล็อก สแกนนิ้ว + รหัส", "ล็อกเทค", 12900, 9900, "#2c2a28"]], "งานติดตั้งประตู"],
  ["ห้องนอนใหญ่", "builtin", "ตู้เสื้อผ้าบิวท์อิน", 2.8, "ม.", [["ตู้บานเปิดเมลามีน (มาตรฐาน)", "ช่างเอก บิวท์อิน", 12000, 9200, "#d8c8b0"], ["ตู้บานเปิดลามิเนตลายวอลนัท", "ช่างเอก บิวท์อิน", 14500, 11150, "#6f4e37"], ["ตู้บานกระจกชาพร้อมไฟ LED", "ช่างเอก บิวท์อิน", 19800, 15200, "#7a6a58"]], "งานบิวท์อิน"],
  ["ภายนอก", "paint", "สีผนังภายนอก", 1, "งาน", [["ขาวนวล/เทาอ่อน (มาตรฐาน)", "สีสวย", 38000, 29000, "#ece8df"], ["เทาเข้ม/ไม้ (สีเกรดพรีเมียม)", "เพนท์โปร", 45500, 35000, "#5f5e5a"], ["เอิร์ธโทน ครีม/น้ำตาล", "สีสวย", 38000, 29000, "#d8c3a5"]], "งานทาสีภายนอก"],
];

/** per project: status letter per template row (A approved, C chosen, P pending, - skip) and deadline offsets from TODAY */
const PLAN: Record<string, { s: string; off: number[] }> = {
  "HC-2025-04": { s: "AAAAAAAAAAA", off: [-200, -180, -170, -160, -160, -150, -140, -120, -120, -110, -100] },
  "HC-2026-01": { s: "AAAAAACAAAA", off: [-80, -60, -60, -50, -50, -40, -6, -30, -20, -30, -10] },
  "HC-2026-02": { s: "AACPCAPP-PA", off: [-40, -20, -10, -5, -8, -12, 3, 12, 0, 18, -30] },
  "HC-2026-05": { s: "ACPPPPPP-PP", off: [-15, -6, -3, 10, 10, 14, 21, 28, 0, 30, 45] },
  "HC-2026-04": { s: "PPPPPP-P-PP", off: [9, 20, 25, 35, 35, 40, 0, 50, 0, 55, 70] },
  "HC-2026-03": { s: "CP-----PPP-", off: [6, 14, 0, 0, 0, 0, 0, 25, 25, 30, 0] },
  "HC-2026-06": { s: "PPPPP--P---", off: [-2, 30, 34, 40, 40, 0, 0, 60, 0, 0, 0] },
};

export function seedSelections(): Selection[] {
  const out: Selection[] = [];
  for (const [projectId, plan] of Object.entries(PLAN)) {
    const p = getProject(projectId);
    if (!p) continue;
    let n = 0;
    TEMPLATE.forEach(([room, category, item, qty, unit, opts, blocks], i) => {
      const code = plan.s[i];
      if (!code || code === "-") return;
      n += 1;
      const id = `SEL-${projectId}-${String(n).padStart(2, "0")}`;
      const options: SelectionOption[] = opts.map(([name, brand, price, cost, swatch], j) => ({ id: `${id}-O${j + 1}`, name, brand, price, cost, images: [], swatch }));
      const deadline = addDays(TODAY, plan.off[i]);
      const status = code === "A" ? "approved" : code === "C" ? "chosen" : "pending";
      // approved seeds chose the standard option (no price difference); chosen seeds picked an upgrade waiting for approval
      const chosenIdx = status === "approved" ? 0 : status === "chosen" ? 1 + (i % Math.max(1, opts.length - 1)) : undefined;
      out.push({
        id,
        projectId,
        room,
        category,
        item,
        qty,
        unit,
        allowanceUnit: opts[0][2],
        allowanceCostUnit: opts[0][3],
        options,
        deadline,
        blocks,
        blocksDate: addDays(deadline, 14),
        status,
        chosenId: chosenIdx !== undefined ? options[Math.min(chosenIdx, options.length - 1)].id : undefined,
        chosenAt: chosenIdx !== undefined ? addDays(deadline, -3) : undefined,
        chosenBy: chosenIdx !== undefined ? p.owner : undefined,
        clientNote: status === "chosen" && i === 2 ? "ขอสีเขียวเสจตามรูปที่ส่งให้ในแชตค่ะ" : undefined,
        approvedAt: status === "approved" ? addDays(deadline, -1) : undefined,
        approvedBy: status === "approved" ? DESIGNERS[i % 2] : undefined,
      });
    });
  }
  return out;
}
