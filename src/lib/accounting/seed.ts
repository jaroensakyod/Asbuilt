// Demo seed of the accounting module: fixed-asset register, ~120 expenses (Jan–Nov 2026),
// opening balances as of 2026-01-01 and a few manual journals. All names are fictional.
// Revenue / AR / AP / payroll come from the shared biz collections (other modules).
// Pure: no React, no "@/" imports.
import { accumAccount, accumulatedAt } from "./assets";
import { A } from "./coa";
import { categoryOf } from "./categories";
import { buildExpenseJournal } from "./ledger";
import { DEFAULT_ACCOUNTS } from "./coa";
import { BOOKS_START, docPrefix, monthEnd, periodsBetween, r2 } from "./money";
import type { Expense, FixedAsset, JournalLine, ManualJournal } from "./types";
import type { VatMode } from "./tax";

function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** 12 digits → 13-digit id with a valid mod-11 check digit */
function taxId(first12: string) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(first12[i]) * (13 - i);
  return first12 + String((11 - (s % 11)) % 10);
}

export const SEED_TODAY = "2026-11-04";

// ---------- fixed assets ----------

const fa = (id: string, name: string, account: string, cost: number, lifeYears: number, startDate: string, site: boolean, extra: Partial<FixedAsset> = {}): FixedAsset => ({
  id,
  name,
  account,
  cost,
  salvage: lifeYears ? 1 : 0,
  lifeYears,
  startDate,
  site,
  paidFrom: startDate < BOOKS_START ? "opening" : "1112",
  ...extra,
});

export const SEED_ASSETS: FixedAsset[] = [
  fa("FA-0001", "อาคารสำนักงาน ลาดพร้าว 3 ชั้น", "1210", 8_500_000, 20, "2019-03-01", false),
  fa("FA-0002", "ที่ดินสำนักงาน ลาดพร้าว (1 งาน 40 ตร.ว.)", "1260", 6_000_000, 0, "2019-03-01", false),
  fa("FA-0003", "รถกระบะ Toyota Hilux Revo ทะเบียน 1ฒก-4521", "1230", 780_000, 5, "2022-06-15", true),
  fa("FA-0004", "รถกระบะ Isuzu D-Max ทะเบียน 2ฒข-1187", "1230", 820_000, 5, "2024-02-01", true),
  fa("FA-0005", "รถบรรทุก 6 ล้อ Hino ทะเบียน 71-5524", "1230", 1_650_000, 5, "2023-09-01", true),
  fa("FA-0006", "เครื่องผสมคอนกรีต 1 ลบ.ม.", "1220", 185_000, 5, "2023-04-10", true),
  fa("FA-0007", "นั่งร้านเหล็ก 400 ชุด", "1220", 640_000, 5, "2024-07-01", true),
  fa("FA-0008", "ชุดเครื่องมือช่าง เครื่องตัด/เชื่อมเหล็ก", "1220", 260_000, 5, "2025-03-01", true),
  fa("FA-0009", "กล้องสำรวจ Total Station", "1220", 420_000, 5, "2025-08-01", true),
  fa("FA-0010", "คอมพิวเตอร์งานออกแบบ 6 เครื่อง", "1240", 330_000, 3, "2024-01-15", false),
  fa("FA-0011", "เครื่องพิมพ์แบบ A0", "1240", 145_000, 3, "2023-05-01", false, { disposedDate: "2026-08-31", proceeds: 12_000 }),
  fa("FA-0012", "เฟอร์นิเจอร์สำนักงาน", "1250", 480_000, 5, "2019-03-01", false),
  fa("FA-0013", "รถขุดเล็ก Kubota U30", "1220", 1_350_000, 5, "2026-03-12", true, { vat: 94_500, serial: "IV2603/0412" }),
  fa("FA-0014", "โน้ตบุ๊กวิศวกรสนาม 4 เครื่อง", "1240", 128_000, 3, "2026-06-03", false, { vat: 8_960, serial: "TX-69-01882" }),
  fa("FA-0015", "เครื่องปั่นไฟ 10 kVA", "1220", 95_000, 5, "2026-09-18", true, { vat: 6_650, serial: "INV-2569-0931" }),
];

