// Pure design-module calculations (no React, no "@/" imports) — unit tested in tests/design.

import type { Installment } from "../biz";
import {
  STAGE_KEYS,
  STAGE_LABEL,
  type BuildingUse,
  type CompletionKind,
  type DesignSettings,
  type DesignStage,
  type Permit,
  type PermitDoc,
  type PermitRoute,
  type SpecClause,
  type SpecSection,
  type SpecSet,
  type StageKey,
} from "./types";

const DAY = 86400000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso.slice(0, 10)) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Legal / commercial numbers are defaults only: shown with "ตรวจสอบกับประกาศล่าสุด" and editable in settings. */
export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  id: "design",
  feePct: { concept: 15, schematic: 25, dd: 25, cd: 30, permit: 5 },
  autoInstallment: true,
  installmentDueDays: 7,
  vatRate: 7,
  reviewAlertDays: 7,
  permitPendingDays: 30,
  permitExpiryDays: 60,
  permitValidityDays: 365,
  permitReviewDays: 45,
  m39ReviewDays: 120,
  eiaHeightM: 23,
  eiaAreaM2: 10000,
  eiaCondoUnits: 80,
  largeBuildingM2: 2000,
};

// ---------- design stages ----------

export function stageProgress(s: Pick<DesignStage, "deliverables" | "status">) {
  const total = s.deliverables.length;
  const done = s.deliverables.filter((d) => d.done).length;
  const pct = s.status === "approved" ? 100 : total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

/** Overall state of a project's design: current stage (first not approved), % complete weighted by fee share */
export function designState(stages: DesignStage[], feePct: Record<StageKey, number>) {
  const ordered = [...stages].sort((a, b) => STAGE_KEYS.indexOf(a.key) - STAGE_KEYS.indexOf(b.key));
  const current = ordered.find((s) => s.status !== "approved");
  const weight = (k: StageKey) => feePct[k] || 1;
  const totalW = ordered.reduce((t, s) => t + weight(s.key), 0) || 1;
  const pct = Math.round(ordered.reduce((t, s) => t + (weight(s.key) * stageProgress(s).pct) / 100, 0) / totalW * 100);
  const approved = ordered.filter((s) => s.status === "approved").length;
  const revisions = ordered.reduce((t, s) => t + s.revisions, 0);
  return { current, pct, approved, total: ordered.length, revisions, done: !current && ordered.length > 0 };
}

/** Split a design fee over the stages by percentage; the last stage takes the rounding difference. */
export function stageFees(feeTotal: number, feePct: Record<StageKey, number>): Record<StageKey, number> {
  const sum = STAGE_KEYS.reduce((t, k) => t + (feePct[k] || 0), 0) || 100;
  const out = {} as Record<StageKey, number>;
  let used = 0;
  STAGE_KEYS.forEach((k, i) => {
    const v = i === STAGE_KEYS.length - 1 ? r2(feeTotal - used) : r2((feeTotal * (feePct[k] || 0)) / sum);
    out[k] = v;
    used = r2(used + v);
  });
  return out;
}

/** Days the client has had a stage for review (undefined when not waiting on the client) */
export function waitingDays(s: Pick<DesignStage, "status" | "submittedAt">, today: string) {
  if (s.status !== "client_review" || !s.submittedAt) return undefined;
  return daysBetween(s.submittedAt, today);
}

export const isStageLate = (s: Pick<DesignStage, "status" | "due">, today: string) => s.status !== "approved" && s.due < today;

/** The design-fee installment created when a stage is approved ("ค่าออกแบบ …"). */
export function designFeeInstallment(
  s: Pick<DesignStage, "projectId" | "key" | "fee" | "approvedAt">,
  opts: { no: number; vatRate: number; dueDays: number; today: string; contractValue?: number },
): Installment {
  const approved = (s.approvedAt ?? opts.today).slice(0, 10);
  const amount = r2(s.fee);
  return {
    id: `INS-DES-${s.projectId}-${s.key}`,
    projectId: s.projectId,
    no: opts.no,
    title: `ค่าออกแบบ · ขั้น${STAGE_LABEL[s.key]}`,
    milestone: `ลูกค้าอนุมัติขั้น${STAGE_LABEL[s.key]}`,
    percent: opts.contractValue ? r2((amount / opts.contractValue) * 100) : 0,
    amount,
    vat: r2((amount * opts.vatRate) / 100),
    dueDate: addDays(approved, opts.dueDays),
    status: "due",
  };
}

/** Next free installment number of a project */
export const nextInstallmentNo = (list: Pick<Installment, "projectId" | "no">[], projectId: string) =>
  list.filter((i) => i.projectId === projectId).reduce((m, i) => Math.max(m, i.no), 0) + 1;

// ---------- permits ----------

export type PermitInput = { route: PermitRoute; use: BuildingUse; height: number; floorArea: number; units?: number; ownerIsApplicant: boolean };

/** Environmental impact assessment needed? Thresholds come from settings (verify with the latest notification). */
export function eiaCheck(p: Pick<PermitInput, "height" | "floorArea" | "units" | "use">, s: Pick<DesignSettings, "eiaHeightM" | "eiaAreaM2" | "eiaCondoUnits">) {
  const reasons: string[] = [];
  if (p.height >= s.eiaHeightM) reasons.push(`สูง ${p.height} ม. (เกณฑ์ ≥ ${s.eiaHeightM} ม.)`);
  if (p.floorArea >= s.eiaAreaM2) reasons.push(`พื้นที่ ${p.floorArea.toLocaleString("th-TH")} ตร.ม. (เกณฑ์ ≥ ${s.eiaAreaM2.toLocaleString("th-TH")} ตร.ม.)`);
  if (p.use === "condo" && (p.units ?? 0) >= s.eiaCondoUnits) reasons.push(`อาคารชุด ${p.units} ห้อง (เกณฑ์ ≥ ${s.eiaCondoUnits} ห้อง)`);
  return { required: reasons.length > 0, reasons };
}

/** Completion step after construction: อ.6 for controlled-use buildings, otherwise a completion notice */
export const completionKindFor = (use: BuildingUse): CompletionKind => (use === "condo" || use === "commercial" ? "a6" : "notice");

type DocDef = { key: string; label: string; required: boolean };

/** Document checklist for a permit route; keeps status/files of documents already in `existing`. */
export function permitChecklist(p: PermitInput, s: Pick<DesignSettings, "eiaHeightM" | "eiaAreaM2" | "eiaCondoUnits" | "largeBuildingM2">, existing: PermitDoc[] = []): PermitDoc[] {
  const defs: DocDef[] = [
    p.route === "permit"
      ? { key: "form", label: "แบบคำขออนุญาตก่อสร้างอาคาร (ข.1)", required: true }
      : { key: "form", label: "แบบแจ้งการก่อสร้างอาคารตามมาตรา 39 ทวิ", required: true },
    { key: "title", label: "สำเนาโฉนดที่ดิน/น.ส.3 ขนาดเท่าต้นฉบับ ทุกหน้า", required: true },
    { key: "id", label: "สำเนาบัตรประชาชนและทะเบียนบ้านผู้ขออนุญาต", required: true },
    { key: "consent", label: "หนังสือยินยอมให้ปลูกสร้างอาคารในที่ดิน (เจ้าของที่ดิน)", required: !p.ownerIsApplicant },
    { key: "siteplan", label: "แผนผังบริเวณ", required: true },
    { key: "drawings", label: "แบบแปลน รูปด้าน รูปตัด และแบบขยาย", required: true },
    { key: "calc", label: "รายการคำนวณโครงสร้าง", required: true },
    { key: "architect", label: "หนังสือรับรองของสถาปนิกผู้ออกแบบ", required: true },
    { key: "engineer", label: "หนังสือรับรองของวิศวกรผู้คำนวณ", required: true },
    { key: "supervisor", label: "หนังสือแสดงความยินยอมของผู้ควบคุมงาน", required: true },
    { key: "licenses", label: "สำเนาใบอนุญาตประกอบวิชาชีพ (สถาปนิก/วิศวกร/ผู้ควบคุมงาน)", required: true },
  ];
  if (p.route === "m39") {
    defs.push({ key: "m39cert", label: "หนังสือรับรองผู้ออกแบบและผู้คำนวณว่าแบบถูกต้องตามกฎหมาย (ม.39 ทวิ)", required: true });
    defs.push({ key: "feeslip", label: "ใบเสร็จค่าธรรมเนียมการแจ้ง", required: true });
  }
  if (p.floorArea >= s.largeBuildingM2 || p.use === "condo" || p.use === "commercial") {
    defs.push({ key: "fire", label: "แบบระบบป้องกันอัคคีภัยและทางหนีไฟ", required: true });
    defs.push({ key: "wastewater", label: "แบบและรายการคำนวณระบบบำบัดน้ำเสีย", required: true });
    defs.push({ key: "soil", label: "ผลเจาะสำรวจดิน/ทดสอบเสาเข็ม", required: false });
  }
  const eia = eiaCheck(p, s);
  if (eia.required) defs.push({ key: "eia", label: "รายงานผลกระทบสิ่งแวดล้อม (EIA) ที่ได้รับความเห็นชอบ", required: true });
  const old = new Map(existing.map((d) => [d.key, d]));
  const out = defs.map((d) => {
    const o = old.get(d.key);
    return o ? { ...o, label: d.label, required: d.required } : { ...d, status: "missing" as const, files: [] };
  });
  // keep custom documents the user added
  for (const o of existing) if (!defs.some((d) => d.key === o.key)) out.push(o);
  return out;
}

export function docsReady(docs: PermitDoc[]) {
  const req = docs.filter((d) => d.required);
  const ready = req.filter((d) => d.status !== "missing").length;
  return { ready, total: req.length, complete: ready === req.length };
}

export type PermitFlag = "stuck" | "expiring" | "expired" | "query" | "docs";
export const FLAG_LABEL: Record<PermitFlag, string> = { stuck: "รอพิจารณานาน", expiring: "ใกล้หมดอายุ", expired: "หมดอายุ", query: "มีข้อซักถามค้าง", docs: "เอกสารไม่ครบ" };

/** Current expiry including approved extensions */
export function currentExpiry(p: Pick<Permit, "expiresAt" | "extensions">) {
  return p.extensions.filter((e) => e.approvedAt && e.newExpiry).reduce<string | undefined>((m, e) => (!m || e.newExpiry! > m ? e.newExpiry : m), p.expiresAt);
}

export function permitState(p: Permit, today: string, s: Pick<DesignSettings, "permitPendingDays" | "permitExpiryDays">) {
  const flags: PermitFlag[] = [];
  const waiting = p.status === "submitted" || p.status === "query";
  const pendingDays = waiting && p.submittedAt ? daysBetween(p.submittedAt, today) : undefined;
  if (pendingDays !== undefined && pendingDays > s.permitPendingDays) flags.push("stuck");
  if (p.queries.some((q) => !q.repliedAt)) flags.push("query");
  const expiry = currentExpiry(p);
  const live = p.status === "approved" || p.status === "completion";
  const expiresIn = live && expiry ? daysBetween(today, expiry) : undefined;
  if (expiresIn !== undefined && p.status === "approved") {
    if (expiresIn < 0) flags.push("expired");
    else if (expiresIn <= s.permitExpiryDays) flags.push("expiring");
  }
  const docs = docsReady(p.docs);
  if (p.status === "preparing" && !docs.complete) flags.push("docs");
  return { flags, pendingDays, expiresIn, expiry, docs };
}

// ---------- specifications ----------

export type ResolvedClause = SpecClause & { overridden: boolean };
export type ResolvedSection = Omit<SpecSection, "clauses"> & { clauses: ResolvedClause[] };

/** The project's spec: chosen sections in library order, excluded clauses removed, project overrides applied. */
export function resolveSpec(set: Pick<SpecSet, "sectionIds" | "excluded" | "overrides">, library: SpecSection[]): ResolvedSection[] {
  return library
    .filter((sec) => set.sectionIds.includes(sec.id))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((sec) => ({
      ...sec,
      clauses: sec.clauses
        .filter((c) => !set.excluded.includes(c.id))
        .map((c) => {
          const o = set.overrides[c.id];
          return { ...c, text: o?.text ?? c.text, brands: o?.brands ?? c.brands, costCode: c.costCode ?? sec.costCode, overridden: !!o };
        }),
    }));
}

/** Clause counts per cost code of a resolved spec */
export function specByCostCode(sections: ResolvedSection[]) {
  const m = new Map<string, number>();
  for (const s of sections) for (const c of s.clauses) if (c.costCode) m.set(c.costCode, (m.get(c.costCode) ?? 0) + 1);
  return m;
}
