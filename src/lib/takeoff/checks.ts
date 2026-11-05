// Sanity checks on a takeoff: rule-based flags first (always available), then a compact prompt so
// the AI can explain them in plain Thai and add what the rules miss. Pure.

import type { JsonSchema } from "../ai/types";
import { CAT_OF, type CatSummary, type TakeoffItem, type TakeoffSource, type Wall } from "./types";

export type Severity = "high" | "medium" | "low";
export type Flag = { id: string; severity: Severity; title: string; detail: string; codes: string[] };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function takeoffFlags(src: TakeoffSource, walls: Wall[], items: TakeoffItem[], summary: CatSummary[]): Flag[] {
  const flags: Flag[] = [];
  const masonry = items.filter((x) => x.cat === "masonry");
  const byWall = new Map(masonry.map((x) => [x.wallId, x]));
  const code = (w: Wall) => byWall.get(w.id)?.code ?? w.id;

  // walls that are mostly openings, or almost nothing to build
  for (const w of walls) {
    const gross = (w.b - w.a) * w.height;
    const open = w.openings.reduce((a, o) => a + (o.s1 - o.s0) * (o.head - o.sill), 0);
    if (gross > 1 && open / gross > 0.6) flags.push({ id: `open-${w.id}`, severity: "medium", title: `ผนัง ${w.id} มีช่องเปิด ${Math.round((open / gross) * 100)}% ของพื้นที่`, detail: "ตรวจว่าช่องเปิดซ้อนหรือขนาดผิดหรือไม่", codes: [code(w)] });
    if (w.height < 2.2 || w.height > 4.5) flags.push({ id: `h-${w.id}`, severity: "medium", title: `ผนัง ${w.id} สูง ${w.height.toFixed(2)} ม.`, detail: "ความสูงผิดจากช่วงปกติของบ้านพักอาศัย (2.2–4.5 ม.)", codes: [code(w)] });
    if (w.b - w.a < 0.4) flags.push({ id: `short-${w.id}`, severity: "low", title: `ผนัง ${w.id} ยาวเพียง ${(w.b - w.a).toFixed(2)} ม.`, detail: "อาจเป็นเศษผนังจากการต่อแนว หรือเสาที่อ่านเป็นผนัง", codes: [code(w)] });
    for (const o of w.openings) {
      if (o.kind === "door" && o.head - o.sill < 1.9) flags.push({ id: `door-${w.id}-${o.id}`, severity: "medium", title: `ประตู ${o.id} สูง ${(o.head - o.sill).toFixed(2)} ม.`, detail: "ต่ำกว่า 1.90 ม. อาจเป็นหน้าต่างที่อ่านเป็นประตู", codes: [code(w)] });
      if (o.kind === "window" && o.sill < 0.05) flags.push({ id: `win-${w.id}-${o.id}`, severity: "low", title: `หน้าต่าง ${o.id} ชิดพื้น`, detail: "ขอบล่างอยู่ที่ระดับพื้น ตรวจว่าเป็นประตูกระจกหรือไม่", codes: [code(w)] });
    }
  }

  // rooms
  for (const r of src.rooms) {
    const area = (r.x1 - r.x0) * (r.z1 - r.z0);
    if (r.bath && !items.some((x) => x.cat === "wallTile" && x.roomIds.includes(r.id)))
      flags.push({ id: `bath-${r.id}`, severity: "high", title: `${r.name} ไม่มีกระเบื้องผนัง`, detail: "ห้องน้ำควรมีกระเบื้องผนัง ตรวจว่าผนังรอบห้องอ่านได้ครบ", codes: [] });
    if (area < 1.2 && r.floorTile) flags.push({ id: `room-${r.id}`, severity: "low", title: `${r.name} พื้นที่ ${area.toFixed(2)} ตร.ม.`, detail: "ห้องเล็กผิดปกติ", codes: items.filter((x) => x.cat === "floorTile" && x.roomIds.includes(r.id)).map((x) => x.code) });
  }

  // ratios across the whole takeoff
  const q = Object.fromEntries(summary.map((x) => [x.cat, x.qty]));
  const floorArea = src.rooms.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  if (q.masonry > 0) {
    const ratio = q.plaster / q.masonry;
    if (ratio < 1.6 || ratio > 2.4) flags.push({ id: "ratio-plaster", severity: "medium", title: `ฉาบ/ก่อ = ${ratio.toFixed(2)}`, detail: "ปกติประมาณ 2 (ฉาบสองด้าน) ตรวจผนังที่ไม่มีห้องติดหรือผนังภายนอกที่ขาดด้านใดด้านหนึ่ง", codes: [] });
    if (floorArea > 0) {
      const perFloor = q.masonry / floorArea;
      if (perFloor < 0.8 || perFloor > 2.5) flags.push({ id: "ratio-masonry", severity: "medium", title: `ก่ออิฐ ${perFloor.toFixed(2)} ตร.ม. ต่อพื้นที่ใช้สอย 1 ตร.ม.`, detail: "บ้านทั่วไปอยู่ราว 1.0–2.0 ผนังอาจขาดหรือซ้ำ", codes: [] });
    }
  }
  const noRoom = items.filter((x) => x.cat === "plaster" && x.kind.startsWith("ด้าน ") && /ด้าน [AB]$/.test(x.kind));
  if (noRoom.length) flags.push({ id: "faces-ab", severity: "low", title: `ผนัง ${new Set(noRoom.map((x) => x.wallId)).size} แนวไม่รู้ว่าติดห้องไหน`, detail: "ฉาบ/ทาสีนับเป็นด้าน A/B แยกตามห้องไม่ได้", codes: noRoom.slice(0, 8).map((x) => x.code) });
  for (const x of summary) if (x.lines && x.priceStatus === "sample") flags.push({ id: `price-${x.cat}`, severity: "low", title: `${CAT_OF[x.cat].label}ใช้ราคาตัวอย่าง`, detail: x.priceNote, codes: [] });
  for (const n of src.notes) flags.push({ id: `note-${n.slice(0, 20)}`, severity: "medium", title: "ข้อมูลต้นทางไม่ครบ", detail: n, codes: [] });

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

export type AiReview = { summary: string; issues: { severity: Severity; title: string; detail: string; codes: string[]; suggestion: string }[] };

export const REVIEW_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "สรุป 2–3 ประโยค ภาษาไทย" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          detail: { type: "string" },
          codes: { type: "array", items: { type: "string" } },
          suggestion: { type: "string" },
        },
        required: ["severity", "title", "detail", "codes", "suggestion"],
      },
    },
  },
  required: ["summary", "issues"],
};

