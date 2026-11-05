// Payment schedule templates and installment generation (pure; shared by the
// quotation "เซ็นสัญญา" action and the demo seeds in seed-biz.ts).

import { projects, TODAY, type Project } from "../data";
import type { Installment, InstallmentStatus } from "../biz";

export type Milestone = "contract" | "foundation" | "structure" | "masonry" | "mep" | "finish" | "handover";
export type PayTerm = { no: number; title: string; milestone: Milestone; percent: number };

/** Point in the build (0..1) at which a milestone is reached — mirrors PHASE_WINDOW in lib/house.ts */
export const MILESTONE_AT: Record<Milestone, number> = {
  contract: 0,
  foundation: 0.12,
  structure: 0.38,
  masonry: 0.58,
  mep: 0.76,
  finish: 0.9,
  handover: 1,
};
export const MILESTONE_LABEL: Record<Milestone, string> = {
  contract: "ลงนามสัญญา",
  foundation: "งานฐานราก",
  structure: "งานโครงสร้าง",
  masonry: "งานก่ออิฐ/หลังคา",
  mep: "งานระบบ",
  finish: "งานตกแต่ง",
  handover: "ส่งมอบ",
};

/** Default 7 งวด; the last 5 % is held as retention until handover. */
export const DEFAULT_TERMS: PayTerm[] = [
  { no: 1, title: "ทำสัญญา", milestone: "contract", percent: 10 },
  { no: 2, title: "งานฐานรากแล้วเสร็จ", milestone: "foundation", percent: 15 },
  { no: 3, title: "งานโครงสร้างแล้วเสร็จ", milestone: "structure", percent: 20 },
  { no: 4, title: "งานก่ออิฐและหลังคาแล้วเสร็จ", milestone: "masonry", percent: 20 },
  { no: 5, title: "งานระบบไฟฟ้า/ประปาแล้วเสร็จ", milestone: "mep", percent: 15 },
  { no: 6, title: "งานตกแต่งแล้วเสร็จ", milestone: "finish", percent: 15 },
  { no: 7, title: "ส่งมอบบ้าน (เงินประกันผลงาน)", milestone: "handover", percent: 5 },
];

export const TERM_TEMPLATES: { key: string; label: string; terms: PayTerm[] }[] = [
  { key: "std7", label: "มาตรฐาน 7 งวด (ประกันผลงาน 5%)", terms: DEFAULT_TERMS },
  {
    key: "fast5",
    label: "5 งวด สำหรับบ้านชั้นเดียว",
    terms: [
      { no: 1, title: "ทำสัญญา", milestone: "contract", percent: 10 },
      { no: 2, title: "งานฐานรากและโครงสร้างแล้วเสร็จ", milestone: "structure", percent: 30 },
      { no: 3, title: "งานก่ออิฐ หลังคา และงานระบบแล้วเสร็จ", milestone: "mep", percent: 30 },
      { no: 4, title: "งานตกแต่งแล้วเสร็จ", milestone: "finish", percent: 25 },
      { no: 5, title: "ส่งมอบบ้าน (เงินประกันผลงาน)", milestone: "handover", percent: 5 },
    ],
  },
];

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);
const minIso = (a: string, b: string) => (a < b ? a : b);

/** Planned due date for a term: contract date, or start + fraction of the build duration. */
export function dueDateOf(t: PayTerm, contractDate: string, start: string, finish: string) {
  if (t.milestone === "contract") return contractDate;
  const s = Date.parse(start);
  const f = Date.parse(finish);
  return new Date(s + (f - s) * MILESTONE_AT[t.milestone]).toISOString().slice(0, 10);
}

export const VAT_RATE = 7;

/** Fresh schedule for a newly signed contract: everything scheduled. */
export function scheduleFor(input: { projectId: string; quoteId?: string; contractValue: number; contractDate: string; start: string; finish: string; terms: PayTerm[] }): Installment[] {
  return input.terms.map((t) => {
    const amount = Math.round((input.contractValue * t.percent) / 100);
    return {
      id: `INS-PAY-${input.projectId}-${t.no}`,
      projectId: input.projectId,
      quoteId: input.quoteId,
      no: t.no,
      title: `งวดที่ ${t.no} · ${t.title}`,
      milestone: MILESTONE_LABEL[t.milestone],
      percent: t.percent,
      amount,
      vat: Math.round((amount * VAT_RATE) / 100),
      dueDate: dueDateOf(t, input.contractDate, input.start, input.finish),
      status: "scheduled" as InstallmentStatus,
    };
  });
}

/**
 * Demo history for an existing project: milestones already reached are paid,
 * the next one is invoiced / due (a few overdue), the rest scheduled.
 */
