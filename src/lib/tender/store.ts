// Tender collections and actions.

import { createCollection } from "@/lib/collection";
import { TODAY } from "@/lib/data";
import { defaultSettings, seedTenders, boqTemplate } from "./seed";
import type { Tender, TenderSettings } from "./types";

export const tenders = createCollection<Tender>("tenders", seedTenders);
const settingsCol = createCollection<TenderSettings>("tender_settings", []);

const DEFAULTS = defaultSettings();
export function useTenderSettings(): TenderSettings {
  const rows = settingsCol.use();
  const s = rows.find((r) => r.id === "tender");
  return s ? { ...DEFAULTS, ...s, indices: { ...DEFAULTS.indices, ...s.indices } } : DEFAULTS;
}
export const saveTenderSettings = (s: TenderSettings) => settingsCol.upsert(s);
export const TENDER_DEFAULTS = DEFAULTS;

export function newTender(input: Pick<Tender, "title" | "client" | "source" | "method" | "province" | "submitDue" | "owner"> & Partial<Tender>): Tender {
  const t: Tender = {
    status: "prospect",
    docs: [],
    lines: [],
    markupPct: input.source === "egp" ? 6 : 15,
    vatPct: 7,
    createdAt: TODAY,
    ...input,
    id: tenders.nextId(`TD-${TODAY.slice(0, 4)}-`),
  };
  tenders.upsert(t);
  return t;
}
export const saveTender = (t: Tender) => tenders.upsert(t);
export { boqTemplate };
