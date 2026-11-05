// Safety photo hazard check → inspection findings, and toolbox-talk topic suggestions.

import type { JsonSchema } from "../ai/types";
import type { ItemResult, TopicCat } from "../safety/types";
import { addDaysIso as addDays, baseSystem, bestMatch, oneOf, str, strList } from "./common";

export type HazardSeverity = "high" | "medium" | "low";
export const HAZARD_SEV_LABEL: Record<HazardSeverity, string> = { high: "สูง หยุดงานแก้ทันที", medium: "ปานกลาง แก้ภายในวัน", low: "ต่ำ แก้ภายในสัปดาห์" };
export type Hazard = { hazard: string; where: string; severity: HazardSeverity; action: string; /** index into the checklist, -1 when none fits */ item: number };
export type HazardResult = { hazards: Hazard[]; good: string[]; summary: string };

export const HAZARD_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    hazards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hazard: { type: "string", description: "สิ่งที่ไม่ปลอดภัยที่เห็น เช่น คนงานไม่สวมหมวกนิรภัย" },
          where: { type: "string", description: "ตำแหน่งในรูป" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          action: { type: "string", description: "การแก้ไขที่สั่งได้ทันที" },
          item: { type: "integer", description: "เลขข้อในเช็กลิสต์ที่เกี่ยวข้อง (เริ่มที่ 1) หรือ 0 ถ้าไม่มี" },
        },
        required: ["hazard", "severity", "action", "item"],
      },
    },
    good: { type: "array", items: { type: "string" }, description: "สิ่งที่ทำได้ดี (ถ้ามี)" },
    summary: { type: "string", description: "สรุป 1 ประโยค" },
  },
  required: ["hazards", "summary"],
};

