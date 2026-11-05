// Lead brief → structured requirements + house-model recommendations (pure).

import type { JsonSchema } from "../ai/types";

/** House catalogue entry (structurally matches data.ts HouseModel, only what we use). */
export type CatalogModel = {
  code: string;
  name: string;
  nameTh: string;
  type: string;
  floors: number;
  area: number;
  beds: number;
  baths: number;
  parking: number;
  style: string;
  land: string;
  W: number;
  D: number;
  priceMin: number;
  priceMax: number;
  months: number;
};

/** What the AI extracts from a customer's chat / notes. Every field is optional. */
export type LeadBrief = {
  name?: string;
  phone?: string;
  lineId?: string;
  email?: string;
  budgetMillion?: number;
  landSizeWa?: number;
  landWidthM?: number;
  landDepthM?: number;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  parking?: number;
  style?: string;
  province?: string;
  timeline?: string;
  mustHaves?: string[];
  concerns?: string[];
  summary?: string;
};

export type ModelRec = { code: string; reason: string; fit: number };
export type Upgrade = { name: string; reason: string };
export type LeadBriefResult = { brief: LeadBrief; recommendations: ModelRec[]; upgrades: Upgrade[]; nextStep: string };

export const SYSTEM_LEAD =
  "คุณเป็นที่ปรึกษาการขายของบริษัทรับสร้างบ้านในประเทศไทย อ่านข้อความแชต/บันทึกของลูกค้า สกัดความต้องการเป็นข้อมูลโครงสร้าง " +
  "แล้วแนะนำแบบบ้านจากแค็ตตาล็อกที่ให้มาเท่านั้น 2–3 แบบ พร้อมเหตุผลสั้น ๆ ที่อ้างอิงงบ ขนาดที่ดิน จำนวนห้อง และสไตล์ " +
  "ห้ามเดาข้อมูลที่ลูกค้าไม่ได้บอก (เว้นว่างไว้) แปลงหน่วย: 1 ไร่ = 400 ตร.ว., 1 งาน = 100 ตร.ว., 1 ตร.ว. = 4 ตร.ม. " +
  "งบให้เป็นล้านบาท ตอบเป็นภาษาไทย";

export const LEAD_BRIEF_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    brief: {
      type: "object",
      properties: {
        name: { type: "string", description: "ชื่อลูกค้า ถ้ามีในข้อความ" },
        phone: { type: "string" },
        lineId: { type: "string" },
        email: { type: "string" },
        budgetMillion: { type: "number", description: "งบก่อสร้าง ล้านบาท" },
        landSizeWa: { type: "number", description: "ขนาดที่ดิน ตารางวา" },
        landWidthM: { type: "number", description: "หน้ากว้างที่ดิน เมตร" },
        landDepthM: { type: "number", description: "ความลึกที่ดิน เมตร" },
        bedrooms: { type: "integer" },
        bathrooms: { type: "integer" },
        floors: { type: "integer" },
        parking: { type: "integer" },
        style: { type: "string" },
        province: { type: "string", description: "จังหวัดที่ดิน ใช้ชื่อตามรายการจังหวัดที่ให้" },
        timeline: { type: "string", description: "ช่วงเวลาที่อยากเริ่ม/เข้าอยู่" },
        mustHaves: { type: "array", items: { type: "string" } },
        concerns: { type: "array", items: { type: "string" } },
        summary: { type: "string", description: "สรุปความต้องการ 1–2 ประโยค" },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: { code: { type: "string", description: "รหัสแบบบ้านจากแค็ตตาล็อก" }, reason: { type: "string" }, fit: { type: "integer", description: "ความเหมาะสม 0–100" } },
        required: ["code", "reason", "fit"],
      },
    },
    upgrades: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, reason: { type: "string" } }, required: ["name", "reason"] },
      description: "รายการเสริม/อัปเกรดที่ลูกค้าน่าจะสนใจ",
    },
    nextStep: { type: "string", description: "สิ่งที่เซลส์ควรทำต่อ" },
  },
  required: ["brief", "recommendations", "upgrades", "nextStep"],
};

export function catalogForPrompt(models: CatalogModel[]) {
  return models
    .map((m) => `${m.code}|${m.name} (${m.nameTh})|${m.type}|${m.floors} ชั้น|${m.area} ตร.ม.|${m.beds} นอน ${m.baths} น้ำ|จอด ${m.parking}|${m.style}|ที่ดินแนะนำ ${m.land}|${m.priceMin}–${m.priceMax} ล้าน|${m.months} เดือน`)
    .join("\n");
}