export function historyFor(p: Project, opts: { quoteId?: string; overdue: boolean; holdRetention?: boolean; seq: { inv: number; rcp: number } }): Installment[] {
  const contractDate = p.contractDate ?? p.start;
  const base = scheduleFor({ projectId: p.id, quoteId: opts.quoteId, contractValue: Math.round(p.value * 1e6), contractDate, start: p.start, finish: p.finish, terms: DEFAULT_TERMS });
  let currentSet = false;
  return base.map((ins, i) => {
    const t = DEFAULT_TERMS[i];
    if (opts.holdRetention && t.milestone === "handover" && p.status === "delivered") {
      opts.seq.inv++;
      return { ...ins, status: "overdue" as const, invoiceNo: `INV-${ins.dueDate.slice(0, 4)}-${String(opts.seq.inv).padStart(4, "0")}` };
    }
    const reached = p.status === "delivered" || (contractDate <= TODAY && (t.milestone === "contract" || (p.status !== "planning" && p.actual >= MILESTONE_AT[t.milestone] * 100)));
    const yr = (d: string) => d.slice(0, 4);
    if (reached) {
      // ahead-of-plan milestones were billed when reached, not at the planned date
      const due = minIso(ins.dueDate, addDays(TODAY, -6 - i));
      const paid = minIso(addDays(due, 5 + ((p.id.charCodeAt(p.id.length - 1) + i) % 12)), addDays(TODAY, -1));
      opts.seq.inv++;
      opts.seq.rcp++;
      return { ...ins, dueDate: due, status: "paid" as const, paidDate: paid < due ? due : paid, invoiceNo: `INV-${yr(due)}-${String(opts.seq.inv).padStart(4, "0")}`, receiptNo: `RCP-${yr(paid)}-${String(opts.seq.rcp).padStart(4, "0")}` };
    }
    if (!currentSet) {
      currentSet = true;
      const days = (Date.parse(ins.dueDate) - Date.parse(TODAY)) / 86400000;
      if (t.milestone === "contract" && days > 0) return days <= 45 ? { ...ins, status: "due" as const } : ins;
      if (opts.overdue && days < -10) {
        opts.seq.inv++;
        return { ...ins, status: "overdue" as const, invoiceNo: `INV-${yr(ins.dueDate)}-${String(opts.seq.inv).padStart(4, "0")}` };
      }
      if (days <= 7) {
        // milestone due now or late on site: bill raised when the stage is inspected
        const due = days < -30 ? addDays(TODAY, -8) : ins.dueDate;
        opts.seq.inv++;
        return { ...ins, dueDate: due, status: "invoiced" as const, invoiceNo: `INV-${yr(due)}-${String(opts.seq.inv).padStart(4, "0")}` };
      }
      if (days <= 45) return { ...ins, status: "due" as const };
    }
    return ins;
  });
}

/** Projects whose sale is recorded in the CRM demo data (won lead + approved quote). */
export const LINKED_PROJECT_IDS = projects
  .filter((p) => p.modelCode !== "CD-01" && (p.contractDate ?? "") >= "2025-10-01")
  .sort((a, b) => (a.contractDate ?? "").localeCompare(b.contractDate ?? ""))
  .map((p) => p.id);

const shift = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);

/** Quote / estimate ids and dates for the linked projects (stable, used by CRM seeds and biz seeds). */
export const LINKED: { projectId: string; quoteId: string; estimateId: string; quoteDate: string; estimateDate: string }[] = (() => {
  const seqQ: Record<string, number> = {};
  const seqE: Record<string, number> = {};
  return LINKED_PROJECT_IDS.map((id, i) => {
    const p = projects.find((x) => x.id === id)!;
    const contract = p.contractDate ?? p.start;
    const q0 = shift(contract, -(12 + ((i * 7) % 15)));
    const quoteDate = q0 > TODAY ? shift(TODAY, -6) : q0;
    const estimateDate = shift(quoteDate, -(3 + (i % 4)));
    const qy = quoteDate.slice(0, 4);
    const ey = estimateDate.slice(0, 4);
    seqQ[qy] = (seqQ[qy] ?? 0) + 1;
    seqE[ey] = (seqE[ey] ?? 0) + 1;
    return { projectId: id, quoteId: `QT-${qy}-${String(seqQ[qy]).padStart(4, "0")}`, estimateId: `EST-${ey}-${String(seqE[ey]).padStart(4, "0")}`, quoteDate, estimateDate };
  });
})();
export const linkedOf = (projectId: string) => LINKED.find((l) => l.projectId === projectId);