// ---------- payees ----------

type Payee = { name: string; taxId?: string; branch?: string };
const P = {
  shell: { name: "บริษัท ปิโตรเลียมไทยสาขาลาดพร้าว จำกัด", taxId: taxId("010553600411"), branch: "สาขาที่ 00012" },
  ptt: { name: "หจก. ศรีนครปั๊มน้ำมัน", taxId: taxId("013355800217"), branch: "สำนักงานใหญ่" },
  homemart: { name: "บริษัท โฮมวัสดุ มาร์ท จำกัด", taxId: taxId("010554400871"), branch: "สาขาที่ 00031" },
  hardware: { name: "ร้านเจริญวัสดุภัณฑ์", taxId: undefined },
  mea: { name: "การไฟฟ้านครหลวง", taxId: "0994000165510", branch: "สำนักงานใหญ่" },
  mwa: { name: "การประปานครหลวง", taxId: "0994000165528", branch: "สำนักงานใหญ่" },
  pea: { name: "การไฟฟ้าส่วนภูมิภาค", taxId: "0994000165501", branch: "สำนักงานใหญ่" },
  telecom: { name: "บริษัท ไทยเน็ตเวิร์ค คอมมิวนิเคชั่น จำกัด", taxId: taxId("010754600332"), branch: "สำนักงานใหญ่" },
  landlord: { name: "นางสาวพรรณี ศรีสุข", taxId: taxId("310060012345") },
  district: { name: "สำนักงานเขต/เทศบาล (ค่าธรรมเนียมใบอนุญาต)", taxId: undefined },
  crane: { name: "บริษัท สยามเครนให้เช่า จำกัด", taxId: taxId("010555700123"), branch: "สำนักงานใหญ่" },
  scaffold: { name: "บริษัท นั่งร้านมั่นคง จำกัด", taxId: taxId("011556100456"), branch: "สำนักงานใหญ่" },
  truck: { name: "นายสมศักดิ์ ขนส่ง", taxId: taxId("150990033214") },
  lab: { name: "บริษัท ไทยเทสติ้ง แลบอราทอรี่ จำกัด", taxId: taxId("010555900778"), branch: "สำนักงานใหญ่" },
  electrician: { name: "นายประเสริฐ ช่างไฟ", taxId: taxId("340120045678") },
  plumber: { name: "นายบุญชัย ประปาดี", taxId: taxId("170050011234") },
  accounting: { name: "บริษัท สอบบัญชีกรุงเทพ จำกัด", taxId: taxId("010555300991"), branch: "สำนักงานใหญ่" },
  ads: { name: "บริษัท ดิจิทัล มีเดีย พลัส จำกัด", taxId: taxId("010556200445"), branch: "สำนักงานใหญ่" },
  stationery: { name: "บริษัท ออฟฟิศเมท (ไทย) จำกัด", taxId: taxId("010754500667"), branch: "สาขาที่ 00005" },
  restaurant: { name: "ร้านอาหารครัวบ้านสวน", taxId: undefined },
  insurer: { name: "บริษัท ไทยประกันภัยก่อสร้าง จำกัด (มหาชน)", taxId: taxId("010753700112"), branch: "สำนักงานใหญ่" },
  bank: { name: "ธนาคารกรุงไทย จำกัด (มหาชน)", taxId: "0107537000882", branch: "สำนักงานใหญ่" },
  labour: { name: "แรงงานรายวันหน้างาน (ใบสำคัญจ่าย)", taxId: undefined },
  repair: { name: "บริษัท ช่างยนต์บริการ จำกัด", taxId: taxId("010556600213"), branch: "สำนักงานใหญ่" },
} satisfies Record<string, Payee>;

