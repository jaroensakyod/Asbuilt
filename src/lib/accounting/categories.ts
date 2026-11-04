// Ported from ZettaFlow (src/lib/expense-categories.ts), retuned for a house-builder and without emoji.
// Each category books to a default account and suggests a withholding rate (Revenue Dept order ท.ป.4/2528):
// hire of work / services 3%, rent 5%, transport 1%, advertising 2%, non-life insurance premium 1%.
// "byCostCode" categories post to the 51xx account of the chosen cost code when the expense is tagged with one.
// An accountant can override the account and the rate on each expense.
import { costCodeAccount } from "./coa";

export type ExpenseCategory = { name: string; account: string; wht: number; byCostCode?: boolean; site?: boolean };
export type ExpenseCategoryGroup = { name: string; items: ExpenseCategory[] };

const c = (name: string, account: string, wht = 0, extra: Partial<ExpenseCategory> = {}): ExpenseCategory => ({ name, account, wht, ...extra });

export const expenseCategoryGroups: ExpenseCategoryGroup[] = [
  {
    name: "ต้นทุนหน้างาน",
    items: [
      c("วัสดุก่อสร้าง", "5103", 0, { byCostCode: true, site: true }),
      c("ผู้รับเหมาช่วง", "5103", 3, { byCostCode: true, site: true }),
      c("ค่าเช่าเครื่องจักร/นั่งร้าน", "5120", 5, { site: true }),
      c("ค่าขนส่งวัสดุ", "5140", 1, { site: true }),
      c("ค่าแรงหน้างาน (จ่ายรายวัน)", "5150", 0, { site: true }),
      c("ค่าน้ำมันเครื่องจักร/รถหน้างาน", "5160", 0, { site: true }),
      c("ค่าไฟฟ้า/ประปาหน้างาน", "5165", 0, { site: true }),
      c("วัสดุสิ้นเปลือง/เครื่องมือเล็ก", "5170", 0, { site: true }),
      c("ค่าทดสอบ/ตรวจสอบวัสดุ", "5175", 3, { site: true }),
      c("ค่าใบอนุญาต/ธรรมเนียมราชการ", "5101", 0, { site: true }),
    ],
  },
  {
    name: "สำนักงาน",
    items: [
      c("ค่าเช่าสำนักงาน", "5310", 5),
      c("ค่าไฟฟ้า/ประปาสำนักงาน", "5320"),
      c("โทรศัพท์/อินเทอร์เน็ต", "5321"),
      c("วัสดุสำนักงาน/เครื่องเขียน", "5330"),
      c("ค่าน้ำมัน/ค่าเดินทาง", "5340"),
      c("ซ่อมแซมบำรุงรักษา", "5360", 3),
    ],
  },
  {
    name: "ขายและบริหาร",
    items: [
      c("ค่าโฆษณา/การตลาด", "5410", 2),
      c("ค่ารับรองลูกค้า", "5420"),
      c("ค่าบริการวิชาชีพ (บัญชี/กฎหมาย/ออกแบบ)", "5350", 3),
      c("สวัสดิการพนักงาน", "5212"),
      c("เบี้ยประกันภัย", "5520", 1),
      c("ค่าธรรมเนียมธนาคาร", "5510"),
      c("ภาษีและค่าธรรมเนียมราชการ", "5530"),
      c("ดอกเบี้ยจ่าย", "5610"),
      c("ค่าใช้จ่ายอื่น", "5900"),
    ],
  },
];

const all = expenseCategoryGroups.flatMap((g) => g.items);
export const expenseCategories = all.map((x) => x.name);
export const categoryOf = (name: string) => all.find((x) => x.name === name);
export const categoryAccount = (name: string, costCode?: string) => {
  const cat = categoryOf(name);
  if (!cat) return undefined;
  return (cat.byCostCode && costCodeAccount(costCode)) || cat.account;
};
