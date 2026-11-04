// A3 landscape frame and title block, drawn in paper millimetres.

import { COMPANY_INFO, MODEL_TYPE_LABEL, type HouseModel } from "../data";
import type { Builder } from "./builder";
import { DISC_BY_KEY, type SheetMeta, type Pt } from "./types";

export const PAPER_W = 420;
export const PAPER_H = 297;
/** Drawing area (paper mm) left of the title block */
export const CA = { x0: 26, x1: 322, y0: 30, y1: 283 };
/** notes / legend region inside the title block (paper mm) */
export const NOTES = { x0: 331, x1: 407, top: 230, bottom: 154 };

export const REVISIONS = [
  { rev: 0, date: "2025-04-29", text: "ออกแบบชุดแบบมาตรฐาน (ฉบับแรก)", by: "สถาปนิก" },
  { rev: 1, date: "2025-06-20", text: "ปรับปรุงงานระบบและรายการวัสดุ", by: "วิศวกรงานระบบ" },
  { rev: 2, date: "2026-08-17", text: "ปรับปรุงมาตรฐานแบบ ฉบับ 2569 (ปัจจุบัน)", by: "ผู้จัดการฝ่ายออกแบบ" },
];

export const PEOPLE = {
  designed: "ชนิดา มีสุข",
  drawn: "กิตติพัฒน์ แสงอรุณ",
  checkedA: "วรเชษฐ์ อินทรประเสริฐ",
  checkedE: "ธีรวัฒน์ บุญมา",
  approved: "ประเสริฐ อุดมสุข",
};

const slashDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
};

export function frame(b: Builder, spec: HouseModel, meta: SheetMeta, level: string) {
  const P = (x: number, y: number): Pt => [b.mm(x), b.mm(y)];
  const T = (x: number, y: number, h: number, s: string, o: Parameters<Builder["text"]>[4] = {}) => b.text("TITLE", P(x, y), b.mm(h), s, o);
  const L = (x0: number, y0: number, x1: number, y1: number, w = 0.25) => b.line("TITLE", P(x0, y0), P(x1, y1), { w });

  // paper edge, border and title column
  b.rect("TITLE", 0, 0, b.mm(PAPER_W), b.mm(PAPER_H), { w: 0.09 });
  b.rect("TITLE", b.mm(20), b.mm(10), b.mm(410), b.mm(287), { w: 0.7 });
  L(328, 10, 328, 287, 0.5);
  // centring marks
  L(210, 0, 210, 5, 0.18);
  L(210, 292, 210, 297, 0.18);
  L(0, 148.5, 5, 148.5, 0.18);
  L(415, 148.5, 420, 148.5, 0.18);

  // company
  b.pline(
    "TITLE",
    [P(331, 274), P(336, 279), P(341, 274), P(341, 268), P(331, 268)],
    true,
    { w: 0.35 },
  );
  L(334.5, 268, 334.5, 272, 0.25);
  L(334.5, 272, 337.5, 272, 0.25);
  L(337.5, 272, 337.5, 268, 0.25);
  T(343.5, 275.5, 2.1, COMPANY_INFO.name, { bold: true });
  T(343.5, 271.4, 1.45, COMPANY_INFO.nameEn);
  const addr = COMPANY_INFO.address;
  const cut = addr.indexOf(" เขต");
  T(331, 264, 1.3, cut > 0 ? addr.slice(0, cut) : addr);
  if (cut > 0) T(331, 261.2, 1.3, addr.slice(cut + 1));
  T(331, 258.2, 1.3, `โทร ${COMPANY_INFO.phone} · สายด่วน ${COMPANY_INFO.hotline}`);
  L(328, 255, 410, 255);

  // project
  T(331, 251.6, 1.2, "โครงการ / PROJECT");
  T(331, 247, 2.0, spec.nameTh, { bold: true });
  T(331, 243, 1.5, `แบบบ้าน ${spec.code} ${spec.name}`);
  T(331, 239.6, 1.3, `${MODEL_TYPE_LABEL[spec.type]} · ${spec.floors} ชั้น · พื้นที่ใช้สอย ${spec.area.toLocaleString()} ตร.ม.`);
  T(331, 236.4, 1.3, `ขนาดที่ดินแนะนำ ${spec.land} · สไตล์ ${spec.style}`);
  L(328, 234, 410, 234);
  T(331, NOTES.top - 0.8, 1.2, "หมายเหตุ / NOTES");

  // people
  L(328, 151, 410, 151);
  const rows: [string, string][] = [
    ["ออกแบบ / DESIGNED", PEOPLE.designed],
    ["เขียนแบบ / DRAWN", PEOPLE.drawn],
    ["ตรวจสอบ / CHECKED", meta.disc === "E" || meta.disc === "P" || meta.disc === "M" ? PEOPLE.checkedE : PEOPLE.checkedA],
    ["อนุมัติ / APPROVED", PEOPLE.approved],
  ];
  rows.forEach(([k, v], i) => {
    const y = 147.6 - i * 6.6;
    T(331, y, 1.15, k);
    T(331, y - 3.3, 1.5, v);
    b.line("TITLE", P(372, y - 3.6), P(407, y - 3.6), { w: 0.09, lt: "DASHED" });
  });
  L(328, 123, 410, 123);

  // revisions
  T(331, 119.6, 1.2, "ประวัติการแก้ไข / REVISIONS");
  const ry = 117;
  L(328, ry, 410, ry, 0.18);
  T(331, ry - 2.9, 1.2, "Rev", { bold: true });
  T(338, ry - 2.9, 1.2, "วันที่", { bold: true });
  T(354, ry - 2.9, 1.2, "รายละเอียด", { bold: true });
  REVISIONS.forEach((r, i) => {
    const y = ry - 4 - i * 4;
    L(328, y, 410, y, 0.09);
    T(332, y - 2.9, 1.3, String(r.rev), { mono: true });
    T(338, y - 2.9, 1.3, slashDate(r.date), { mono: true });
    T(354, y - 2.9, 1.2, r.text);
  });
  L(336, ry, 336, ry - 16, 0.09);
  L(352, ry, 352, ry - 16, 0.09);
  L(328, 101, 410, 101);

  // title
  const d = DISC_BY_KEY[meta.disc];
  T(331, 97.4, 1.25, `${d.th} / ${d.en.toUpperCase()}`);
  T(331, 90, 3.3, meta.titleTh, { bold: true });
  T(331, 85, 1.75, meta.titleEn.toUpperCase());
  T(331, 80.8, 1.3, level);
  L(328, 77, 410, 77);

  // scale and date
  L(369, 77, 369, 63, 0.18);
  T(331, 74, 1.15, "มาตราส่วน / SCALE");
  T(331, 66.5, 2.4, meta.nts ? "ไม่มีมาตราส่วน" : `1:${meta.scale}`, { mono: !meta.nts });
  T(371, 74, 1.15, "วันที่ / DATE");
  T(371, 66.5, 2.4, slashDate(REVISIONS[REVISIONS.length - 1].date), { mono: true });
  L(328, 63, 410, 63);
  T(331, 60, 1.15, "รหัสแบบ / DWG CODE");
  T(331, 54.6, 1.9, meta.code, { mono: true });
  L(328, 51, 410, 51);

  // sheet number
  T(331, 47.8, 1.15, "แผ่นที่ / SHEET NO.");
  T(369, 27, 9, meta.id, { al: "c", mono: true, bold: true });
  T(369, 16, 1.6, `แผ่นที่ ${meta.index} / ${meta.total} · กระดาษ A3`, { al: "c" });
}

