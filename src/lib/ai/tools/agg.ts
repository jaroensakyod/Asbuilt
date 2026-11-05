// Pure aggregation helpers for the company AI assistant's tools.
// No React, no "@/" imports: unit-tested under tests/ai.
// The hook (use-company-tools.ts) maps each module's records into these generic shapes,
// so the model only ever receives compact, aggregated results (never whole collections).

const DAY = 86400000;
export const daysDiff = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY);
export const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso.slice(0, 10)) + n * DAY).toISOString().slice(0, 10);
export const monthOf = (iso: string) => iso.slice(0, 7);
export const r0 = (n: number) => Math.round(Number(n) || 0);
export const r1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (xs: number[]) => xs.reduce((s, x) => s + (Number(x) || 0), 0);

export function countBy<T>(xs: T[], key: (x: T) => string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = key(x);
    if (k === undefined) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function sumBy<T>(xs: T[], key: (x: T) => string | undefined, val: (x: T) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = key(x);
    if (k === undefined) continue;
    out[k] = (out[k] ?? 0) + (Number(val(x)) || 0);
  }
  return out;
}

/** first `n` items plus how many were left out, so the model knows a list is partial */
export function topN<T>(xs: T[], n: number): { items: T[]; total: number; more: number } {
  const lim = Math.max(1, Math.min(50, Math.floor(n) || 10));
  return { items: xs.slice(0, lim), total: xs.length, more: Math.max(0, xs.length - lim) };
}

/** Thai / Latin text normalised for matching: lower case, no spaces, no dots/dashes */
export const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[\s.\-_/·,]+/g, "");

export function textMatch(q: string | undefined, ...fields: (string | number | undefined)[]): boolean {
  if (!q || !q.trim()) return true;
  const hay = norm(fields.filter((f) => f !== undefined).join(" "));
  return q
    .trim()
    .split(/\s+/)
    .map(norm)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

// ---------- receivables / payables aging ----------

export type MoneyRow = { id: string; due: string; amount: number; projectId?: string; party?: string; label?: string; status?: string; href?: string };
export type AgingOut = {
  today: string;
  outstanding: { count: number; amount: number };
  overdue: { count: number; amount: number };
  /** not yet overdue and due within the current calendar month */
  dueThisMonth: { count: number; amount: number };
  /** not yet overdue and due within `horizonDays` from today */
  dueSoon: { days: number; count: number; amount: number };
  /** overdue amount by days past due */
  buckets: { "1-30": number; "31-60": number; "61-90": number; "90+": number };
  /** overdue items, oldest first */
  overdueItems: (MoneyRow & { daysOverdue: number })[];
  /** upcoming items, soonest first */
  upcomingItems: (MoneyRow & { inDays: number })[];
  byProject: { projectId: string; amount: number; overdue: number }[];
};

export function aging(rows: MoneyRow[], today: string, horizonDays = 30, listN = 10): AgingOut {
  const live = rows.filter((r) => (Number(r.amount) || 0) > 0);
  const overdue = live.filter((r) => r.due < today).map((r) => ({ ...r, daysOverdue: daysDiff(r.due, today) }));
  const upcoming = live.filter((r) => r.due >= today).map((r) => ({ ...r, inDays: daysDiff(today, r.due) }));
  const month = monthOf(today);
  const thisMonth = upcoming.filter((r) => monthOf(r.due) === month);
  const soon = upcoming.filter((r) => r.inDays <= horizonDays);
  const buckets = { "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of overdue) {
    const k = r.daysOverdue <= 30 ? "1-30" : r.daysOverdue <= 60 ? "31-60" : r.daysOverdue <= 90 ? "61-90" : "90+";
    buckets[k] += r.amount;
  }
  const proj = new Map<string, { amount: number; overdue: number }>();
  for (const r of live) {
    if (!r.projectId) continue;
    const p = proj.get(r.projectId) ?? { amount: 0, overdue: 0 };
    p.amount += r.amount;
    if (r.due < today) p.overdue += r.amount;
    proj.set(r.projectId, p);
  }
  const c = (xs: MoneyRow[]) => ({ count: xs.length, amount: r0(sum(xs.map((x) => x.amount))) });
  return {
    today,
    outstanding: c(live),
    overdue: c(overdue),
    dueThisMonth: c(thisMonth),
    dueSoon: { days: horizonDays, ...c(soon) },
    buckets: { "1-30": r0(buckets["1-30"]), "31-60": r0(buckets["31-60"]), "61-90": r0(buckets["61-90"]), "90+": r0(buckets["90+"]) },
    overdueItems: overdue.sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount).slice(0, listN).map((r) => ({ ...r, amount: r0(r.amount) })),
    upcomingItems: upcoming.sort((a, b) => a.inDays - b.inDays || b.amount - a.amount).slice(0, listN).map((r) => ({ ...r, amount: r0(r.amount) })),
    byProject: [...proj.entries()]
      .map(([projectId, v]) => ({ projectId, amount: r0(v.amount), overdue: r0(v.overdue) }))
      .sort((a, b) => b.overdue - a.overdue || b.amount - a.amount)
      .slice(0, listN),
  };
}

