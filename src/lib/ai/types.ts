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

export type AiRequest = {
  /** short name of the feature, for logs/limits: "chat", "ocr-bill", "diary-draft" … */
  task: string;
  system?: string;
  messages: AiMessage[];
  tools?: AiTool[];
  /** ask for JSON matching this schema (no tools in the same call) */
  json?: JsonSchema;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiResponse = {
  text?: string;
  calls?: { id?: string; name: string; args: Record<string, unknown> }[];
  json?: unknown;
  /** model turn to append to history as { role: "model", parts, raw } */
  message: AiMessage;
  usage?: { input?: number; output?: number };
  model: string;
};

export type AiStatus = { configured: boolean; provider: string; model: string };
