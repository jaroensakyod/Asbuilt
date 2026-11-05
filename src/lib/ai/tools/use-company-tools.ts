"use client";

// Company tools for the current user. Hooks are called here (tool.run can't call hooks),
// and the current arrays of hook-only stores (ops store, notifications) are captured for the tools.

import { useMemo } from "react";
import type { ClientTool } from "@/lib/ai/client";
import { projects as seedProjects, COMPANY_INFO, TODAY } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useRepairs, useInspections, useWorkOrders, useMaintenance } from "@/lib/ops-store";
import { useNotifications } from "@/lib/notifications";
import { canView, moduleOfPath, MODULES, MODULE_KEYS } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { buildCompanyTools } from "./company";
import { buildSystemPrompt, pageRef } from "./prompt";

export function useCompanyTools(): ClientTool[] {
  const me = useMe();
  const local = useLocalProjects();
  const repairs = useRepairs();
  const inspections = useInspections();
  const workOrders = useWorkOrders();
  const maintenance = useMaintenance();
  const notes = useNotifications();
  return useMemo(() => {
    const projects = [...local, ...seedProjects.filter((p) => !local.some((l) => l.id === p.id))];
    return buildCompanyTools({ role: me.role, userName: me.name, demo: !me.live, projects, repairs, inspections, workOrders, maintenance, notes });
  }, [me.role, me.name, me.live, local, repairs, inspections, workOrders, maintenance, notes]);
}

/** Thai system prompt for the current user and page. */
export function useAssistantPrompt(pathname?: string | null): string {
  const me = useMe();
  return useMemo(() => {
    const visible = MODULE_KEYS.filter((m) => canView(me.role, m)).map((m) => MODULES[m]);
    const hidden = MODULE_KEYS.filter((m) => !canView(me.role, m)).map((m) => MODULES[m]);
    const page = pageRef(pathname);
    const mod = page ? moduleOfPath(page.path) : undefined;
    return buildSystemPrompt({ company: me.company || COMPANY_INFO.name, today: TODAY, userName: me.name, roleLabel: me.roleLabel, visible, hidden, demo: !me.live, page, pageModule: mod ? MODULES[mod] : undefined });
  }, [me.role, me.name, me.roleLabel, me.company, me.live, pathname]);
}
