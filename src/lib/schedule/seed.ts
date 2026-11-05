// Demo WBS + progress for every building / handover project and two planning projects.
// This module owns the shared collections wbs_tasks and progress_entries (see @/lib/biz).

import { provideSeed, type ProgressEntry, type WbsTask } from "@/lib/biz";
import { projects, TODAY } from "@/lib/data";
import { generateProject, seedsSchedule } from "./gen";

/** planning projects that already have a baseline programme */
export const PLANNING_WITH_WBS = ["HC-2026-10", "HC-2026-11"];

let cache: { tasks: WbsTask[]; entries: ProgressEntry[] } | null = null;
function build() {
  if (cache) return cache;
  const tasks: WbsTask[] = [];
  const entries: ProgressEntry[] = [];
  for (const p of projects) {
    if (!seedsSchedule(p, PLANNING_WITH_WBS)) continue;
    const g = generateProject(p, TODAY);
    tasks.push(...g.tasks);
    entries.push(...g.entries);
  }
  return (cache = { tasks, entries });
}

provideSeed("wbs_tasks", () => build().tasks);
provideSeed("progress_entries", () => build().entries);
