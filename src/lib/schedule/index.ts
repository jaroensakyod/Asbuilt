// Module entry: importing this registers the module's collections, seeds and notification feeds.
//
// Schedule module (แผนงาน & ความคืบหน้า): WBS / Gantt, CPM, progress measurement, earned value.
// Owner of the shared collections wbsTasks (wbs_tasks) and progressEntries (progress_entries).
//
// For other modules (dashboards, 3D timeline, executive):
//   projectProgress(projectId)        weighted % complete from the WBS (falls back to project.actual)
//   scheduleSummary(projectId)        % plan vs actual, SPI/CPI, forecast finish, days late, critical late …
//   useProjectProgress / useScheduleSummary   the same as React hooks (re-render on edits)

import "./seed";
import "./notes";
import { wbsTasks } from "@/lib/biz";
import { getProject, type Project } from "@/lib/data";
import { scheduleCtxNow, summaryOf, useScheduleCtx } from "./store";
import { leavesOf, weightedPct } from "./rollup";
import type { ScheduleSummary } from "./summary";
import { useMemo } from "react";

export * from "./dates";
export * from "./cpm";
export * from "./rollup";
export * from "./ev";
export * from "./summary";
export * from "./store";
export type { SchedTask } from "./types";
export { CREW, houseTemplate, condoTemplate, syncSummaries } from "./gen";

/** Weighted % complete (0–100) of a project from its WBS; project.actual when it has no WBS. */
export function projectProgress(projectId: string, tasks = wbsTasks.all()): number {
  const ts = tasks.filter((t) => t.projectId === projectId);
  if (!leavesOf(ts).length) return getProject(projectId)?.actual ?? 0;
  return Math.round(weightedPct(ts) * 10) / 10;
}

/** Schedule summary of a project (reads the collections now; use useScheduleSummary in components). */
export function scheduleSummary(projectId: string, project?: Pick<Project, "id" | "value" | "finish">): ScheduleSummary | undefined {
  const p = project ?? getProject(projectId);
  if (!p) return undefined;
  return summaryOf(p, scheduleCtxNow());
}

export function useProjectProgress(projectId: string): number {
  const tasks = wbsTasks.use();
  return useMemo(() => projectProgress(projectId, tasks), [projectId, tasks]);
}

export function useScheduleSummary(projectId: string, project?: Pick<Project, "id" | "value" | "finish">): ScheduleSummary | undefined {
  const ctx = useScheduleCtx();
  return useMemo(() => {
    const p = project ?? getProject(projectId);
    return p ? summaryOf(p, ctx) : undefined;
  }, [ctx, projectId, project]);
}
