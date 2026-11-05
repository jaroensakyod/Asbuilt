// Pure time-clock helpers for /m/clock: geofence distance and check-in/out → attendance
// sheet entries. Type-only imports; unit-tested in tests/hr/labour.test.ts.
import type { DayMark } from "./calc";
import type { AttendanceEntry, AttendanceSheet, ClockStamp } from "./types";
import type { ClockSettings } from "./labour-types";

export const DEFAULT_CLOCK: ClockSettings = { id: "clock-settings", defaultRadius: 300, sites: [], dayHours: 8, breakHours: 1, halfDayBelow: 5, shiftEnd: "17:00" };

/** great-circle distance in metres */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

export type Fence = { lat?: number; lng?: number; radius: number };

/** site pin + radius for a project: per-site override, else project coordinates and the default radius */
export function fenceFor(projectId: string, project: { lat?: number; lng?: number } | undefined, s: ClockSettings = DEFAULT_CLOCK): Fence {
  const o = s.sites.find((x) => x.projectId === projectId);
  return { lat: o?.lat ?? project?.lat, lng: o?.lng ?? project?.lng, radius: o?.radius ?? s.defaultRadius };
}

/** distance and inside flag; inside is undefined when the site has no pin */
export function checkFence(pos: { lat: number; lng: number; acc?: number }, f: Fence): { dist?: number; inside?: boolean } {
  if (f.lat === undefined || f.lng === undefined) return {};
  const dist = distanceM(pos.lat, pos.lng, f.lat, f.lng);
  // give the benefit of the GPS accuracy circle (capped so a vague fix cannot pass from far away)
  const slack = Math.min(pos.acc ?? 0, 100);
  return { dist, inside: dist <= f.radius + slack };
}

export const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** hours worked between two stamps minus the break (only taken when the span is over 5 h) */
export function workedHours(inAt: string, outAt: string, s: ClockSettings = DEFAULT_CLOCK) {
  const span = Math.max(0, minutes(outAt) - minutes(inAt)) / 60;
  return Math.round(Math.max(0, span - (span > 5 ? s.breakHours : 0)) * 100) / 100;
}

/** worked hours → day mark; OT = time after the shift end in whole half hours (max 6), full days only */
export function markFromStamps(inAt: string, outAt: string, s: ClockSettings = DEFAULT_CLOCK): { mark: DayMark; ot: number; hours: number } {
  const hours = workedHours(inAt, outAt, s);
  if (hours <= 0) return { mark: "absent", ot: 0, hours };
  if (hours < s.halfDayBelow) return { mark: "half", ot: 0, hours };
  const after = Math.max(0, minutes(outAt) - minutes(s.shiftEnd ?? "17:00"));
  return { mark: "present", ot: Math.min(6, Math.floor(after / 30) / 2), hours };
}

const emptySheet = (projectId: string, date: string, by: string): AttendanceSheet => ({ id: `ATT-${projectId}-${date}`, projectId, date, by, entries: [] });

/** Check a worker in. Keeps an earlier check-in of the same day. */
export function clockIn(sheet: AttendanceSheet | undefined, at: { projectId: string; date: string; by: string }, employeeId: string, stamp: ClockStamp): AttendanceSheet {
  const s = sheet ?? emptySheet(at.projectId, at.date, at.by);
  const cur = s.entries.find((e) => e.employeeId === employeeId);
  const next: AttendanceEntry = cur ? { ...cur, in: cur.in ?? stamp, mark: cur.mark === "absent" ? "present" : cur.mark } : { employeeId, mark: "present", ot: 0, in: stamp };
  return { ...s, entries: cur ? s.entries.map((e) => (e.employeeId === employeeId ? next : e)) : [...s.entries, next] };
}

/** Check a worker out and derive the day mark and OT from the hours worked. */
export function clockOut(sheet: AttendanceSheet, employeeId: string, stamp: ClockStamp, s: ClockSettings = DEFAULT_CLOCK): AttendanceSheet {
  return {
    ...sheet,
    entries: sheet.entries.map((e) => {
      if (e.employeeId !== employeeId) return e;
      if (!e.in) return { ...e, out: stamp };
      const { mark, ot } = markFromStamps(e.in.at, stamp.at, s);
      return { ...e, mark, ot, out: stamp };
    }),
  };
}

export type Verified = "gps" | "outside" | "qr" | "manual";
/** how an entry was recorded, for the attendance sheet indicator */
export function verification(e: AttendanceEntry): Verified {
  if (!e.in) return "manual";
  if (e.in.method === "qr") return "qr";
  if (e.in.method === "gps") return e.in.inside === false ? "outside" : "gps";
  return "manual";
}
