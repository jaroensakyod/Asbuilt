// Workspace: which company the signed-in user is working in, and that company's data.
//
// Demo mode (no Supabase env): status "demo", the bundled sample data is used as is.
// Live mode: after sign-in the browser loads the active company's rows and swaps them
// into the shared data arrays (projects, team, ops records, documents) BEFORE the app
// renders (see AppFrame). This only ever happens in the browser, so the server never
// holds tenant data and one company's records can't leak into another's render.

import { useSyncExternalStore } from "react";
import { LIVE } from "./supabase/env";
import { supabase } from "./supabase/client";
import { projects, team, repairs, inspections, maintenance, workOrders, documents, COMPANY_INFO, type Project, type Member, type Role } from "./data";

export type WsStatus = "demo" | "loading" | "signed-out" | "no-company" | "ready" | "error";

export type WsCompany = { id: string; name: string; role: Role; displayName: string };

export type WsState = {
  status: WsStatus;
  userId?: string;
  email?: string;
  displayName?: string;
  role?: Role;
  companyId?: string;
  companies: WsCompany[];
  error?: string;
};

let ws: WsState = LIVE ? { status: "loading", companies: [] } : { status: "demo", companies: [] };
const listeners = new Set<() => void>();
const SERVER: WsState = LIVE ? { status: "loading", companies: [] } : { status: "demo", companies: [] };

function setWs(next: Partial<WsState>) {
  ws = { ...ws, ...next };
  listeners.forEach((l) => l());
}

export function useWorkspace(): WsState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ws,
    () => SERVER,
  );
}

export const workspace = () => ws;
export const isLiveReady = () => LIVE && ws.status === "ready" && !!ws.companyId;

// ---------------------------------------------------------------------------
// tenant hydration hooks: stores register how to receive their rows
// ---------------------------------------------------------------------------

export type TenantRows = {
  projects: Project[];
  repairs: unknown[];
  inspections: unknown[];
  workOrders: unknown[];
  maintenance: unknown[];
  documents: unknown[];
  invitations: { id: string; email: string; role: Role; display_name: string | null; phone: string | null; skill: string | null; created_at: string }[];
};

type Hydrator = (rows: TenantRows) => void;
const hydrators = new Set<Hydrator>();
/** Stores call this at module load to receive tenant rows when a company is loaded. */
export function onTenantLoad(fn: Hydrator) {
  hydrators.add(fn);
}

function replace<T>(arr: T[], next: T[]) {
  arr.splice(0, arr.length, ...next);
}

// ---------------------------------------------------------------------------
// remote writes
// ---------------------------------------------------------------------------

export type Table = "projects" | "repairs" | "inspections" | "work_orders" | "maintenance" | "documents" | "invitations";

type ErrorListener = (msg: string) => void;
const errorListeners = new Set<ErrorListener>();
export function onRemoteError(fn: ErrorListener) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}
function report(e: { message?: string } | null | undefined, what: string) {
  if (!e) return;
  const msg = `${what}: ${e.message ?? "เกิดข้อผิดพลาด"}`;
  console.error(msg);
  errorListeners.forEach((l) => l(msg));
}

export async function upsertRow(table: Table, row: Record<string, unknown>) {
  const sb = supabase();
  if (!sb || !ws.companyId) return;
  const { error } = await sb.from(table).upsert({ ...row, company_id: ws.companyId });
  report(error, "บันทึกข้อมูลไม่สำเร็จ");
}

export async function deleteRow(table: Table, id: string) {
  const sb = supabase();
  if (!sb || !ws.companyId) return;
  const { error } = await sb.from(table).delete().eq("company_id", ws.companyId).eq("id", id);
  report(error, "ลบข้อมูลไม่สำเร็จ");
}

export async function updateCompany(patch: Record<string, unknown>) {
  const sb = supabase();
  if (!sb || !ws.companyId) return;
  const { error } = await sb.from("companies").update(patch).eq("id", ws.companyId);
  report(error, "บันทึกข้อมูลบริษัทไม่สำเร็จ");
}

// ---------------------------------------------------------------------------
// boot / switch company
// ---------------------------------------------------------------------------

const ACTIVE_KEY = "asbuilt:company";

