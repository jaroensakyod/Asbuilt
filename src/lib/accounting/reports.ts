// Financial reports from journal entries: GL, trial balance, P&L (by month / by project), balance sheet, aging, CSV.
// Pure: no React, no "@/" imports.
import { debitNormal, typeOfCode, type Account } from "./coa";
import { daysBetween, r2, satang } from "./money";
import type { JournalEntry } from "./types";

type Range = { from?: string; to?: string };
const inRange = (date: string, { from, to }: Range) => (!from || date >= from) && (!to || date <= to);

/** Debit − credit per account (satang-exact) for entries in a date range. */
export function netByAccount(entries: JournalEntry[], range: Range = {}, skip?: (e: JournalEntry) => boolean) {
  const m = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    if (!inRange(e.date, range) || skip?.(e)) continue;
    for (const l of e.lines) {
      const x = m.get(l.account) ?? { debit: 0, credit: 0 };
      x.debit += satang(l.debit);
      x.credit += satang(l.credit);
      m.set(l.account, x);
    }
  }
  const out = new Map<string, { debit: number; credit: number; net: number }>();
  for (const [k, v] of m) out.set(k, { debit: v.debit / 100, credit: v.credit / 100, net: (v.debit - v.credit) / 100 });
  return out;
}

const dayBefore = (iso: string) => new Date(Date.parse(iso + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);

// ---------- general ledger ----------

export type GlRow = { entry: JournalEntry; debit: number; credit: number; balance: number; memo: string; projectId?: string };
export function generalLedger(entries: JournalEntry[], account: string, range: Range = {}) {
  const opening = range.from ? (netByAccount(entries, { to: dayBefore(range.from) }).get(account)?.net ?? 0) : 0;
  let bal = satang(opening);
  const rows: GlRow[] = [];
  for (const e of entries) {
    if (!inRange(e.date, range)) continue;
    for (const l of e.lines) {
      if (l.account !== account) continue;
      bal += satang(l.debit) - satang(l.credit);
      rows.push({ entry: e, debit: l.debit, credit: l.credit, balance: bal / 100, memo: l.memo || e.memo, projectId: l.projectId });
    }
  }
  return { opening, rows, closing: bal / 100, debit: r2(rows.reduce((s, r) => s + r.debit, 0)), credit: r2(rows.reduce((s, r) => s + r.credit, 0)) };
}

// ---------- trial balance ----------

export type TbRow = { code: string; name: string; opening: number; debit: number; credit: number; closing: number };
/** Opening (before `from`), movement in the range, closing — signed debit-positive. Excludes year-end closing entries by default. */
export function trialBalance(entries: JournalEntry[], accounts: Account[], range: Range, includeClosing = false) {
  const skip = includeClosing ? undefined : (e: JournalEntry) => e.source === "closing";
  const before = range.from ? netByAccount(entries, { to: dayBefore(range.from) }, skip) : new Map();
  const during = netByAccount(entries, range, skip);
  const codes = new Set([...before.keys(), ...during.keys()]);
  const name = (c: string) => accounts.find((a) => a.code === c)?.name ?? c;
  const rows: TbRow[] = [...codes]
    .sort()
    .map((code) => {
      const o = before.get(code)?.net ?? 0,
        d = during.get(code) ?? { debit: 0, credit: 0, net: 0 };
      return { code, name: name(code), opening: o, debit: d.debit, credit: d.credit, closing: r2(o + d.net) };
    })
    .filter((r) => satang(r.opening) || satang(r.debit) || satang(r.credit));
  const tot = (f: (r: TbRow) => number) => rows.reduce((s, r) => s + satang(f(r)), 0) / 100;
  const totals = {
    debit: tot((r) => r.debit),
    credit: tot((r) => r.credit),
    drBalance: tot((r) => Math.max(0, r.closing)),
    crBalance: tot((r) => Math.max(0, -r.closing)),
  };
  return { rows, totals, balanced: satang(totals.debit) === satang(totals.credit) && satang(totals.drBalance) === satang(totals.crBalance) };
}

// ---------- profit and loss ----------

/** Sign so revenue and expenses both read positive. */
const plValue = (code: string, net: number) => (typeOfCode(code) === "income" ? -net : net);

export type PlLine = { code: string; name: string; values: number[]; total: number };
export type PlReport = { columns: string[]; income: PlLine[]; cost: PlLine[]; sga: PlLine[]; totals: { income: number[]; cost: number[]; gross: number[]; sga: number[]; net: number[] } };

function plFrom(columns: string[], cell: (col: string) => Map<string, { net: number }>, accounts: Account[]): PlReport {
  const maps = columns.map(cell);
  const codes = new Set<string>();
  for (const m of maps) for (const k of m.keys()) if (/^[45]/.test(k)) codes.add(k);
  const name = (c: string) => accounts.find((a) => a.code === c)?.name ?? c;
  const line = (code: string): PlLine => {
    const values = maps.map((m) => r2(plValue(code, m.get(code)?.net ?? 0)));
    return { code, name: name(code), values, total: r2(values.reduce((s, v) => s + v, 0)) };
  };
  const sorted = [...codes].sort();
  const income = sorted.filter((c) => c.startsWith("4")).map(line);
  const cost = sorted.filter((c) => c.startsWith("51")).map(line);
  const sga = sorted.filter((c) => c.startsWith("5") && !c.startsWith("51")).map(line);
  const col = (ls: PlLine[]) => columns.map((_, i) => r2(ls.reduce((s, l) => s + l.values[i], 0)));
  const ti = col(income),
    tc = col(cost),
    ts = col(sga);
  const gross = columns.map((_, i) => r2(ti[i] - tc[i]));
  return { columns, income, cost, sga, totals: { income: ti, cost: tc, gross, sga: ts, net: columns.map((_, i) => r2(gross[i] - ts[i])) } };
}

const notClosing = (e: JournalEntry) => e.source === "closing";

export function plByMonth(entries: JournalEntry[], accounts: Account[], periods: string[]) {
  return plFrom(periods, (p) => netByAccount(entries.filter((e) => e.period === p), {}, notClosing), accounts);
}

/** Revenue vs cost per project (lines tagged with a projectId) = project profitability. */
export function plByProject(entries: JournalEntry[], range: Range) {
  const m = new Map<string, { revenue: number; cost: number; other: number }>();
  for (const e of entries) {
    if (!inRange(e.date, range) || e.source === "closing") continue;
    for (const l of e.lines) {
      if (!l.projectId || !/^[45]/.test(l.account)) continue;
      const x = m.get(l.projectId) ?? { revenue: 0, cost: 0, other: 0 };
      const v = satang(l.debit) - satang(l.credit);
      if (l.account.startsWith("4")) x.revenue -= v;
      else if (l.account.startsWith("51")) x.cost += v;
      else x.other += v;
      m.set(l.projectId, x);
    }
  }
  return [...m.entries()]
    .map(([projectId, x]) => {
      const revenue = x.revenue / 100,
        cost = (x.cost + x.other) / 100;
      return { projectId, revenue, cost, profit: r2(revenue - cost), margin: revenue ? r2(((revenue - cost) / revenue) * 100) : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------- balance sheet ----------

export type BsLine = { code: string; name: string; amount: number };
export function balanceSheet(entries: JournalEntry[], accounts: Account[], asOf: string) {
  const all = netByAccount(entries, { to: asOf });
  const year = asOf.slice(0, 4);
  const name = (c: string) => accounts.find((a) => a.code === c)?.name ?? c;
  const assets: BsLine[] = [],
    liabilities: BsLine[] = [],
    equity: BsLine[] = [];
  let currentProfit = 0,
    priorUnclosed = 0;
  for (const [code, v] of [...all.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const t = typeOfCode(code);
    if (t === "asset") assets.push({ code, name: name(code), amount: v.net });
    else if (t === "liability") liabilities.push({ code, name: name(code), amount: -v.net });
    else if (t === "equity") equity.push({ code, name: name(code), amount: -v.net });
  }
  // income and expenses not yet closed into 3200: this year's profit, plus earlier years left open
  const thisYear = netByAccount(entries, { from: `${year}-01-01`, to: asOf });
  for (const [code, v] of all) if (/^[45]/.test(code)) priorUnclosed -= v.net;
  for (const [code, v] of thisYear) if (/^[45]/.test(code)) currentProfit -= v.net;
  priorUnclosed = r2(priorUnclosed - currentProfit);
  currentProfit = r2(currentProfit);
  const tot = (ls: BsLine[]) => ls.reduce((s, l) => s + satang(l.amount), 0) / 100;
  const totalAssets = tot(assets),
    totalLiabilities = tot(liabilities),
    totalEquity = r2(tot(equity) + currentProfit + priorUnclosed);
  return {
    assets: assets.filter((l) => satang(l.amount)),
    liabilities: liabilities.filter((l) => satang(l.amount)),
    equity: equity.filter((l) => satang(l.amount)),
    currentProfit,
    priorUnclosed,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: satang(totalAssets) === satang(totalLiabilities + totalEquity),
  };
}

// ---------- aging ----------

export const AGING_BUCKETS = ["ยังไม่ถึงกำหนด", "0–30 วัน", "31–60 วัน", "61–90 วัน", "เกิน 90 วัน"] as const;
/** Bucket index by days past the due date. */
export function agingBucket(dueDate: string, asOf: string) {
  const d = daysBetween(dueDate, asOf);
  return d < 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4;
}
export function aging<T>(items: T[], due: (x: T) => string, amount: (x: T) => number, asOf: string) {
  const totals = AGING_BUCKETS.map(() => 0);
  const rows = items.map((x) => {
    const b = agingBucket(due(x), asOf);
    totals[b] = r2(totals[b] + amount(x));
    return { item: x, bucket: b, days: daysBetween(due(x), asOf) };
  });
  return { rows, totals, total: r2(totals.reduce((s, v) => s + v, 0)) };
}

// ---------- account balance helpers ----------

export const balanceOf = (entries: JournalEntry[], code: string, asOf?: string) => netByAccount(entries, { to: asOf }).get(code)?.net ?? 0;
/** Balance shown with the account's normal sign (credit accounts positive when in credit). */
export const normalBalance = (entries: JournalEntry[], code: string, asOf?: string) => {
  const n = balanceOf(entries, code, asOf);
  return debitNormal(typeOfCode(code)) ? n : -n;
};

// ---------- CSV ----------

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV with a UTF-8 BOM so Excel opens Thai text correctly. */
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