export function reviewPrompt(o: { project: string; source: TakeoffSource; walls: Wall[]; items: TakeoffItem[]; summary: CatSummary[]; flags: Flag[] }) {
  const floorArea = r2(o.source.rooms.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0));
  const sum = o.summary
    .map((x) => `- ${CAT_OF[x.cat].prefix} ${CAT_OF[x.cat].label}: ${x.qty} ${CAT_OF[x.cat].unit} (${x.lines} รายการ) เผื่อ ${x.waste}% ซื้อ ${x.purchase} ${x.purchaseUnit} · ${x.price} บ./หน่วย [${x.priceStatus}] รวม ${x.cost} บาท (วัสดุ ${x.materialCost} ค่าแรง ${x.labourCost})`)
    .join("\n");
  const walls = o.walls
    .slice(0, 60)
    .map((w) => `${w.id} ชั้น${w.floor} ${w.exterior ? "นอก" : "ใน"} ยาว ${r2(w.b - w.a)} สูง ${w.height} ช่องเปิด ${w.openings.map((p) => `${p.kind === "door" ? "D" : "W"}${r2(p.s1 - p.s0)}×${r2(p.head - p.sill)}@${r2(p.sill)}`).join(",") || "-"}`)
    .join("\n");
  const masonry = o.items.filter((x) => x.cat === "masonry").map((x) => `${x.code}=${x.wallId}`).join(" ");
  const flags = o.flags.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}${f.codes.length ? ` (${f.codes.join(", ")})` : ""}`).join("\n") || "- ไม่มี";
  return {
    system:
      "คุณเป็นสถาปนิก/QS ตรวจงานถอดปริมาณงานสถาปัตย์ของบ้านพักอาศัยในไทย (ก่ออิฐ ฉาบ ทาสี เสาเอ็นคานเอ็น จับเซี้ยม กระเบื้อง) " +
      "ตอบภาษาไทยสั้น ชัด ใช้เฉพาะตัวเลขที่ให้มา ห้ามเดาราคาตลาดใหม่ ชี้รายการผิดปกติพร้อมรหัสบรรทัด (เช่น อ12) หรือรหัสผนัง และบอกว่าควรตรวจอะไรกับแบบ " +
      "ถ้าข้อมูลดูปกติให้บอกว่าปกติ อย่าแต่งปัญหา ความต่างไม่เกิน 2 ซม. ถือว่าปกติ " +
      "ความหมายสถานะราคา: book = วัสดุและค่าแรงจากบัญชีราคาบริษัท, partial = วัสดุจากบัญชีราคา + ค่าแรงที่บริษัทตั้งเอง (ราคาครบแล้ว ไม่ใช่ข้อบกพร่อง), sample = ราคาตัวอย่างที่ยังไม่ได้ยืนยัน " +
      "จับเซี้ยมคิดจำนวนเส้นแบบปัดขึ้นทีละแนว (แต่ละขอบช่องเปิดตัดจากเส้นเต็มแยกกัน) จำนวนเส้นจึงมากกว่าความยาวรวมหารความยาวเส้น เป็นเรื่องปกติ",
    prompt:
      `โครงการ ${o.project} · แหล่งข้อมูล ${o.source.label} · ${o.source.floors} ชั้น · ${o.walls.length} แนวผนัง · ${o.source.rooms.length} ห้อง พื้นที่ห้องรวม ${floorArea} ตร.ม.\n\n` +
      `สรุปหมวด:\n${sum}\n\nผนัง (รหัส ชั้น ยาว สูง ช่องเปิด กว้าง×สูง@ขอบล่าง):\n${walls}\n\nรหัสบรรทัดก่ออิฐ: ${masonry}\n\nกฎตรวจอัตโนมัติพบ:\n${flags}\n\n` +
      "ตรวจและสรุปประเด็นที่ควรแก้หรือยืนยันก่อนสั่งของ/ทำสัญญาค่าแรง เรียงจากสำคัญมากไปน้อย ไม่เกิน 8 ข้อ",
  };
}
