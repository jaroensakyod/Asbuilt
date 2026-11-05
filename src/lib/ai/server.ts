import "server-only";

// Server side of the AI layer. Provider: Google Gemini (@google/genai).
//   GEMINI_API_KEY   required — create one at https://aistudio.google.com/apikey (keep it in .env.local, never commit)
//   GEMINI_MODEL     optional — default "gemini-flash-latest"
// To add another provider later, implement `generate` for it and switch on AI_PROVIDER.

import { GoogleGenAI, FunctionCallingConfigMode, type Content, type Part } from "@google/genai";
import type { AiMessage, AiRequest, AiResponse, AiStatus } from "./types";

const KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export const aiStatus = (): AiStatus => ({ configured: Boolean(KEY), provider: "gemini", model: MODEL });

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: KEY }));

function toContent(m: AiMessage): Content {
  if (m.raw && m.role === "model") return m.raw as Content;
  const parts: Part[] = m.parts.map((p) => {
    if ("text" in p) return { text: p.text };
    if ("file" in p) return { inlineData: { mimeType: p.file.mimeType, data: p.file.data } };
    if ("call" in p) return { functionCall: { id: p.call.id, name: p.call.name, args: p.call.args } };
    return { functionResponse: { id: p.result.id, name: p.result.name, response: wrap(p.result.response) } };
  });
  return { role: m.role, parts };
}
// functionResponse.response must be an object
const wrap = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : { result: v });

export class AiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

export async function generate(req: AiRequest): Promise<AiResponse> {
  if (!KEY) throw new AiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน .env.local", 503);
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: req.messages.map(toContent),
    config: {
      systemInstruction: req.system,
      temperature: req.temperature ?? (req.json ? 0.1 : 0.4),
      maxOutputTokens: Math.min(req.maxOutputTokens ?? 8192, 32768),
      ...(req.tools?.length
        ? {
            tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
          }
        : {}),
      ...(req.json ? { responseMimeType: "application/json", responseJsonSchema: req.json } : {}),
    },
  });

  const content: Content = res.candidates?.[0]?.content ?? { role: "model", parts: [] };
  const calls = (res.functionCalls ?? []).map((c) => ({ id: c.id, name: c.name ?? "", args: (c.args ?? {}) as Record<string, unknown> }));
  const text = res.text ?? "";
  let json: unknown;
  if (req.json && text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError("AI ตอบกลับไม่ใช่ JSON ที่ถูกต้อง", 502);
    }
  }
  return {
    text: text || undefined,
    calls: calls.length ? calls : undefined,
    json,
    message: {
      role: "model",
      parts: [...(text ? [{ text }] : []), ...calls.map((c) => ({ call: c }))],
      raw: content,
    },
    usage: { input: res.usageMetadata?.promptTokenCount, output: res.usageMetadata?.candidatesTokenCount },
    model: MODEL,
  };
}
