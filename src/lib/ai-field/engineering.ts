// Engineering drafting: meeting minutes + action items, RFI question, NCR, supervision narrative.

import type { JsonSchema } from "../ai/types";
import type { Disc, NcrSeverity, Priority } from "../engineering/types";
import { addDaysIso, baseSystem, bestMatch, isIsoDate, oneOf, str, strList } from "./common";

export const DISC_TH = { A: "สถาปัตย์", S: "โครงสร้าง", E: "ไฟฟ้า", P: "สุขาภิบาล", M: "ปรับอากาศ" } satisfies Record<Disc, string>;
export const DISC_KEYS = Object.keys(DISC_TH) as Disc[];
const PRIORITY_KEYS = ["low", "normal", "high", "urgent"] as const satisfies readonly Priority[];
const NCR_SEV_KEYS = ["minor", "major", "critical"] as const satisfies readonly NcrSeverity[];

// ---------- meeting minutes ----------

export type MinutesAction = { text: string; owner: string; /** matched attendee, "" when the model's owner is not in the list */ matched: boolean; due: string };
export type MinutesDraft = { minutes: string; decisions: string[]; actions: MinutesAction[]; agenda: string[] };

export const MINUTES_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    minutes: { type: "string", description: "บันทึกการประชุมแยกตามวาระ ใช้ขึ้นบรรทัดใหม่ระหว่างวาระ" },
    decisions: { type: "array", items: { type: "string" }, description: "มติที่ประชุม ข้อละประโยค" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "งานที่ต้องทำ ขึ้นต้นด้วยคำกริยา" },
          owner: { type: "string", description: "ชื่อผู้รับผิดชอบจากรายชื่อผู้เข้าประชุมตรงตัว" },
          due: { type: "string", description: "กำหนดเสร็จ YYYY-MM-DD" },
        },
        required: ["text", "owner", "due"],
      },
    },
    agenda: { type: "array", items: { type: "string" }, description: "หัวข้อวาระที่พูดถึง" },
  },
  required: ["minutes", "decisions", "actions"],
};

