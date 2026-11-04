// Client store for operations records created or edited in the browser.
// Seed data (src/components/ops/seed.ts) + local overrides persisted in localStorage.
// SSR-safe: the server snapshot is the seed only; the client snapshot adds local changes after hydration.

import { useSyncExternalStore } from "react";
import { TODAY, getProject, type RepairStatus, type WorkOrderStatus } from "@/lib/data";
import {
  addDays,
  addMonths,
  ISSUER,
  itemsFor,
  itemSystem,
  scoreOf,
  SEED,
  seedResults,
  SLA_HOURS,
  TECH_BY_SYSTEM,
  PASS_SCORE,
  assetLocation,
  projectAssets,
  type ItemState,
  type OpsInspection,
  type OpsMaint,
  type OpsRepair,
  type OpsWorkOrder,
} from "@/components/ops/seed";

export type { OpsInspection, OpsMaint, OpsRepair, OpsWorkOrder, ItemState };

type Coll<T> = { up: Record<string, T>; del: string[] };
type State = {
  repairs: Coll<OpsRepair>;
  inspections: Coll<OpsInspection>;
  workOrders: Coll<OpsWorkOrder>;
  maintenance: Coll<OpsMaint>;
};
type Kind = keyof State;
type Item<K extends Kind> = State[K] extends Coll<infer T> ? T : never;

const KEY = "asbuilt:ops:v1";
const empty = (): State => ({
  repairs: { up: {}, del: [] },
  inspections: { up: {}, del: [] },
  workOrders: { up: {}, del: [] },
  maintenance: { up: {}, del: [] },
});
const SERVER_STATE = empty();

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  if (typeof window === "undefined") return SERVER_STATE;
  const s = empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      for (const k of Object.keys(s) as Kind[]) if (parsed[k]) Object.assign(s[k], parsed[k]);
    }
  } catch {
    // ignore broken storage
  }
  state = s;
  return s;
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or unavailable: keep the in-memory copy
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    state = null;
    listeners.forEach((x) => x());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

// merged lists, memoised per collection object so snapshots stay referentially stable
const memo = new WeakMap<object, unknown[]>();
function merged<K extends Kind>(s: State, k: K): Item<K>[] {
  const c = s[k] as Coll<Item<K>>;
  const hit = memo.get(c);
  if (hit) return hit as Item<K>[];
  const seed = SEED[k] as unknown as (Item<K> & { id: string })[];
  const del = new Set(c.del);
  const seen = new Set<string>();
  const out: Item<K>[] = [];
  for (const x of seed) {
    seen.add(x.id);
    if (!del.has(x.id)) out.push(c.up[x.id] ?? x);
  }
  for (const [id, v] of Object.entries(c.up)) if (!seen.has(id) && !del.has(id)) out.push(v);
  memo.set(c, out);
  return out;
}

function current<K extends Kind>(k: K) {
  return merged(load(), k);
}

function upsert<K extends Kind>(k: K, item: Item<K> & { id: string }) {
  const s = load();
  const c = s[k] as Coll<Item<K>>;
  commit({ ...s, [k]: { up: { ...c.up, [item.id]: item }, del: c.del.filter((d) => d !== item.id) } });
}

function remove<K extends Kind>(k: K, id: string) {
  const s = load();
  const c = s[k] as Coll<Item<K>>;
  const up = { ...c.up };
  delete up[id];
  commit({ ...s, [k]: { up, del: [...c.del, id] } });
}

function useColl<K extends Kind>(k: K): Item<K>[] {
  return useSyncExternalStore(
    subscribe,
    () => merged(load(), k),
    () => merged(SERVER_STATE, k),
  );
}

export const useRepairs = () => useColl("repairs");
export const useInspections = () => useColl("inspections");
export const useWorkOrders = () => useColl("workOrders");
export const useMaintenance = () => useColl("maintenance");

/** Clears every local change and returns to the seed data */
export function resetOps() {
  commit(empty());
}

// ---------- ids ----------