/** Title label under the drawing with a scale bar on the left */
export function drawingTitle(b: Builder, meta: SheetMeta, n: number) {
  const P = (x: number, y: number): Pt => [b.mm(x), b.mm(y)];
  const cx = (CA.x0 + CA.x1) / 2 + 10;
  const r = 4.2;
  const bx = cx - 52;
  b.circle("A-ANNO", P(bx, 19), b.mm(r), { w: 0.35 });
  b.line("A-ANNO", P(bx - r, 19), P(bx + r, 19), { w: 0.18 });
  b.text("A-ANNO", P(bx, 20.2), b.mm(2.4), String(n), { al: "c", mono: true });
  b.text("A-ANNO", P(bx, 15.3), b.mm(1.5), meta.id, { al: "c", mono: true });
  b.text("A-ANNO", P(bx + 7, 20), b.mm(4), meta.titleTh, { bold: true });
  b.line("A-ANNO", P(bx + 7, 18.6), P(bx + 100, 18.6), { w: 0.5 });
  b.line("A-ANNO", P(bx + 7, 17.8), P(bx + 100, 17.8), { w: 0.13 });
  b.text("A-ANNO", P(bx + 7, 14), b.mm(2), meta.titleEn.toUpperCase());
  b.text("A-ANNO", P(bx + 100, 14), b.mm(2), meta.nts ? "ไม่มีมาตราส่วน" : `มาตราส่วน 1:${meta.scale}`, { al: "r" });

  if (meta.nts) return;
  // scale bar: five segments of a round length
  const targetMm = 40;
  const cand = [1, 2, 5, 10, 20, 25, 50];
  const len = cand.find((c) => (c * 1000) / meta.scale >= targetMm * 0.8) ?? 50;
  const segMm = (len * 1000) / meta.scale / 5;
  const x0 = CA.x0 + 2;
  for (let i = 0; i < 5; i++) {
    const xa = x0 + i * segMm;
    b.rect("A-ANNO", b.mm(xa), b.mm(16), b.mm(xa + segMm), b.mm(17.6), { w: 0.18 });
    if (i % 2 === 0) b.hatchRect("A-ANNO", b.mm(xa), b.mm(16), b.mm(xa + segMm), b.mm(17.6), "solid");
  }
  b.text("A-ANNO", P(x0, 12.6), b.mm(1.6), "0", { al: "c", mono: true });
  b.text("A-ANNO", P(x0 + segMm * 5, 12.6), b.mm(1.6), `${len} ม.`, { al: "c", mono: true });
}
