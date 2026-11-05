// Token prices per provider/model, and cost of one call. Pure (used by the server and the browser).
// USD per 1M tokens, standard (non-batch) tier. Check the providers' pricing pages before quoting customers:
//   Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
//   Google:    https://aistudio.google.com/docs/pricing
// Override any row with env AI_PRICES='{"claude-opus-5-5":{"input":4,"output":20}}' (server) if prices change.

export type Provider = "gemini" | "claude";

export type Price = {
  input: number; // uncached input
  output: number; // output incl. thinking
  cacheRead: number; // cached input read
  cacheWrite: number; // cache write (Claude 5-minute TTL = 1.25× input; Gemini implicit caching has no write fee)
  /** price takes effect from this date (YYYY-MM-DD); later rows of the same model win */
  from?: string;
};

type Row = { match: RegExp; label: string; provider: Provider } & Price;

// Order: most specific first; for the same model, rows with a later `from` override earlier ones.
const ROWS: Row[] = [
  // Claude (Anthropic first-party API)
  { match: /^claude-opus-5-5/, label: "Claude Opus 5.5", provider: "claude", input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  { match: /^claude-opus-5(?!-5)/, label: "Claude Opus 5", provider: "claude", input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  { match: /^claude-sonnet-5-5/, label: "Claude Sonnet 5.5", provider: "claude", input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  { match: /^claude-haiku-5-5/, label: "Claude Haiku 5.5", provider: "claude", input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  // Gemini (Google AI Studio / Gemini API, paid tier)
  { match: /^gemini-4-argon/, label: "Gemini 4 Argon", provider: "gemini", input: 2, output: 10, cacheRead: 0.1, cacheWrite: 0 },
  { match: /^gemini-4-argon/, label: "Gemini 4 Argon", provider: "gemini", input: 4, output: 20, cacheRead: 0.2, cacheWrite: 0, from: "2026-12-01" },
  // ≤200k-token prompts (longer prompts cost more: $4 / $18)
  { match: /^gemini-3\.1-pro/, label: "Gemini 3.1 Pro", provider: "gemini", input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
  { match: /^gemini-3\.8-flash/, label: "Gemini 3.8 Flash", provider: "gemini", input: 0.75, output: 3.75, cacheRead: 0.075, cacheWrite: 0 },
  { match: /^gemini-3\.8-flash/, label: "Gemini 3.8 Flash", provider: "gemini", input: 1.5, output: 7.5, cacheRead: 0.15, cacheWrite: 0, from: "2027-01-01" },
  { match: /^gemini-3\.6-flash/, label: "Gemini 3.6 Flash", provider: "gemini", input: 0.75, output: 3.75, cacheRead: 0.075, cacheWrite: 0 },
  { match: /^gemini-3\.6-flash/, label: "Gemini 3.6 Flash", provider: "gemini", input: 1.5, output: 7.5, cacheRead: 0.15, cacheWrite: 0, from: "2027-01-01" },
  { match: /^gemini-3\.5-flash-lite/, label: "Gemini 3.5 Flash-Lite", provider: "gemini", input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 },
  { match: /^gemini-3-flash/, label: "Gemini 3 Flash", provider: "gemini", input: 0.5, output: 3, cacheRead: 0.05, cacheWrite: 0 },
  { match: /^gemini-2\.5-flash-lite/, label: "Gemini 2.5 Flash-Lite", provider: "gemini", input: 0.1, output: 0.4, cacheRead: 0.01, cacheWrite: 0 },
  { match: /^gemini-2\.5-flash/, label: "Gemini 2.5 Flash", provider: "gemini", input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 },
  // alias: Google moves "gemini-flash-latest" to the newest Flash; the response's modelVersion is priced when known
  { match: /^gemini-flash-latest/, label: "Gemini Flash (latest)", provider: "gemini", input: 0.75, output: 3.75, cacheRead: 0.075, cacheWrite: 0 },
  { match: /^gemini-flash-latest/, label: "Gemini Flash (latest)", provider: "gemini", input: 1.5, output: 7.5, cacheRead: 0.15, cacheWrite: 0, from: "2027-01-01" },
];

export type PriceInfo = Price & { label: string; known: boolean };

/** Price row for a model on a date. Unknown models return zeros with known=false. */
export function priceOf(model: string, date: string, overrides?: Record<string, Partial<Price>>): PriceInfo {
  const m = model.replace(/^models\//, "");
  const rows = ROWS.filter((r) => r.match.test(m) && (!r.from || r.from <= date));
  const row = rows.sort((a, b) => (a.from ?? "").localeCompare(b.from ?? "")).pop();
  const o = overrides?.[m];
  if (!row && !o) return { label: m, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, known: false };
  const base = row ?? { label: m, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  return { label: base.label, input: base.input, output: base.output, cacheRead: base.cacheRead, cacheWrite: base.cacheWrite, ...o, known: true };
}

export type TokenUsage = {
  input: number; // uncached input tokens
  output: number; // all output tokens billed (incl. thinking)
  thinking?: number; // part of output that was reasoning
  cacheRead?: number;
  cacheWrite?: number;
};

export function costUsd(u: TokenUsage, p: Price): number {
  const usd = (u.input * p.input + u.output * p.output + (u.cacheRead ?? 0) * p.cacheRead + (u.cacheWrite ?? 0) * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export const DEFAULT_USD_THB = 33;
