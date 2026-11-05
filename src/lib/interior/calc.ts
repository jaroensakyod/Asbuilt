// Pure interior / selections calculations (no React, no "@/" imports) — unit tested in tests/interior.

import type { Variation } from "../biz";
import { FFE_STATUSES, SEL_CATEGORY_LABEL, SEL_COST_CODE, type FeeMilestone, type FfeItem, type FfeStatus, type InteriorSettings, type Sample, type Selection, type SelectionOption } from "./types";

const DAY = 86400000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso.slice(0, 10)) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
const r2 = (n: number) => Math.round(n * 100) / 100;

export const DEFAULT_INTERIOR_SETTINGS: InteriorSettings = { id: "interior", defaultMarkup: 30, sampleReturnDays: 14, vatRate: 7, allowanceCostRatio: 0.8 };

// ---------- pricing ----------

/** Client price from trade cost and markup %, rounded to whole baht */
export const priceFromMarkup = (tradeCost: number, markupPct: number) => Math.round(tradeCost * (1 + markupPct / 100));
/** Markup % implied by a client price (1 decimal) */
export const markupFromPrice = (tradeCost: number, clientPrice: number) => (tradeCost > 0 ? Math.round(((clientPrice - tradeCost) / tradeCost) * 1000) / 10 : 0);
/** Gross margin % on the sell price (1 decimal) */
export const marginPct = (cost: number, sell: number) => (sell > 0 ? Math.round(((sell - cost) / sell) * 1000) / 10 : 0);

// ---------- selections ----------

export const allowanceTotal = (s: Pick<Selection, "qty" | "allowanceUnit">) => r2(s.qty * s.allowanceUnit);
export const optionTotal = (s: Pick<Selection, "qty">, o: Pick<SelectionOption, "price">) => r2(s.qty * o.price);
export const chosenOption = (s: Pick<Selection, "options" | "chosenId">) => s.options.find((o) => o.id === s.chosenId);

/** Sell-price difference of the chosen option against the allowance (+ = client pays more) */
export function selectionDiff(s: Pick<Selection, "qty" | "allowanceUnit" | "options" | "chosenId">) {
  const o = chosenOption(s);
  return o ? r2(optionTotal(s, o) - allowanceTotal(s)) : 0;
}

/** Cost difference of the chosen option against the cost assumed for the allowance */
export function selectionCostDiff(s: Pick<Selection, "qty" | "allowanceUnit" | "allowanceCostUnit" | "options" | "chosenId">, costRatio = 0.8) {
  const o = chosenOption(s);
  if (!o) return 0;
  const base = s.allowanceCostUnit ?? s.allowanceUnit * costRatio;
  return r2(s.qty * ((o.cost ?? o.price * costRatio) - base));
}

/** Still waiting for the client after the deadline (blocks the schedule) */
export const isSelectionLate = (s: Pick<Selection, "status" | "deadline">, today: string) => s.status === "pending" && s.deadline < today;
export const daysToDeadline = (s: Pick<Selection, "deadline">, today: string) => daysBetween(today, s.deadline);

/** Variation (change order) raised when an approved selection differs from its allowance; undefined when there is no difference. */
export function selectionVariation(s: Selection, opts: { no: number; by: string; today: string; costRatio?: number }): Variation | undefined {
  const o = chosenOption(s);
  const amount = selectionDiff(s);
  if (!o || amount === 0) return undefined;
  const ratio = opts.costRatio ?? 0.8;
  const unitSell = r2(o.price - s.allowanceUnit);
  const unitCost = r2((o.cost ?? o.price * ratio) - (s.allowanceCostUnit ?? s.allowanceUnit * ratio));
  return {
    id: `VO-${s.projectId}-${opts.no}`,
    projectId: s.projectId,
    no: opts.no,
    title: `ส่วนต่างวัสดุที่ลูกค้าเลือก · ${s.item}`,
    reason: `ลูกค้าเลือก ${o.name}${o.brand ? ` (${o.brand})` : ""} แทนงบมาตรฐาน ${s.allowanceUnit.toLocaleString("th-TH")} บาท/${s.unit} · ${s.room} · หมวด${SEL_CATEGORY_LABEL[s.category]}`,
    origin: "selection",
    selectionId: s.id,
    lines: [{ description: `${s.item} — ${o.name} (ส่วนต่างจากงบ)`, qty: s.qty, unit: s.unit, unitPrice: unitSell, unitCost, costCode: SEL_COST_CODE[s.category] }],
    amount,
    cost: r2(s.qty * unitCost),
    days: 0,
    status: "submitted",
    raisedBy: opts.by,
    raisedAt: opts.today,
  };
}

