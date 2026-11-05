"use client";

// One row per AI call (task, provider, model, tokens, cost) so the company can see what each
// feature really costs and price its packages. Stored like other records: localStorage in demo
// mode, public.records (per company) in live mode.

import { createCollection } from "@/lib/collection";
import type { AiUsage } from "./types";

export type AiUsageRow = AiUsage & { id: string; at: string; task: string; ok: boolean; error?: string; group?: string };

export const aiUsage = createCollection<AiUsageRow>("ai_usage", []);

let seq = 0;
export function logAiUsage(task: string, u: AiUsage, group?: string) {
  try {
    aiUsage.upsert({ ...u, id: `AIU-${Date.now().toString(36)}-${(seq++).toString(36)}`, at: new Date().toISOString(), task, ok: true, group });
  } catch {
    // logging must never break the feature
  }
}

export type TaskStat = { task: string; provider: string; model: string; /** user actions (a chat question = 1 even with several tool rounds) */ calls: number; apiCalls: number; input: number; output: number; thinking: number; cacheRead: number; costUsd: number; costThb: number; avgUsd: number; avgThb: number; avgMs: number };

/** Average tokens / cost per user action, by task and provider. */
export function statsByTask(rows: AiUsageRow[]): TaskStat[] {
  const m = new Map<string, TaskStat>();
  const groups = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = `${r.task}|${r.provider}|${r.model}`;
    const s = m.get(k) ?? { task: r.task, provider: r.provider, model: r.model, calls: 0, apiCalls: 0, input: 0, output: 0, thinking: 0, cacheRead: 0, costUsd: 0, costThb: 0, avgUsd: 0, avgThb: 0, avgMs: 0 };
    s.apiCalls++;
    const g = groups.get(k) ?? new Set<string>();
    g.add(r.group ?? r.id);
    groups.set(k, g);
    s.calls = g.size;
    s.input += r.input;
    s.output += r.output;
    s.thinking += r.thinking ?? 0;
    s.cacheRead += r.cacheRead ?? 0;
    s.costUsd += r.costUsd;
    s.costThb += r.costThb;
    s.avgMs += r.ms;
    m.set(k, s);
  }
  return [...m.values()]
    .map((s) => ({ ...s, avgUsd: s.costUsd / s.calls, avgThb: s.costThb / s.calls, avgMs: Math.round(s.avgMs / s.calls) /* time per action */ }))
    .sort((a, b) => a.task.localeCompare(b.task) || a.provider.localeCompare(b.provider));
}
