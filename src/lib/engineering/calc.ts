// Pure engineering calculations (no React, no "@/" imports) so they can be unit-tested:
//   concrete acceptance, test due dates, rebar tensile check, ITP hold-point gating,
//   submittal state, licence-rule checks, closeout completion.

import type {
  ConcreteRule,
  ConcreteTest,
  Closeout,
  Duty,
  InspectionRequest,
  ItpTemplate,
  LicLevel,
  LicenseRule,
  Licensee,
  RebarLot,
  RebarSpec,
  Submittal,
  SubmittalState,
  TestSet,
} from "./types";

const DAY = 86400000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
export const pad = (n: number, w = 3) => String(n).padStart(w, "0");

/** default acceptance rule: avg ≥ fc' and each ≥ fc' − 35 ksc (check against the current standard) */
export const DEFAULT_CONCRETE_RULE: ConcreteRule = { avgOffset: 0, tolKsc: 35, ages: [7, 28], specimensPerAge: 3, earlyPct: 65 };

/** default minimum properties per TIS 20 / TIS 24 (check against the current standard) */
export const DEFAULT_REBAR_SPEC: RebarSpec = {
  SR24: { yieldKsc: 2400, tensileKsc: 3900, elongation: 21 },
  SD40: { yieldKsc: 3900, tensileKsc: 5600, elongation: 15 },
  SD50: { yieldKsc: 4900, tensileKsc: 6300, elongation: 13 },
};

// ---------- concrete ----------

export type StrengthEval = { n: number; avg: number; min: number; avgOk: boolean; eachOk: boolean; pass: boolean; avgLimit: number; eachLimit: number };

/** Acceptance of one set of specimens at the design age. */
export function evalStrength(results: number[], fc: number, rule: Pick<ConcreteRule, "avgOffset" | "tolKsc">): StrengthEval {
  const vals = results.filter((v) => Number.isFinite(v) && v > 0);
  const n = vals.length;
  const avg = n ? vals.reduce((s, v) => s + v, 0) / n : 0;
  const min = n ? Math.min(...vals) : 0;
  const avgLimit = fc + rule.avgOffset;
  const eachLimit = fc - rule.tolKsc;
  const avgOk = n > 0 && avg >= avgLimit - 1e-9;
  const eachOk = n > 0 && min >= eachLimit - 1e-9;
  return { n, avg, min, avgOk, eachOk, pass: avgOk && eachOk, avgLimit, eachLimit };
}

/** Early-age (e.g. 7-day) check: indicative only, average ≥ earlyPct % of fc'. */
export function evalEarly(results: number[], fc: number, earlyPct: number) {
  const vals = results.filter((v) => Number.isFinite(v) && v > 0);
  const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const target = (fc * earlyPct) / 100;
  return { n: vals.length, avg, target, ok: vals.length > 0 && avg >= target - 1e-9 };
}

/** Planned test sets for a pour: one per age, due = pour date + age. */
export function planSets(pourDate: string, ages: number[]): TestSet[] {
  return [...ages].sort((a, b) => a - b).map((age) => ({ age, due: addDays(pourDate, age), results: [] }));
}

export type SetState = "done" | "overdue" | "today" | "upcoming";
export function setState(s: TestSet, today: string): SetState {
  if (s.results.some((v) => v > 0)) return "done";
  if (s.due < today) return "overdue";
  if (s.due === today) return "today";
  return "upcoming";
}

/** Final (design-age) verdict for a pour, or "pending" while the last set has no results. */
export type ConcreteVerdict = "pass" | "fail" | "pending" | "early-low";
export function concreteVerdict(t: Pick<ConcreteTest, "sets" | "fc">, rule: ConcreteRule): ConcreteVerdict {
  const sets = [...t.sets].sort((a, b) => a.age - b.age);
  const last = sets[sets.length - 1];
  if (last && last.results.some((v) => v > 0)) return evalStrength(last.results, t.fc, rule).pass ? "pass" : "fail";
  const early = sets.find((s) => s !== last && s.results.some((v) => v > 0));
  if (early && !evalEarly(early.results, t.fc, rule.earlyPct).ok) return "early-low";
  return "pending";
}

/** Slump within the specified range (inclusive); undefined when not recorded. */
export function slumpOk(t: Pick<ConcreteTest, "slump" | "slumpMin" | "slumpMax">): boolean | undefined {
  if (t.slump === undefined) return undefined;
  if (t.slumpMin !== undefined && t.slump < t.slumpMin) return false;
  if (t.slumpMax !== undefined && t.slump > t.slumpMax) return false;
  return true;
}

/** Pending sets across tests: due today / overdue first. */
export function dueSets(tests: Pick<ConcreteTest, "id" | "sets">[], today: string) {
  const out: { testId: string; set: TestSet; state: SetState }[] = [];
  for (const t of tests) for (const s of t.sets) {
    const st = setState(s, today);
    if (st !== "done") out.push({ testId: t.id, set: s, state: st });
  }
  const rank: Record<SetState, number> = { overdue: 0, today: 1, upcoming: 2, done: 3 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || a.set.due.localeCompare(b.set.due));
}

// ---------- rebar ----------

export type RebarVerdict = "pending" | "pass" | "fail";
export function rebarVerdict(l: Pick<RebarLot, "grade" | "yieldKsc" | "tensileKsc" | "elongation">, spec: RebarSpec): RebarVerdict {
  if (l.yieldKsc === undefined || l.tensileKsc === undefined) return "pending";
  const s = spec[l.grade];
  const ok = l.yieldKsc >= s.yieldKsc && l.tensileKsc >= s.tensileKsc && (l.elongation === undefined || l.elongation >= s.elongation);
  return ok ? "pass" : "fail";
}

