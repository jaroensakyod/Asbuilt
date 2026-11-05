// Customer chat reply suggestions — project context digest + prompt (pure).

export type ReplyContext = {
  project: { id: string; name: string; owner: string; phase: string; actual: number; plan: number; finish: string; status: string; pm: string };
  nextInstallment?: { no: number; title: string; amount: number; vat: number; dueDate: string; status: string };
  overdueInstallments?: number;
  openRepairs?: { id: string; title: string; status: string; reported: string }[];
  pendingSelections?: { item: string; deadline: string; status: string }[];
  pendingVariations?: { id: string; title: string; amount: number; status: string }[];
  thread: { side: "customer" | "company"; author: string; text: string; at: string }[];
};

type Inst = { no: number; title: string; amount: number; vat: number; dueDate: string; status: string; projectId: string };
type Rep = { id: string; title: string; status: string; reported: string; projectId: string };
type Sel = { item: string; deadline: string; status: string; projectId: string };
type Vo = { id: string; title: string; amount: number; status: string; projectId: string };
type Msg = { side: "customer" | "company"; author: string; text: string; at: string; projectId: string };

/** Build a small context object. Pass `undefined` for any list the user's role may not view. */
export function replyContext(o: { project: ReplyContext["project"]; installments?: Inst[]; repairs?: Rep[]; selections?: Sel[]; variations?: Vo[]; messages: Msg[]; maxMessages?: number }): ReplyContext {
  const pid = o.project.id;
  const inst = (o.installments ?? []).filter((i) => i.projectId === pid && i.status !== "paid").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const ctx: ReplyContext = {
    project: o.project,
    thread: o.messages
      .filter((m) => m.projectId === pid)
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-(o.maxMessages ?? 8))
      .map(({ side, author, text, at }) => ({ side, author, text: text.slice(0, 600), at })),
  };
  if (o.installments) {
    const n = inst[0];
    if (n) ctx.nextInstallment = { no: n.no, title: n.title, amount: Math.round(n.amount), vat: Math.round(n.vat), dueDate: n.dueDate, status: n.status };
    ctx.overdueInstallments = inst.filter((i) => i.status === "overdue").length;
  }
  if (o.repairs) ctx.openRepairs = o.repairs.filter((r) => r.projectId === pid && r.status !== "closed").slice(0, 6).map(({ id, title, status, reported }) => ({ id, title, status, reported }));
  if (o.selections) ctx.pendingSelections = o.selections.filter((s) => s.projectId === pid && s.status !== "approved").slice(0, 8).map(({ item, deadline, status }) => ({ item, deadline, status }));
  if (o.variations)
    ctx.pendingVariations = o.variations
      .filter((v) => v.projectId === pid && ["priced", "submitted"].includes(v.status))
      .slice(0, 6)
      .map(({ id, title, amount, status }) => ({ id, title, amount: Math.round(amount), status }));
  return ctx;
}

export const SYSTEM_REPLY =
  "คุณเป็นเจ้าหน้าที่ดูแลลูกค้าของบริษัทรับสร้างบ้าน ร่างคำตอบแชตถึงเจ้าของบ้านเป็นภาษาไทยสุภาพ อบอุ่น กระชับ (2–6 ประโยค) " +
  "ลงท้ายด้วย ครับ/ค่ะ ตามที่ผู้ใช้กำหนด ตอบเฉพาะสิ่งที่ข้อมูลรองรับ ถ้าไม่แน่ใจให้บอกว่าจะตรวจสอบและแจ้งกลับ " +
  "ห้ามสัญญาวันเสร็จ ส่วนลด หรือการแก้ไขที่ไม่มีในข้อมูล ไม่ใช้อีโมจิ ไม่ใส่หัวเรื่อง";

export function replyPrompt(ctx: ReplyContext, o: { staffName: string; politeEnding: "ครับ" | "ค่ะ"; instruction?: string; today: string }) {
  const last = [...ctx.thread].reverse().find((m) => m.side === "customer");
  return [
    `วันที่วันนี้ ${o.today} · ผู้ตอบ ${o.staffName} · ลงท้าย "${o.politeEnding}"`,
    `ข้อมูลโครงการ (JSON):\n${JSON.stringify({ ...ctx, thread: undefined })}`,
    `บทสนทนาล่าสุด:\n${ctx.thread.map((m) => `[${m.at.slice(0, 16)}] ${m.side === "customer" ? "ลูกค้า" : "บริษัท"} ${m.author}: ${m.text}`).join("\n") || "(ยังไม่มี)"}`,
    last ? `ตอบข้อความล่าสุดของลูกค้า: "${last.text}"` : "ยังไม่มีข้อความจากลูกค้า ให้ร่างข้อความอัปเดตความคืบหน้าสั้น ๆ",
    o.instruction ? `คำสั่งเพิ่มเติมจากเจ้าหน้าที่: ${o.instruction}` : "",
    "ส่งกลับเฉพาะข้อความที่จะส่งให้ลูกค้า",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Strip quotes / labels the model sometimes wraps around a reply. */
export function cleanReply(s: string) {
  return s
    .trim()
    .replace(/^```[a-z]*\n?|```$/g, "")
    .replace(/^(คำตอบ|ร่างคำตอบ|ข้อความ)\s*[:：]\s*/, "")
    .replace(/^["“]([\s\S]*)["”]$/, "$1")
    .trim()
    .slice(0, 1000);
}
