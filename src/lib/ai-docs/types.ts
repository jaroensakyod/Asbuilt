// Shapes the AI returns when it reads a document (pure types, no React).
// Every number is in baht; a missing value comes back as "" or 0 (the schemas make every key required,
// which keeps the model from dropping keys), so mappers treat "" / 0 as "not printed on the document".

export type Confidence = "high" | "medium" | "low";

export const DOC_KINDS = ["tax_invoice_full", "tax_invoice_abb", "receipt", "cash_bill", "invoice", "delivery_note", "quotation", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  tax_invoice_full: "ใบกำกับภาษีเต็มรูป",
  tax_invoice_abb: "ใบกำกับภาษีอย่างย่อ",
  receipt: "ใบเสร็จรับเงิน",
  cash_bill: "บิลเงินสด",
  invoice: "ใบแจ้งหนี้/ใบวางบิล",
  delivery_note: "ใบส่งของ",
  quotation: "ใบเสนอราคา",
  other: "เอกสารอื่น",
};

export type XLine = { description: string; qty: number; unit: string; unitPrice: number; amount: number };

/** supplier tax invoice / receipt / bill / delivery note */
export type InvoiceX = {
  docKind: DocKind;
  vendorName: string;
  vendorTaxId: string;
  vendorBranch: string;
  vendorAddress: string;
  vendorPhone: string;
  docNo: string;
  date: string; // YYYY-MM-DD (ค.ศ.)
  dueDate: string;
  creditDays: number;
  poNumber: string;
  lines: XLine[];
  /** sum of lines before document discount */
  subtotal: number;
  discount: number;
  /** printed line prices already include VAT (typical for ใบกำกับอย่างย่อ / shop receipts) */
  pricesIncludeVat: boolean;
  vatRate: number;
  vat: number;
  total: number;
  whtRate: number;
  whtAmount: number;
  /** any text that hints at a project / site (ชื่อโครงการ, ที่อยู่ส่งของ, หมายเหตุ) */
  projectHint: string;
  /** receipts only: best-matching expense category from the list in the prompt, or "" */
  categoryGuess: string;
  note: string;
  confidence: Confidence;
  /** keys of fields the model could not read clearly */
  uncertain: string[];
};

export type QuoteX = {
  vendorName: string;
  vendorTaxId: string;
  docNo: string;
  date: string;
  validUntil: string;
  validDays: number;
  leadDays: number;
  creditDays: number;
  pricesIncludeVat: boolean;
  lines: XLine[];
  subtotal: number;
  vat: number;
  total: number;
  note: string;
  confidence: Confidence;
  uncertain: string[];
};

export type TenderBoqX = { group: string; description: string; qty: number; unit: string; material: number; labour: number; unitPrice: number };

export type TenderX = {
  title: string;
  client: string;
  province: string;
  source: "egp" | "private";
  method: "e-bidding" | "selection" | "specific" | "invitation";
  egpNo: string;
  budget: number;
  medianPrice: number;
  announced: string;
  siteVisit: string;
  questionsDue: string;
  submitDue: string;
  openDate: string;
  bidBondAmount: number;
  bidBondPct: number;
  durationDays: number;
  penaltyRatePct: number;
  warrantyMonths: number;
  summary: string;
  qualifications: string[];
  risks: string[];
  boq: TenderBoqX[];
  confidence: Confidence;
  uncertain: string[];
};

export type DocSummaryX = {
  kind: "contract" | "permit" | "spec" | "drawing" | "report" | "warranty" | "other";
  title: string;
  summary: string;
  facts: { label: string; value: string }[];
  keyDates: { label: string; date: string }[];
  risks: string[];
  confidence: Confidence;
};

export type Issue = { field: string; msg: string; tone: "warn" | "neg" };
