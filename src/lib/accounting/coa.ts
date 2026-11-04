// Thai chart of accounts for a house-builder (based on ZettaFlow's defaultAccounts in src/lib/ledger.ts,
// extended for construction: AR / retention / WIP / deferred VAT / payroll / fixed assets).
// Pure: no React, no "@/" imports.

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type Account = {
  id: string; // = code (collection id)
  code: string;
  name: string;
  type: AccountType;
  parent?: string; // header account code
  header?: boolean; // grouping line, not postable
  active: boolean;
  /** cost of construction (51xx) vs SG&A, for the P&L layout */
  group?: "cost" | "sga" | "other";
};

export const TYPE_LABEL: Record<AccountType, string> = {
  asset: "สินทรัพย์",
  liability: "หนี้สิน",
  equity: "ส่วนของเจ้าของ",
  income: "รายได้",
  expense: "ค่าใช้จ่าย",
};
/** Debit-normal accounts: assets and expenses. */
export const debitNormal = (t: AccountType) => t === "asset" || t === "expense";
export const typeOfCode = (code: string): AccountType =>
  code.startsWith("1") ? "asset" : code.startsWith("2") ? "liability" : code.startsWith("3") ? "equity" : code.startsWith("4") ? "income" : "expense";

/** Cost-code labels (copy of COST_CODES in src/lib/biz.ts — duplicated so this file stays import-free). */
export const COST_CODE_NAMES: Record<string, string> = {
  "01": "งานเตรียมการ/ใบอนุญาต",
  "02": "งานฐานราก",
  "03": "งานโครงสร้าง",
  "04": "งานก่ออิฐ/ฉาบ",
  "05": "งานหลังคา",
  "06": "งานระบบไฟฟ้า",
  "07": "งานระบบประปา/สุขาภิบาล",
  "08": "งานระบบปรับอากาศ",
  "09": "งานประตู/หน้าต่าง",
  "10": "งานพื้น/ผนัง/ฝ้า (ตกแต่ง)",
  "11": "งานสี",
  "12": "สุขภัณฑ์/อุปกรณ์",
  "13": "งานภายนอก/รั้ว/ถนน",
  "90": "ค่าดำเนินการ (overhead)",
};
/** Cost code "03" → 5103 ต้นทุนงานโครงสร้าง; "90" → 5190. */
export const costCodeAccount = (cc: string | undefined) => (cc && COST_CODE_NAMES[cc] ? `51${cc}` : undefined);
export const accountCostCode = (code: string) => (/^51(0\d|1[0-3]|90)$/.test(code) ? code.slice(2) : undefined);

// well-known accounts used by the posting rules
export const A = {
  cash: "1111",
  bank: "1112",
  petty: "1113",
  ar: "1130",
  retention: "1135",
  inputVat: "1154",
  inputVatDeferred: "1155",
  vatCredit: "1156",
  whtPrepaid: "1157",
  wip: "1180",
  inventory: "1190",
  ap: "2111",
  advance: "2120",
  whtPayable: "2132",
  ssoPayable: "2133",
  outputVat: "2135",
  outputVatDeferred: "2136",
  salaryPayable: "2140",
  retentionPayable: "2150",
  capital: "3100",
  retained: "3200",
  revenue: "4110",
  serviceRevenue: "4120",
  otherIncome: "4900",
  gainOnDisposal: "4910",
  siteLabour: "5150",
  siteLabourSso: "5151",
  siteDepreciation: "5180",
  salaries: "5210",
  officeSso: "5211",
  officeDepreciation: "5250",
  lossOnDisposal: "5590",
  otherExpense: "5900",
} as const;