/** Next variation number of a project */
export const nextVariationNo = (list: Pick<Variation, "projectId" | "no">[], projectId: string) => list.filter((v) => v.projectId === projectId).reduce((m, v) => Math.max(m, v.no), 0) + 1;

export function selectionSummary(list: Selection[], today: string) {
  const late = list.filter((s) => isSelectionLate(s, today)).length;
  const pending = list.filter((s) => s.status === "pending").length;
  const chosen = list.filter((s) => s.status === "chosen").length;
  const approved = list.filter((s) => s.status === "approved").length;
  const allowance = r2(list.reduce((t, s) => t + allowanceTotal(s), 0));
  const diff = r2(list.reduce((t, s) => t + selectionDiff(s), 0));
  return { total: list.length, late, pending, chosen, approved, allowance, diff };
}

// ---------- FF&E ----------

export const ffeRank = (s: FfeStatus) => FFE_STATUSES.indexOf(s);
/** Expected delivery: order date + supplier lead time */
export const expectedDelivery = (orderedAt: string, leadDays: number) => addDays(orderedAt, leadDays);
/** Ordered but not yet received after the expected date */
export const isFfeLate = (f: Pick<FfeItem, "status" | "expectedAt">, today: string) => !!f.expectedAt && ffeRank(f.status) >= 1 && ffeRank(f.status) < ffeRank("received") && f.expectedAt < today;
export const ffeCost = (f: Pick<FfeItem, "qty" | "unitCost">) => r2(f.qty * f.unitCost);
export const ffeSell = (f: Pick<FfeItem, "qty" | "unitSell">) => r2(f.qty * f.unitSell);

export type RoomBudget = { room: string; allowance: number; specified: number; committed: number; actual: number; cost: number; variance: number };

/**
 * Room budget (sell prices): allowance agreed with the client, items specified, committed
 * (ordered or later) and actual (received or installed). Variance = allowance − (committed or specified).
 */
export function roomBudgets(rooms: { name: string; budget: number }[], items: FfeItem[]): RoomBudget[] {
  const names = [...rooms.map((r) => r.name), ...items.map((i) => i.room).filter((n) => !rooms.some((r) => r.name === n))];
  return [...new Set(names)].map((room) => {
    const list = items.filter((i) => i.room === room);
    const allowance = rooms.find((r) => r.name === room)?.budget ?? 0;
    const specified = r2(list.reduce((t, i) => t + ffeSell(i), 0));
    const committed = r2(list.filter((i) => ffeRank(i.status) >= 1).reduce((t, i) => t + ffeSell(i), 0));
    const actual = r2(list.filter((i) => ffeRank(i.status) >= ffeRank("received")).reduce((t, i) => t + ffeSell(i), 0));
    const cost = r2(list.reduce((t, i) => t + ffeCost(i), 0));
    return { room, allowance, specified, committed, actual, cost, variance: r2(allowance - Math.max(committed, specified)) };
  });
}

// ---------- samples ----------

/** Return-by date of a sample (explicit, or received/shown + N days) */
export const sampleReturnBy = (s: Pick<Sample, "returnBy" | "receivedAt" | "shownAt">, days: number) => s.returnBy ?? (s.shownAt ?? s.receivedAt ? addDays((s.shownAt ?? s.receivedAt)!, days) : undefined);
export function isSampleOverdue(s: Sample, today: string, days: number) {
  if (s.status !== "received" && s.status !== "shown") return false;
  const by = sampleReturnBy(s, days);
  return !!by && by < today;
}

// ---------- design fee / deposit schedule ----------

/** Default interior fee schedule: deposit 30 % / design approval 40 % / installation complete 30 % */
export function defaultFeeSchedule(fee: number, start: string, due: string): FeeMilestone[] {
  const parts: [string, number, string][] = [
    ["มัดจำเริ่มงานออกแบบ", 30, start],
    ["อนุมัติแบบและรายการเฟอร์นิเจอร์", 40, addDays(start, Math.max(14, Math.round(daysBetween(start, due) / 3)))],
    ["ติดตั้งแล้วเสร็จและตรวจรับ", 30, due],
  ];
  let used = 0;
  return parts.map(([title, pct, d], i) => {
    const amount = i === parts.length - 1 ? r2(fee - used) : r2((fee * pct) / 100);
    used = r2(used + amount);
    return { id: `F${i + 1}`, title, pct, amount, due: d, status: "scheduled" };
  });
}
