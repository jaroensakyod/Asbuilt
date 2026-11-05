// Sales insights: small aggregated pipeline digest for the AI (pure).

import type { JsonSchema } from "../ai/types";

type L = { id: string; name: string; stage: string; budget: number; owner: string; source: string; created: string; updated: string; nextFollowUp?: string; models: string[]; lostReason?: string };
type Q = { id: string; leadId?: string; status: string; date: string; validDays: number; total: number };

const OPEN = ["new", "contacted", "viewing", "quoted", "negotiating"];
const day = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export type PipelineDigest = ReturnType<typeof pipelineDigest>;

/** Aggregate the pipeline into a compact object (no phone numbers or other personal contact data). */
export function pipelineDigest(leads: L[], quotes: Q[], o: { today: string; weights: Record<string, number>; stallDays?: number }) {
  const stall = o.stallDays ?? 14;
  const open = leads.filter((l) => OPEN.includes(l.stage));
  const byStage = Object.fromEntries(
    [...OPEN, "won", "lost"].map((s) => {
      const xs = leads.filter((l) => l.stage === s);
      return [s, { n: xs.length, valueM: Math.round(xs.reduce((t, l) => t + l.budget, 0) * 10) / 10 }];
    }),
  );
  const weightedM = Math.round(open.reduce((t, l) => t + l.budget * (o.weights[l.stage] ?? 0), 0) * 10) / 10;
  const stalled = open
    .map((l) => ({ id: l.id, stage: l.stage, budgetM: l.budget, owner: l.owner, idleDays: day(l.updated, o.today), followUp: l.nextFollowUp, overdueDays: l.nextFollowUp && l.nextFollowUp < o.today ? day(l.nextFollowUp, o.today) : 0 }))
    .filter((l) => l.idleDays >= stall || l.overdueDays > 0 || !l.followUp)
    .sort((a, b) => b.overdueDays - a.overdueDays || b.idleDays - a.idleDays || b.budgetM - a.budgetM)
    .slice(0, 12);
  const expiring = quotes
    .filter((q) => q.status === "sent")
    .map((q) => ({ id: q.id, leadId: q.leadId, totalM: Math.round(q.total / 1e4) / 100, daysLeft: day(o.today, new Date(Date.parse(q.date) + q.validDays * 86400000).toISOString().slice(0, 10)) }))
    .filter((q) => q.daysLeft <= 10)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);
  const sources = Object.entries(
    leads.reduce<Record<string, { n: number; won: number; lost: number }>>((acc, l) => {
      const s = (acc[l.source] ??= { n: 0, won: 0, lost: 0 });
      s.n++;
      if (l.stage === "won") s.won++;
      if (l.stage === "lost") s.lost++;
      return acc;
    }, {}),
  ).map(([source, v]) => ({ source, ...v }));
  const owners = Object.entries(
    open.reduce<Record<string, { n: number; valueM: number }>>((acc, l) => {
      const s = (acc[l.owner] ??= { n: 0, valueM: 0 });
      s.n++;
      s.valueM = Math.round((s.valueM + l.budget) * 10) / 10;
      return acc;
    }, {}),
  ).map(([owner, v]) => ({ owner, ...v }));
  const lostReasons = Object.entries(leads.filter((l) => l.stage === "lost" && l.lostReason).reduce<Record<string, number>>((acc, l) => ((acc[l.lostReason!] = (acc[l.lostReason!] ?? 0) + 1), acc), {})).map(([reason, n]) => ({ reason, n }));
  const new30 = leads.filter((l) => day(l.created, o.today) <= 30).length;
  return { today: o.today, totalLeads: leads.length, openLeads: open.length, new30, byStage, weightedM, stalled, expiringQuotes: expiring, sources, owners, lostReasons };
}

export const SYSTEM_INSIGHTS =
  "คุณเป็นผู้จัดการฝ่ายขายของบริษัทรับสร้างบ้าน วิเคราะห์ข้อมูลไปป์ไลน์ที่สรุปมาให้ (งบเป็นล้านบาท) " +
  "ตอบภาษาไทย กระชับ อ้างอิงตัวเลขจากข้อมูลเท่านั้น ห้ามแต่งข้อมูล ระบุรหัสลีด (LD-…) เมื่อพูดถึงลีด";

export type Insights = { health: string; highlights: string[]; stalled: { leadId: string; why: string; action: string }[]; actions: string[] };

export const INSIGHTS_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    health: { type: "string", description: "สรุปสุขภาพไปป์ไลน์ 2–3 ประโยค" },
    highlights: { type: "array", items: { type: "string" }, description: "ข้อสังเกตสำคัญ 2–4 ข้อ" },
    stalled: {
      type: "array",
      items: { type: "object", properties: { leadId: { type: "string" }, why: { type: "string" }, action: { type: "string" } }, required: ["leadId", "why", "action"] },
      description: "ลีดที่ค้าง/ควรรีบตาม สูงสุด 6 ราย",
    },
    actions: { type: "array", items: { type: "string" }, description: "สิ่งที่ทีมขายควรทำสัปดาห์นี้ 3–5 ข้อ" },
  },
  required: ["health", "highlights", "stalled", "actions"],
};

export function insightsPrompt(d: PipelineDigest, stageLabels: Record<string, string>, sourceLabels: Record<string, string>) {
  return [`ชื่อขั้นการขาย: ${JSON.stringify(stageLabels)}`, `ชื่อแหล่งที่มา: ${JSON.stringify(sourceLabels)}`, `ข้อมูลไปป์ไลน์:\n${JSON.stringify(d)}`].join("\n\n");
}

/** Drop stalled entries whose lead id the digest does not contain. */
export function cleanInsights(x: Insights | undefined, d: PipelineDigest, knownIds: string[]): Insights {
  const ids = new Set([...knownIds, ...d.stalled.map((s) => s.id)]);
  return {
    health: String(x?.health ?? ""),
    highlights: (x?.highlights ?? []).map(String).slice(0, 5),
    stalled: (x?.stalled ?? []).filter((s) => ids.has(String(s.leadId).trim())).slice(0, 6),
    actions: (x?.actions ?? []).map(String).slice(0, 6),
  };
}
