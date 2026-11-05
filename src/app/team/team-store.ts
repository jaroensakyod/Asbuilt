import { COMPANY_INFO, type Role } from "@/lib/data";
import { createLocalStore } from "@/lib/projects-store";
import { deleteRow, isLiveReady, updateCompany, workspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase/client";

export type Invite = { id: string; name: string; email: string; phone: string; role: Role; skill?: string; invited: string; token?: string };

const NO_INVITES: Invite[] = [];

// Live mode: pending rows of the invitations table. A new invite is inserted
// and its link token copied back into the store.
export const invites = createLocalStore<Invite[]>("asbuilt.team.invites.v1", NO_INVITES, {
  hydrate: (rows) =>
    rows.invitations.map((r) => ({
      id: r.id,
      name: r.display_name ?? r.email,
      email: r.email,
      phone: r.phone ?? "–",
      role: r.role,
      skill: r.skill ?? undefined,
      invited: r.created_at.slice(0, 10),
      token: (r as { token?: string }).token,
    })),
  onChange: (prev, next) => {
    const before = new Set(prev.map((i) => i.id));
    const after = new Set(next.map((i) => i.id));
    for (const i of next) if (!before.has(i.id)) void createInvitation(i);
    for (const id of before) if (!after.has(id)) void deleteRow("invitations", id);
  },
});

async function createInvitation(i: Invite) {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) return;
  const { data, error } = await sb
    .from("invitations")
    .insert({ id: i.id, company_id: cid, email: i.email.toLowerCase(), role: i.role, display_name: i.name, phone: i.phone === "–" ? null : i.phone, skill: i.skill ?? null })
    .select("token")
    .single();
  if (error) {
    console.error("invite failed", error.message);
    invites.set((prev) => prev.filter((x) => x.id !== i.id));
    return;
  }
  invites.set((prev) => prev.map((x) => (x.id === i.id ? { ...x, token: data.token as string } : x)));
}

export const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

export type CompanySettings = Omit<typeof COMPANY_INFO, "id" | "since"> & { since: number };

// pristine demo profile, so "reset" can restore it in demo mode
const BASE = { ...COMPANY_INFO };
const NO_OVERRIDES: Partial<CompanySettings> = {};

const COLUMN: Partial<Record<keyof CompanySettings, string>> = {
  name: "name",
  nameEn: "name_en",
  address: "address",
  phone: "phone",
  hotline: "hotline",
  taxId: "tax_id",
  line: "line",
  since: "since",
};

export const companyOverrides = createLocalStore<Partial<CompanySettings>>("asbuilt.company.v1", NO_OVERRIDES, {
  hydrate: () => ({}),
  onChange: (_prev, next) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next)) {
      const col = COLUMN[k as keyof CompanySettings];
      if (col) patch[col] = v;
    }
    if (Object.keys(patch).length) void updateCompany(patch);
  },
});

/**
 * Make company settings visible everywhere (document headers, sidebar…).
 * Demo mode: overrides from this browser on top of the demo profile.
 * Live mode: saved values are written into the shared profile directly.
 */
export function applyCompanySettings() {
  const o = companyOverrides.get();
  if (isLiveReady()) {
    Object.assign(COMPANY_INFO, o);
    return;
  }
  Object.assign(COMPANY_INFO, BASE, o);
}
if (typeof window !== "undefined") companyOverrides.subscribe(applyCompanySettings);

// seat limit of the current SaaS plan
export { seatLimit } from "@/lib/billing";
