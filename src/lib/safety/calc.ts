// Pure safety calculations (จป. requirement, man-hours, LTIFR, inspection score, permit state).
// Type-only imports; unit-tested in tests/safety/calc.test.ts.
import type { AttendanceSheet } from "../hr/types";
import type { Incident, JpLevel, JpRung, Permit, SafetyInspection, SafetySettings } from "./types";

export const DEFAULT_SAFETY: SafetySettings = {
  id: "safety-settings",
  ladder: [
    { min: 2, level: "supervisor" },
    { min: 20, level: "technical" },
    { min: 50, level: "advanced", committee: true },
    { min: 100, level: "professional", committee: true },
  ],
  ltifrBase: 1_000_000,
  hoursPerDay: 8,
  pm25Limit: 37.5,
  notifyItems: [
    "หยุดงานและกั้นบริเวณที่เกิดเหตุ รักษาสภาพไว้เพื่อสอบสวน",
    "แจ้งพนักงานตรวจความปลอดภัย สำนักงานสวัสดิการและคุ้มครองแรงงานจังหวัด (เสียชีวิต: แจ้งทันที)",
    "ส่งแบบ กท.16 แจ้งการประสบอันตรายต่อสำนักงานประกันสังคม ภายใน 15 วัน",
    "ส่งรายงานผลการสอบสวนอุบัติเหตุเป็นหนังสือ ภายใน 7 วัน",
    "แจ้งเจ้าหน้าที่ตำรวจ (กรณีเสียชีวิต)",
    "แจ้งญาติ และผู้รับเหมาช่วงต้นสังกัด",
    "รายงานผู้บริหารและคณะกรรมการความปลอดภัย",
  ],
};

const RANK: Record<JpLevel, number> = { supervisor: 1, technical: 2, advanced: 3, professional: 4 };

export type JpNeed = { level: JpLevel; have: number; ok: boolean };
export type JpCheck = { headcount: number; reached: JpRung[]; needs: JpNeed[]; committee: boolean; ok: boolean };

/**
 * Officers a site needs for its headcount. Every rung reached applies; จป.หัวหน้างาน is a
 * separate role (frontline supervisors), the higher rungs are one ladder where only the top rung
 * reached counts and an officer of that level or higher satisfies it.
 */
export function jpCheck(headcount: number, ladder: JpRung[], officers: JpLevel[]): JpCheck {
  const reached = ladder.filter((r) => headcount >= r.min).sort((a, b) => a.min - b.min);
  const needs: JpNeed[] = [];
  if (reached.some((r) => r.level === "supervisor")) {
    const have = officers.filter((o) => o === "supervisor").length;
    needs.push({ level: "supervisor", have, ok: have >= 1 });
  }
  const top = reached.filter((r) => r.level !== "supervisor").at(-1);
  if (top) {
    const have = officers.filter((o) => o !== "supervisor" && RANK[o] >= RANK[top.level]).length;
    needs.push({ level: top.level, have, ok: have >= 1 });
  }
  return { headcount, reached, needs, committee: reached.some((r) => r.committee), ok: needs.every((n) => n.ok) };
}

const DAY: Record<string, number> = { present: 1, half: 0.5, absent: 0 };

/** Man-hours from attendance sheets: day value × hours per day + OT hours. */
export function manHours(sheets: AttendanceSheet[], hoursPerDay = 8, filter?: (s: AttendanceSheet) => boolean) {
  let h = 0;
  for (const s of sheets) {
    if (filter && !filter(s)) continue;
    for (const e of s.entries) h += (DAY[e.mark] ?? 0) * hoursPerDay + (e.ot || 0);
  }
  return h;
}

/** Lost-time injury frequency rate: LTI × base / man-hours (fatal cases count as LTI). */
export function ltifr(ltiCount: number, hours: number, base = 1_000_000) {
  if (hours <= 0) return 0;
  return Math.round(((ltiCount * base) / hours) * 100) / 100;
}

export const isLti = (i: Pick<Incident, "cls">) => i.cls === "lost_time" || i.cls === "fatal";

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Days since the last lost-time incident at a site (or since the site started). */
export function daysWithoutLti(incidents: Pick<Incident, "cls" | "date" | "projectId">[], projectId: string, siteStart: string, today: string) {
  const last = incidents.filter((i) => i.projectId === projectId && isLti(i) && i.date <= today).reduce((m, i) => (i.date > m ? i.date : m), "");
  return Math.max(0, days(last || siteStart, today));
}

/** % of applicable items that passed */
export function inspectionScore(items: SafetyInspection["items"]) {
  const app = items.filter((i) => i.result !== "na");
  if (!app.length) return 100;
  return Math.round((app.filter((i) => i.result === "pass").length / app.length) * 100);
}

/** permit state at a moment: open permits past validTo are overdue */
export function permitOverdue(p: Pick<Permit, "status" | "validTo">, nowIso: string) {
  return (p.status === "active" || p.status === "issued" || p.status === "requested") && p.validTo < nowIso;
}

/** valid duration in hours */
export const permitHours = (p: Pick<Permit, "validFrom" | "validTo">) => Math.max(0, Math.round((Date.parse(p.validTo) - Date.parse(p.validFrom)) / 360000) / 10);

/** Incident still needs work: open actions, overdue actions, or unfinished notification checklist on serious cases. */
export function incidentFollowUp(i: Incident, today: string) {
  const open = i.actions.filter((a) => !a.done);
  const overdue = open.filter((a) => a.due < today);
  const serious = i.cls === "lost_time" || i.cls === "fatal";
  const notifyLeft = serious ? i.notify.filter((n) => !n.done).length : 0;
  const kt16Missing = serious && !i.kt16;
  return { open: open.length, overdue: overdue.length, notifyLeft, kt16Missing, needs: i.status !== "closed" && (open.length > 0 || notifyLeft > 0 || kt16Missing) };
}

/** AQI-like band for PM2.5 (Thai PCD bands, µg/m³ 24-h average) */
export function pm25Band(v: number): { label: string; tone: "pos" | "neutral" | "warn" | "neg" } {
  if (v <= 15) return { label: "ดีมาก", tone: "pos" };
  if (v <= 25) return { label: "ดี", tone: "pos" };
  if (v <= 37.5) return { label: "ปานกลาง", tone: "neutral" };
  if (v <= 75) return { label: "เริ่มมีผลกระทบ", tone: "warn" };
  return { label: "มีผลกระทบต่อสุขภาพ", tone: "neg" };
}
