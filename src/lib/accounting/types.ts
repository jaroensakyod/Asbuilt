// Record shapes of the accounting module. Pure types.
// Shared biz shapes are imported type-only (erased at runtime, so node --test never loads biz.ts).
import type { Line, PayStatus, VatMode } from "./tax";

export type Source =
  | "opening"
  | "installment-invoice"
  | "receipt"
  | "supplier-bill"
  | "bill-payment"
  | "expense"
  | "expense-payment"
  | "payroll"
  | "payroll-payment"
  | "depreciation"
  | "asset"
  | "asset-disposal"
  | "tax-payment"
  | "manual"
  | "closing";

export const SOURCE_LABEL: Record<Source, string> = {
  opening: "ยอดยกมา",
  "installment-invoice": "ใบแจ้งหนี้/ใบกำกับภาษี",
  receipt: "รับชำระ",
  "supplier-bill": "ตั้งหนี้ผู้ขาย",
  "bill-payment": "จ่ายชำระหนี้",
  expense: "ค่าใช้จ่าย",
  "expense-payment": "จ่ายค่าใช้จ่ายค้างจ่าย",
  payroll: "เงินเดือน/ค่าแรง",
  "payroll-payment": "จ่ายเงินเดือน",
  depreciation: "ค่าเสื่อมราคา",
  asset: "ซื้อสินทรัพย์",
  "asset-disposal": "จำหน่ายสินทรัพย์",
  "tax-payment": "นำส่งภาษี/ประกันสังคม",
  manual: "รายการปรับปรุง (JV)",
  closing: "ปิดบัญชีสิ้นปี",
};

export type JournalLine = { account: string; debit: number; credit: number; projectId?: string; costCode?: string; memo?: string };

/** VAT line for ภ.พ.30 detail (รายงานภาษีขาย / ภาษีซื้อ) */
export type TaxMeta = { kind: "output" | "input"; docNo: string; date: string; party: string; taxId?: string; branch?: string; base: number; vat: number };
export type WhtFormName = "ภ.ง.ด.1" | "ภ.ง.ด.3" | "ภ.ง.ด.53";
/** Tax we withheld from a payee (ภ.ง.ด.1/3/53 and 50 ทวิ) */
export type WhtMeta = { key: string; form: WhtFormName; payee: string; taxId?: string; base: number; rate: number; amount: number; incomeType: string; date: string; docNo: string };
/** Tax a customer withheld from us (ภาษีถูกหัก ณ ที่จ่าย) */
export type WhtSuffered = { docNo: string; date: string; payer: string; base: number; amount: number };

export type JournalEntry = {
  id: string; // JV-2026-0001 ("" until a number is assigned)
  key: string; // source:ref — stable identity of the derived entry
  date: string;
  period: string; // YYYY-MM
  source: Source;
  ref: string; // document number
  memo: string;
  lines: JournalLine[];
  posted: boolean;
  tax?: TaxMeta[];
  wht?: WhtMeta[];
  whtSuffered?: WhtSuffered[];
};

// ---------- documents owned by accounting ----------

export type ArInvoice = {
  id: string; // IV-6911-0001
  kind: "invoice";
  installmentId: string;
  projectId: string;
  date: string;
  dueDate: string;
  customerName: string;
  customerTaxId?: string;
  customerBranch?: string; // "สำนักงานใหญ่" / "สาขาที่ 00001"
  customerAddress?: string;
  description: string;
  amount: number; // excl. VAT
  vat: number;
  retention: number; // baht withheld by the customer as performance retention (excl. VAT)
  /** "receipt": construction is a service, so output VAT is due when paid (ภาษีขายยังไม่ถึงกำหนด until then). */
  taxPoint: "invoice" | "receipt";
  synthetic?: boolean; // reconstructed from an installment that was invoiced outside this module
};
export type ArReceipt = {
  id: string; // RC-6911-0001
  kind: "receipt";
  installmentId: string;
  projectId: string;
  invoiceNo: string;
  date: string;
  account: string; // 1112 bank / 1111 cash
  whtRate: number; // customer withheld (%)
  wht: number;
  received: number;
  note?: string;
  synthetic?: boolean;
};
export type ArDoc = ArInvoice | ArReceipt;

export type ApPayment = {
  id: string; // PV-6911-0001
  billId: string;
  date: string;
  account: string; // 1112 / 1111
  whtRate: number;
  wht: number;
  paid: number;
  note?: string;
  synthetic?: boolean;
};

export type Expense = {
  id: string; // EX-6910-0001
  date: string;
  payee: string;
  payeeTaxId?: string;
  payeeBranch?: string;
  category: string;
  accountCode?: string;
  docType: string;
  docNo?: string;
  vatMode: VatMode;
  whtRate: number;
  amount: number; // as printed, after document discount
  lines?: Line[];
  discount?: number;
  discountType?: "amount" | "percent";
  payStatus: PayStatus;
  paidDate?: string; // when an unpaid expense is settled later
  paidAccount?: string;
  projectId?: string;
  costCode?: string;
  note?: string;
  status?: "posted" | "void";
};

export type FixedAsset = {
  id: string; // FA-0001
  name: string;
  account: string; // 1210 / 1220 / 1230 / 1240 / 1250 / 1260
  serial?: string;
  cost: number; // excl. VAT
  vat?: number;
  salvage: number;
  lifeYears: number; // 0 = not depreciated (land)
  startDate: string; // in use from
  site: boolean; // used on construction sites → depreciation is a construction cost
  projectId?: string;
  paidFrom: "opening" | "1112" | "2111";
  disposedDate?: string;
  proceeds?: number;
};

export type ManualJournal = {
  id: string; // MJ-0001
  date: string;
  memo: string;
  ref?: string;
  source?: "manual" | "opening";
  lines: JournalLine[];
  createdBy?: string;
};

export type TaxFilingKind = "pp30" | "pnd1" | "pnd3" | "pnd53" | "sso";
export const FILING_LABEL: Record<TaxFilingKind, string> = { pp30: "ภ.พ.30", pnd1: "ภ.ง.ด.1", pnd3: "ภ.ง.ด.3", pnd53: "ภ.ง.ด.53", sso: "ประกันสังคม สปส.1-10" };
export type TaxFiling = { id: string; kind: TaxFilingKind; period: string; paidDate: string; amount: number; account: string; ref?: string };

export type PeriodLock = { id: string; closedAt: string; closedBy: string; entries: JournalEntry[] };
export type JvNumber = { id: string; key: string };

/** Issued หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) */
export type WhtCertificate = {
  id: string; // WHT-2569-0001
  no: string; // 2569/0001
  key: string; // WhtMeta.key
  form: WhtFormName;
  payee: string;
  payeeTaxId?: string;
  payeeAddress?: string;
  payeeBranch?: string;
  incomeRow: "1" | "2" | "3" | "4a" | "4b" | "5" | "6";
  incomeDesc: string;
  date: string;
  base: number;
  rate: number;
  amount: number;
  payerMode: "withhold" | "always" | "once";
  issuedAt: string;
};

export type BankMatch = { id: string; cleared: boolean; statementDate?: string };
export type BankStatement = { id: string; account: string; period: string; balance: number };

export type ProjectRef = { id: string; name: string; owner: string; address?: string };
