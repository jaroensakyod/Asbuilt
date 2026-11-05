// Voice / quick text → site diary draft. Prompt, schema, and the mapper that turns the model's
// answer into Diary fields (matching WBS tasks and subcontractors, clamping numbers).

import type { JsonSchema } from "../ai/types";
import type { SiteDiary, Subcontractor, Weather, WbsTask } from "../biz";
import { baseSystem, bestMatch, num, oneOf, str } from "./common";

export const WEATHER_KEYS = ["sunny", "cloudy", "rain", "storm"] as const satisfies readonly Weather[];
const WEATHER_TH: Record<Weather, string> = { sunny: "แดดออก", cloudy: "มีเมฆ", rain: "ฝนตก", storm: "พายุ" };
export const OWN_GROUP = "ทีมบริษัท";

export type DiaryDraft = {
  weatherAm?: string;
  weatherPm?: string;
  rainHours?: number;
  manpower?: { group?: string; trade?: string; count?: number }[];
  equipment?: { name?: string; hours?: number }[];
  work?: { text?: string; taskId?: string; pct?: number }[];
  deliveries?: string;
  issues?: string;
  visitors?: string;
  safety?: string;
};

export const DIARY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    weatherAm: { type: "string", enum: [...WEATHER_KEYS], description: "อากาศช่วงเช้า" },
    weatherPm: { type: "string", enum: [...WEATHER_KEYS], description: "อากาศช่วงบ่าย" },
    rainHours: { type: "number", description: "ชั่วโมงที่ฝนตก 0 ถ้าไม่ได้พูดถึง" },
    manpower: {
      type: "array",
      items: {
        type: "object",
        properties: {
          group: { type: "string", description: `ชื่อผู้รับเหมาช่วงจากรายการ หรือ "${OWN_GROUP}"` },
          trade: { type: "string", description: "ประเภทช่าง เช่น ช่างปูน ช่างไฟฟ้า กรรมกร" },
          count: { type: "integer" },
        },
        required: ["trade", "count"],
      },
    },
    equipment: { type: "array", items: { type: "object", properties: { name: { type: "string" }, hours: { type: "number" } }, required: ["name"] } },
    work: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "งานที่ทำ เขียนเป็นประโยคสั้น" },
          taskId: { type: "string", description: "id ของงานในแผน WBS ที่ตรงที่สุด หรือว่างถ้าไม่ตรง" },
          pct: { type: "number", description: "ความคืบหน้าสะสม % ของงานนั้น ถ้าพูดถึง" },
        },
        required: ["text"],
      },
    },
    deliveries: { type: "string", description: "วัสดุที่เข้าหน้างาน จำนวน หน่วย" },
    issues: { type: "string", description: "ปัญหา/ความล่าช้า" },
    visitors: { type: "string" },
    safety: { type: "string" },
  },
  required: ["weatherAm", "weatherPm", "manpower", "work"],
};

/** leaf, non-milestone tasks of the project, most relevant to `today` first (running, then near) */
export function pickTasks(all: readonly WbsTask[], projectId: string, today: string, max = 80): WbsTask[] {
  const own = all.filter((t) => t.projectId === projectId && !t.milestone);
  const leaves = own.filter((t) => !own.some((c) => c.parentId === t.id));
  const dist = (t: WbsTask) => (t.start <= today && t.finish >= today ? 0 : Math.min(Math.abs(Date.parse(t.start) - Date.parse(today)), Math.abs(Date.parse(t.finish) - Date.parse(today))) / 86400000);
  return leaves
    .filter((t) => t.pct < 100 || dist(t) < 7)
    .sort((a, b) => dist(a) - dist(b) || a.code.localeCompare(b.code, undefined, { numeric: true }))
    .slice(0, max);
}

export function diaryPrompt(o: { text: string; date: string; projectName: string; tasks: readonly WbsTask[]; subs: readonly Pick<Subcontractor, "name" | "trades">[] }) {
  const tasks = o.tasks.map((t) => `${t.id} | ${t.code} ${t.name} | ตอนนี้ ${t.pct}%${t.crew ? ` | ${t.crew}` : ""}`).join("\n");
  const subs = o.subs.map((s) => `${s.name} (${s.trades.join(", ")})`).join("\n");
  return {
    system: `${baseSystem(o.date)}\nงานนี้: แปลงคำพูด/ข้อความสรุปงานของโฟร์แมนเป็นรายงานประจำวันหน้างาน (site diary)`,
    prompt: [
      `โครงการ: ${o.projectName} · วันที่รายงาน ${o.date}`,
      `ค่าอากาศที่ใช้ได้: ${Object.entries(WEATHER_TH)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")} · ถ้าไม่ได้พูดถึงให้ใช้ sunny · ถ้าบอกว่าฝนตกช่วงบ่ายให้ weatherPm=rain`,
      `กำลังคน: แยกบรรทัดตามประเภทช่าง ถ้าไม่ได้บอกบริษัทให้ group="${OWN_GROUP}" ถ้าตรงกับผู้รับเหมาช่วงในรายการให้ใช้ชื่อนั้นตรงตัว`,
      "งานที่ทำ: จับคู่กับงานในแผน WBS ด้านล่างด้วย id (คอลัมน์แรก) เฉพาะที่ตรงจริง ตัวเลข % ที่พูดคือความคืบหน้าสะสมของงานนั้น",
      "วัสดุเข้า: สรุปเป็นข้อความเดียว เช่น \"ปูนซีเมนต์ 20 ถุง\"",
      "",
      "งานในแผน WBS (id | รหัส ชื่องาน | % ปัจจุบัน | ทีม):",
      tasks || "(ไม่มีแผนงาน)",
      "",
      "ผู้รับเหมาช่วง:",
      subs || "(ไม่มี)",
      "",
      "ข้อความจากหน้างาน:",
      o.text.trim(),
    ].join("\n"),
  };
}

