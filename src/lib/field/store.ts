// Field + service collections and actions.

import { createCollection, type Collection } from "@/lib/collection";
import { progressEntries, provideSeed, siteDiaries, wbsTasks, type ProgressEntry } from "@/lib/biz";
import { getProject, team, TODAY } from "@/lib/data";
import { addInspection, addMaintPlan, addRepair, createWorkOrderFromRepair, updateWorkOrder, type OpsWorkOrder } from "@/lib/ops-store";
import type { SystemKey } from "@/lib/data";
import { addDays, addMonths, copyDiary, diaryId, distanceM } from "./calc";
import { contractFirstVisit, seedClaims, seedContracts, seedDiaries, seedPunch, seedSurveys, seedVanMoves, seedVanStock, seedWarranty, seedWoService } from "./seed";
import {
  FIELD_DEFAULTS,
  type Diary,
  type FieldIssue,
  type FieldSettings,
  type Geo,
  type PunchItem,
  type ServiceContract,
  type SurveyRequest,
  type VanMove,
  type VanStock,
  type WarrantyCategory,
  type WarrantyClaim,
  type WarrantyItem,
  type WoService,
} from "./types";

provideSeed("site_diaries", seedDiaries);
/** the shared siteDiaries collection, typed with the optional workflow fields */
export const diaries = siteDiaries as unknown as Collection<Diary>;

export const punchItems = createCollection<PunchItem>("punch_items", seedPunch);
export const fieldIssues = createCollection<FieldIssue>("field_issues", []);
export const woService = createCollection<WoService>("wo_service", seedWoService);
export const vanStock = createCollection<VanStock>("van_stock", seedVanStock);
export const vanMoves = createCollection<VanMove>("van_moves", seedVanMoves);
export const surveyRequests = createCollection<SurveyRequest>("survey_requests", seedSurveys);
export const serviceContracts = createCollection<ServiceContract>("service_contracts", seedContracts);
export const warrantyItems = createCollection<WarrantyItem>("warranty_items", seedWarranty);
export const warrantyClaims = createCollection<WarrantyClaim>("warranty_claims", seedClaims);
const settingsCol = createCollection<FieldSettings>("field_settings", []);

export function useFieldSettings(): FieldSettings {
  const rows = settingsCol.use();
  const s = rows.find((r) => r.id === "field");
  return { ...FIELD_DEFAULTS, ...s, warrantyMonths: { ...FIELD_DEFAULTS.warrantyMonths, ...s?.warrantyMonths } };
}
export const fieldSettings = (): FieldSettings => {
  const s = settingsCol.all().find((r) => r.id === "field");
  return { ...FIELD_DEFAULTS, ...s, warrantyMonths: { ...FIELD_DEFAULTS.warrantyMonths, ...s?.warrantyMonths } };
};
export const saveFieldSettings = (s: FieldSettings) => settingsCol.upsert(s);

export const technicians = () => team.filter((m) => m.role === "technician" && m.active);

