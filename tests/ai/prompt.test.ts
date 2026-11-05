// System prompt, page context, starters, chat history and the markdown parser of the assistant.
import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { buildSystemPrompt, pageRef, starterQuestions, chatTitle, historyForModel } = await lib("prompt");
const { parseMarkdown, parseInline, safeHref, inlineText } = await lib("markdown");

test("pageRef: entity pages resolve kind + id, others keep the path", () => {
  assert.deepEqual(pageRef("/projects/HC-2026-02"), { path: "/projects/HC-2026-02", kind: "project", id: "HC-2026-02", label: "โครงการ" });
  assert.equal(pageRef("/schedule/HC-2025-03")?.id, "HC-2025-03");
  assert.equal(pageRef("/contracts/variations/VO-HC-2026-01-2")?.kind, "variation");
  assert.equal(pageRef("/contracts/HC-2026-01")?.kind, "project");
  assert.equal(pageRef("/rfi/RFI-HC-2026-02-001?x=1")?.id, "RFI-HC-2026-02-001");
  assert.equal(pageRef("/m/jobs/WO-2611-003")?.kind, "workorder");
  assert.deepEqual(pageRef("/repairs"), { path: "/repairs" });
  assert.equal(pageRef(undefined), undefined);
});

test("system prompt: Thai, date, role, permissions, no invented numbers, page and demo", () => {
  const s = buildSystemPrompt({
    company: "บริษัท ตัวอย่าง จำกัด",
    today: "2026-11-04",
    userName: "ศิริพร",
    roleLabel: "ผู้จัดการโครงการ",
    visible: ["โครงการ", "แผนงาน"],
    hidden: ["บัญชี/การเงิน"],
    demo: true,
    page: pageRef("/projects/HC-2026-02"),
    pageModule: "โครงการ",
  });
  for (const part of ["บริษัท ตัวอย่าง จำกัด", "2026-11-04", "ผู้จัดการโครงการ", "ดูข้อมูลได้: โครงการ, แผนงาน", "ไม่มีสิทธิ์ดู: บัญชี/การเงิน", "ห้ามเดา", "ห้ามแต่งตัวเลข", "ข้อมูลตัวอย่าง", "HC-2026-02", "หน้านี้", "href"]) assert.ok(s.includes(part), part);
  const live = buildSystemPrompt({ company: "X", today: "2026-11-04", userName: "a", roleLabel: "ผู้ดูแล", visible: ["ทุกส่วน"], hidden: [], demo: false, page: pageRef("/assistant") });
  assert.ok(!live.includes("ข้อมูลตัวอย่าง"));
  assert.ok(live.includes("ดูได้ทุกส่วน"));
  assert.ok(!live.includes("กำลังเปิดหน้า"));
});

test("starters per role", () => {
  assert.ok(starterQuestions("exec").some((q: string) => q.includes("ลูกหนี้")));
  assert.ok(starterQuestions("exec").some((q: string) => q.includes("ล่าช้า")));
  assert.ok(starterQuestions("pm")[0].includes("ของฉัน"));
  assert.ok(starterQuestions("foreman")[0].includes("วันนี้"));
  assert.ok(starterQuestions("accounting").some((q: string) => q.includes("ลูกหนี้")));
  assert.ok(starterQuestions("sales")[0].includes("pipeline"));
  assert.ok(starterQuestions("technician").length >= 2);
  assert.ok(starterQuestions("subcontractor").length >= 1);
});

test("chatTitle", () => {
  assert.equal(chatTitle("  โครงการไหน\nล่าช้าที่สุด "), "โครงการไหน ล่าช้าที่สุด");
  assert.equal(chatTitle(""), "แชทใหม่");
  assert.equal(chatTitle("ก".repeat(60), 10).length, 10);
});

test("historyForModel: drops notices, names files, merges same-role turns, starts with user", () => {
  const m = (role: string, text: string, extra = {}) => ({ id: text, role, text, at: "", ...extra });
  const h = historyForModel([
    m("model", "stray answer"),
    m("user", "q1", { files: [{ name: "bill.pdf", type: "application/pdf", size: 1 }] }),
    m("model", "a1"),
    m("user", "q2"),
    m("model", "หยุดแล้ว", { notice: "stopped" }),
    m("user", "q3"),
  ]);
  assert.equal(h[0].role, "user");
  assert.ok(h[0].text.includes("bill.pdf"));
  assert.deepEqual(
    h.map((x: { role: string }) => x.role),
    ["user", "model", "user"],
  );
  assert.equal(h[2].text, "q2\n\nq3");
  assert.equal(historyForModel([m("user", "a"), m("model", "b"), m("user", "c"), m("model", "d")], 3)[0].text, "c");
});

test("markdown: blocks", () => {
  const md = ["## สรุป", "", "โครงการ **ล่าช้า** 3 แห่ง", "บรรทัดสอง", "", "- หนึ่ง", "  - ย่อย", "- สอง", "", "1. ก", "2. ข", "", "| โครงการ | วันล่าช้า |", "|---|---:|", "| [HC-2026-02](/projects/HC-2026-02) | 12 |", "| A \\| B | 3 |", "", "```", "x = 1", "```", "---"].join("\n");
  const b = parseMarkdown(md);
  assert.deepEqual(
    b.map((x: { t: string }) => x.t),
    ["h", "p", "ul", "ol", "table", "code", "hr"],
  );
  assert.equal(b[0].level, 2);
  assert.ok(b[1].c.some((n: { t: string }) => n.t === "br"));
  assert.deepEqual(
    b[2].items.map((i: { depth: number }) => i.depth),
    [0, 1, 0],
  );
  assert.equal(b[3].start, 1);
  assert.equal(b[3].items.length, 2);
  assert.deepEqual(b[4].align, ["left", "right"]);
  assert.equal(b[4].rows.length, 2);
  assert.deepEqual(b[4].rows[0][0][0], { t: "link", href: "/projects/HC-2026-02", internal: true, c: [{ t: "text", v: "HC-2026-02" }] });
  assert.equal(inlineText(b[4].rows[1][0]), "A | B");
  assert.equal(b[5].v, "x = 1");
});

test("markdown: inline and link safety", () => {
  assert.deepEqual(parseInline("**ก** และ `x` *เอียง*"), [
    { t: "b", c: [{ t: "text", v: "ก" }] },
    { t: "text", v: " และ " },
    { t: "code", v: "x" },
    { t: "text", v: " " },
    { t: "i", c: [{ t: "text", v: "เอียง" }] },
  ]);
  // snake_case and lone stars stay text
  assert.equal(inlineText(parseInline("site_diaries 5 * 3")), "site_diaries 5 * 3");
  // unsafe link targets render as plain text
  assert.deepEqual(parseInline("[x](javascript:alert(1))")[0], { t: "text", v: "x" });
  assert.equal(safeHref("//evil.com"), null);
  assert.deepEqual(safeHref("https://example.com"), { href: "https://example.com", internal: false });
  assert.deepEqual(safeHref("/rfi/RFI-1"), { href: "/rfi/RFI-1", internal: true });
});

test("markdown: bullets nested under numbered items keep their own marker", () => {
  const [ol] = parseMarkdown("1. งวดที่ 13\n   * จำนวนเงิน ฿569,995\n2. งวดที่ 12");
  assert.equal(ol.t, "ol");
  assert.deepEqual(
    ol.items.map((i: { depth: number; num?: number }) => [i.depth, i.num]),
    [
      [0, 1],
      [1, undefined],
      [0, 2],
    ],
  );
});