// ---------- ITP / hold points ----------

/**
 * Index of the first step that may be recorded now. Steps run in order; a hold point (H)
 * must be passed (approved by the supervising engineer) before any later step can be recorded.
 * Returns steps.length when everything is recorded.
 */
export function nextOpenStep(tpl: Pick<ItpTemplate, "steps">, req: Pick<InspectionRequest, "steps">): number {
  const rec = new Map(req.steps.map((s) => [s.stepId, s]));
  for (let i = 0; i < tpl.steps.length; i++) {
    const r = rec.get(tpl.steps[i].id);
    if (!r?.result) return i;
    if (tpl.steps[i].point === "H" && r.result === "fail") return i; // blocked until re-inspected
  }
  return tpl.steps.length;
}

/** Can step i be recorded? (all earlier hold points passed) */
export function canRecordStep(tpl: Pick<ItpTemplate, "steps">, req: Pick<InspectionRequest, "steps">, i: number): boolean {
  const rec = new Map(req.steps.map((s) => [s.stepId, s]));
  for (let k = 0; k < i; k++) {
    const st = tpl.steps[k];
    const r = rec.get(st.id);
    if (st.point === "H" && r?.result !== "pass" && r?.result !== "na") return false;
  }
  return true;
}

/** The hold point waiting for the engineer's release, if the work has reached it. */
export function waitingHold(tpl: Pick<ItpTemplate, "steps">, req: Pick<InspectionRequest, "steps" | "status">) {
  if (req.status === "approved" || req.status === "rejected") return undefined;
  const i = nextOpenStep(tpl, req);
  const st = tpl.steps[i];
  return st && st.point === "H" ? { index: i, step: st } : undefined;
}

export function itpProgress(tpl: Pick<ItpTemplate, "steps">, req: Pick<InspectionRequest, "steps">) {
  const rec = new Map(req.steps.map((s) => [s.stepId, s]));
  const done = tpl.steps.filter((s) => rec.get(s.id)?.result).length;
  const failed = tpl.steps.filter((s) => rec.get(s.id)?.result === "fail").length;
  return { done, total: tpl.steps.length, failed, pct: tpl.steps.length ? Math.round((done / tpl.steps.length) * 100) : 0 };
}

// ---------- submittals ----------

export function submittalState(s: Pick<Submittal, "revs">, today: string): SubmittalState {
  const r = s.revs[s.revs.length - 1];
  if (!r?.code) return r && r.due < today ? "overdue" : "review";
  return ({ A: "approved", B: "approvedNotes", C: "resubmit", D: "rejected" } as const)[r.code];
}
export const latestRev = <R>(s: { revs: R[] }): R => s.revs[s.revs.length - 1];

// ---------- licences ----------

export type DutyCheck = { duty: Duty; rule?: LicenseRule; licensee?: Licensee; ok: boolean; problems: string[] };

/** The strictest matching rule per duty for a building of `floors` storeys and `area` m². */
export function requiredFor(rules: LicenseRule[], floors: number, area: number): Partial<Record<Duty, LicenseRule>> {
  const out: Partial<Record<Duty, LicenseRule>> = {};
  for (const r of rules) {
    const hit = (r.minFloors <= 0 && r.minArea <= 0) || (r.minFloors > 0 && floors >= r.minFloors) || (r.minArea > 0 && area >= r.minArea);
    if (!hit) continue;
    const cur = out[r.duty];
    if (!cur || r.minLevel > cur.minLevel) out[r.duty] = r;
  }
  return out;
}

/** Check assigned licensees against the rule table; expiring within `warnDays` is flagged but still ok. */
export function checkLicensing(
  rules: LicenseRule[],
  floors: number,
  area: number,
  assigned: Partial<Record<Duty, string>>,
  people: Licensee[],
  today: string,
  levelName: (c: Licensee["council"], l: LicLevel) => string,
): DutyCheck[] {
  const req = requiredFor(rules, floors, area);
  return (Object.keys(req) as Duty[]).map((duty) => {
    const rule = req[duty]!;
    const id = assigned[duty];
    const lic = id ? people.find((p) => p.id === id) : undefined;
    const problems: string[] = [];
    if (!lic) problems.push("ยังไม่ได้กำหนดผู้รับผิดชอบ");
    else {
      if (lic.council !== rule.council) problems.push(`ต้องเป็นสมาชิก${rule.council === "coe" ? "สภาวิศวกร" : "สภาสถาปนิก"}`);
      else if (rule.branch && lic.branch !== rule.branch) problems.push(`ต้องเป็นสาขา${rule.branch}`);
      if (lic.level < rule.minLevel) problems.push(`ระดับต่ำกว่าที่กำหนด (ต้อง${levelName(rule.council, rule.minLevel)}ขึ้นไป)`);
      if (lic.expiry < today) problems.push("ใบอนุญาตหมดอายุ");
    }
    return { duty, rule, licensee: lic, ok: problems.length === 0, problems };
  });
}

// ---------- closeout ----------

export function closeoutPct(c: Pick<Closeout, "items">) {
  const items = c.items.filter((i) => !i.na);
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

// ---------- numbering ----------

/** next running number for a project-scoped series, e.g. RFI-HC-2026-02-007 */
export function nextNo(rows: { projectId: string; no: number }[], projectId: string) {
  return rows.filter((r) => r.projectId === projectId).reduce((m, r) => Math.max(m, r.no), 0) + 1;
}