// active sites by month (from the project list in data.ts)
const SITES: { id: string; from: string; to: string; province: "bkk" | "up" }[] = [
  { id: "HC-2025-04", from: "2026-01", to: "2026-11", province: "bkk" },
  { id: "HC-2025-03", from: "2026-01", to: "2026-11", province: "bkk" },
  { id: "HC-2026-01", from: "2026-02", to: "2026-11", province: "up" },
  { id: "HC-2026-02", from: "2026-03", to: "2026-11", province: "up" },
  { id: "HC-2026-03", from: "2026-03", to: "2026-11", province: "bkk" },
  { id: "HC-2026-04", from: "2026-04", to: "2026-11", province: "bkk" },
  { id: "HC-2026-05", from: "2026-05", to: "2026-11", province: "up" },
  { id: "HC-2026-06", from: "2026-06", to: "2026-11", province: "up" },
  { id: "HC-2026-07", from: "2026-07", to: "2026-11", province: "up" },
  { id: "HC-2026-08", from: "2026-08", to: "2026-11", province: "up" },
  { id: "HC-2026-09", from: "2026-09", to: "2026-11", province: "up" },
];

type Tpl = {
  category: string;
  payee: Payee;
  min: number;
  max: number;
  vatMode: VatMode;
  docType: string;
  pay: Expense["payStatus"];
  site?: boolean;
  costCode?: string;
  item: string;
  unit?: string;
};
const T = (category: string, payee: Payee, min: number, max: number, vatMode: VatMode, docType: string, pay: Expense["payStatus"], item: string, extra: Partial<Tpl> = {}): Tpl => ({
  category,
  payee,
  min,
  max,
  vatMode,
  docType,
  pay,
  item,
  site: categoryOf(category)?.site,
  ...extra,
});

const FULL = "ใบกำกับภาษีเต็มรูป",
  ABB = "ใบกำกับภาษีอย่างย่อ",
  RCPT = "ใบเสร็จ",
  CASHBILL = "บิลเงินสด/ใบรับรองแทนใบเสร็จ";

