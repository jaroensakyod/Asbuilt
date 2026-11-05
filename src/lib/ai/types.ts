// Provider-neutral AI request/response shapes, shared by the browser and the /api/ai route.
// The provider (Gemini today) lives only on the server; the API key never reaches the browser.

/** JSON Schema subset understood by the providers (object/array/string/number/integer/boolean/enum). */
export type JsonSchema = {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
  format?: string;
  nullable?: boolean;
};

export type AiFile = { mimeType: string; data: string /* base64, no data: prefix */ };

export type AiPart =
  | { text: string }
  | { file: AiFile }
  | { call: { id?: string; name: string; args: Record<string, unknown> } }
  | { result: { id?: string; name: string; response: unknown } };

export type AiMessage = {
  role: "user" | "model";
  parts: AiPart[];
  /** provider-native content of a model turn, echoed back verbatim (keeps thought signatures for tool calls) */
  raw?: unknown;
};

export type AiTool = { name: string; description: string; parameters: JsonSchema };
export type AiProvider = "gemini" | "claude";

export type AiRequest = {
  /** short name of the feature, for logs/limits: "chat", "ocr-bill", "diary-draft" … */
  task: string;
  system?: string;
  messages: AiMessage[];
  tools?: AiTool[];
  /** ask for JSON matching this schema (no tools in the same call) */
  json?: JsonSchema;
  /** Gemini only (Claude Opus 5.5 rejects sampling parameters) */
  temperature?: number;
  maxOutputTokens?: number;
  /** run on this provider instead of the server default (AI_PROVIDER) — used by the comparison page */
  provider?: AiProvider;
  /** calls that belong to one user action (a chat question with tool rounds) share a group id, for cost per action */
  group?: string;
};

/** Tokens and cost of one call, as billed by the provider. */
export type AiUsage = {
  provider: AiProvider;
  model: string; // model that actually answered
  input: number; // uncached input tokens
  output: number; // output tokens incl. thinking
  thinking?: number;
  cacheRead?: number;
  cacheWrite?: number;
  costUsd: number;
  costThb: number;
  ms: number; // wall time of the provider call
  priced: boolean; // false when the model is missing from the price table
  note?: string;
};

export type AiResponse = {
  text?: string;
  calls?: { id?: string; name: string; args: Record<string, unknown> }[];
  json?: unknown;
  /** model turn to append to history as { role: "model", parts, raw } */
  message: AiMessage;
  usage?: AiUsage;
  model: string;
};

export type AiProviderStatus = { configured: boolean; model: string; effort?: string };

export type AiStatus = {
  configured: boolean;
  provider: AiProvider;
  model: string;
  providers?: Record<AiProvider, AiProviderStatus>;
  usdThb?: number;
};
