// Demo seeds for the shared business collections owned by sales/estimating:
//   installments  — payment schedule of every existing project, consistent with its progress
//   budgets       — project budget from the model's estimate, ≈ value × (1 − margin) by cost code
// Registered with provideSeed() at import time (see src/lib/modules.ts).

import { projects } from "../data";
import { provideSeed, type Budget, type Installment } from "../biz";
import { budgetLinesFrom, computeBoq, type BoqResult } from "./boq";
import { sampleBook } from "./prices-data";
import { historyFor, linkedOf } from "./terms";

/** Projects whose current installment is overdue in the demo */
const OVERDUE = new Set(["HC-2026-02", "HC-2026-09"]);
/** Delivered project where the customer still holds the 5 % retention */
const HOLD_RETENTION = new Set(["HC-2025-02"]);

const MEASURED = new Set(["HC-2025-03", "HC-2026-03", "HC-2024-05"]);

function seedInstallments(): Installment[] {
  const out: Installment[] = [];
  const seq = { inv: 0, rcp: 0 };
  const list = [...projects].sort((a, b) => (a.contractDate ?? a.start).localeCompare(b.contractDate ?? b.start));
  // projects billed by measured progress (interim payment certificates, see lib/contracts) have no milestone installments
  for (const p of list) if (!MEASURED.has(p.id)) out.push(...historyFor(p, { quoteId: linkedOf(p.id)?.quoteId, overdue: OVERDUE.has(p.id), holdRetention: HOLD_RETENTION.has(p.id), seq }));
  renumber(out, "invoiceNo", (i) => i.dueDate, "INV");
  renumber(out, "receiptNo", (i) => i.paidDate ?? i.dueDate, "RCP");
  return out;
}

/** Sequential document numbers per year in date order */
function renumber(list: Installment[], key: "invoiceNo" | "receiptNo", dateOf: (i: Installment) => string, prefix: string) {
  const seq: Record<string, number> = {};
  for (const i of list.filter((x) => x[key]).sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.id.localeCompare(b.id))) {
    const y = dateOf(i).slice(0, 4);
    seq[y] = (seq[y] ?? 0) + 1;
    i[key] = `${prefix}-${y}-${String(seq[y]).padStart(4, "0")}`;
  }
}

const boqCache = new Map<string, BoqResult>();
export function modelBoq(code: string) {
  let r = boqCache.get(code);
  if (!r) {
    r = computeBoq(code, sampleBook("cgd"));
    boqCache.set(code, r);
  }
  return r;
}

/** Planned margin per project (16–21 %), deterministic */
export function plannedMargin(projectId: string) {
  let h = 0;
  for (const c of projectId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 16 + (h % 6);
}

function seedBudgets(): Budget[] {
  return projects.map((p) => {
    const value = Math.round(p.value * 1e6);
    const target = value * (1 - plannedMargin(p.id) / 100);
    return {
      id: `BUD-${p.id}`,
      projectId: p.id,
      estimateId: linkedOf(p.id)?.estimateId,
      lines: budgetLinesFrom(modelBoq(p.modelCode), target),
      contractValue: value,
      approvedDate: p.contractDate ?? p.start,
    };
  });
}

provideSeed("installments", seedInstallments);
provideSeed("budgets", seedBudgets);