// recurring office items each month
const MONTHLY: Tpl[] = [
  T("ค่าเช่าสำนักงาน", P.landlord, 45_000, 45_000, "none", RCPT, "โอนแล้ว", "ค่าเช่าโกดังเก็บวัสดุ ลาดพร้าว"),
  T("ค่าไฟฟ้า/ประปาสำนักงาน", P.mea, 9_500, 16_500, "included", FULL, "โอนแล้ว", "ค่าไฟฟ้าสำนักงาน"),
  T("ค่าไฟฟ้า/ประปาสำนักงาน", P.mwa, 900, 1_800, "included", FULL, "โอนแล้ว", "ค่าน้ำประปาสำนักงาน"),
  T("โทรศัพท์/อินเทอร์เน็ต", P.telecom, 6_420, 6_420, "included", FULL, "โอนแล้ว", "อินเทอร์เน็ตและโทรศัพท์มือถือ 18 เลขหมาย"),
];
// pool for the rest
const POOL: Tpl[] = [
  T("ค่าน้ำมันเครื่องจักร/รถหน้างาน", P.shell, 1_800, 4_800, "included", FULL, "เงินสดย่อย", "น้ำมันดีเซล รถกระบะหน้างาน", { unit: "ลิตร" }),
  T("ค่าน้ำมันเครื่องจักร/รถหน้างาน", P.ptt, 2_500, 7_500, "included", FULL, "โอนแล้ว", "น้ำมันดีเซล รถบรรทุก/รถขุด", { unit: "ลิตร" }),
  T("ค่าน้ำมัน/ค่าเดินทาง", P.shell, 800, 2_400, "included", ABB, "เงินสดย่อย", "น้ำมันรถผู้บริหาร/ฝ่ายขาย"),
  T("วัสดุสิ้นเปลือง/เครื่องมือเล็ก", P.homemart, 1_200, 9_800, "included", FULL, "เงินสดย่อย", "ใบตัด ดอกสว่าน ลวดผูกเหล็ก ถุงมือ"),
  T("วัสดุสิ้นเปลือง/เครื่องมือเล็ก", P.hardware, 350, 2_800, "none", CASHBILL, "เงินสดย่อย", "ตะปู สายเอ็น ปูนกาว (ร้านใกล้ไซต์)"),
  T("วัสดุก่อสร้าง", P.homemart, 4_500, 38_000, "included", FULL, "โอนแล้ว", "วัสดุซื้อเร่งด่วนหน้างาน", { costCode: "04" }),
  T("วัสดุก่อสร้าง", P.hardware, 1_500, 8_500, "none", CASHBILL, "เงินสดย่อย", "ทราย หิน ปูนถุง (ซื้อเพิ่มหน้างาน)", { costCode: "02" }),
  T("ค่าเช่าเครื่องจักร/นั่งร้าน", P.crane, 18_000, 42_000, "excluded", FULL, "โอนแล้ว", "เช่ารถเครน 25 ตัน ยกโครงหลังคา", { costCode: "05" }),
  T("ค่าเช่าเครื่องจักร/นั่งร้าน", P.scaffold, 9_000, 24_000, "excluded", FULL, "ยังไม่จ่าย", "เช่านั่งร้านเพิ่ม 1 เดือน", { costCode: "03" }),
  T("ค่าขนส่งวัสดุ", P.truck, 3_500, 12_000, "none", RCPT, "โอนแล้ว", "ค่าขนส่งเหล็ก/ไม้แบบเข้าไซต์"),
  T("ผู้รับเหมาช่วง", P.electrician, 15_000, 48_000, "none", RCPT, "โอนแล้ว", "ค่าแรงเดินสายไฟ (ผู้รับเหมาช่วงบุคคล)", { costCode: "06" }),
  T("ผู้รับเหมาช่วง", P.plumber, 12_000, 36_000, "none", RCPT, "โอนแล้ว", "ค่าแรงเดินท่อประปา (ผู้รับเหมาช่วงบุคคล)", { costCode: "07" }),
  T("ค่าทดสอบ/ตรวจสอบวัสดุ", P.lab, 4_800, 14_500, "excluded", FULL, "โอนแล้ว", "ทดสอบกำลังอัดคอนกรีต (ก้อนตัวอย่าง)", { costCode: "03" }),
  T("ค่าแรงหน้างาน (จ่ายรายวัน)", P.labour, 2_400, 7_200, "none", CASHBILL, "เงินสดย่อย", "ค่าแรงจรเก็บงาน/ขนย้ายวัสดุ"),
  T("ค่าไฟฟ้า/ประปาหน้างาน", P.pea, 1_500, 5_800, "included", FULL, "โอนแล้ว", "ค่าไฟฟ้าชั่วคราวหน้างาน"),
  T("ค่าใบอนุญาต/ธรรมเนียมราชการ", P.district, 1_200, 9_500, "none", RCPT, "เงินสด", "ค่าธรรมเนียมใบอนุญาตก่อสร้าง/ขอเลขที่บ้าน"),
  T("วัสดุสำนักงาน/เครื่องเขียน", P.stationery, 900, 6_500, "included", FULL, "เงินสดย่อย", "กระดาษ A3/A4 หมึกพิมพ์ แฟ้ม"),
  T("ค่ารับรองลูกค้า", P.restaurant, 1_200, 5_800, "none", RCPT, "เงินสดย่อย", "รับรองลูกค้าดูงานบ้านตัวอย่าง"),
  T("ค่าโฆษณา/การตลาด", P.ads, 15_000, 45_000, "excluded", FULL, "โอนแล้ว", "โฆษณาออนไลน์และถ่ายภาพผลงาน"),
  T("ซ่อมแซมบำรุงรักษา", P.repair, 3_500, 18_000, "excluded", FULL, "โอนแล้ว", "ซ่อมบำรุงรถบรรทุก/รถกระบะ"),
  T("ค่าธรรมเนียมธนาคาร", P.bank, 150, 1_200, "none", RCPT, "โอนแล้ว", "ค่าธรรมเนียมโอนเงิน/หนังสือค้ำประกัน"),
];