export function hazardPrompt(o: { today: string; checklist: readonly string[]; note?: string; location?: string }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: เป็นเจ้าหน้าที่ความปลอดภัย (จป.) ดูรูปหน้างานก่อสร้างแล้วระบุสภาพหรือการกระทำที่ไม่ปลอดภัยที่เห็นจริงในรูปเท่านั้น`,
    prompt: [
      "ตัวอย่างที่ต้องสังเกต: ไม่สวมหมวกนิรภัย/รองเท้านิรภัย/เข็มขัดนิรภัยเมื่อทำงานที่สูง, ขอบหรือช่องเปิดไม่มีราวกันตก, นั่งร้านไม่มีแผ่นพื้นเต็ม ไม่มีขอบกันของตก (toe-board) ไม่มีค้ำยัน, บันไดไม่มั่นคง, สายไฟพาดพื้น/ปลั๊กพ่วงชำรุด, ความไม่เป็นระเบียบ เศษวัสดุ ตะปู, เหล็กเสริมปลายแหลมไม่มีฝาครอบ, เครื่องมือไม่มีการ์ด, ถังแก๊สไม่ยึด",
      "severity: high = อาจถึงตาย/บาดเจ็บสาหัส ต้องหยุดงาน, medium = ต้องแก้ภายในวัน, low = แก้ภายในสัปดาห์",
      "เช็กลิสต์ของการตรวจนี้ (เลขข้อ. หัวข้อ):",
      o.checklist.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      o.location ? `จุดตรวจ: ${o.location}` : "",
      o.note?.trim() ? `หมายเหตุจากผู้ตรวจ: ${o.note.trim()}` : "",
      "ถ้าไม่เห็นอันตรายเลยให้ hazards เป็นรายการว่าง ห้ามเดา",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

type RawHazards = { hazards?: { hazard?: string; where?: string; severity?: string; action?: string; item?: number }[]; good?: unknown; summary?: string };
export function normalizeHazards(r: RawHazards | undefined, checklist: readonly string[]): HazardResult {
  const hazards = (r?.hazards ?? [])
    .map((h) => {
      const hazard = str(h.hazard, 300);
      let item = typeof h.item === "number" && h.item >= 1 && h.item <= checklist.length ? Math.round(h.item) - 1 : -1;
      if (item < 0 && hazard) {
        const m = bestMatch(hazard, checklist.map((t, i) => ({ t, i })), (x) => x.t, 0.5);
        if (m) item = m.row.i;
      }
      return { hazard, where: str(h.where, 120), severity: oneOf(h.severity, ["high", "medium", "low"] as const, "medium"), action: str(h.action, 300), item };
    })
    .filter((h) => h.hazard)
    .slice(0, 15);
  const rank = { high: 0, medium: 1, low: 2 };
  hazards.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { hazards, good: strList(r?.good, 6, 200), summary: str(r?.summary, 300) };
}

/** mark the chosen hazards on a checklist (fail + note) and build the "actions" text */
export function applyHazards<T extends { text: string; result: ItemResult; note?: string }>(items: readonly T[], hazards: readonly Hazard[]): { items: T[]; actions: string; unmatched: Hazard[] } {
  const out = items.map((i) => ({ ...i }));
  const unmatched: Hazard[] = [];
  for (const h of hazards) {
    const it = h.item >= 0 ? out[h.item] : undefined;
    if (!it) {
      unmatched.push(h);
      continue;
    }
    it.result = "fail";
    const note = h.where ? `${h.hazard} (${h.where})` : h.hazard;
    it.note = it.note?.trim() ? (it.note.includes(note) ? it.note : `${it.note}; ${note}`) : note;
  }
  return { items: out, actions: actionsText(hazards), unmatched };
}
export function actionsText(hazards: readonly Hazard[]) {
  return hazards.map((h, i) => `${i + 1}. ${h.action || h.hazard}${h.severity === "high" ? " (หยุดงานจนกว่าจะแก้)" : ""}`).join("\n");
}
/** suggested follow-up days by worst severity */
export const followUpDays = (hazards: readonly Hazard[]) => (hazards.some((h) => h.severity === "high") ? 0 : hazards.some((h) => h.severity === "medium") ? 1 : 7);

// ---------- toolbox talk topics ----------

export type TopicSuggestion = { title: string; topicId?: string; cat?: TopicCat; why: string; points: string[] };
export const TOPIC_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicId: { type: "string", description: "รหัสหัวข้อจากคลัง ถ้าตรง ไม่งั้นว่าง" },
          title: { type: "string" },
          why: { type: "string", description: "เหตุผลที่ควรพูดสัปดาห์นี้ อ้างอิงเหตุการณ์/ใบอนุญาต/อากาศ" },
          points: { type: "array", items: { type: "string" }, description: "ประเด็นที่ต้องพูด 3–5 ข้อ" },
        },
        required: ["title", "why", "points"],
      },
    },
  },
  required: ["topics"],
};

export type WeekContext = {
  incidents: { date: string; cls: string; description: string }[];
  permits: { type: string; title: string; validFrom: string }[];
  weather: { date: string; am: string; pm: string; rainHours?: number }[];
  /** recent safety-walk failures */
  findings: string[];
  /** topics already talked about in the last 2 weeks */
  recentTopics: string[];
  work: string[];
};
/** collect the last 14 days of one site's safety signals for the topic prompt */
export function buildWeekContext(o: {
  site: string;
  today: string;
  incidents: readonly { projectId: string; date: string; cls: string; description: string }[];
  permits: readonly { projectId: string; type: string; title: string; validFrom: string; validTo: string; status: string }[];
  diaries: readonly { projectId: string; date: string; weatherAm: string; weatherPm: string; rainHours?: number }[];
  inspections: readonly { projectId: string; date: string; items: { text: string; result: string; note?: string }[] }[];
  talks: readonly { projectId: string; date: string; topic: string }[];
  tasks: readonly { projectId: string; name: string; start: string; finish: string; pct: number; milestone?: boolean }[];
  labels?: { incident?: Record<string, string>; permit?: Record<string, string>; weather?: Record<string, string> };
}): WeekContext {
  const from14 = addDays(o.today, -14);
  const from7 = addDays(o.today, -7);
  const to7 = addDays(o.today, 7);
  const L = o.labels ?? {};
  const mine = <T extends { projectId: string }>(rows: readonly T[]) => rows.filter((r) => r.projectId === o.site);
  return {
    incidents: mine(o.incidents)
      .filter((i) => i.date >= from14 && i.date <= o.today)
      .map((i) => ({ date: i.date, cls: L.incident?.[i.cls] ?? i.cls, description: i.description.slice(0, 200) })),
    permits: mine(o.permits)
      .filter((p) => p.status !== "cancelled" && p.validTo.slice(0, 10) >= from7 && p.validFrom.slice(0, 10) <= to7)
      .map((p) => ({ type: L.permit?.[p.type] ?? p.type, title: p.title, validFrom: p.validFrom })),
    weather: mine(o.diaries)
      .filter((d) => d.date >= from7 && d.date <= o.today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ date: d.date, am: L.weather?.[d.weatherAm] ?? d.weatherAm, pm: L.weather?.[d.weatherPm] ?? d.weatherPm, rainHours: d.rainHours })),
    findings: mine(o.inspections)
      .filter((x) => x.date >= from14)
      .flatMap((x) => x.items.filter((i) => i.result === "fail").map((i) => (i.note ? `${i.text}: ${i.note}` : i.text)))
      .slice(0, 12),
    recentTopics: [...new Set(mine(o.talks).filter((t) => t.date >= from14).map((t) => t.topic))],
    work: mine(o.tasks)
      .filter((t) => !t.milestone && t.pct < 100 && t.start <= to7 && t.finish >= o.today)
      .map((t) => t.name)
      .slice(0, 12),
  };
}

export function topicPrompt(o: { today: string; siteName: string; ctx: WeekContext; library: readonly { id: string; title: string }[] }) {
  const c = o.ctx;
  const list = (rows: string[], empty = "(ไม่มี)") => (rows.length ? rows.join("\n") : empty);
  return {
    system: `${baseSystem(o.today)}\nงานนี้: แนะนำหัวข้อ Toolbox Talk 3 หัวข้อสำหรับหน้างานสัปดาห์นี้ ให้สัมพันธ์กับความเสี่ยงจริงของไซต์`,
    prompt: [
      `หน้างาน: ${o.siteName}`,
      "อุบัติเหตุ/เหตุเกือบเกิด 14 วันล่าสุด:",
      list(c.incidents.map((i) => `${i.date} ${i.cls}: ${i.description}`)),
      "ใบอนุญาตทำงาน (permit) สัปดาห์นี้:",
      list(c.permits.map((p) => `${p.validFrom.slice(0, 10)} ${p.type}: ${p.title}`)),
      "สภาพอากาศจากรายงานประจำวัน:",
      list(c.weather.map((w) => `${w.date} เช้า ${w.am} บ่าย ${w.pm}${w.rainHours ? ` ฝน ${w.rainHours} ชม.` : ""}`)),
      "ข้อบกพร่องจากการเดินตรวจล่าสุด:",
      list(c.findings),
      "งานที่กำลังทำ:",
      list(c.work),
      "หัวข้อที่พูดไปแล้วใน 2 สัปดาห์ (หลีกเลี่ยงซ้ำ ยกเว้นจำเป็น):",
      list(c.recentTopics),
      "คลังหัวข้อ (รหัส. หัวข้อ):",
      o.library.map((t) => `${t.id}. ${t.title}`).join("\n"),
    ].join("\n"),
  };
}
export function normalizeTopics(r: { topics?: { topicId?: string; title?: string; why?: string; points?: unknown }[] } | undefined, library: readonly { id: string; cat: TopicCat; title: string }[]): TopicSuggestion[] {
  return (r?.topics ?? [])
    .map((t) => {
      const title = str(t.title, 200);
      const lib = library.find((x) => x.id === str(t.topicId, 10)) ?? (title ? bestMatch(title, library, (x) => x.title, 0.75)?.row : undefined);
      return { title: lib?.title ?? title, topicId: lib?.id, cat: lib?.cat, why: str(t.why, 400), points: strList(t.points, 6, 200) };
    })
    .filter((t) => t.title)
    .slice(0, 5);
}