export async function bootWorkspace(preferCompany?: string) {
  const sb = supabase();
  if (!sb) return;
  setWs({ status: "loading", error: undefined });
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    setWs({ status: "signed-out", userId: undefined, email: undefined, companies: [] });
    return;
  }
  const { data: mems, error } = await sb.from("memberships").select("company_id, role, display_name, active, companies(name)").eq("user_id", user.id).eq("active", true);
  if (error) {
    setWs({ status: "error", error: error.message, userId: user.id, email: user.email ?? undefined });
    return;
  }
  const companies: WsCompany[] = (mems ?? []).map((m) => ({
    id: m.company_id as string,
    role: m.role as Role,
    displayName: (m.display_name as string) ?? user.email ?? "",
    name: ((m.companies as unknown as { name: string } | null)?.name as string) ?? "บริษัท",
  }));
  if (!companies.length) {
    setWs({ status: "no-company", userId: user.id, email: user.email ?? undefined, companies });
    return;
  }
  const saved = preferCompany ?? window.localStorage.getItem(ACTIVE_KEY) ?? "";
  const active = companies.find((c) => c.id === saved) ?? companies[0];
  window.localStorage.setItem(ACTIVE_KEY, active.id);
  try {
    await loadCompany(active.id);
  } catch (e) {
    setWs({ status: "error", error: (e as Error).message });
    return;
  }
  setWs({ status: "ready", userId: user.id, email: user.email ?? undefined, companies, companyId: active.id, role: active.role, displayName: active.displayName });
}

export async function switchCompany(id: string) {
  window.localStorage.setItem(ACTIVE_KEY, id);
  await bootWorkspace(id);
}

export async function signOut() {
  const sb = supabase();
  if (!sb) return;
  await sb.auth.signOut();
  window.localStorage.removeItem(ACTIVE_KEY);
  // full reload so no data from the previous session stays in memory
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}

async function all<T>(table: string, companyId: string, columns = "data"): Promise<T[]> {
  const sb = supabase()!;
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(columns).eq("company_id", companyId).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

async function loadCompany(companyId: string) {
  const sb = supabase()!;
  const { data: company, error } = await sb.from("companies").select("*").eq("id", companyId).single();
  if (error) throw new Error(error.message);
  const [proj, rep, ins, wo, mt, docs, mems] = await Promise.all([
    all<{ data: Project }>("projects", companyId),
    all<{ data: unknown }>("repairs", companyId),
    all<{ data: unknown }>("inspections", companyId),
    all<{ data: unknown }>("work_orders", companyId),
    all<{ data: unknown }>("maintenance", companyId),
    all<{ data: unknown }>("documents", companyId),
    all<{ user_id: string; role: Role; display_name: string | null; phone: string | null; skill: string | null; active: boolean; email: string | null; created_at: string }>(
      "memberships",
      companyId,
      "user_id, role, display_name, phone, skill, active, email, created_at",
    ),
  ]);
  // invitations are admin-only; a non-admin just gets none
  const { data: inv } = await sb.from("invitations").select("id, email, role, display_name, phone, skill, created_at, token").eq("company_id", companyId).is("accepted_at", null);

  // company profile
  Object.assign(COMPANY_INFO, {
    id: company.id,
    name: company.name ?? COMPANY_INFO.name,
    nameEn: company.name_en ?? "",
    address: company.address ?? "",
    phone: company.phone ?? "",
    hotline: company.hotline ?? company.phone ?? "",
    taxId: company.tax_id ?? "",
    line: company.line ?? "",
    since: company.since ?? COMPANY_INFO.since,
  });

  // team
  const members: Member[] = mems.map((m) => ({
    id: m.user_id,
    name: m.display_name ?? m.email ?? "ผู้ใช้",
    role: m.role,
    phone: m.phone ?? "",
    email: m.email ?? "",
    skill: m.skill ?? undefined,
    active: m.active,
    lastSeen: m.created_at.slice(0, 10),
  }));
  replace(team, members);
  replace(projects, proj.map((r) => r.data));
  // legacy base arrays some pages still read directly
  replace(repairs as unknown[], rep.map((r) => r.data));
  replace(inspections as unknown[], ins.map((r) => r.data));
  replace(workOrders as unknown[], wo.map((r) => r.data));
  replace(maintenance as unknown[], mt.map((r) => r.data));
  replace(documents as unknown[], []);

  const rows: TenantRows = {
    projects: proj.map((r) => r.data),
    repairs: rep.map((r) => r.data),
    inspections: ins.map((r) => r.data),
    workOrders: wo.map((r) => r.data),
    maintenance: mt.map((r) => r.data),
    documents: docs.map((r) => r.data),
    invitations: (inv ?? []) as TenantRows["invitations"],
  };
  hydrators.forEach((h) => h(rows));
}
