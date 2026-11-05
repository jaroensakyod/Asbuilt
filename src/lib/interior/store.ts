// Interior / fit-out and client-selection collections and actions.

import { createCollection } from "../collection";
import { TODAY, getProject } from "../data";
import { installments, variations, type Installment, type Variation } from "../biz";
import { newPR } from "../procurement/store";
import { DEFAULT_INTERIOR_SETTINGS, addDays, chosenOption, expectedDelivery, nextVariationNo, selectionVariation } from "./calc";
import { seedBoards, seedFfe, seedInstallJobs, seedInteriorProjects, seedProducts, seedPunch, seedSamples, seedSelections } from "./seed";
import { SEL_CATEGORY_LABEL, SEL_COST_CODE, type FeeMilestone, type FfeItem, type FfeStatus, type InstallJob, type InteriorProject, type InteriorSettings, type MoodBoard, type Product, type PunchItem, type Sample, type Selection } from "./types";

export const selections = createCollection<Selection>("selections", seedSelections);
export const interiorProjects = createCollection<InteriorProject>("interior_projects", seedInteriorProjects);
export const products = createCollection<Product>("interior_products", seedProducts);
export const moodBoards = createCollection<MoodBoard>("mood_boards", seedBoards);
export const ffeItems = createCollection<FfeItem>("ffe_items", seedFfe);
export const samples = createCollection<Sample>("interior_samples", seedSamples);
export const installJobs = createCollection<InstallJob>("install_jobs", seedInstallJobs);
export const punchItems = createCollection<PunchItem>("interior_punch_items", seedPunch);
const settingsCol = createCollection<InteriorSettings>("interior_settings", []);

const merge = (rows: InteriorSettings[]) => ({ ...DEFAULT_INTERIOR_SETTINGS, ...rows.find((r) => r.id === "interior") });
export const interiorSettingsNow = () => merge(settingsCol.all());
export const useInteriorSettings = (): InteriorSettings => merge(settingsCol.use());
export const saveInteriorSettings = (s: InteriorSettings) => settingsCol.upsert(s);

// ---------- selections ----------

/** Client (portal) or staff records the chosen option */
export function chooseOption(s: Selection, optionId: string, by: string, note?: string) {
  if (s.status === "approved") return;
  selections.upsert({ ...s, chosenId: optionId, chosenAt: TODAY, chosenBy: by, clientNote: note?.trim() || s.clientNote, status: "chosen" });
}

/**
 * Approve and lock a selection. A price difference against the allowance raises a
 * Variation (origin "selection", status "submitted") for the client to approve in the portal;
 * optionally a purchase request is sent for the chosen item.
 */
export function approveSelection(s: Selection, by: string, opts: { purchase?: boolean } = {}) {
  const next: Selection = { ...s, status: "approved", approvedAt: TODAY, approvedBy: by };
  if (!s.variationId) {
    const vo = buildVariation(next, by);
    if (vo) {
      variations.upsert(vo);
      next.variationId = vo.id;
    }
  }
  if (opts.purchase && !s.prId) next.prId = requestPurchase(next, by);
  selections.upsert(next);
  return next;
}

function buildVariation(s: Selection, by: string): Variation | undefined {
  return selectionVariation(s, { no: nextVariationNo(variations.all(), s.projectId), by, today: TODAY, costRatio: interiorSettingsNow().allowanceCostRatio });
}

/** Raise the variation later (selection approved before the difference was known) */
export function raiseSelectionVariation(s: Selection, by: string) {
  if (s.variationId) return;
  const vo = buildVariation(s, by);
  if (!vo) return;
  variations.upsert(vo);
  selections.upsert({ ...s, variationId: vo.id });
}

/** Purchase request for the chosen option (procurement → RFQ → PO) */
export function requestPurchase(s: Selection, by: string): string | undefined {
  const o = chosenOption(s);
  if (!o) return undefined;
  const pr = newPR({
    projectId: s.projectId,
    costCode: SEL_COST_CODE[s.category],
    date: TODAY,
    requestedBy: by,
    lines: [{ description: `${o.name}${o.brand ? ` · ${o.brand}` : ""}${o.model ? ` ${o.model}` : ""} (${s.item})`, qty: s.qty, unit: s.unit, neededBy: s.blocksDate ?? addDays(TODAY, 14) }],
    note: `จากรายการลูกค้าเลือก ${s.id} · หมวด${SEL_CATEGORY_LABEL[s.category]} · ${s.room}`,
  });
  return pr.id;
}

export function linkSelectionPR(s: Selection, by: string) {
  const prId = requestPurchase(s, by);
  if (prId) selections.upsert({ ...s, prId });
}

/** Unlock a selection (only while its variation is not yet approved) */
export function reopenSelection(s: Selection) {
  const vo = s.variationId ? variations.get(s.variationId) : undefined;
  if (vo && vo.status === "approved") return false;
  if (vo) variations.upsert({ ...vo, status: "void" });
  selections.upsert({ ...s, status: s.chosenId ? "chosen" : "pending", approvedAt: undefined, approvedBy: undefined, variationId: undefined });
  return true;
}

// ---------- FF&E ----------

const STAMP: Partial<Record<FfeStatus, keyof FfeItem>> = { ordered: "orderedAt", confirmed: "confirmedAt", shipped: "shippedAt", received: "receivedAt", installed: "installedAt" };

/** Move an FF&E item along ordered → confirmed → shipped → received → installed, stamping dates */
export function setFfeStatus(f: FfeItem, status: FfeStatus, extra: Partial<FfeItem> = {}, date = TODAY): FfeItem {
  const next: FfeItem = { ...f, status, ...extra };
  const key = STAMP[status];
  if (key && !f[key]) (next as Record<string, unknown>)[key] = date;
  if (status === "ordered" && !f.expectedAt) {
    const lead = f.productId ? (products.get(f.productId)?.leadDays ?? 30) : 30;
    next.expectedAt = expectedDelivery(next.orderedAt ?? date, lead);
  }
  ffeItems.upsert(next);
  return next;
}

export function nextFfeId(interiorId: string) {
  return ffeItems.nextId(`FFE-${interiorId}-`, 3);
}

// ---------- fees ----------

/** Send an interior fee milestone of a linked house project to the installments (accounting invoices it) */
export function feeToInstallment(p: InteriorProject, f: FeeMilestone): Installment | undefined {
  if (!p.projectId) return undefined;
  const id = `INS-INT-${p.id}-${f.id}`;
  const existing = installments.get(id);
  if (existing) return existing;
  const vat = interiorSettingsNow().vatRate;
  const no = installments.all().filter((i) => i.projectId === p.projectId).reduce((m, i) => Math.max(m, i.no), 0) + 1;
  const inst: Installment = {
    id,
    projectId: p.projectId,
    no,
    title: `ค่าออกแบบตกแต่งภายใน · ${f.title}`,
    milestone: f.title,
    percent: 0,
    amount: f.amount,
    vat: Math.round(f.amount * vat) / 100,
    dueDate: f.due < TODAY ? TODAY : f.due,
    status: "due",
  };
  installments.upsert(inst);
  interiorProjects.upsert({ ...p, fees: p.fees.map((x) => (x.id === f.id ? { ...x, installmentId: id } : x)) });
  return inst;
}

export const interiorName = (p: Pick<InteriorProject, "projectId" | "name">) => (p.projectId ? `${p.name} · ${getProject(p.projectId)?.name ?? p.projectId}` : p.name);