const pad = (n: number) => String(n).padStart(4, "0");
const ym = TODAY.slice(0, 7).replace("-", "");
function nextSeq(ids: string[], prefix: string) {
  let max = 0;
  for (const id of ids) if (id.startsWith(prefix)) max = Math.max(max, Number(id.slice(prefix.length)) || 0);
  return prefix + pad(max + 1);
}
export const nextRepairId = () => nextSeq(current("repairs").map((r) => r.id), `REP-${ym}-`);
export const nextInspectionId = () => nextSeq(current("inspections").map((r) => r.id), `INS-${TODAY.slice(0, 4)}-`);
export const nextWorkOrderId = () => nextSeq(current("workOrders").map((r) => r.id), `WO-${ym}-`);
export const nextPmId = () => nextSeq(current("maintenance").map((r) => r.id), "PM-");

const nowStamp = () => {
  const d = new Date();
  return `${TODAY} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ---------- repairs ----------

export type NewRepair = Omit<OpsRepair, "id" | "slaHours" | "slaTotal" | "status" | "reported"> & { status?: RepairStatus; reported?: string };

export function addRepair(input: NewRepair): OpsRepair {
  const r: OpsRepair = {
    status: "open",
    reported: TODAY,
    ...input,
    id: nextRepairId(),
    slaTotal: SLA_HOURS[input.severity],
    slaHours: SLA_HOURS[input.severity],
  };
  upsert("repairs", r);
  return r;
}

export function updateRepair(id: string, patch: Partial<OpsRepair>) {
  const r = current("repairs").find((x) => x.id === id);
  if (!r) return;
  const next = { ...r, ...patch };
  if (patch.status === "closed" && !next.closed) next.closed = TODAY;
  if (patch.status && patch.status !== "closed") next.closed = undefined;
  if (patch.severity && patch.severity !== r.severity) {
    next.slaHours = r.slaHours + SLA_HOURS[patch.severity] - r.slaTotal;
    next.slaTotal = SLA_HOURS[patch.severity];
  }
  upsert("repairs", next);
}

export function setRepairStatus(id: string, status: RepairStatus) {
  updateRepair(id, { status });
}

export function deleteRepair(id: string) {
  remove("repairs", id);
}

// ---------- work orders ----------

export function createWorkOrderFromRepair(repairId: string, opts?: { technician?: string; scheduled?: string; billing?: OpsWorkOrder["billing"] }): OpsWorkOrder | undefined {
  const r = current("repairs").find((x) => x.id === repairId);
  if (!r) return;
  const existing = current("workOrders").find((w) => w.repairId === repairId && w.status !== "cancelled");
  if (existing) return existing;
  const wo: OpsWorkOrder = {
    id: nextWorkOrderId(),
    repairId,
    title: `${r.title} · ${r.location}`,
    asset: r.asset,
    projectId: r.projectId,
    technician: opts?.technician ?? r.assignee,
    issuedBy: ISSUER,
    issued: TODAY,
    scheduled: opts?.scheduled ?? addDays(TODAY, r.severity === "high" ? 1 : 2),
    status: "assigned",
    severity: r.severity,
    billing: opts?.billing ?? (r.source === "customer" && !getProject(r.projectId)?.warrantyUntil ? "charge" : "warranty"),
    log: [{ at: nowStamp(), text: `ออกใบสั่งงานจาก ${r.id}` }],
  };
  upsert("workOrders", wo);
  if (r.status === "open") updateRepair(r.id, { status: "fixing" });
  return wo;
}

export function updateWorkOrder(id: string, patch: Partial<OpsWorkOrder>, logText?: string) {
  const w = current("workOrders").find((x) => x.id === id);
  if (!w) return;
  const next = { ...w, ...patch, log: logText ? [{ at: nowStamp(), text: logText }, ...w.log] : w.log };
  upsert("workOrders", next);
  // keep the linked repair in step
  const st = patch.status as WorkOrderStatus | undefined;
  if (st === "done") updateRepair(w.repairId, { status: "closed" });
  else if (st === "on_hold") updateRepair(w.repairId, { status: "waiting" });
  else if (st === "in_progress") updateRepair(w.repairId, { status: "fixing" });
}

export function deleteWorkOrder(id: string) {
  remove("workOrders", id);
}

// ---------- inspections ----------

export function addInspection(input: Omit<OpsInspection, "id">): OpsInspection {
  const ins: OpsInspection = { ...input, id: nextInspectionId() };
  upsert("inspections", ins);
  return ins;
}

export function updateInspection(id: string, patch: Partial<OpsInspection>) {
  const i = current("inspections").find((x) => x.id === id);
  if (i) upsert("inspections", { ...i, ...patch });
}

export function deleteInspection(id: string) {
  remove("inspections", id);
}

/** Save partial results without submitting */
export function saveInspectionResults(id: string, results: Record<string, ItemState>) {
  updateInspection(id, { results });
}

/** Score the checklist; each failed item opens a repair (source inspection). Returns created repair ids. */
export function submitInspection(id: string, results: Record<string, ItemState>): string[] {
  const ins = current("inspections").find((x) => x.id === id);
  if (!ins) return [];
  const p = getProject(ins.projectId);
  const { model, assets } = projectAssets(p);
  const items = itemsFor(ins);
  const created: string[] = [];
  for (const it of items) {
    const st = results[it.id];
    if (st?.r !== "fail") continue;
    const sys = itemSystem(it.id);
    const floorNo = Number(ins.location.match(/\d+/)?.[0] ?? 1);
    const a =
      assets.find((x) => x.code === st.asset) ??
      assets.find((x) => x.system === sys && x.floor === floorNo && x.category !== "เบรกเกอร์ลูกย่อย") ??
      assets.find((x) => x.system === sys) ??
      assets[0];
    const r = addRepair({
      title: `ไม่ผ่าน: ${it.text}`,
      detail: st.note?.trim() || `เกณฑ์ ${it.standard} · จาก ${ins.id}`,
      asset: a?.code ?? "-",
      assetName: a?.name ?? it.text,
      projectId: ins.projectId,
      location: a && model ? assetLocation(model, a) : ins.location,
      system: a?.system ?? sys,
      severity: st.severity ?? "medium",
      source: "inspection",
      assignee: TECH_BY_SYSTEM[a?.system ?? sys],
      reporter: ins.inspector,
      inspectionId: ins.id,
    });
    created.push(r.id);
  }
  const { score } = scoreOf(results);
  updateInspection(id, {
    results,
    score,
    result: score >= PASS_SCORE ? "pass" : "fail",
    repairIds: [...(ins.repairIds ?? []), ...created],
    submitted: nowStamp(),
  });
  return created;
}

export function resultsOf(ins: OpsInspection) {
  return seedResults(ins) ?? {};
}

// ---------- maintenance ----------

export type MaintState = OpsMaint["state"];
export function maintState(m: OpsMaint): MaintState {
  if (m.state === "done" || m.doneOn) return "done";
  if (m.date < TODAY) return "overdue";
  const d = Math.round((Date.parse(m.date) - Date.parse(TODAY)) / 86400000);
  return d <= 14 ? "soon" : "planned";
}

export function addMaintPlan(input: { projectId: string; task: string; system: OpsMaint["system"]; asset?: string; cycleMonths: number; first: string; assignee: string }) {
  const p = getProject(input.projectId);
  const owner = p ? (p.owner.startsWith("บริษัท") || p.owner.startsWith("นิติ") ? p.owner : `คุณ${p.owner.split(" ")[0]}`) : "";
  const out: OpsMaint[] = [];
  const end = addMonths(input.first, 24);
  let date = input.first;
  let planId = "";
  while (date < end) {
    const id = nextPmId();
    planId ||= id;
    const m: OpsMaint = {
      id,
      task: input.task,
      projectId: input.projectId,
      owner,
      date,
      system: input.system,
      state: "planned",
      cycle: `ทุก ${input.cycleMonths} เดือน`,
      assignee: input.assignee,
      cycleMonths: input.cycleMonths,
      asset: input.asset,
      planId,
    };
    upsert("maintenance", m);
    out.push(m);
    date = addMonths(date, input.cycleMonths);
  }
  return out;
}

export function markMaintDone(id: string, done = true) {
  const m = current("maintenance").find((x) => x.id === id);
  if (!m) return;
  upsert("maintenance", done ? { ...m, state: "done", doneOn: TODAY } : { ...m, state: "planned", doneOn: undefined });
}

export function deleteMaint(id: string) {
  remove("maintenance", id);
}
