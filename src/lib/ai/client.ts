"use client";

// Browser side of the AI layer. Every feature calls these helpers:
//   aiJson<T>(task, { system, prompt, files, schema })   → structured extraction / drafting
//   aiText(task, { system, prompt, files })              → plain Thai text
//   runToolLoop({ task, system, messages, tools })       → chat that reads company data through tools
// Tools run HERE, in the browser, against the same collections the user can already see,
// so the AI only ever sees data the signed-in role is allowed to view.

import { useEffect, useState } from "react";
import type { AiFile, AiMessage, AiRequest, AiResponse, AiStatus, AiTool, JsonSchema } from "./types";
import { mediaUrl, type MediaRef } from "@/lib/media";

export type { AiMessage, AiTool, JsonSchema } from "./types";

export class AiUnavailable extends Error {}

export async function aiGenerate(req: AiRequest): Promise<AiResponse> {
  let res: Response;
  try {
    res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
  } catch {
    throw new AiUnavailable("ต่อบริการ AI ไม่ได้ (ไม่มีอินเทอร์เน็ต?)");
  }
  const body = (await res.json().catch(() => ({}))) as AiResponse & { error?: string };
  if (!res.ok) throw res.status === 503 ? new AiUnavailable(body.error ?? "ยังไม่ได้ตั้งค่า AI") : new Error(body.error ?? `AI error ${res.status}`);
  return body;
}

let statusCache: Promise<AiStatus> | null = null;
export function aiStatus(): Promise<AiStatus> {
  return (statusCache ??= fetch("/api/ai")
    .then((r) => r.json() as Promise<AiStatus>)
    .catch(() => ({ configured: false, provider: "gemini", model: "" })));
}
/** undefined while loading */
export function useAiStatus() {
  const [s, setS] = useState<AiStatus>();
  useEffect(() => {
    let on = true;
    void aiStatus().then((x) => on && setS(x));
    return () => {
      on = false;
    };
  }, []);
  return s;
}

// ---------- files ----------

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function fileToAi(file: Blob): Promise<AiFile> {
  return { mimeType: file.type || "application/octet-stream", data: await toBase64(file) };
}
export async function mediaToAi(ref: MediaRef): Promise<AiFile | undefined> {
  const url = await mediaUrl(ref);
  if (!url) return undefined;
  const blob = await fetch(url).then((r) => r.blob());
  return { mimeType: ref.type || blob.type, data: await toBase64(blob) };
}

// ---------- one-shot helpers ----------

type OneShot = { system?: string; prompt: string; files?: AiFile[]; temperature?: number; maxOutputTokens?: number };
const userMsg = (prompt: string, files: AiFile[] = []): AiMessage => ({ role: "user", parts: [...files.map((file) => ({ file })), { text: prompt }] });

export async function aiText(task: string, o: OneShot): Promise<string> {
  const r = await aiGenerate({ task, system: o.system, messages: [userMsg(o.prompt, o.files)], temperature: o.temperature, maxOutputTokens: o.maxOutputTokens });
  return r.text ?? "";
}

export async function aiJson<T>(task: string, o: OneShot & { schema: JsonSchema }): Promise<T> {
  const r = await aiGenerate({ task, system: o.system, messages: [userMsg(o.prompt, o.files)], json: o.schema, temperature: o.temperature, maxOutputTokens: o.maxOutputTokens ?? 12000 });
  return r.json as T;
}

// ---------- tool loop (chat) ----------

export type ClientTool = AiTool & { run: (args: Record<string, unknown>) => unknown | Promise<unknown> };

/** Runs model ↔ browser-tool rounds until the model answers in text. Returns the new messages (model + tool turns). */
export async function runToolLoop(o: {
  task: string;
  system: string;
  messages: AiMessage[];
  tools: ClientTool[];
  maxSteps?: number;
  onStep?: (name: string, args: Record<string, unknown>) => void;
}): Promise<{ text: string; added: AiMessage[] }> {
  const added: AiMessage[] = [];
  const decl = o.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
  for (let step = 0; step < (o.maxSteps ?? 6); step++) {
    const r = await aiGenerate({ task: o.task, system: o.system, messages: [...o.messages, ...added], tools: decl });
    added.push(r.message);
    if (!r.calls?.length) return { text: r.text ?? "", added };
    const results = await Promise.all(
      r.calls.map(async (c) => {
        o.onStep?.(c.name, c.args);
        const tool = o.tools.find((t) => t.name === c.name);
        let response: unknown;
        try {
          response = tool ? await tool.run(c.args) : { error: `ไม่มีเครื่องมือ ${c.name}` };
        } catch (e) {
          response = { error: e instanceof Error ? e.message : String(e) };
        }
        return { result: { id: c.id, name: c.name, response: trimForModel(response) } };
      }),
    );
    added.push({ role: "user", parts: results });
  }
  return { text: "ขออภัย คำถามนี้ต้องค้นข้อมูลหลายขั้นเกินไป ลองถามให้แคบลง", added };
}

/** Keep tool results small: long arrays are cut, so one call can't blow the context. */
export function trimForModel(v: unknown, maxItems = 60): unknown {
  if (Array.isArray(v)) return v.length > maxItems ? { items: v.slice(0, maxItems).map((x) => trimForModel(x, maxItems)), total: v.length, truncated: true } : v.map((x) => trimForModel(x, maxItems));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimForModel(x, maxItems)]));
  return v;
}
