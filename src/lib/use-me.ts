"use client";

import { ROLE_LABEL, COMPANY_INFO, type Role } from "./data";
import { useWorkspace } from "./workspace";

const DEMO_ME = { name: "ศิริพร ตั้งเจริญ", email: "siriporn@example.co.th", role: "pm" as Role };

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

/** The signed-in person (live mode) or the demo persona. */
export function useMe() {
  const ws = useWorkspace();
  const live = ws.status === "ready";
  const name = live ? (ws.displayName ?? ws.email ?? "ผู้ใช้") : DEMO_ME.name;
  const role: Role = live ? (ws.role ?? "pm") : DEMO_ME.role;
  return {
    live,
    name,
    email: live ? (ws.email ?? "") : DEMO_ME.email,
    role,
    roleLabel: ROLE_LABEL[role],
    initials: initialsOf(name),
    company: live ? (ws.companies.find((c) => c.id === ws.companyId)?.name ?? COMPANY_INFO.name) : COMPANY_INFO.name,
    companies: ws.companies,
    companyId: ws.companyId,
  };
}
