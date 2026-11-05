// Safety collections and derived per-site figures (headcount, safety officers, จป. check).
import { useMemo } from "react";
import { createCollection } from "../collection";
import { siteDiaries } from "../biz";
import { TODAY } from "../data";
import { ACTIVE_SITES } from "../hr/seed";
import { employees } from "../hr/store";
import { trainings } from "../hr/labour-store";
import type { CertKey } from "../hr/labour-types";
import { DEFAULT_SAFETY, jpCheck, type JpCheck } from "./calc";
import { seedEnv, seedIncidents, seedOfficers, seedPermits, seedPpe, seedSafetyInspections, seedSafetySettings, seedTalks } from "./seed";
import type { EnvLog, Incident, JpLevel, Permit, PpeIssue, SafetyInspection, SafetyOfficer, SafetySettings, ToolboxTalk } from "./types";

export const toolboxTalks = createCollection<ToolboxTalk>("toolbox_talks", seedTalks);
export const permits = createCollection<Permit>("work_permits", seedPermits);
export const safetyInspections = createCollection<SafetyInspection>("safety_inspections", seedSafetyInspections);
export const incidents = createCollection<Incident>("incidents", seedIncidents);
export const ppeIssues = createCollection<PpeIssue>("ppe_issues", seedPpe);
export const envLogs = createCollection<EnvLog>("env_logs", seedEnv);
export const safetyOfficers = createCollection<SafetyOfficer>("safety_officers", seedOfficers);
export const safetySettings = createCollection<SafetySettings>("safety_settings", seedSafetySettings);

export const useSafetySettings = (): SafetySettings => safetySettings.use().find((s) => s.id === "safety-settings") ?? DEFAULT_SAFETY;

export const JP_CERT: Record<JpLevel, CertKey> = { supervisor: "jp_supervisor", technical: "jp_technical", advanced: "jp_advanced", professional: "jp_professional" };
const CERT_JP: Partial<Record<CertKey, JpLevel>> = { jp_supervisor: "supervisor", jp_technical: "technical", jp_advanced: "advanced", jp_professional: "professional" };

export type SiteOfficer = { name: string; level: JpLevel; source: "cert" | "assigned"; ref: string };
export type SiteSafety = { projectId: string; headcount: number; officers: SiteOfficer[]; check: JpCheck };

/** Headcount and safety officers of every active site, checked against the จป. ladder. */
export function useSiteSafety(): SiteSafety[] {
  const emps = employees.use();
  const trn = trainings.use();
  const assigned = safetyOfficers.use();
  const diaries = siteDiaries.use();
  const settings = useSafetySettings();
  return useMemo(() => {
    const out: SiteSafety[] = [];
    for (const p of ACTIVE_SITES) {
      const people = emps.filter((e) => e.projectId === p.id && e.status !== "resigned" && (!e.endDate || e.endDate >= TODAY));
      let headcount = people.reduce((s, e) => s + (e.type === "subcontract" ? (e.crewSize ?? 1) : 1), 0);
      // a recent site diary may report more people on site (other subcontractors)
      const diary = diaries.filter((d) => d.projectId === p.id && d.date <= TODAY).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (diary) headcount = Math.max(headcount, diary.manpower.reduce((s, m) => s + m.count, 0));
      const officers: SiteOfficer[] = [];
      for (const e of people) {
        const levels = new Set(trn.filter((t) => t.employeeId === e.id && CERT_JP[t.cert]).map((t) => CERT_JP[t.cert]!));
        for (const level of levels) officers.push({ name: e.name, level, source: "cert", ref: e.id });
      }
      for (const a of assigned) if (a.projectId === p.id && !officers.some((o) => o.name === a.name && o.level === a.level)) officers.push({ name: a.name, level: a.level, source: "assigned", ref: a.id });
      out.push({ projectId: p.id, headcount, officers, check: jpCheck(headcount, settings.ladder, officers.map((o) => o.level)) });
    }
    return out;
  }, [emps, trn, assigned, diaries, settings.ladder]);
}