/** cost used % compared with progress %: a positive gap means spending ahead of work done */
export const burnGap = (usedPct: number | null, progressPct: number) => (usedPct === null ? null : r1(usedPct - progressPct));

// ---------- sales pipeline ----------

export type PipeLead = { id: string; stage: string; budget: number /* baht */; owner?: string; nextFollowUp?: string; created?: string; updated?: string };
export function pipeline(leads: PipeLead[], weights: Record<string, number>, today: string, stageOrder: string[] = Object.keys(weights)) {
  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const stages = stageOrder.map((s) => {
    const xs = leads.filter((l) => l.stage === s);
    const value = sum(xs.map((x) => x.budget));
    return { stage: s, count: xs.length, value: r0(value), weighted: r0(value * (weights[s] ?? 0)) };
  });
  const followUpsDue = open.filter((l) => l.nextFollowUp && l.nextFollowUp <= today).sort((a, b) => (a.nextFollowUp ?? "").localeCompare(b.nextFollowUp ?? ""));
  const won = leads.filter((l) => l.stage === "won").length;
  const lost = leads.filter((l) => l.stage === "lost").length;
  return {
    stages,
    open: { count: open.length, value: r0(sum(open.map((l) => l.budget))), weighted: r0(sum(open.map((l) => l.budget * (weights[l.stage] ?? 0)))) },
    winRate: won + lost ? r1((won / (won + lost)) * 100) : null,
    followUpsDue: followUpsDue.map((l) => ({ id: l.id, stage: l.stage, owner: l.owner, nextFollowUp: l.nextFollowUp, overdueDays: daysDiff(l.nextFollowUp!, today) })),
    byOwner: Object.entries(sumBy(open, (l) => l.owner ?? "-", (l) => l.budget))
      .map(([owner, value]) => ({ owner, value: r0(value), count: open.filter((l) => (l.owner ?? "-") === owner).length }))
      .sort((a, b) => b.value - a.value),
  };
}

// ---------- schedule ranking ----------

export type ProjSched = { id: string; pct: number; planPct: number; daysLate: number; spi?: number; cpi?: number; late?: number; criticalLate?: number };
/** worst first: days late, then % behind plan, then SPI */
export function rankLate<T extends ProjSched>(rows: T[]): (T & { behindPts: number })[] {
  return rows
    .map((r) => ({ ...r, behindPts: r1(r.planPct - r.pct) }))
    .sort((a, b) => b.daysLate - a.daysLate || b.behindPts - a.behindPts || (a.spi ?? 1) - (b.spi ?? 1));
}

// ---------- search ----------

export type SearchItem = { kind: string; id: string; title: string; sub?: string; href: string; extra?: string };
export function searchRank(items: SearchItem[], q: string, limit = 12): (SearchItem & { score: number })[] {
  const nq = norm(q);
  if (!nq) return [];
  const tokens = q.trim().split(/\s+/).map(norm).filter(Boolean);
  const out: (SearchItem & { score: number })[] = [];
  for (const it of items) {
    const id = norm(it.id);
    const title = norm(it.title);
    const hay = `${id} ${title} ${norm(it.sub)} ${norm(it.extra)}`;
    let score = 0;
    if (id === nq) score = 100;
    else if (id.startsWith(nq)) score = 80;
    else if (id.includes(nq)) score = 70;
    else if (title === nq) score = 65;
    else if (title.includes(nq)) score = 55;
    else if (tokens.every((t) => hay.includes(t))) score = 40;
    else {
      const hit = tokens.filter((t) => hay.includes(t)).length;
      if (hit && tokens.length > 1) score = Math.round((20 * hit) / tokens.length);
    }
    if (score) out.push({ ...it, score });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, Math.max(1, Math.min(30, limit)));
}

// ---------- misc ----------

/** latest date ≤ today among records (e.g. most recent attendance day) */
export function latestOnOrBefore(dates: string[], today: string): string | undefined {
  let best: string | undefined;
  for (const d of dates) if (d <= today && (!best || d > best)) best = d;
  return best;
}

/** clamp a numeric tool argument */
export const numArg = (v: unknown, def: number, min = 1, max = 50) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
};
export const strArg = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
