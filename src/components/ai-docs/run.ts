"use client";

// The AI calls behind each flow (one aiJson per document). Kept apart from the forms so every
// flow sends the same schema + Thai prompt and gets the same normalised shape back.

import { aiJson } from "@/lib/ai/client";
import type { AiFile } from "@/lib/ai/types";
import { TODAY } from "@/lib/data";
import {
  docSummarySchema,
  docSummarySystem,
  invoicePrompt,
  invoiceSchema,
  invoiceSystem,
  quotePrompt,
  quoteSchema,
  quoteSystem,
  tenderPrompt,
  tenderSchema,
  tenderSystem,
  type DocSummaryX,
  type InvoiceX,
  type QuoteX,
  type TenderX,
} from "@/lib/ai-docs";

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0);

function cleanInvoice(r: Partial<InvoiceX>): InvoiceX {
  return {
    docKind: (r.docKind ?? "other") as InvoiceX["docKind"],
    vendorName: s(r.vendorName),
    vendorTaxId: s(r.vendorTaxId),
    vendorBranch: s(r.vendorBranch),
    vendorAddress: s(r.vendorAddress),
    vendorPhone: s(r.vendorPhone),
    docNo: s(r.docNo),
    date: s(r.date),
    dueDate: s(r.dueDate),
    creditDays: n(r.creditDays),
    poNumber: s(r.poNumber),
    lines: arr<InvoiceX["lines"][number]>(r.lines).map((l) => ({ description: s(l.description), qty: n(l.qty), unit: s(l.unit), unitPrice: n(l.unitPrice), amount: n(l.amount) })),
    subtotal: n(r.subtotal),
    discount: n(r.discount),
    pricesIncludeVat: !!r.pricesIncludeVat,
    vatRate: n(r.vatRate),
    vat: n(r.vat),
    total: n(r.total),
    whtRate: n(r.whtRate),
    whtAmount: n(r.whtAmount),
    projectHint: s(r.projectHint),
    categoryGuess: s(r.categoryGuess),
    note: s(r.note),
    confidence: r.confidence ?? "medium",
    uncertain: arr<string>(r.uncertain).map(s),
  };
}

export async function readInvoice(files: AiFile[], ctx: Parameters<typeof invoicePrompt>[0]): Promise<InvoiceX> {
  const task = ctx.purpose === "expense" ? "ocr-receipt" : ctx.purpose === "delivery" ? "ocr-delivery-note" : "ocr-bill";
  const r = await aiJson<Partial<InvoiceX>>(task, { system: invoiceSystem(TODAY), prompt: invoicePrompt(ctx), files, schema: invoiceSchema(ctx.categories), temperature: 0 });
  return cleanInvoice(r ?? {});
}

export async function readQuote(files: AiFile[], prLines: { description: string; qty: number; unit: string }[]): Promise<QuoteX> {
  const r = (await aiJson<Partial<QuoteX>>("ocr-quotation", { system: quoteSystem(TODAY), prompt: quotePrompt(prLines), files, schema: quoteSchema, temperature: 0 })) ?? {};
  return {
    vendorName: s(r.vendorName),
    vendorTaxId: s(r.vendorTaxId),
    docNo: s(r.docNo),
    date: s(r.date),
    validUntil: s(r.validUntil),
    validDays: n(r.validDays),
    leadDays: n(r.leadDays),
    creditDays: n(r.creditDays),
    pricesIncludeVat: !!r.pricesIncludeVat,
    lines: arr<QuoteX["lines"][number]>(r.lines).map((l) => ({ description: s(l.description), qty: n(l.qty), unit: s(l.unit), unitPrice: n(l.unitPrice), amount: n(l.amount) })),
    subtotal: n(r.subtotal),
    vat: n(r.vat),
    total: n(r.total),
    note: s(r.note),
    confidence: r.confidence ?? "medium",
    uncertain: arr<string>(r.uncertain).map(s),
  };
}

export async function readTender(files: AiFile[], hint?: string): Promise<TenderX> {
  const r = (await aiJson<Partial<TenderX>>("ocr-tender", { system: tenderSystem(TODAY), prompt: tenderPrompt(hint), files, schema: tenderSchema, temperature: 0 })) ?? {};
  return {
    title: s(r.title),
    client: s(r.client),
    province: s(r.province),
    source: r.source === "egp" ? "egp" : "private",
    method: (r.method ?? "invitation") as TenderX["method"],
    egpNo: s(r.egpNo),
    budget: n(r.budget),
    medianPrice: n(r.medianPrice),
    announced: s(r.announced),
    siteVisit: s(r.siteVisit),
    questionsDue: s(r.questionsDue),
    submitDue: s(r.submitDue),
    openDate: s(r.openDate),
    bidBondAmount: n(r.bidBondAmount),
    bidBondPct: n(r.bidBondPct),
    durationDays: n(r.durationDays),
    penaltyRatePct: n(r.penaltyRatePct),
    warrantyMonths: n(r.warrantyMonths),
    summary: s(r.summary),
    qualifications: arr<string>(r.qualifications).map(s).filter(Boolean),
    risks: arr<string>(r.risks).map(s).filter(Boolean),
    boq: arr<TenderX["boq"][number]>(r.boq).map((l) => ({ group: s(l.group), description: s(l.description), qty: n(l.qty), unit: s(l.unit), material: n(l.material), labour: n(l.labour), unitPrice: n(l.unitPrice) })),
    confidence: r.confidence ?? "medium",
    uncertain: arr<string>(r.uncertain).map(s),
  };
}

export async function summarizeDoc(files: AiFile[], category: string, title: string): Promise<DocSummaryX> {
  const r = (await aiJson<Partial<DocSummaryX>>("doc-summary", { system: docSummarySystem(TODAY, category), prompt: `สรุปเอกสาร "${title}" ที่แนบ`, files, schema: docSummarySchema, temperature: 0.1 })) ?? {};
  return {
    kind: (r.kind ?? "other") as DocSummaryX["kind"],
    title: s(r.title) || title,
    summary: s(r.summary),
    facts: arr<{ label: string; value: string }>(r.facts).map((f) => ({ label: s(f.label), value: s(f.value) })).filter((f) => f.label && f.value),
    keyDates: arr<{ label: string; date: string }>(r.keyDates).map((f) => ({ label: s(f.label), date: s(f.date) })).filter((f) => f.label),
    risks: arr<string>(r.risks).map(s).filter(Boolean),
    confidence: r.confidence ?? "medium",
  };
}