export const nowStamp = () => {
  const d = new Date();
  return `${TODAY} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ---------- site diary ----------

export function newDiary(projectId: string, date: string, by: string): Diary {
  const prev = diaries
    .all()
    .filter((d) => d.projectId === projectId && d.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prev) return copyDiary(prev, date, by, diaryId(projectId, date));
  return {
    id: diaryId(projectId, date),
    projectId,
    date,
    weatherAm: "sunny",
    weatherPm: "sunny",
    rainHours: 0,
    manpower: [{ group: "ทีมบริษัท", trade: "โฟร์แมน/ผู้ควบคุมงาน", count: 1 }],
    equipment: [],
    work: [{ text: "" }],
    photos: [],
    by,
    status: "draft",
  };
}

/** Save a diary; work lines linked to a WBS task with a % also record progress (source "diary"). */
export function saveDiary(d: Diary) {
  const clean: Diary = { ...d, work: d.work.filter((w) => w.text.trim() || w.taskId) };
  diaries.upsert(clean);
  const entries: ProgressEntry[] = [];
  const tasks = wbsTasks.all();
  clean.work.forEach((w) => {
    if (!w.taskId || w.pct === undefined) return;
    const t = tasks.find((x) => x.id === w.taskId);
    entries.push({ id: `PRG-${d.projectId}-D${d.date.replace(/-/g, "")}-${w.taskId.split("-").pop()}`, projectId: d.projectId, taskId: w.taskId, date: d.date, pct: w.pct, by: d.by, source: "diary", note: w.text || t?.name });
    if (t) {
      const latest = progressEntries
        .all()
        .filter((p) => p.taskId === t.id && p.source !== "diary")
        .reduce((m, p) => (p.date > m ? p.date : m), "");
      if (d.date >= latest && t.pct !== w.pct) wbsTasks.upsert({ ...t, pct: w.pct });
    }
  });
  if (entries.length) progressEntries.upsertMany(entries);
  return clean;
}
export const submitDiary = (d: Diary) => saveDiary({ ...d, status: "submitted", submittedAt: nowStamp() });
export function approveDiary(id: string, by: string, comment?: string) {
  const d = diaries.get(id);
  if (d) diaries.upsert({ ...d, status: "approved", approvedBy: by, approvedAt: nowStamp(), comment: comment || d.comment });
}
export function returnDiary(id: string, comment: string) {
  const d = diaries.get(id);
  if (d) diaries.upsert({ ...d, status: "draft", approvedBy: undefined, approvedAt: undefined, comment });
}

// ---------- punch list & quick issues ----------

export function addPunch(input: Omit<PunchItem, "id" | "status" | "date"> & { date?: string }): PunchItem {
  const item: PunchItem = { ...input, id: punchItems.nextId(`PUN-${input.projectId}-`, 3), status: "open", date: input.date ?? TODAY };
  punchItems.upsert(item);
  return item;
}
export function setPunchStatus(id: string, status: PunchItem["status"], fixPhotos?: PunchItem["fixPhotos"]) {
  const p = punchItems.get(id);
  if (!p) return;
  punchItems.upsert({
    ...p,
    status,
    fixPhotos: fixPhotos ?? p.fixPhotos,
    fixedAt: status === "open" ? undefined : (p.fixedAt ?? TODAY),
    verifiedAt: status === "verified" ? TODAY : undefined,
  });
}

const TECH_FOR: Record<SystemKey, string> = { elec: "สุริยา คำแก้ว", hvac: "ไพโรจน์ ดวงจันทร์", plumb: "สมชาย ปานทอง", arch: "บุญเลิศ ใจดี", struct: "บุญเลิศ ใจดี", ext: "บุญเลิศ ใจดี" };

export function reportIssue(input: Omit<FieldIssue, "id" | "at" | "repairId" | "punchId"> & { location: string; severity: "high" | "medium" | "low" }) {
  const issue: FieldIssue = { id: fieldIssues.nextId("ISS-", 5), projectId: input.projectId, kind: input.kind, title: input.title, detail: input.detail, system: input.system, photos: input.photos, lat: input.lat, lng: input.lng, by: input.by, at: nowStamp() };
  if (input.kind === "repair") {
    const r = addRepair({
      title: input.title,
      detail: [input.detail, input.photos.length ? `แนบรูป ${input.photos.length} รูปจากแอปหน้างาน (${issue.id})` : ""].filter(Boolean).join(" · "),
      asset: "-",
      assetName: input.title,
      projectId: input.projectId,
      location: input.location,
      system: input.system,
      severity: input.severity,
      source: getProject(input.projectId)?.status === "delivered" ? "customer" : "internal",
      assignee: TECH_FOR[input.system],
      reporter: input.by,
    });
    issue.repairId = r.id;
  } else {
    const p = addPunch({ projectId: input.projectId, title: input.title, location: input.location, trade: input.system, photos: input.photos, by: input.by, lat: input.lat, lng: input.lng, due: addDays(TODAY, 7) });
    issue.punchId = p.id;
  }
  fieldIssues.upsert(issue);
  return issue;
}

// ---------- work-order field service ----------

export function svcOf(wo: Pick<OpsWorkOrder, "id" | "projectId">): WoService {
  return woService.get(wo.id) ?? { id: wo.id, projectId: wo.projectId, checklist: [], before: [], after: [], parts: [] };
}
export const saveSvc = (s: WoService) => woService.upsert(s);

export function geoFor(projectId: string, lat?: number, lng?: number): Geo {
  const p = getProject(projectId);
  const dist = lat !== undefined && lng !== undefined && p?.lat !== undefined && p.lng !== undefined ? distanceM(lat, lng, p.lat, p.lng) : undefined;
  return { at: nowStamp(), lat, lng, dist };
}
export function checkIn(wo: OpsWorkOrder, geo: Geo) {
  saveSvc({ ...svcOf(wo), checkIn: geo });
  updateWorkOrder(wo.id, { status: "in_progress" }, `เช็กอินหน้างาน${geo.dist !== undefined ? ` (ห่างหมุด ${geo.dist} ม.)` : " (ไม่มีพิกัด)"}`);
}
export function checkOut(wo: OpsWorkOrder, geo: Geo) {
  saveSvc({ ...svcOf(wo), checkOut: geo });
  updateWorkOrder(wo.id, {}, "เช็กเอาต์ออกจากหน้างาน");
}

/** issue a part from the technician's van to the job (deducts van stock) */
export function issuePart(wo: OpsWorkOrder, stockId: string, qty: number) {
  const s = vanStock.get(stockId);
  if (!s || qty <= 0) return;
  const svc = svcOf(wo);
  const parts = [...svc.parts];
  const i = parts.findIndex((p) => p.stockId === stockId);
  if (i >= 0) parts[i] = { ...parts[i], qty: parts[i].qty + qty };
  else parts.push({ stockId, code: s.code, name: s.name, unit: s.unit, qty, unitPrice: s.unitPrice });
  saveSvc({ ...svc, parts });
  vanStock.upsert({ ...s, qty: s.qty - qty });
  vanMoves.upsert({ id: vanMoves.nextId("VMV-"), stockId, tech: s.tech, date: TODAY, qty: -qty, woId: wo.id, note: "เบิกใช้หน้างาน" });
  updateWorkOrder(wo.id, { parts: parts.map((p) => `${p.name} × ${p.qty} ${p.unit}`).join(", ") });
}
/** put an issued part back in the van */
export function returnPart(wo: OpsWorkOrder, stockId: string) {
  const svc = svcOf(wo);
  const line = svc.parts.find((p) => p.stockId === stockId);
  if (!line) return;
  const parts = svc.parts.filter((p) => p.stockId !== stockId);
  saveSvc({ ...svc, parts });
  const s = vanStock.get(stockId);
  if (s) {
    vanStock.upsert({ ...s, qty: s.qty + line.qty });
    vanMoves.upsert({ id: vanMoves.nextId("VMV-"), stockId, tech: s.tech, date: TODAY, qty: line.qty, woId: wo.id, note: "คืนเข้ารถ" });
  }
  updateWorkOrder(wo.id, { parts: parts.map((p) => `${p.name} × ${p.qty} ${p.unit}`).join(", ") || undefined });
}
export function replenish(stockId: string, qty: number, note = "เติมสต็อกจากคลังกลาง") {
  const s = vanStock.get(stockId);
  if (!s || !qty) return;
  vanStock.upsert({ ...s, qty: s.qty + qty });
  vanMoves.upsert({ id: vanMoves.nextId("VMV-"), stockId, tech: s.tech, date: TODAY, qty, note });
}
export function addVanItem(item: Omit<VanStock, "id">) {
  const tid = team.find((m) => m.name === item.tech)?.id ?? "X";
  const s: VanStock = { ...item, id: `VAN-${tid}-${item.code}` };
  vanStock.upsert(s);
  return s;
}

/** assign a work order to a technician / day / slot (dispatch board) */
export function assignWorkOrder(wo: OpsWorkOrder, tech: string, date: string, slot?: "am" | "pm") {
  const changed = wo.technician !== tech || wo.scheduled !== date;
  updateWorkOrder(wo.id, { technician: tech, scheduled: date }, changed ? `จัดคิว ${tech} · ${date}${slot ? (slot === "am" ? " ช่วงเช้า" : " ช่วงบ่าย") : ""}` : undefined);
  if (slot) saveSvc({ ...svcOf(wo), slot });
}
export function assignRepair(repairId: string, tech: string, date: string, slot?: "am" | "pm") {
  const wo = createWorkOrderFromRepair(repairId, { technician: tech, scheduled: date });
  if (wo && slot) saveSvc({ ...svcOf(wo), slot });
  return wo;
}

export function requestSurvey(input: { repairId: string; woId?: string; projectId: string; by: string; channel?: SurveyRequest["channel"] }) {
  const p = getProject(input.projectId);
  const s: SurveyRequest = { id: `SRV-${input.repairId}`, repairId: input.repairId, woId: input.woId, projectId: input.projectId, customer: p?.owner ?? "", phone: p?.phone, requestedAt: TODAY, by: input.by, channel: input.channel ?? "line", status: "pending" };
  surveyRequests.upsert(s);
  return s;
}

// ---------- service contracts ----------

export function saveContract(c: ServiceContract) {
  serviceContracts.upsert(c);
}
/** create the maintenance plan visits for every scope (24 months ahead, see addMaintPlan) */
export function generateVisits(c: ServiceContract) {
  const ids: string[] = [];
  for (const s of c.scopes) {
    const first = contractFirstVisit(c.start, s.cycleMonths, TODAY);
    if (first > c.end) continue;
    const made = addMaintPlan({ projectId: c.projectId, task: `${s.label} (${c.id})`, system: s.system, cycleMonths: s.cycleMonths, first, assignee: c.assignee });
    if (made[0]) ids.push(made[0].id);
  }
  serviceContracts.upsert({ ...c, planIds: [...(c.planIds ?? []), ...ids] });
  return ids.length;
}
export function renewContract(c: ServiceContract, priceChangePct = 0): ServiceContract {
  const start = addDays(c.end, 1);
  const next: ServiceContract = {
    ...c,
    id: serviceContracts.nextId(`SVC-${start.slice(0, 4)}-`),
    start,
    end: addDays(addMonths(start, 12), -1),
    price: Math.round(c.price * (1 + priceChangePct / 100)),
    status: "active",
    planIds: [],
    renewedFrom: c.id,
  };
  serviceContracts.upsert(next);
  serviceContracts.upsert({ ...c, status: "expired" });
  return next;
}

// ---------- warranty ----------

const CAT_LABEL_DEFAULT: Record<Exclude<WarrantyCategory, "equipment">, { label: string; system: SystemKey }> = {
  structure: { label: "โครงสร้างหลัก เสาเข็ม ฐานราก เสา คาน พื้น", system: "struct" },
  roof: { label: "หลังคารั่วซึมและงานกันซึม", system: "arch" },
  general: { label: "งานสถาปัตย์ทั่วไป สี กระเบื้อง ประตูหน้าต่าง", system: "arch" },
  system: { label: "งานระบบไฟฟ้าและประปา", system: "elec" },
};
/** add the company warranty items for a delivered project using the default periods */
export function generateWarranty(projectId: string, start: string, months?: Partial<Record<WarrantyCategory, number>>) {
  const s = fieldSettings();
  const existing = warrantyItems.all().filter((w) => w.projectId === projectId);
  const out: WarrantyItem[] = [];
  let n = existing.length;
  for (const [cat, v] of Object.entries(CAT_LABEL_DEFAULT) as [Exclude<WarrantyCategory, "equipment">, (typeof CAT_LABEL_DEFAULT)["structure"]][]) {
    if (existing.some((w) => w.category === cat)) continue;
    out.push({ id: `WAR-${projectId}-${String(++n).padStart(2, "0")}`, projectId, category: cat, label: v.label, months: months?.[cat] ?? s.warrantyMonths[cat], start, source: "company", system: v.system, note: cat === "structure" ? "ตาม ป.พ.พ. ม.600 หรือสัญญา" : undefined });
  }
  warrantyItems.upsertMany(out);
  return out.length;
}
/** book a whole-house inspection before the warranty of these items ends (uses the inspections module) */
export function bookPreExpiryInspection(projectId: string, items: WarrantyItem[], date: string, inspector: string) {
  const systems = [...new Set(items.map((w) => w.system ?? "arch"))];
  const ins = addInspection({
    title: `ตรวจบ้านก่อนหมดประกัน · ${items.map((w) => w.label.split(" ")[0]).join(", ")}`,
    projectId,
    location: "ทั้งหลัง",
    inspector,
    date,
    time: "10:00",
    items: 12,
    phase: "ติดตั้งสุขภัณฑ์/อุปกรณ์",
    result: "scheduled",
    systems,
  });
  warrantyItems.upsertMany(items.map((w) => ({ ...w, inspectionId: ins.id })));
  return ins;
}
export const nextWarrantyId = (projectId: string) => warrantyItems.nextId(`WAR-${projectId}-`, 2);
export function setClaim(c: Omit<WarrantyClaim, "id" | "date">) {
  warrantyClaims.upsert({ ...c, id: `WCL-${c.repairId}`, date: TODAY });
}
