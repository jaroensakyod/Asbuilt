// Contract settings and per-project contract terms. Kept free of accounting imports so the
// accounting store can read the terms (measured billing, advance, retention release) without a cycle.

import { createCollection } from "@/lib/collection";
import { seedTerms } from "./seed";
import { DEFAULT_SETTINGS, type ContractSettings, type ContractTerms } from "./types";

export const contractSettings = createCollection<ContractSettings>("contract_settings", [DEFAULT_SETTINGS]);
export const contractTerms = createCollection<ContractTerms>("contract_terms", seedTerms);

export function useContractSettings(): ContractSettings {
  const list = contractSettings.use();
  return { ...DEFAULT_SETTINGS, ...(list.find((s) => s.id === "settings") ?? {}) };
}
export const getContractSettings = (): ContractSettings => ({ ...DEFAULT_SETTINGS, ...(contractSettings.get("settings") ?? {}) });

/** Terms of a project: its record, or the company defaults (billed by sales installments). */
export function defaultTerms(projectId: string, s: ContractSettings = DEFAULT_SETTINGS): ContractTerms {
  return {
    id: `CT-${projectId}`,
    projectId,
    billing: "installments",
    retentionPct: s.retentionPct,
    retentionCapPct: s.retentionCapPct,
    advancePct: 0,
    whtRate: 0,
    defectsMonths: s.defectsMonths,
    certPayDays: s.certPayDays,
  };
}
export const termsFor = (list: ContractTerms[], projectId: string, s?: ContractSettings) => list.find((t) => t.projectId === projectId) ?? defaultTerms(projectId, s);
