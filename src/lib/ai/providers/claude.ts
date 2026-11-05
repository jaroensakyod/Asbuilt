import "server-only";

// Anthropic Claude (@anthropic-ai/sdk).
//   ANTHROPIC_API_KEY  required — https://platform.claude.com/settings/keys
//   CLAUDE_MODEL       optional — default "claude-opus-5-5"
//   CLAUDE_EFFORT      optional — low | medium | high | xhigh | max (default "medium")
//   ANTHROPIC_WORKSPACE_ID  needed only when the API key is not scoped to a workspace
//
// Notes for Claude Opus 5.5: thinking is always on (effort is the only control); sampling
// parameters (temperature) and forced tool_choice are rejected, so neither is sent. JSON output
// uses structured outputs (output_config.format). The system prompt is cached (prompt caching).
// Refusals fall back server-side to the model's default fallback chain.

import Anthropic from "@anthropic-ai/sdk";
import type { AiMessage, AiProviderStatus, AiRequest, AiResponse } from "../types";
import { toClaudeSchema } from "../schema";
import { AiError, usageFor } from "./common";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

const MODEL = () => process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = (): Effort => {
  const e = (process.env.CLAUDE_EFFORT || "medium").toLowerCase() as Effort;
  return EFFORTS.includes(e) ? e : "medium";
};
const configured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export const claudeStatus = (): AiProviderStatus => ({ configured: configured(), model: MODEL(), effort: EFFORT() });

let client: Anthropic | null = null;
// reads ANTHROPIC_API_KEY from the environment. Keys that aren't scoped to a workspace must name one:
// ANTHROPIC_WORKSPACE_ID (Console → Settings → Workspaces) is sent as the anthropic-workspace-id header.
const anthropic = () =>
  (client ??= new Anthropic(process.env.ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } } : {}));

// ---------- messages ----------

type Block = Anthropic.Beta.BetaContentBlockParam;

/** Raw Claude content of an assistant turn (thinking + tool_use blocks are replayed unchanged). */
function rawClaude(raw: unknown): Block[] | null {
  const r = raw as { provider?: string; content?: Block[] } | undefined;
  return r?.provider === "claude" && Array.isArray(r.content) ? r.content : null;
}

function fileBlock(mimeType: string, data: string): Block {
  if (mimeType === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  if (/^image\/(jpeg|png|gif|webp)$/.test(mimeType)) return { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } };
  if (mimeType.startsWith("text/")) return { type: "text", text: Buffer.from(data, "base64").toString("utf8") };
  return { type: "text", text: `[แนบไฟล์ชนิด ${mimeType} ที่อ่านไม่ได้]` };
}

function toMessages(list: AiMessage[]): Anthropic.Beta.BetaMessageParam[] {
  // tool calls from another provider may have no id: give each a stable one and pair results in order
  let n = 0;
  const pending = new Map<string, string[]>(); // tool name → ids waiting for a result
  return list.map((m) => {
    if (m.role === "model") {
      const raw = rawClaude(m.raw);
      if (raw) {
        for (const b of raw) if (b.type === "tool_use") pending.set(b.name, [...(pending.get(b.name) ?? []), b.id]);
        return { role: "assistant", content: raw };
      }
    }
    const content: Block[] = m.parts.map((p): Block => {
      if ("text" in p) return { type: "text", text: p.text || " " };
      if ("file" in p) return fileBlock(p.file.mimeType, p.file.data);
      if ("call" in p) {
        const id = p.call.id && /^[a-zA-Z0-9_-]+$/.test(p.call.id) ? p.call.id : `toolu_x${++n}`;
        pending.set(p.call.name, [...(pending.get(p.call.name) ?? []), id]);
        return { type: "tool_use", id, name: p.call.name, input: p.call.args };
      }
      const queue = pending.get(p.result.name) ?? [];
      const id = p.result.id && queue.includes(p.result.id) ? p.result.id : (queue[0] ?? `toolu_x${++n}`);
      pending.set(
        p.result.name,
        queue.filter((x) => x !== id),
      );
      return { type: "tool_result", tool_use_id: id, content: JSON.stringify(p.result.response ?? null) };
    });
    return { role: m.role === "model" ? "assistant" : "user", content };
  });
}

// ---------- call ----------

export async function generateClaude(req: AiRequest): Promise<AiResponse> {
  if (!configured()) throw new AiError("ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY", 503);
  const model = MODEL();
  const t0 = Date.now();
  let msg: Anthropic.Beta.BetaMessage;
  try {
    // streaming + finalMessage: thinking can make long turns; avoids HTTP timeouts
    msg = await anthropic()
      .beta.messages.stream({
        model,
        // thinking is billed inside max_tokens, so leave room above the visible answer
        max_tokens: Math.min(Math.max((req.maxOutputTokens ?? 8192) * 2, 16000), 64000),
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: EFFORT(), ...(req.json ? { format: { type: "json_schema", schema: toClaudeSchema(req.json) } } : {}) },
        ...(req.system ? { system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }] } : {}),
        ...(req.tools?.length
          ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: toClaudeSchema(t.parameters) as Anthropic.Beta.BetaTool.InputSchema })) }
          : {}),
        messages: toMessages(req.messages),
      })
      .finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("ANTHROPIC_API_KEY ไม่ถูกต้อง", 401);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Claude ถูกจำกัดอัตราการเรียก ลองใหม่อีกครั้ง", 429);
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`Claude ปฏิเสธคำขอ: ${e.message.slice(0, 200)}`, 400);
    if (e instanceof Anthropic.APIError) throw new AiError(`Claude ขัดข้อง (${e.status}): ${e.message.slice(0, 200)}`, 502);
    throw e;
  }
  const ms = Date.now() - t0;

  if (msg.stop_reason === "refusal") throw new AiError(`Claude ไม่ตอบคำขอนี้${msg.stop_details?.category ? ` (${msg.stop_details.category})` : ""}`, 422);

  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
  let json: unknown;
  if (req.json) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError(msg.stop_reason === "max_tokens" ? "คำตอบของ Claude ยาวเกินขีดจำกัด" : "AI ตอบกลับไม่ใช่ JSON ที่ถูกต้อง", 502);
    }
  }

  const u = msg.usage;
  const fellBack = msg.content.some((b) => b.type === "fallback");
  const usage = usageFor(
    "claude",
    msg.model,
    {
      input: u.input_tokens,
      output: u.output_tokens,
      thinking: u.output_tokens_details?.thinking_tokens,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
    },
    ms,
    fellBack ? `โมเดลหลักปฏิเสธ ใช้ ${msg.model} แทน` : undefined,
  );

  return {
    text: text || undefined,
    calls: calls.length ? calls : undefined,
    json,
    message: {
      role: "model",
      parts: [...(text ? [{ text }] : []), ...calls.map((c) => ({ call: c }))],
      raw: { provider: "claude", content: msg.content },
    },
    usage,
    model: msg.model,
  };
}