type Row = [code: string, name: string, parent?: string, header?: boolean];
const ROWS: Row[] = [
  ["1000", "สินทรัพย์", undefined, true],
  ["1100", "สินทรัพย์หมุนเวียน", "1000", true],
  ["1111", "เงินสด", "1100"],
  ["1112", "เงินฝากธนาคาร", "1100"],
  ["1113", "เงินสดย่อย", "1100"],
  ["1130", "ลูกหนี้การค้า", "1100"],
  ["1135", "ลูกหนี้เงินประกันผลงาน", "1100"],
  ["1154", "ภาษีซื้อ", "1100"],
  ["1155", "ภาษีซื้อยังไม่ถึงกำหนด", "1100"],
  ["1156", "ภาษีมูลค่าเพิ่มชำระเกินยกไป", "1100"],
  ["1157", "ภาษีถูกหัก ณ ที่จ่าย", "1100"],
  ["1160", "เงินมัดจำและเงินประกัน", "1100"],
  ["1180", "งานระหว่างก่อสร้าง", "1100"],
  ["1190", "สินค้าและวัสดุคงคลัง", "1100"],
  ["1200", "ที่ดิน อาคารและอุปกรณ์", "1000", true],
  ["1210", "อาคารสำนักงาน", "1200"],
  ["1211", "ค่าเสื่อมราคาสะสม-อาคาร", "1200"],
  ["1220", "เครื่องจักรและเครื่องมือก่อสร้าง", "1200"],
  ["1221", "ค่าเสื่อมราคาสะสม-เครื่องจักร", "1200"],
  ["1230", "ยานพาหนะ", "1200"],
  ["1231", "ค่าเสื่อมราคาสะสม-ยานพาหนะ", "1200"],
  ["1240", "อุปกรณ์สำนักงานและคอมพิวเตอร์", "1200"],
  ["1241", "ค่าเสื่อมราคาสะสม-อุปกรณ์สำนักงาน", "1200"],
  ["1250", "เฟอร์นิเจอร์และเครื่องตกแต่ง", "1200"],
  ["1251", "ค่าเสื่อมราคาสะสม-เฟอร์นิเจอร์", "1200"],
  ["1260", "ที่ดิน", "1200"],

  ["2000", "หนี้สิน", undefined, true],
  ["2100", "หนี้สินหมุนเวียน", "2000", true],
  ["2111", "เจ้าหนี้การค้า", "2100"],
  ["2120", "เงินรับล่วงหน้าค่างวด", "2100"],
  ["2132", "ภาษีหัก ณ ที่จ่ายค้างจ่าย", "2100"],
  ["2133", "เงินประกันสังคมค้างจ่าย", "2100"],
  ["2135", "ภาษีขาย", "2100"],
  ["2136", "ภาษีขายยังไม่ถึงกำหนด", "2100"],
  ["2140", "เงินเดือนและค่าแรงค้างจ่าย", "2100"],
  ["2150", "เงินประกันผลงานค้างจ่ายผู้รับเหมา", "2100"],
  ["2160", "ค่าใช้จ่ายค้างจ่าย", "2100"],
  ["2200", "หนี้สินไม่หมุนเวียน", "2000", true],
  ["2210", "เงินกู้ยืมระยะยาวจากธนาคาร", "2200"],

  ["3000", "ส่วนของเจ้าของ", undefined, true],
  ["3100", "ทุนจดทะเบียนที่ชำระแล้ว", "3000"],
  ["3200", "กำไรสะสม", "3000"],

  ["4000", "รายได้", undefined, true],
  ["4110", "รายได้ค่าก่อสร้าง", "4000"],
  ["4120", "รายได้ค่าบริการซ่อม", "4000"],
  ["4900", "รายได้อื่น", "4000"],
  ["4910", "กำไรจากการจำหน่ายสินทรัพย์", "4000"],

  ["5100", "ต้นทุนงานก่อสร้าง", undefined, true],
  ...Object.entries(COST_CODE_NAMES).map(([cc, name]): Row => [`51${cc}`, `ต้นทุน${name}`, "5100"]),
  ["5120", "ค่าเช่าเครื่องจักรและนั่งร้าน", "5100"],
  ["5140", "ค่าขนส่งวัสดุ", "5100"],
  ["5150", "ค่าแรงงานก่อสร้าง", "5100"],
  ["5151", "เงินสมทบประกันสังคม-แรงงานก่อสร้าง", "5100"],
  ["5160", "ค่าน้ำมันเชื้อเพลิงหน้างาน", "5100"],
  ["5165", "ค่าไฟฟ้า/ประปาหน้างาน", "5100"],
  ["5170", "วัสดุสิ้นเปลืองและเครื่องมือเล็ก", "5100"],
  ["5175", "ค่าทดสอบและตรวจสอบวัสดุ", "5100"],
  ["5180", "ค่าเสื่อมราคา-เครื่องจักรและยานพาหนะ", "5100"],

  ["5200", "ค่าใช้จ่ายในการขายและบริหาร", undefined, true],
  ["5210", "เงินเดือนและค่าจ้าง", "5200"],
  ["5211", "เงินสมทบประกันสังคม", "5200"],
  ["5212", "สวัสดิการพนักงาน", "5200"],
  ["5250", "ค่าเสื่อมราคา-สำนักงาน", "5200"],
  ["5310", "ค่าเช่าสำนักงาน", "5200"],
  ["5320", "ค่าไฟฟ้าและประปาสำนักงาน", "5200"],
  ["5321", "ค่าโทรศัพท์และอินเทอร์เน็ต", "5200"],
  ["5330", "วัสดุสำนักงานและเครื่องเขียน", "5200"],
  ["5340", "ค่าน้ำมันและค่าเดินทาง", "5200"],
  ["5350", "ค่าบริการวิชาชีพ", "5200"],
  ["5360", "ค่าซ่อมแซมและบำรุงรักษา", "5200"],
  ["5410", "ค่าโฆษณาและส่งเสริมการขาย", "5200"],
  ["5420", "ค่ารับรอง", "5200"],
  ["5510", "ค่าธรรมเนียมธนาคาร", "5200"],
  ["5520", "เบี้ยประกันภัย", "5200"],
  ["5530", "ภาษีและค่าธรรมเนียมราชการ", "5200"],
  ["5590", "ขาดทุนจากการจำหน่ายสินทรัพย์", "5200"],
  ["5610", "ดอกเบี้ยจ่าย", "5200"],
  ["5900", "ค่าใช้จ่ายอื่น", "5200"],
];

export const DEFAULT_ACCOUNTS: Account[] = ROWS.map(([code, name, parent, header]) => {
  const type = typeOfCode(code);
  return {
    id: code,
    code,
    name,
    type,
    parent,
    header: header || undefined,
    active: true,
    group: type === "expense" ? (code.startsWith("51") ? "cost" : "sga") : undefined,
  };
});

export const accountName = (accounts: Account[], code: string) => accounts.find((a) => a.code === code)?.name ?? DEFAULT_ACCOUNTS.find((a) => a.code === code)?.name ?? code;
