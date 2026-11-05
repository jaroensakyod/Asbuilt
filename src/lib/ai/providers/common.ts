import "server-only";

import { costUsd, DEFAULT_USD_THB, priceOf, type Price, type TokenUsage } from "../pricing";
import type { AiProvider, AiUsage } from "../types";

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export const usdThb = () => Number(process.env.AI_USD_THB) || DEFAULT_USD_THB;

let overrides: Record<string, Partial<Price>> | undefined;
const priceOverrides = () => {
  if (overrides) return overrides;
  try {
    overrides = process.env.AI_PRICES ? (JSON.parse(process.env.AI_PRICES) as Record<string, Partial<Price>>) : {};
  } catch {
    overrides = {};
  }
  return overrides;
};

export function usageFor(provider: AiProvider, model: string, u: TokenUsage, ms: number, note?: string): AiUsage {
  const today = new Date().toISOString().slice(0, 10);
  const p = priceOf(model, today, priceOverrides());
  const usd = costUsd(u, p);
  return {
    provider,
    model,
    input: u.input,
    output: u.output,
    thinking: u.thinking,
    cacheRead: u.cacheRead,
    cacheWrite: u.cacheWrite,
    costUsd: usd,
    costThb: Math.round(usd * usdThb() * 10000) / 10000,
    ms,
    priced: p.known,
    note,
  };
}
