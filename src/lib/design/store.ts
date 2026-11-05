// Design-module collections and actions (design stages, permits, specs) plus the
// customer-portal records this module owns (messages, satisfaction surveys).

import { createCollection } from "../collection";
import { TODAY, getProject } from "../data";
import { budgets, installments, type Installment } from "../biz";
import type { MediaRef } from "../media";
import { DEFAULT_DESIGN_SETTINGS, addDays, designFeeInstallment, nextInstallmentNo, stageFees } from "./calc";
import { SPEC_LIBRARY } from "./spec-library";
import { defaultDeliverables, seedDesignJobs, seedDesignStages, seedMessages, seedPermits, seedSpecSets, seedSurveys } from "./seed";
import {
  STAGE_KEYS,
  type DesignJob,
  type DesignSettings,
  type DesignStage,
  type FeeStatus,
  type Permit,
  type PortalMessage,
  type ReviewEntry,
  type SpecSection,
  type SpecSet,
  type SurveyResponse,
} from "./types";

export const designJobs = createCollection<DesignJob>("design_jobs", seedDesignJobs);
export const designStages = createCollection<DesignStage & { feeAuto?: boolean }>("design_stages", seedDesignStages);
export const permits = createCollection<Permit>("permits", seedPermits);
export const specSections = createCollection<SpecSection>("spec_sections", SPEC_LIBRARY);
export const specSets = createCollection<SpecSet>("spec_sets", seedSpecSets);
export const portalMessages = createCollection<PortalMessage>("portal_messages", seedMessages);
export const surveys = createCollection<SurveyResponse>("satisfaction_surveys", seedSurveys);
const settingsCol = createCollection<DesignSettings>("design_settings", []);

/** Demo "now": the demo date with the wall-clock time */
export function nowIso() {
  const d = new Date();
  return `${TODAY}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00+07:00`;
}

// ---------- settings ----------

const mergeSettings = (rows: DesignSettings[]): DesignSettings => {
  const r = rows.find((x) => x.id === "design");
  return { ...DEFAULT_DESIGN_SETTINGS, ...r, feePct: { ...DEFAULT_DESIGN_SETTINGS.feePct, ...r?.feePct } };
};
export const designSettingsNow = () => mergeSettings(settingsCol.all());
export function useDesignSettings(): DesignSettings {
  return mergeSettings(settingsCol.use());
}
export const saveDesignSettings = (s: DesignSettings) => settingsCol.upsert(s);

// ---------- design jobs / stages ----------

export function createDesignJob(input: Omit<DesignJob, "id"> & { inContract: boolean }) {
  const { inContract, ...rest } = input;
  const job: DesignJob = { ...rest, id: `DJ-${input.projectId}` };
  const s = designSettingsNow();
  const fees = stageFees(job.feeTotal, s.feePct);
  const span = [21, 30, 30, 40, 45];
  let cursor = job.start;
  const list: DesignStage[] = STAGE_KEYS.map((key, i) => {
    const start = cursor;
    cursor = addDays(cursor, span[i]);
    return {
      id: `DS-${job.projectId}-${key}`,
      projectId: job.projectId,
      key,
      start: i === 0 ? start : undefined,
      due: cursor,
      architect: job.leadArchitect,
      engineers: i === 0 ? [] : [job.structural, job.mep].filter(Boolean),
      deliverables: defaultDeliverables(key),
      status: i === 0 ? "in_progress" : "not_started",
      revisions: 0,
      fee: fees[key],
      feeStatus: inContract || job.feeTotal === 0 ? "in_contract" : "pending",
      reviews: [],
      attachments: [],
    };
  });
  designJobs.upsert(job);
  designStages.upsertMany(list);
  return job;
}

const pushReview = (s: DesignStage, r: Omit<ReviewEntry, "id" | "at">): ReviewEntry[] => [...s.reviews, { ...r, id: `R-${Date.now().toString(36)}-${s.reviews.length}`, at: nowIso() }];

export function submitStage(s: DesignStage, by: string, comment?: string) {
  designStages.upsert({ ...s, status: "client_review", submittedAt: TODAY, reviews: pushReview(s, { by, side: "company", action: "submitted", comment }) });
}

export function addStageComment(s: DesignStage, by: string, side: ReviewEntry["side"], comment: string) {
  designStages.upsert({ ...s, reviews: pushReview(s, { by, side, action: "comment", comment }) });
}

