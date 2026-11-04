// Customer portal: a project owner opens /portal/<token> without logging in.
//
// Demo mode: the token is deterministic per project ("demo-" + id lowercased),
//            revoking only switches it off in this browser.
// Live mode: tokens are rows of public.portal_links; the anonymous page reads
//            through the security-definer RPC portal_view(token) and reports
//            repairs through portal_report_repair(token, repair).

import { useSyncExternalStore } from "react";
import { LIVE } from "./supabase/env";
import { supabase } from "./supabase/client";
import { workspace } from "./workspace";
import type { Project, Repair, Severity, SystemKey } from "./data";
import type { Installment } from "./biz";

// ---------- demo tokens ----------

const DEMO_PREFIX = "demo-";
export const portalTokenFor = (projectId: string) => DEMO_PREFIX + projectId.toLowerCase();
/** Project id a demo token points to (no existence check) */
export const projectIdFromDemoToken = (token: string) =>
  token.startsWith(DEMO_PREFIX) ? token.slice(DEMO_PREFIX.length).toUpperCase() : null;

const OFF_KEY = "asbuilt:portal:off";
const offListeners = new Set<() => void>();
let offCache: string[] | null = null;
const NO_OFF: string[] = [];
function readOff(): string[] {
  if (typeof window === "undefined") return NO_OFF;
  if (offCache) return offCache;
  try {
    offCache = JSON.parse(window.localStorage.getItem(OFF_KEY) ?? "[]") as string[];
  } catch {
    offCache = [];
  }
  return offCache;
}
/** Demo mode: turn a project's portal link off/on in this browser */
export function setDemoLinkOff(projectId: string, off: boolean) {
  const next = readOff().filter((p) => p !== projectId);
  if (off) next.push(projectId);
  offCache = next;
  window.localStorage.setItem(OFF_KEY, JSON.stringify(next));
  offListeners.forEach((l) => l());
}
export function useDemoLinksOff(): string[] {
  return useSyncExternalStore(
    (l) => {
      offListeners.add(l);
      return () => offListeners.delete(l);
    },
    readOff,
    () => NO_OFF,
  );
}

export const portalUrl = (token: string) => (typeof window === "undefined" ? `/portal/${token}` : `${window.location.origin}/portal/${token}`);

// ---------- live link management (staff side, RLS: company members) ----------

export type PortalLink = { token: string; projectId: string; createdAt: string; revokedAt: string | null };

type LinkRow = { token: string; project_id: string; created_at: string; revoked_at: string | null };
const toLink = (r: LinkRow): PortalLink => ({ token: r.token, projectId: r.project_id, createdAt: r.created_at, revokedAt: r.revoked_at });

/** The active link of a project, or null */
export async function fetchActiveLink(projectId: string): Promise<PortalLink | null> {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) return null;
  const { data, error } = await sb
    .from("portal_links")
    .select("token, project_id, created_at, revoked_at")
    .eq("company_id", cid)
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ? toLink(data[0] as LinkRow) : null;
}

export async function createLink(projectId: string): Promise<PortalLink> {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล");
  const { data, error } = await sb.from("portal_links").insert({ company_id: cid, project_id: projectId }).select("token, project_id, created_at, revoked_at").single();
  if (error) throw new Error(error.message);
  return toLink(data as LinkRow);
}

export async function revokeLink(token: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("portal_links").update({ revoked_at: new Date().toISOString() }).eq("token", token);
  if (error) throw new Error(error.message);
}

/** Revoke every active link of the project and issue a fresh one */
export async function regenerateLink(projectId: string): Promise<PortalLink> {
  const sb = supabase();
  const cid = workspace().companyId;
  if (sb && cid) {
    const { error } = await sb
      .from("portal_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("company_id", cid)
      .eq("project_id", projectId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
  }
  return createLink(projectId);
}

// ---------- what the customer sees ----------

export type PortalCompany = { name: string; phone?: string; hotline?: string; line?: string };
export type PortalPayload = {
  company: PortalCompany;
  project: Project;
  repairs: Repair[];
  installments: Installment[];
};

/** Live mode: read the portal through the RPC. Null = unknown or revoked token. */
export async function fetchPortal(token: string): Promise<PortalPayload | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("portal_view", { p_token: token });
  if (error) throw new Error(error.message);
  const d = data as null | {
    company: PortalCompany | null;
    project: Project | null;
    repairs: Repair[] | null;
    records: { kind: string; data: unknown }[] | null;
  };
  if (!d || !d.project) return null;
  return {
    company: d.company ?? { name: "" },
    project: d.project,
    repairs: d.repairs ?? [],
    installments: (d.records ?? []).filter((r) => r.kind === "installments").map((r) => r.data as Installment),
  };
}

export const PORTAL_LIVE = LIVE;

export type PortalRepairInput = {
  system: SystemKey;
  location: string;
  detail: string;
  urgent: boolean;
  name: string;
  phone: string;
};

export const severityOf = (urgent: boolean): Severity => (urgent ? "high" : "medium");
export const repairTitle = (detail: string) => {
  const t = detail.trim().replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 46)}…` : t;
};

/** Live mode: report a repair through the RPC. Returns the new repair id. */
export async function reportRepairLive(token: string, input: PortalRepairInput, sla: number): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล");
  const today = new Date().toISOString().slice(0, 10);
  const repair = {
    title: repairTitle(input.detail),
    detail: input.detail.trim(),
    asset: "",
    assetName: "แจ้งผ่านพอร์ทัลลูกค้า",
    location: input.location.trim(),
    system: input.system,
    severity: severityOf(input.urgent),
    source: "customer",
    assignee: "",
    reported: today,
    reporter: `${input.name.trim()} · ${input.phone.trim()}`,
    slaHours: sla,
    slaTotal: sla,
  };
  const { data, error } = await sb.rpc("portal_report_repair", { p_token: token, p_repair: repair });
  if (error) throw new Error(error.message);
  return String(data);
}
