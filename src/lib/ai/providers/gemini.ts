import "server-only";

// Google Gemini (@google/genai).
//   GEMINI_API_KEY   required — https://aistudio.google.com/apikey
//   GEMINI_MODEL     optional — default "gemini-flash-latest" (Google moves the alias to the newest Flash)

import { GoogleGenAI, FunctionCallingConfigMode, type Content, type Part } from "@google/genai";
import type { AiMessage, AiProviderStatus, AiRequest, AiResponse } from "../types";
import { AiError, usageFor } from "./common";

const KEY = () => process.env.GEMINI_API_KEY ?? "";
const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

export const geminiStatus = (): AiProviderStatus => ({ configured: Boolean(KEY()), model: MODEL() });

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: KEY() }));

/** Raw Gemini content of a model turn: tagged { provider: "gemini", content } or (older chats) the Content itself. */
function rawGemini(raw: unknown): Content | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { provider?: string; content?: Content; parts?: unknown };
  if (r.provider === "gemini" && r.content) return r.content;
  if (!r.provider && Array.isArray(r.parts)) return raw as Content;
  return null; // another provider's turn: rebuild from the neutral parts
}

function toContent(m: AiMessage): Content {
  const raw = m.role === "model" ? rawGemini(m.raw) : null;
  if (raw) return raw;
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

export async function generateGemini(req: AiRequest): Promise<AiResponse> {
  if (!KEY()) throw new AiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY", 503);
  const t0 = Date.now();
  const res = await ai().models.generateContent({
    model: MODEL(),
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
  const ms = Date.now() - t0;

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
  // Gemini bills thinking ("thoughts") as output; promptTokenCount includes the cached part
  const um = res.usageMetadata;
  const cached = um?.cachedContentTokenCount ?? 0;
  const thinking = um?.thoughtsTokenCount ?? 0;
  const model = res.modelVersion || MODEL();
  const usage = usageFor("gemini", model, { input: Math.max(0, (um?.promptTokenCount ?? 0) - cached), output: (um?.candidatesTokenCount ?? 0) + thinking, thinking, cacheRead: cached }, ms);
  return {
    text: text || undefined,
    calls: calls.length ? calls : undefined,
    json,
    message: {
      role: "model",
      parts: [...(text ? [{ text }] : []), ...calls.map((c) => ({ call: c }))],
      raw: { provider: "gemini", content },
    },
    usage,
    model,
  };
}
