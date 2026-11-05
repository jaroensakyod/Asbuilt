import "server-only";

// Server side of the AI layer: picks the provider and returns tokens + cost with every answer.
//   AI_PROVIDER   gemini (default) | claude — the provider every feature uses
//   AI_USD_THB    exchange rate for the baht cost shown with each call (default 33)
//   AI_PRICES     optional JSON price overrides per model (see lib/ai/pricing.ts)
// Provider settings: providers/gemini.ts (GEMINI_*) and providers/claude.ts (ANTHROPIC_API_KEY, CLAUDE_*).
// A request may name `provider` to run on a specific one (the comparison page does this).

import type { AiProvider, AiRequest, AiResponse, AiStatus } from "./types";
import { AiError, usdThb } from "./providers/common";
import { claudeStatus, generateClaude } from "./providers/claude";
import { geminiStatus, generateGemini } from "./providers/gemini";

export { AiError };

const DEFAULT = (): AiProvider => (process.env.AI_PROVIDER === "claude" ? "claude" : "gemini");

export function aiStatus(): AiStatus {
  const providers = { gemini: geminiStatus(), claude: claudeStatus() };
  const p = DEFAULT();
  return { configured: providers[p].configured, provider: p, model: providers[p].model, providers, usdThb: usdThb() };
}

export async function generate(req: AiRequest): Promise<AiResponse> {
  const p = req.provider === "claude" || req.provider === "gemini" ? req.provider : DEFAULT();
  return p === "claude" ? generateClaude(req) : generateGemini(req);
}