export function minutesPrompt(o: { today: string; date: string; title: string; projectName: string; attendees: readonly { name: string; org: string }[]; agenda: readonly string[]; carried: readonly string[]; notes: string }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: เรียบเรียงโน้ตดิบจากการประชุมหน้างานเป็นรายงานการประชุมที่เป็นทางการ มติ และงานที่ต้องดำเนินการ`,
    prompt: [
      `การประชุม: ${o.title} · โครงการ ${o.projectName} · วันที่ ${o.date}`,
      "ผู้เข้าประชุม (ชื่อ · หน่วยงาน):",
      o.attendees.map((a) => `${a.name} · ${a.org}`).join("\n") || "(ไม่ระบุ)",
      o.agenda.filter(Boolean).length ? `วาระที่ตั้งไว้:\n${o.agenda.filter(Boolean).join("\n")}` : "",
      o.carried.length ? `เรื่องค้างจากครั้งก่อน:\n${o.carried.join("\n")}` : "",
      "ผู้รับผิดชอบต้องเป็นชื่อจากรายชื่อด้านบน ถ้าโน้ตพูดถึงหน่วยงาน (เช่น ผู้รับเหมาไฟฟ้า) ให้เลือกคนของหน่วยงานนั้น",
      `กำหนดเสร็จ: ถ้าโน้ตบอก "ศุกร์นี้" "สัปดาห์หน้า" ให้คำนวณจากวันที่ประชุม ถ้าไม่บอกให้ใช้ ${addDaysIso(o.date, 7)}`,
      "ห้ามเพิ่มเรื่องที่ไม่มีในโน้ต",
      "",
      "โน้ตดิบ:",
      o.notes.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** match a free-text owner to an attendee: exact, first name, org, then fuzzy */
export function matchOwner(owner: string, attendees: readonly { name: string; org: string }[]): string | undefined {
  const o = owner.trim();
  if (!o) return undefined;
  const exact = attendees.find((a) => a.name === o);
  if (exact) return exact.name;
  const first = attendees.find((a) => a.name.split(/\s+/)[0] === o.split(/\s+/)[0] || o.includes(a.name.split(/\s+/)[0]));
  if (first) return first.name;
  return bestMatch(o, attendees, (a) => [a.name, a.org], 0.5)?.row.name;
}

export function normalizeMinutes(r: { minutes?: string; decisions?: unknown; actions?: { text?: string; owner?: string; due?: string }[]; agenda?: unknown } | undefined, o: { date: string; attendees: readonly { name: string; org: string }[] }): MinutesDraft {
  const fallbackDue = addDaysIso(o.date, 7);
  const actions = (r?.actions ?? [])
    .map((a) => {
      const raw = str(a.owner, 120);
      const m = matchOwner(raw, o.attendees);
      const due = isIsoDate(a.due) && a.due >= o.date ? a.due : fallbackDue;
      return { text: str(a.text, 400), owner: m ?? raw, matched: !!m, due };
    })
    .filter((a) => a.text)
    .slice(0, 30);
  return { minutes: str(r?.minutes, 8000), decisions: strList(r?.decisions, 30), actions, agenda: strList(r?.agenda, 20, 200) };
}

// ---------- RFI ----------

export type RfiDraft = { subject: string; question: string; proposal: string; disc: Disc; location: string; sheet: string; priority: Priority; costImpact: boolean; timeImpact: boolean };
export const RFI_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    subject: { type: "string", description: "หัวเรื่องสั้น ไม่เกิน 80 ตัวอักษร" },
    question: { type: "string", description: "คำถามที่เป็นทางการ ระบุแบบ/ตำแหน่ง/สิ่งที่ขัดแย้ง และสิ่งที่ขอให้ผู้ออกแบบชี้แจง" },
    proposal: { type: "string", description: "แนวทางที่หน้างานเสนอ ถ้ามีในโน้ต" },
    disc: { type: "string", enum: [...DISC_KEYS] },
    location: { type: "string" },
    sheet: { type: "string", description: "เลขแผ่นแบบจากรายการ ถ้ามี" },
    priority: { type: "string", enum: [...PRIORITY_KEYS] },
    costImpact: { type: "boolean" },
    timeImpact: { type: "boolean" },
  },
  required: ["subject", "question", "disc", "priority"],
};
export function rfiPrompt(o: { today: string; projectName: string; note: string; sheets: readonly { id: string; titleTh: string }[]; photoCount: number }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: เรียบเรียงโน้ตหน้างานเป็นเอกสารขอคำชี้แจงแบบ (RFI) ถึงผู้ออกแบบ/ที่ปรึกษา`,
    prompt: [
      `โครงการ: ${o.projectName}`,
      `หมวดงาน (disc): ${Object.entries(DISC_TH)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
      "ความเร่งด่วน (priority): low ต่ำ, normal ปกติ, high สูง (งานจะหยุดภายในสัปดาห์), urgent ด่วนมาก (งานหยุดอยู่ตอนนี้)",
      o.sheets.length ? `แผ่นแบบของโครงการ: ${o.sheets.map((s) => `${s.id} ${s.titleTh}`).join(", ")}` : "",
      o.photoCount ? `แนบรูปหน้างาน ${o.photoCount} รูป ใช้ประกอบการบรรยาย` : "",
      "",
      "โน้ตหน้างาน:",
      o.note.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
export function normalizeRfi(r: Partial<Record<keyof RfiDraft, unknown>> | undefined, sheets: readonly { id: string }[]): RfiDraft {
  const sheetIn = str(r?.sheet, 20).toUpperCase();
  return {
    subject: str(r?.subject, 120),
    question: str(r?.question, 3000),
    proposal: str(r?.proposal, 2000),
    disc: oneOf(r?.disc, DISC_KEYS, "S"),
    location: str(r?.location, 160),
    sheet: sheets.some((s) => s.id === sheetIn) ? sheetIn : "",
    priority: oneOf(r?.priority, PRIORITY_KEYS, "normal"),
    costImpact: r?.costImpact === true,
    timeImpact: r?.timeImpact === true,
  };
}

// ---------- NCR ----------

export type NcrDraft = { title: string; description: string; location: string; disc: Disc; severity: NcrSeverity; rootCause: string; corrective: string; preventive: string };
export const NCR_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "หัวข้อสั้น เช่น รูพรุนคอนกรีตเสาชั้น 4" },
    description: { type: "string", description: "สิ่งที่ไม่เป็นไปตามแบบ/ข้อกำหนด/มาตรฐาน อ้างอิงมาตรฐานที่เกี่ยวข้องถ้าทราบ (เช่น มยผ., วสท.)" },
    location: { type: "string" },
    disc: { type: "string", enum: [...DISC_KEYS] },
    severity: { type: "string", enum: [...NCR_SEV_KEYS], description: "minor เล็กน้อย, major สำคัญ, critical ร้ายแรง (กระทบความปลอดภัย/โครงสร้าง)" },
    rootCause: { type: "string", description: "สาเหตุที่เป็นไปได้ (ข้อเสนอ ให้ผู้รับผิดชอบยืนยัน)" },
    corrective: { type: "string", description: "การแก้ไขงานที่ผิด" },
    preventive: { type: "string", description: "การป้องกันไม่ให้เกิดซ้ำ" },
  },
  required: ["title", "description", "disc", "severity"],
};
export function ncrPrompt(o: { today: string; projectName: string; note: string; photoCount: number }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: ร่างรายงานงานไม่เป็นไปตามข้อกำหนด (NCR) จากโน้ตและรูปหน้างาน สาเหตุและการแก้ไขเป็นข้อเสนอให้ผู้รับผิดชอบยืนยัน`,
    prompt: [`โครงการ: ${o.projectName}`, o.photoCount ? `แนบรูป ${o.photoCount} รูป` : "", "", "โน้ตหน้างาน:", o.note.trim() || "(ไม่มีโน้ต ดูจากรูป)"].filter(Boolean).join("\n"),
  };
}
export function normalizeNcr(r: Partial<Record<keyof NcrDraft, unknown>> | undefined): NcrDraft {
  return {
    title: str(r?.title, 120),
    description: str(r?.description, 3000),
    location: str(r?.location, 160),
    disc: oneOf(r?.disc, DISC_KEYS, "S"),
    severity: oneOf(r?.severity, NCR_SEV_KEYS, "major"),
    rootCause: str(r?.rootCause, 1500),
    corrective: str(r?.corrective, 1500),
    preventive: str(r?.preventive, 1500),
  };
}

