// System prompt, starter questions and page context for the company assistant.
// Pure (type-only imports) so it can be unit-tested.

import type { Role } from "../../data";

export type PageRef = { path: string; kind?: string; id?: string; label?: string };

/** What the user is looking at, from the URL, so "หน้านี้ / โครงการนี้" can be resolved. */
const ROUTE_KINDS: [RegExp, string, string][] = [
  [/^\/projects\/([^/?#]+)/, "project", "โครงการ"],
  [/^\/schedule\/([^/?#]+)/, "project", "แผนงานของโครงการ"],
  [/^\/costs\/([^/?#]+)/, "project", "ต้นทุนของโครงการ"],
  [/^\/contracts\/variations\/([^/?#]+)/, "variation", "งานเปลี่ยนแปลง (VO)"],
  [/^\/contracts\/([^/?#]+)/, "project", "สัญญาของโครงการ"],
  [/^\/closeout\/([^/?#]+)/, "project", "การส่งมอบโครงการ"],
  [/^\/design-stages\/([^/?#]+)/, "project", "ขั้นตอนออกแบบของโครงการ"],
  [/^\/permits\/([^/?#]+)/, "project", "ใบอนุญาตของโครงการ"],
  [/^\/interior\/([^/?#]+)/, "project", "งานตกแต่งของโครงการ"],
  [/^\/selections\/([^/?#]+)/, "project", "การเลือกวัสดุของโครงการ"],
  [/^\/rfi\/([^/?#]+)/, "rfi", "RFI"],
  [/^\/submittals\/([^/?#]+)/, "submittal", "เอกสารส่งอนุมัติ"],
  [/^\/quotes\/([^/?#]+)/, "quote", "ใบเสนอราคา"],
  [/^\/sales\/([^/?#]+)/, "lead", "ลูกค้ามุ่งหวัง"],
  [/^\/purchasing\/([^/?#]+)/, "purchase", "เอกสารจัดซื้อ"],
  [/^\/work-orders\/([^/?#]+)/, "workorder", "ใบสั่งงาน"],
  [/^\/inspections\/([^/?#]+)/, "inspection", "การตรวจ"],
  [/^\/diary\/([^/?#]+)/, "diary", "รายงานประจำวัน"],
  [/^\/subcontractors\/([^/?#]+)/, "subcontractor", "ผู้รับเหมาช่วง"],
  [/^\/meetings\/([^/?#]+)/, "meeting", "การประชุม"],
  [/^\/tenders\/([^/?#]+)/, "tender", "งานประมูล"],
  [/^\/plant\/([^/?#]+)/, "plant", "เครื่องจักร"],
  [/^\/m\/jobs\/([^/?#]+)/, "workorder", "ใบสั่งงาน"],
];

export function pageRef(pathname: string | undefined | null): PageRef | undefined {
  if (!pathname) return undefined;
  const path = pathname.split(/[?#]/)[0];
  for (const [re, kind, label] of ROUTE_KINDS) {
    const m = path.match(re);
    if (m) return { path, kind, id: decodeURIComponent(m[1]), label };
  }
  return { path };
}

export type PromptInput = {
  company: string;
  today: string;
  userName: string;
  roleLabel: string;
  /** labels of modules this role may view */
  visible: string[];
  /** labels of modules hidden from this role */
  hidden: string[];
  demo: boolean;
  page?: PageRef;
  /** label of the module the current page belongs to */
  pageModule?: string;
};

export function buildSystemPrompt(i: PromptInput): string {
  const lines = [
    `คุณคือผู้ช่วย AI ภายในของ ${i.company} (บริษัทรับสร้างบ้านและรับเหมาก่อสร้าง) ตอบเป็นภาษาไทยเสมอ`,
    `วันนี้คือ ${i.today} (ปี ค.ศ.; เวลาแสดงให้ผู้ใช้จะใช้ปี พ.ศ. ได้ = ค.ศ. + 543)`,
    `ผู้ใช้: ${i.userName} บทบาท ${i.roleLabel}`,
    "",
    "สิทธิ์การเข้าถึง:",
    `- บทบาทนี้ดูข้อมูลได้: ${i.visible.join(", ") || "-"}`,
    i.hidden.length ? `- ไม่มีสิทธิ์ดู: ${i.hidden.join(", ")}` : "- ดูได้ทุกส่วน",
    "- เครื่องมือ (tools) คืนเฉพาะข้อมูลที่บทบาทนี้มีสิทธิ์ดูเท่านั้น ถ้าคำถามเกี่ยวกับส่วนที่ไม่มีสิทธิ์ ให้บอกตรง ๆ ว่าบทบาทนี้ดูส่วนนั้นไม่ได้ และห้ามเดาหรือคาดการณ์ข้อมูลของส่วนที่ซ่อนอยู่",
    "",
    "วิธีตอบ:",
    "- ห้ามแต่งตัวเลขหรือข้อมูลเอง ทุกตัวเลขต้องมาจากผลของเครื่องมือ ถ้าต้องใช้ข้อมูลให้เรียกเครื่องมือก่อนตอบ ถ้าเครื่องมือไม่มีข้อมูลให้บอกว่าไม่พบ",
    "- ตอบสั้น กระชับ ตรงคำถาม เริ่มด้วยคำตอบหลักก่อน แล้วค่อยรายละเอียดเป็นรายการหรือตารางสั้น ๆ (ไม่เกินราว 10 แถว)",
    "- ตัวเลขเงินใช้รูปแบบไทย เช่น ฿1,250,000 หรือ 12.5 ล้านบาท ใส่จุลภาคคั่นหลักพัน เปอร์เซ็นต์ทศนิยมไม่เกิน 1 ตำแหน่ง วันที่เขียนแบบไทย เช่น 4 พ.ย. 2569",
    "- จำนวนเงินจากเครื่องมือเป็นบาท ไม่รวม VAT เว้นแต่ระบุว่า gross/รวม VAT",
    "- ทุกครั้งที่พูดถึงโครงการหรือเอกสารใด ให้ใส่ลิงก์ markdown จากฟิลด์ href ที่เครื่องมือให้มา เช่น [HC-2026-02 บ้านคุณสมชาย](/projects/HC-2026-02) ห้ามสร้างลิงก์ที่ไม่มีในผลเครื่องมือ",
    "- ถ้าผลระบุ more > 0 หรือ truncated แปลว่าแสดงไม่ครบ ให้บอกผู้ใช้ว่ามีอีกกี่รายการ",
    "- ใช้ชื่อเครื่องมือภายในเฉพาะตอนเรียก ไม่ต้องเล่าให้ผู้ใช้ฟัง",
    "- ถ้าผู้ใช้พูดถึง 'ของฉัน' ให้ใช้ชื่อผู้ใช้ข้างบนกรองข้อมูล (เช่น PM, ผู้รับผิดชอบ, ช่าง)",
    "- ถ้าแนบรูปหรือ PDF มา ให้อ่านแล้วตอบตามเนื้อหา และใช้เครื่องมือเทียบกับข้อมูลบริษัทถ้าเกี่ยวข้อง",
    "- คุณอ่านข้อมูลได้อย่างเดียว แก้ไข/อนุมัติ/บันทึกอะไรไม่ได้ ถ้าผู้ใช้ขอให้ทำ ให้บอกหน้าที่ต้องไปทำเอง",
  ];
  if (i.demo) lines.push("", "หมายเหตุ: ตอนนี้เป็นโหมดสาธิต ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่างสมมติ ให้บอกผู้ใช้สั้น ๆ ครั้งแรกที่ตอบด้วยตัวเลขว่าเป็นข้อมูลตัวอย่าง");
  if (i.page && i.page.path !== "/assistant") {
    lines.push("", `ผู้ใช้กำลังเปิดหน้า ${i.page.path}${i.pageModule ? ` (ส่วน ${i.pageModule})` : ""}`);
    if (i.page.id) lines.push(`หน้านี้คือ${i.page.label ?? i.page.kind} รหัส ${i.page.id} ถ้าผู้ใช้ถามถึง "หน้านี้", "โครงการนี้", "อันนี้" ให้หมายถึงรายการนี้และค้นข้อมูลด้วยรหัสนี้`);
  }
  return lines.join("\n");
}

/** Suggested first questions per role. */
export function starterQuestions(role: Role): string[] {
  switch (role) {
    case "admin":
    case "exec":
      return ["เดือนนี้ลูกหนี้ค้างรับเท่าไร และเจ้าหนี้ที่ต้องจ่ายเท่าไร", "โครงการไหนล่าช้าที่สุด 5 อันดับ", "ต้นทุนโครงการไหนเกินงบบ้าง", "สรุปยอดขายในท่อ (pipeline) ตอนนี้"];
    case "pm":
      return ["โครงการของฉันมีความเสี่ยงอะไรบ้าง", "งานวิกฤตที่ล่าช้าในโครงการของฉัน", "RFI และ NCR ที่ยังเปิดค้าง", "แจ้งซ่อมที่เกิน SLA"];
    case "foreman":
      return ["วันนี้มีงานอะไรต้องทำบ้าง", "งานที่ต้องเริ่มในสัปดาห์นี้", "ใบอนุญาตทำงานที่รออนุมัติ", "รายงานประจำวันล่าสุดของไซต์"];
    case "accounting":
      return ["ลูกหนี้ค้างชำระเกินกำหนดมีเท่าไร", "บิลผู้ขายที่ต้องจ่ายใน 30 วันนี้", "งวดเงินลูกค้าที่ถึงกำหนดเดือนนี้", "ต้นทุนเทียบงบรายโครงการ"];
    case "sales":
      return ["สรุป pipeline ตามขั้นการขาย", "ลูกค้าที่ต้องติดตามวันนี้", "ใบเสนอราคาที่ใกล้หมดอายุ", "อัตราปิดการขายตอนนี้"];
    case "technician":
      return ["งานซ่อมที่เกิน SLA มีอะไรบ้าง", "ใบสั่งงานที่ยังไม่ปิด", "บำรุงรักษาที่ใกล้ถึงกำหนด", "ใบอนุญาตทำงานของไซต์วันนี้"];
    case "purchasing":
      return ["ใบสั่งซื้อที่รออนุมัติ", "ของที่ยังไม่ส่งตามกำหนด", "วัสดุในคลังที่ต่ำกว่าจุดสั่งซื้อ", "ราคาเหล็กเส้นล่าสุด"];
    case "safety":
      return ["อุบัติเหตุที่ยังไม่ปิด", "ใบอนุญาตทำงานที่เกินเวลา", "ผลตรวจความปลอดภัยที่รอแก้ไข", "จำนวนคนงานแต่ละไซต์วันนี้"];
    case "engineer":
    case "qc":
    case "architect":
      return ["RFI ที่เลยกำหนดตอบ", "เอกสารส่งอนุมัติที่รอพิจารณา", "NCR ที่ยังเปิดค้าง", "ผลทดสอบคอนกรีตที่ไม่ผ่าน"];
    case "qs":
      return ["ต้นทุนเทียบงบรายโครงการ", "งานเปลี่ยนแปลงที่รออนุมัติ", "โครงการที่ CPI ต่ำกว่า 1", "ราคาวัสดุที่ขึ้นมากที่สุด"];
    case "interior":
      return ["โครงการที่กำลังก่อสร้าง", "ใบสั่งซื้อที่รอรับของ", "งานเปลี่ยนแปลงของลูกค้า", "ราคาวัสดุตกแต่งล่าสุด"];
    default:
      return ["งานของฉันที่ยังค้าง", "การแจ้งเตือนสำคัญวันนี้"];
  }
}

/** Short title for a chat from the first question. */
export function chatTitle(text: string, max = 48): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "แชทใหม่";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ---------- chat history ----------

export type ChatFileMeta = { name: string; type: string; size: number };
export type ChatMsg = {
  id: string;
  role: "user" | "model";
  text: string;
  at: string;
  files?: ChatFileMeta[];
  /** tools the answer used (Thai labels) */
  steps?: string[];
  /** an error / stopped notice shown in the thread, not sent to the model */
  notice?: "error" | "stopped";
};

/**
 * Prior turns as plain text for the model: notices dropped, attachments named (their bytes are not
 * kept), consecutive turns of the same role merged, the last `max` turns, starting with a user turn.
 */
export function historyForModel(msgs: ChatMsg[], max = 12): { role: "user" | "model"; text: string }[] {
  const out: { role: "user" | "model"; text: string }[] = [];
  for (const m of msgs) {
    if (m.notice) continue;
    const files = m.files?.length ? `\n[แนบไฟล์ก่อนหน้า: ${m.files.map((f) => f.name).join(", ")} — ไม่มีไฟล์แล้ว]` : "";
    const text = (m.text + files).trim();
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.text += "\n\n" + text;
    else out.push({ role: m.role, text });
  }
  let tail = out.slice(-max);
  while (tail.length && tail[0].role !== "user") tail = tail.slice(1);
  return tail;
}
