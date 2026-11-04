// Stock replay: on-hand quantity and moving-average value per item × location.
// Pure functions shared by the seed generator and the inventory UI.

import type { StockMove } from "./types";

export type Balance = { qty: number; value: number };
export const balKey = (loc: string, itemId: string) => `${loc}|${itemId}`;
export const avgOf = (b?: Balance) => (b && b.qty > 0 ? b.value / b.qty : 0);

const r2 = (n: number) => Math.round(n * 100) / 100;

export const sortMoves = (moves: StockMove[]) => [...moves].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

/**
 * Replays moves in date order. Outgoing moves (issue, transfer, negative adjust)
 * leave at the moving average of their source location at that moment; when
 * `fill` is set, their unitCost is (re)written with that average.
 */
export function replay(moves: StockMove[], fill = false) {
  const bal = new Map<string, Balance>();
  const get = (loc: string, item: string) => {
    const k = balKey(loc, item);
    let b = bal.get(k);
    if (!b) bal.set(k, (b = { qty: 0, value: 0 }));
    return b;
  };
  const take = (loc: string, item: string, qty: number) => {
    const b = get(loc, item);
    const avg = avgOf(b);
    const q = Math.min(qty, Math.max(0, b.qty));
    b.qty -= qty;
    b.value = b.qty <= 0 ? 0 : b.value - q * avg;
    return avg;
  };
  const put = (loc: string, item: string, qty: number, unit: number) => {
    const b = get(loc, item);
    if (b.qty < 0) b.value = 0;
    b.qty += qty;
    b.value += qty * unit;
    if (b.qty <= 0) b.value = 0;
  };
  const out: StockMove[] = [];
  for (const m0 of sortMoves(moves)) {
    const m = fill ? { ...m0 } : m0;
    if (m.kind === "receive" && m.to) put(m.to, m.itemId, m.qty, m.unitCost);
    else if (m.kind === "issue" && m.from) {
      const avg = take(m.from, m.itemId, m.qty);
      if (fill) m.unitCost = r2(avg);
    } else if (m.kind === "transfer" && m.from && m.to) {
      const avg = take(m.from, m.itemId, m.qty);
      if (fill) m.unitCost = r2(avg);
      put(m.to, m.itemId, m.qty, fill ? m.unitCost : avg);
    } else if (m.kind === "adjust") {
      const loc = m.to ?? m.from;
      if (loc) {
        if (m.qty >= 0) {
          const unit = m.unitCost || avgOf(get(loc, m.itemId));
          if (fill) m.unitCost = r2(unit);
          put(loc, m.itemId, m.qty, unit);
        } else {
          const avg = take(loc, m.itemId, -m.qty);
          if (fill) m.unitCost = r2(avg);
        }
      }
    }
    out.push(m);
  }
  return { bal, moves: out };
}
