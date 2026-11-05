// POST /api/ai — one generic endpoint for every AI feature (chat, document reading, drafting).
// GET  /api/ai — whether AI is configured (no secrets returned).
// Tools requested by the model are executed in the browser (see src/lib/ai/client.ts), so the
// server never needs tenant data: it only relays prompts, files and tool results to the provider.

import { connection } from "next/server";
import { AiError, aiStatus, generate } from "@/lib/ai/server";
import { serverSupabase } from "@/lib/supabase/server";
import { LIVE } from "@/lib/supabase/env";
import type { AiRequest } from "@/lib/ai/types";

const MAX_BODY = 12 * 1024 * 1024; // photos/PDFs as base64

export async function GET() {
  await connection();
  return Response.json(aiStatus());
}

export async function POST(request: Request) {
  if (LIVE) {
    const sb = await serverSupabase();
    const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
    if (!data.user) return Response.json({ error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
  }
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_BODY) return Response.json({ error: "ไฟล์ใหญ่เกินไป (สูงสุด ~9 MB)" }, { status: 413 });

  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return Response.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body?.task || !Array.isArray(body.messages) || body.messages.length === 0) return Response.json({ error: "ต้องมี task และ messages" }, { status: 400 });
  if (body.messages.length > 60) body.messages = body.messages.slice(-60);

  try {
    return Response.json(await generate(body));
  } catch (e) {
    const status = e instanceof AiError ? e.status : 502;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`ai ${body.task}:`, msg);
    return Response.json({ error: status === 502 ? `บริการ AI ขัดข้อง: ${msg.slice(0, 200)}` : msg }, { status });
  }
}