// ---------- supervision report narrative ----------

export type SupervisionDraft = { work: string; tests: string; instructions: string; issues: string };
export const SUPERVISION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    work: { type: "string", description: "งานที่ตรวจในช่วงนี้ ตำแหน่ง ผลการตรวจ เป็นข้อ ๆ" },
    tests: { type: "string", description: "การทดสอบที่มีในช่วงนี้และผล" },
    instructions: { type: "string", description: "ข้อสั่งการ/คำแนะนำของผู้ควบคุมงาน" },
    issues: { type: "string", description: "ปัญหาและอุปสรรค" },
  },
  required: ["work", "tests", "instructions", "issues"],
};
export type DiaryDigest = { date: string; weather: string; headcount: number; work: string[]; issues?: string; safety?: string };
export type TestDigest = { date: string; text: string };
export function supervisionPrompt(o: { today: string; projectName: string; from: string; to: string; engineer: string; diaries: readonly DiaryDigest[]; tests: readonly TestDigest[]; ncrs: readonly string[] }) {
  return {
    system: `${baseSystem(o.today)}\nงานนี้: ร่างรายงานการควบคุมงานของวิศวกรผู้ควบคุมงาน (ตามที่กฎหมายควบคุมอาคารกำหนดให้บันทึก) จากรายงานประจำวันและผลทดสอบ ใช้ภาษาทางการ ห้ามแต่งผลตรวจที่ไม่มีในข้อมูล`,
    prompt: [
      `โครงการ: ${o.projectName} · ช่วง ${o.from} ถึง ${o.to} · ผู้ควบคุมงาน ${o.engineer || "-"}`,
      "รายงานประจำวัน:",
      o.diaries.map((d) => `${d.date} | ${d.weather} | คนงาน ${d.headcount} | งาน: ${d.work.join("; ") || "-"}${d.issues ? ` | ปัญหา: ${d.issues}` : ""}${d.safety ? ` | ความปลอดภัย: ${d.safety}` : ""}`).join("\n") || "(ไม่มี)",
      "ผลทดสอบวัสดุ/เสาเข็ม:",
      o.tests.map((t) => `${t.date} ${t.text}`).join("\n") || "(ไม่มี)",
      "NCR ที่ยังเปิด:",
      o.ncrs.join("\n") || "(ไม่มี)",
    ].join("\n"),
  };
}
export function normalizeSupervision(r: Partial<SupervisionDraft> | undefined): SupervisionDraft {
  return { work: str(r?.work, 4000), tests: str(r?.tests, 2000), instructions: str(r?.instructions, 2000), issues: str(r?.issues, 2000) };
}
