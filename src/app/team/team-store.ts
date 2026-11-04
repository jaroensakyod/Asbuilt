import { COMPANY_INFO, type Role } from "@/lib/data";
import { createLocalStore } from "@/lib/projects-store";

export type Invite = { id: string; name: string; email: string; phone: string; role: Role; skill?: string; invited: string };

const NO_INVITES: Invite[] = [];
export const invites = createLocalStore<Invite[]>("asbuilt.team.invites.v1", NO_INVITES);

export type CompanySettings = Omit<typeof COMPANY_INFO, "id" | "since"> & { since: number };
const NO_OVERRIDES: Partial<CompanySettings> = {};
export const companyOverrides = createLocalStore<Partial<CompanySettings>>("asbuilt.company.v1", NO_OVERRIDES);

export const SEATS = 25;