function generateExpenses(): Expense[] {
  const rnd = prng(20261104);
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const money = (min: number, max: number) => (min === max ? min : Math.round((min + rnd() * (max - min)) / 10) * 10);
  const out: Expense[] = [];
  const seqByPrefix = new Map<string, number>();
  const push = (t: Tpl, date: string, period: string) => {
    const prefix = docPrefix("EX", date);
    const n = (seqByPrefix.get(prefix) ?? 0) + 1;
    seqByPrefix.set(prefix, n);
    const sites = SITES.filter((s) => s.from <= period && s.to >= period);
    const site = t.site ? pick(sites) : undefined;
    const amount = money(t.min, t.max);
    const cat = categoryOf(t.category);
    const unpaid = t.pay === "ยังไม่จ่าย";
    out.push({
      id: `${prefix}${String(n).padStart(4, "0")}`,
      date,
      payee: t.payee.name,
      payeeTaxId: t.payee.taxId,
      payeeBranch: "branch" in t.payee ? t.payee.branch : undefined,
      category: t.category,
      docType: t.docType,
      docNo: t.docType === CASHBILL ? undefined : `${t.payee.name.includes("ไฟฟ้า") ? "E" : "INV"}${String(Math.floor(rnd() * 900000) + 100000)}`,
      vatMode: t.vatMode,
      whtRate: cat?.wht ?? 0,
      amount,
      lines: [{ name: t.item, qty: 1, price: amount, unit: t.unit }],
      payStatus: t.pay,
      paidDate: unpaid && date < "2026-10-01" ? monthEnd(period) : undefined,
      paidAccount: unpaid && date < "2026-10-01" ? A.bank : undefined,
      projectId: site?.id,
      costCode: site ? t.costCode : undefined,
      status: "posted",
    });
  };
  for (const period of periodsBetween("2026-01", "2026-11")) {
    const lastDay = period === "2026-11" ? 4 : Number(monthEnd(period).slice(8));
    const day = (d: number) => `${period}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
    if (period !== "2026-11") for (const t of MONTHLY) push(t, day(t.category === "ค่าเช่าสำนักงาน" ? 1 : 20 + Math.floor(rnd() * 6)), period);
    const n = period === "2026-11" ? 3 : 7;
    const days = Array.from({ length: n }, () => 1 + Math.floor(rnd() * (lastDay - 1))).sort((a, b) => a - b);
    for (const d of days) push(pick(POOL), day(d), period);
  }
  // quarterly / annual one-offs
  push(T("เบี้ยประกันภัย", P.insurer, 86_500, 86_500, "included", FULL, "โอนแล้ว", "ประกันภัยงานก่อสร้าง (CAR) ประจำปี"), "2026-01-15", "2026-01");
  push(T("ค่าบริการวิชาชีพ (บัญชี/กฎหมาย/ออกแบบ)", P.accounting, 35_000, 35_000, "excluded", FULL, "โอนแล้ว", "ค่าตรวจสอบบัญชีปี 2568"), "2026-04-28", "2026-04");
  push(T("ภาษีและค่าธรรมเนียมราชการ", P.district, 12_840, 12_840, "none", RCPT, "โอนแล้ว", "ภาษีที่ดินและสิ่งปลูกสร้าง ปี 2569"), "2026-04-30", "2026-04");
  push(T("สวัสดิการพนักงาน", P.restaurant, 28_500, 28_500, "none", RCPT, "โอนแล้ว", "งานเลี้ยงปีใหม่และสงกรานต์พนักงาน"), "2026-04-10", "2026-04");
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export const SEED_EXPENSES: Expense[] = generateExpenses();

// ---------- opening balances and manual journals ----------

const prevPeriodOfStart = "2025-12";
function openingLines(): JournalLine[] {
  const lines: JournalLine[] = [
    { account: A.cash, debit: 60_000, credit: 0 },
    { account: A.bank, debit: 24_500_000, credit: 0 },
    { account: A.petty, debit: 50_000, credit: 0 },
    { account: "1160", debit: 180_000, credit: 0, memo: "เงินประกันการใช้ไฟฟ้า/หนังสือค้ำประกัน" },
    { account: A.inventory, debit: 860_000, credit: 0, memo: "วัสดุคงคลังในโกดัง" },
  ];
  const assetCost = new Map<string, number>(),
    accum = new Map<string, number>();
  for (const a of SEED_ASSETS) {
    if (a.paidFrom !== "opening") continue;
    assetCost.set(a.account, (assetCost.get(a.account) ?? 0) + a.cost);
    const acc = accumulatedAt(a, prevPeriodOfStart);
    if (acc) accum.set(accumAccount(a.account), r2((accum.get(accumAccount(a.account)) ?? 0) + acc));
  }
  for (const [account, v] of assetCost) lines.push({ account, debit: r2(v), credit: 0 });
  for (const [account, v] of accum) lines.push({ account, debit: 0, credit: v });
  lines.push({ account: "2210", debit: 0, credit: 7_500_000, memo: "เงินกู้ระยะยาวธนาคารกรุงไทย" });
  lines.push({ account: A.capital, debit: 0, credit: 20_000_000 });
  const dr = lines.reduce((s, l) => s + Math.round(l.debit * 100), 0),
    cr = lines.reduce((s, l) => s + Math.round(l.credit * 100), 0);
  lines.push({ account: A.retained, debit: 0, credit: (dr - cr) / 100, memo: "กำไรสะสม ณ 31 ธ.ค. 2568" });
  return lines;
}

function pettyReplenishments(): ManualJournal[] {
  const out: ManualJournal[] = [];
  for (const period of periodsBetween("2026-01", "2026-10")) {
    const spent = r2(
      SEED_EXPENSES.filter((x) => x.date.startsWith(period) && x.payStatus === "เงินสดย่อย").reduce((s, x) => s + buildExpenseJournal(x, DEFAULT_ACCOUNTS).calc.net, 0),
    );
    if (!spent) continue;
    out.push({
      id: "",
      date: monthEnd(period),
      memo: `เบิกชดเชยเงินสดย่อย งวด ${period}`,
      ref: `PC-${period}`,
      lines: [
        { account: A.petty, debit: spent, credit: 0 },
        { account: A.bank, debit: 0, credit: spent },
      ],
    });
  }
  return out;
}

function otherJournals(): ManualJournal[] {
  const loan = (date: string): ManualJournal => ({
    id: "",
    date,
    memo: "ผ่อนชำระเงินกู้ธนาคารและดอกเบี้ยรายไตรมาส",
    ref: `LN-${date.slice(0, 7)}`,
    lines: [
      { account: "2210", debit: 375_000, credit: 0 },
      { account: "5610", debit: 98_400, credit: 0 },
      { account: A.bank, debit: 0, credit: 473_400 },
    ],
  });
  return [
    loan("2026-03-31"),
    loan("2026-06-30"),
    loan("2026-09-30"),
    {
      id: "",
      date: "2026-06-30",
      memo: "ดอกเบี้ยเงินฝากออมทรัพย์ ครึ่งปีแรก (ธนาคารหักภาษี 1%)",
      ref: "INT-2026-06",
      lines: [
        { account: A.bank, debit: 17_820, credit: 0 },
        { account: A.whtPrepaid, debit: 180, credit: 0 },
        { account: A.otherIncome, debit: 0, credit: 18_000 },
      ],
    },
    {
      id: "",
      date: "2026-09-30",
      memo: "ตั้งค้างจ่ายค่าตรวจสอบบัญชีปี 2569 (ประมาณการ 9 เดือน)",
      ref: "ACR-2026-09",
      lines: [
        { account: "5350", debit: 27_000, credit: 0 },
        { account: "2160", debit: 0, credit: 27_000 },
      ],
    },
  ];
}

export const SEED_MANUAL: ManualJournal[] = [
  { id: "MJ-0001", date: BOOKS_START, memo: "ยอดยกมา ณ 1 ม.ค. 2569 (จากงบการเงินปี 2568)", ref: "OPEN-2569", source: "opening", lines: openingLines() },
  ...[...pettyReplenishments(), ...otherJournals()].sort((a, b) => a.date.localeCompare(b.date)).map((m, i) => ({ ...m, id: `MJ-${String(i + 2).padStart(4, "0")}` })),
];
