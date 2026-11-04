"use client";

import { useEffect, useState } from "react";
import { ROLE_LABEL, COMPANY_INFO, type Role } from "./data";
import { useWorkspace } from "./workspace";

const DEMO_ME = { name: "ศิริพร ตั้งเจริญ", email: "siriporn@example.co.th" };

// demo mode: which role to preview the app as (menu "ดูในบทบาท")
const ROLE_KEY = "asbuilt:demoRole";
const roleListeners = new Set<() => void>();
const readRole = (): Role => {
  if (typeof window === "undefined") return "admin";
  const r = window.localStorage.getItem(ROLE_KEY) as Role | null;
  return r && r in ROLE_LABEL ? r : "admin";
};
export function setDemoRole(r: Role) {
  window.localStorage.setItem(ROLE_KEY, r);
  roleListeners.forEach((l) => l());
}
function useDemoRole(): Role {
  // server and first client render use "admin"; the saved role is applied right after mount
  const [role, setRole] = useState<Role>("admin");
  useEffect(() => {
    const sync = () => setRole(readRole());
    sync();
    roleListeners.add(sync);
    return () => {
      roleListeners.delete(sync);
    };
  }, []);
  return role;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

/** The signed-in person (live mode) or the demo persona. */
export function useMe() {
  const ws = useWorkspace();
  const demoRole = useDemoRole();
  const live = ws.status === "ready";
  const name = live ? (ws.displayName ?? ws.email ?? "ผู้ใช้") : DEMO_ME.name;
  const role: Role = live ? (ws.role ?? "pm") : demoRole;
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