export function leadBriefPrompt(o: { text: string; models: CatalogModel[]; provinces: string[]; upgrades: string[]; today: string; known?: string }) {
  return [
    `วันที่วันนี้ ${o.today}`,
    o.known ? `ข้อมูลที่มีในระบบแล้ว: ${o.known}` : "",
    `ข้อความจากลูกค้า/บันทึกของเซลส์:\n"""${o.text.trim()}"""`,
    `รายการจังหวัด: ${o.provinces.join(", ")}`,
    `แค็ตตาล็อกแบบบ้าน (รหัส|ชื่อ|ประเภท|ชั้น|พื้นที่|ห้อง|ที่จอด|สไตล์|ที่ดิน|ราคา|ระยะเวลาสร้าง):\n${catalogForPrompt(o.models)}`,
    `รายการเสริมที่บริษัทมี: ${o.upgrades.join(", ")}`,
    "เลือกแบบที่ราคาอยู่ในงบ (เกินได้ไม่เกิน 10% ถ้าเหตุผลดี) ขนาดเข้ากับที่ดิน และจำนวนห้องนอนพอ เรียงจากเหมาะที่สุด",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Parse "18 × 22 ม." → [18, 22] */
export function landDims(land: string): [number, number] | null {
  const m = /([\d.]+)\s*[×x*]\s*([\d.]+)/.exec(land);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Deterministic fit check of a model against a brief — used to annotate/validate AI picks. */
export function fitIssues(m: CatalogModel, b: LeadBrief): string[] {
  const out: string[] = [];
  if (b.budgetMillion && m.priceMin > b.budgetMillion * 1.1) out.push(`ราคาเริ่ม ${m.priceMin} ล้าน เกินงบ ${b.budgetMillion} ล้าน`);
  if (b.bedrooms && m.beds < b.bedrooms) out.push(`ห้องนอน ${m.beds} น้อยกว่าที่ต้องการ ${b.bedrooms}`);
  if (b.floors && m.floors !== b.floors) out.push(`${m.floors} ชั้น (ลูกค้าต้องการ ${b.floors} ชั้น)`);
  const dims = landDims(m.land);
  if (dims && b.landWidthM && b.landWidthM < dims[0] - 0.5) out.push(`ที่ดินกว้าง ${b.landWidthM} ม. แคบกว่าที่แนะนำ ${dims[0]} ม.`);
  if (dims && b.landSizeWa && !b.landWidthM) {
    const needWa = (dims[0] * dims[1]) / 4;
    if (b.landSizeWa < needWa * 0.8) out.push(`ที่ดิน ${b.landSizeWa} ตร.ว. เล็กกว่าที่แนะนำราว ${Math.round(needWa)} ตร.ว.`);
  }
  return out;
}

/** Keep only catalogue codes, de-duplicate, clamp fit, at most 3. */
export function cleanRecommendations(recs: ModelRec[] | undefined, models: CatalogModel[]): (ModelRec & { model: CatalogModel })[] {
  const seen = new Set<string>();
  const out: (ModelRec & { model: CatalogModel })[] = [];
  for (const r of recs ?? []) {
    const code = String(r?.code ?? "").trim().toUpperCase();
    const m = models.find((x) => x.code.toUpperCase() === code);
    if (!m || seen.has(m.code)) continue;
    seen.add(m.code);
    out.push({ code: m.code, reason: String(r.reason ?? ""), fit: Math.max(0, Math.min(100, Math.round(Number(r.fit) || 0))), model: m });
    if (out.length === 3) break;
  }
  return out;
}

/** Fallback / sanity ranking without AI: budget, bedrooms, floors, land. Higher is better. */
export function rankModels(models: CatalogModel[], b: LeadBrief) {
  return models
    .filter((m) => m.type !== "condo")
    .map((m) => {
      let s = 100 - fitIssues(m, b).length * 25;
      if (b.budgetMillion) s -= Math.abs((m.priceMin + m.priceMax) / 2 - b.budgetMillion) * 4;
      if (b.style && m.style.toLowerCase().includes(b.style.toLowerCase())) s += 10;
      return { code: m.code, score: Math.round(s) };
    })
    .sort((a, b2) => b2.score - a.score);
}

// ---------- applying the brief to a lead ----------

/** The lead fields we may write (structurally matches sales/crm Lead). */
export type LeadFields = { name: string; phone: string; lineId?: string; email?: string; budget: number; province: string; landSize?: number; notes?: string; models: string[] };

export type BriefChange = { field: keyof LeadFields; label: string; from: string; to: string; value: unknown };

const FIELD_LABEL: Record<string, string> = { name: "ชื่อ", phone: "โทรศัพท์", lineId: "LINE ID", email: "อีเมล", budget: "งบประมาณ (ล้านบาท)", province: "จังหวัดที่ดิน", landSize: "ขนาดที่ดิน (ตร.ว.)" };

const isPlaceholderName = (s: string) => !s.trim() || /^ลีดใหม่|^ลูกค้าใหม่|^ไม่ระบุ/.test(s.trim());

/** Province names from the AI may be short forms ("กทม", "โคราช"); map to the system list. */
export function matchProvince(p: string | undefined, provinces: string[]): string | undefined {
  if (!p) return undefined;
  const t = p.replace(/^จ(\.|ังหวัด)\s*/, "").trim();
  const alias: Record<string, string> = { กทม: "กรุงเทพฯ", "กทม.": "กรุงเทพฯ", กรุงเทพ: "กรุงเทพฯ", กรุงเทพมหานคร: "กรุงเทพฯ", โคราช: "นครราชสีมา", อยุธยา: "พระนครศรีอยุธยา" };
  const a = alias[t] ?? t;
  return provinces.find((x) => x === a) ?? provinces.find((x) => x.startsWith(a) || a.startsWith(x));
}

/**
 * Proposed field changes for a lead (only fields the Lead type has). Everything else from the brief
 * becomes a note text for the activity log.
 */
export function briefChanges(lead: LeadFields, b: LeadBrief, provinces: string[]): { changes: BriefChange[]; note: string } {
  const changes: BriefChange[] = [];
  const add = (field: keyof LeadFields, value: unknown, from: unknown) => {
    if (value === undefined || value === null || value === "" || String(value) === String(from ?? "")) return;
    changes.push({ field, label: FIELD_LABEL[field] ?? field, from: from === undefined || from === "" ? "–" : String(from), to: String(value), value });
  };
  if (b.name && isPlaceholderName(lead.name)) add("name", b.name.trim(), lead.name);
  if (b.phone && !lead.phone.replace(/\D/g, "")) add("phone", b.phone.trim(), lead.phone);
  if (b.lineId && !lead.lineId) add("lineId", b.lineId.trim(), lead.lineId);
  if (b.email && !lead.email && /@/.test(b.email)) add("email", b.email.trim(), lead.email);
  if (b.budgetMillion && b.budgetMillion > 0 && b.budgetMillion < 500) add("budget", Math.round(b.budgetMillion * 100) / 100, lead.budget);
  const prov = matchProvince(b.province, provinces);
  if (prov) add("province", prov, lead.province);
  const wa = b.landSizeWa ?? (b.landWidthM && b.landDepthM ? Math.round((b.landWidthM * b.landDepthM) / 4) : undefined);
  if (wa && wa > 0) add("landSize", Math.round(wa), lead.landSize);

  const bits: string[] = [];
  if (b.summary) bits.push(b.summary);
  const room = [b.floors && `${b.floors} ชั้น`, b.bedrooms && `${b.bedrooms} ห้องนอน`, b.bathrooms && `${b.bathrooms} ห้องน้ำ`, b.parking && `จอดรถ ${b.parking} คัน`].filter(Boolean);
  if (room.length) bits.push(`ต้องการ ${room.join(" ")}`);
  if (b.landWidthM && b.landDepthM) bits.push(`ที่ดิน ${b.landWidthM}×${b.landDepthM} ม.`);
  if (b.style) bits.push(`สไตล์ ${b.style}`);
  if (b.timeline) bits.push(`ช่วงเวลา ${b.timeline}`);
  if (b.province && !prov) bits.push(`ที่ดิน ${b.province}`);
  if (b.mustHaves?.length) bits.push(`ต้องมี: ${b.mustHaves.join(", ")}`);
  if (b.concerns?.length) bits.push(`กังวล: ${b.concerns.join(", ")}`);
  return { changes, note: bits.join(" · ") };
}

/** Patch object from accepted changes. */
export function patchFrom(changes: BriefChange[], accepted: Set<string>): Partial<LeadFields> {
  const patch: Record<string, unknown> = {};
  for (const c of changes) if (accepted.has(c.field)) patch[c.field] = c.value;
  return patch as Partial<LeadFields>;
}