export type DiaryFields = "weather" | "manpower" | "equipment" | "work" | "deliveries" | "issues" | "visitors" | "safety";

/** Merge the model's draft into a diary. Rows already typed are kept; AI rows are added. Returns which sections changed. */
export function applyDiaryDraft<D extends SiteDiary>(d: D, draft: DiaryDraft, tasks: readonly WbsTask[], subs: readonly Pick<Subcontractor, "id" | "name" | "trades">[]): { diary: D; filled: DiaryFields[] } {
  const filled = new Set<DiaryFields>();
  const next: D = { ...d };
  if (draft.weatherAm || draft.weatherPm || draft.rainHours) {
    next.weatherAm = oneOf(draft.weatherAm, WEATHER_KEYS, d.weatherAm);
    next.weatherPm = oneOf(draft.weatherPm, WEATHER_KEYS, d.weatherPm);
    const rain = num(draft.rainHours, 0, 24);
    if (rain !== undefined) next.rainHours = Math.round(rain * 2) / 2;
    if (next.rainHours && next.weatherPm === "sunny" && next.weatherAm === "sunny") next.weatherPm = "rain";
    filled.add("weather");
  }

  const man = (draft.manpower ?? [])
    .map((m) => {
      const count = Math.round(num(m.count, 0, 999) ?? 0);
      const trade = str(m.trade, 80);
      const groupIn = str(m.group, 120);
      const sub = groupIn && groupIn !== OWN_GROUP ? bestMatch(groupIn, subs, (s) => s.name, 0.5)?.row : undefined;
      return { group: sub?.name ?? (groupIn && groupIn !== OWN_GROUP ? groupIn : OWN_GROUP), trade, count, subcontractorId: sub?.id };
    })
    .filter((m) => m.count > 0 && (m.trade || m.group));
  if (man.length) {
    // rows copied from yesterday: the spoken count for the same trade replaces them (group kept when the
    // speaker did not name a company); other trades are added
    const rows = d.manpower.map((x) => ({ ...x }));
    const used = new Set<number>();
    for (const m of man) {
      let at = rows.findIndex((x, i) => !used.has(i) && x.group === m.group && x.trade === m.trade);
      if (at < 0 && !m.subcontractorId && m.group === OWN_GROUP) {
        const hit = bestMatch(m.trade, rows.map((x, i) => ({ x, i })).filter((r) => !used.has(r.i)), (r) => r.x.trade, 0.6);
        if (hit) at = hit.row.i;
      }
      if (at >= 0) {
        rows[at] = { ...rows[at], count: m.count, ...(m.group !== OWN_GROUP ? { group: m.group, subcontractorId: m.subcontractorId } : {}) };
        used.add(at);
      } else {
        rows.push(m);
        used.add(rows.length - 1);
      }
    }
    next.manpower = rows.filter((x) => x.count > 0);
    filled.add("manpower");
  }

  const eq = (draft.equipment ?? []).map((e) => ({ name: str(e.name, 120), hours: num(e.hours, 0, 24) ?? 8 })).filter((e) => e.name);
  if (eq.length) {
    next.equipment = [...d.equipment.filter((x) => x.name.trim()), ...eq];
    filled.add("equipment");
  }

  const work = (draft.work ?? [])
    .map((w) => {
      const text = str(w.text, 400);
      let task = tasks.find((t) => t.id === str(w.taskId, 80));
      if (!task && text) task = bestMatch(text, tasks, (t) => t.name, 0.55)?.row;
      const pct = num(w.pct, 0, 100);
      return { text: text || task?.name || "", taskId: task?.id, pct: pct === undefined ? undefined : Math.round(pct) };
    })
    .filter((w) => w.text);
  if (work.length) {
    next.work = [...d.work.filter((x) => x.text.trim()), ...work];
    filled.add("work");
  }

  for (const k of ["deliveries", "issues", "visitors", "safety"] as const) {
    const v = str(draft[k], 1000);
    if (v) {
      const prev = d[k]?.trim();
      next[k] = prev && !prev.includes(v) ? `${prev}\n${v}` : v;
      filled.add(k);
    }
  }
  return { diary: next, filled: [...filled] };
}
