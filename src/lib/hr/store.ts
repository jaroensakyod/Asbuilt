// HR collections. Import this module (side effect) from src/lib/modules.ts so the
// collections and the payroll_runs seed are registered before a company loads.
import { useSyncExternalStore } from "react";
import { createCollection } from "../collection";
import { payrollRuns, type PayrollRun } from "../biz";
import { DEFAULT_SSO } from "./calc";
import { seedAttendance, seedEmployees, seedLeaves, seedSettings } from "./seed";
import type { AttendanceSheet, Employee, HrRun, HrSettings, LeaveRequest } from "./types";

export const employees = createCollection<Employee>("employees", seedEmployees);
export const attendance = createCollection<AttendanceSheet>("attendance", seedAttendance);
export const leaves = createCollection<LeaveRequest>("leaves", seedLeaves);
export const hrSettings = createCollection<HrSettings>("hr_settings", seedSettings);

const FALLBACK: HrSettings = { id: "hr-settings", sso: DEFAULT_SSO, payDay: 25, dailyCycle: "weekly" };
export const useHrSettings = (): HrSettings => {
  const list = hrSettings.use();
  return list.find((s) => s.id === "hr-settings") ?? FALLBACK;
};
export const saveHrSettings = (s: HrSettings) => hrSettings.upsert(s);

/** payroll runs live in the shared biz collection; HR writes the extended line shape */
const NO_RUNS: HrRun[] = [];
const noopSub = () => () => {};
/**
 * The payroll_runs seed is provided by this module; if a server render read the shared
 * collection before HR was imported its server snapshot is empty. Render the runs only
 * after hydration so server and client agree (harmless once modules.ts imports HR).
 */
export const useRuns = () => {
  const runs = payrollRuns.use() as unknown as HrRun[];
  const hydrated = useSyncExternalStore(noopSub, () => true, () => false);
  return hydrated ? runs : NO_RUNS;
};
export const allRuns = () => payrollRuns.all() as unknown as HrRun[];
export const saveRun = (r: HrRun) => payrollRuns.upsert(r as unknown as PayrollRun);
export const removeRun = (id: string) => payrollRuns.remove(id);
