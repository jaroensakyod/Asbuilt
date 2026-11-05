// JSON Schema conversion between providers. Pure (testable without the SDKs).
import type { JsonSchema } from "./types";

/**
 * Gemini-style schema subset → Claude structured outputs / tool input_schema:
 * every object gets additionalProperties:false (required by structured outputs) and a properties map;
 * `nullable: true` becomes a type union with "null".
 */
export function toClaudeSchema(s: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "nullable") continue;
    if (k === "properties" && v && typeof v === "object") out.properties = Object.fromEntries(Object.entries(v as Record<string, JsonSchema>).map(([pk, pv]) => [pk, toClaudeSchema(pv)]));
    else if (k === "items" && v && typeof v === "object") out.items = toClaudeSchema(v as JsonSchema);
    else out[k] = v;
  }
  if (s.type === "object") {
    out.additionalProperties = false;
    if (!out.properties) out.properties = {};
  }
  if (s.nullable && s.type) out.type = [s.type, "null"];
  return out;
}
