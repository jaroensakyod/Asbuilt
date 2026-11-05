// Dedupe / merge of price observations. One stored row per item + source + kind + province + month,
// so re-running a sync or importing the same file twice updates rows instead of piling them up.
// Pure, unit-tested in tests/prices.

import type { PriceObs } from "../sales/prices-data";

const slug = (s?: string) => (s ? s.trim().replace(/\s+/g, "_") : "");

/** stable id, compatible with the CSV importer: O-<code>-<source>-<YYYY-MM>[-<province>][-L] */
export function obsId(o: Pick<PriceObs, "itemCode" | "source" | "date" | "province" | "kind">) {
  const p = slug(o.province);
  return `O-${o.itemCode}-${o.source}-${o.date.slice(0, 7)}${p ? `-${p}` : ""}${o.kind === "labour" ? "-L" : ""}`;
}

export type MergeResult = { rows: PriceObs[]; added: number; updated: number; unchanged: number };

/**
 * Merge incoming observations into the existing ones. Within `incoming` the last row for a key wins.
 * Returns only the rows that need writing (new or with a different price), each with its stable id.
 */
export function mergeObs(existing: PriceObs[], incoming: PriceObs[]): MergeResult {
  const have = new Map(existing.map((o) => [obsId(o), o]));
  const want = new Map<string, PriceObs>();
  for (const o of incoming) {
    if (!o.itemCode || !(o.price > 0) || !/^\d{4}-\d{2}/.test(o.date)) continue;
    const date = `${o.date.slice(0, 7)}-01`;
    const row: PriceObs = { ...o, date, id: "" };
    row.id = obsId(row);
    if (row.kind !== "labour") delete row.kind;
    want.set(row.id, row);
  }
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const rows: PriceObs[] = [];
  for (const [id, row] of want) {
    const old = have.get(id);
    if (!old) {
      added++;
      rows.push(row);
    } else if (Math.abs(old.price - row.price) > 1e-9 || old.ref !== row.ref) {
      updated++;
      rows.push(row);
    } else unchanged++;
  }
  return { rows, added, updated, unchanged };
}

/** items that already have real (non-sample) observations for a source — their sample series is hidden */
export function itemsWithReal(obs: PriceObs[], source: PriceObs["source"]) {
  return new Set(obs.filter((o) => o.source === source && !o.sample && (o.kind ?? "material") === "material").map((o) => o.itemCode));
}