export function requestStageChanges(s: DesignStage, by: string, side: ReviewEntry["side"], comment: string) {
  designStages.upsert({ ...s, status: "changes_requested", revisions: s.revisions + 1, reviews: pushReview(s, { by, side, action: "changes", comment }) });
}

/** Approve a stage (client in the portal, or staff recording an approval received on paper). Creates the design-fee installment. */
export function approveStage(s: DesignStage, by: string, side: ReviewEntry["side"], comment?: string, signature?: MediaRef) {
  const next: DesignStage = {
    ...s,
    status: "approved",
    approvedAt: TODAY,
    approvedBy: by,
    finishedAt: TODAY,
    deliverables: s.deliverables.map((d) => ({ ...d, done: true })),
    feeStatus: s.feeStatus === "in_contract" ? "in_contract" : "ready",
    reviews: pushReview(s, { by, side, action: "approved", comment, signature }),
  };
  const settings = designSettingsNow();
  if (settings.autoInstallment && next.feeStatus === "ready" && next.fee > 0 && !next.installmentId) next.installmentId = createFeeInstallment(next).id;
  designStages.upsert(next);
  // open the next stage
  const idx = STAGE_KEYS.indexOf(s.key);
  const following = designStages.all().find((x) => x.projectId === s.projectId && x.key === STAGE_KEYS[idx + 1]);
  if (following && following.status === "not_started") designStages.upsert({ ...following, status: "in_progress", start: TODAY });
}

/** Create (or return) the "ค่าออกแบบ …" installment of an approved stage; accounting invoices it from /accounting/sales. */
export function createFeeInstallment(s: DesignStage): Installment {
  const existing = installments.get(`INS-DES-${s.projectId}-${s.key}`);
  if (existing) return existing;
  const settings = designSettingsNow();
  const budget = budgets.all().find((b) => b.projectId === s.projectId);
  const p = getProject(s.projectId);
  const inst = designFeeInstallment(s, {
    no: nextInstallmentNo(installments.all(), s.projectId),
    vatRate: settings.vatRate,
    dueDays: settings.installmentDueDays,
    today: TODAY,
    contractValue: budget?.contractValue ?? (p ? p.value * 1e6 : undefined),
  });
  installments.upsert(inst);
  return inst;
}

export function linkFeeInstallment(s: DesignStage) {
  const inst = createFeeInstallment(s);
  designStages.upsert({ ...s, installmentId: inst.id, feeStatus: "ready", feeAuto: false });
}

/** Fee state, following the linked installment once accounting invoices / receives it */
export function feeStateOf(s: DesignStage, list: Installment[]): FeeStatus {
  if (s.feeStatus === "in_contract") return "in_contract";
  const inst = s.installmentId ? list.find((i) => i.id === s.installmentId) : undefined;
  if (inst?.status === "paid") return "paid";
  if (inst && (inst.status === "invoiced" || inst.invoiceNo || inst.status === "overdue")) return "invoiced";
  return s.status === "approved" ? "ready" : "pending";
}

/**
 * Live mode: a client approval made in the portal (RPC) only marks the stage `feeAuto`.
 * Staff screens call this to create the installments that are still missing.
 */
export function reconcileFeeInstallments() {
  if (!designSettingsNow().autoInstallment) return;
  for (const s of designStages.all()) if (s.status === "approved" && s.feeAuto && !s.installmentId && s.fee > 0 && s.feeStatus !== "in_contract") linkFeeInstallment(s);
}

// ---------- messages ----------

export function postMessage(projectId: string, side: PortalMessage["side"], author: string, text: string, attachments?: MediaRef[]): PortalMessage {
  const m: PortalMessage = {
    id: `${portalMessages.nextId(`MSG-${projectId}-`)}`,
    projectId,
    side,
    author,
    text: text.trim(),
    at: nowIso(),
    attachments: attachments?.length ? attachments : undefined,
  };
  portalMessages.upsert(m);
  return m;
}

export function markMessagesRead(projectId: string) {
  const unread = portalMessages.all().filter((m) => m.projectId === projectId && m.side === "customer" && !m.readAt);
  if (unread.length) portalMessages.upsertMany(unread.map((m) => ({ ...m, readAt: nowIso() })));
}

// ---------- surveys ----------

export const surveyId = (projectId: string, repairId?: string) => (repairId ? `SRV-${projectId}-${repairId}` : `SRV-${projectId}-handover`);
export const saveSurvey = (r: SurveyResponse) => surveys.upsert(r);
