import {
  daysBetween,
  getProject,
  inspections,
  maintenance,
  monthlySeries,
  projects,
  REPAIR_STATUS_LABEL,
  repairs,
  SEVERITY_LABEL,
  slaText,
  SYSTEM_LABEL,
  thDate,
  TODAY,
  type SystemKey,
} from "@/lib/data";
import type { BarDatum, HBarDatum } from "./chart";

export type ReportKey = "progress" | "quality" | "repairs" | "maintenance" | "warranty" | "sales";
export type PeriodKey = "3m" | "6m" | "12m" | "24m" | "all";

export const PERIODS: { key: PeriodKey; label: string; months: number }[] = [
  { key: "3m", label: "3 เดือน", months: 3 },
  { key: "6m", label: "6 เดือน", months: 6 },
  { key: "12m", label: "12 เดือน", months: 12 },
  { key: "24m", label: "24 เดือน", months: 24 },
  { key: "all", label: "ทั้งหมด", months: 132 },
];

export const CATALOGUE: { key: ReportKey; title: string; desc: string }[] = [
  { key: "progress", title: "ความคืบหน้าโครงการ", desc: "ความคืบหน้าจริงเทียบแผน แยกรายโครงการ พร้อมงวดงานปัจจุบันและวันกำหนดเสร็จ" },
  { key: "quality", title: "คุณภาพงานตรวจ", desc: "ผลการตรวจงานแต่ละงวด อัตราผ่าน คะแนนเฉลี่ย และรายการที่ไม่ผ่าน" },
  { key: "repairs", title: "แจ้งซ่อมและ SLA", desc: "แจ้งซ่อมแยกตามระบบ สถานะ อายุงาน และการปิดงานภายในกำหนด SLA" },
  { key: "maintenance", title: "บำรุงรักษา", desc: "แผนบำรุงรักษาตามรอบ งานที่เลยกำหนด และงานที่ต้องนัดลูกค้า" },
  { key: "warranty", title: "ประกันและบ้านที่ส่งมอบ", desc: "บ้านที่ส่งมอบแล้ว ระยะประกันคงเหลือ และงานซ่อมในประกัน" },
  { key: "sales", title: "ยอดขายและ Backlog", desc: "มูลค่าสัญญารายเดือน จำนวนสัญญา การส่งมอบ และมูลค่างานในมือ" },
];

export type Cell = string | number;
export type Report = {
  summary: { label: string; value: string; note?: string }[];
  chartTitle: string;
  bars?: { data: BarDatum[]; unit: string; baseLabel: string; hiLabel?: string };
  hbars?: { data: HBarDatum[]; note: string };
  columns: string[];
  align?: ("l" | "r")[];
  rows: Cell[][];
  empty: string;
};

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function periodStart(p: PeriodKey) {
  const months = PERIODS.find((x) => x.key === p)!.months;
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - months, d)).toISOString().slice(0, 10);
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
const pname = (id: string) => getProject(id)?.name ?? id;
const SYSTEMS = Object.keys(SYSTEM_LABEL) as SystemKey[];

function progress(p: PeriodKey): Report {
  const from = periodStart(p);
  const list = projects
    .filter((x) => (x.status === "building" || x.status === "handover") && x.finish >= from)
    .sort((a, b) => a.actual - a.plan - (b.actual - b.plan));
  const behind = list.filter((x) => x.plan - x.actual >= 3);
  const avgA = list.reduce((s, x) => s + x.actual, 0) / (list.length || 1);
  const avgP = list.reduce((s, x) => s + x.plan, 0) / (list.length || 1);
  return {
    summary: [
      { label: "โครงการที่ก่อสร้าง", value: `${list.length}`, note: "สถานะก่อสร้างและตรวจรับงาน" },
      { label: "ความคืบหน้าเฉลี่ย", value: `${avgA.toFixed(1)}%`, note: `แผน ${avgP.toFixed(1)}%` },
      { label: "ช้ากว่าแผนเกิน 3%", value: `${behind.length}`, note: `จาก ${list.length} โครงการ` },
      { label: "มูลค่ารวม", value: `฿${list.reduce((s, x) => s + x.value, 0).toFixed(1)} ล้าน` },
    ],
    chartTitle: "ความคืบหน้าจริงเทียบแผน",
    hbars: {
      note: "แถบ = จริง · ขีด = แผน · สีส้ม = ช้ากว่าแผนเกิน 3%",
      data: list.map((x) => ({ label: x.name, sub: `${x.id} · ${x.phase}`, value: x.actual, mark: x.plan, hi: x.plan - x.actual >= 3 })),
    },
    columns: ["รหัส", "โครงการ", "แบบบ้าน", "PM", "งวดงาน", "จริง %", "แผน %", "ส่วนต่าง", "กำหนดเสร็จ", "เหลือ (วัน)"],
    align: ["l", "l", "l", "l", "l", "r", "r", "r", "l", "r"],
    rows: list.map((x) => [x.id, x.name, x.model, x.pm, x.phase, x.actual, x.plan, (x.actual - x.plan > 0 ? "+" : "") + (x.actual - x.plan), thDate(x.finish), daysBetween(TODAY, x.finish)]),
    empty: "ไม่มีโครงการที่กำลังก่อสร้างในช่วงนี้",
  };
}

function quality(p: PeriodKey): Report {
  const from = periodStart(p);
  const done = inspections.filter((i) => i.result !== "scheduled" && i.date >= from).sort((a, b) => b.date.localeCompare(a.date));
  const scheduled = inspections.filter((i) => i.result === "scheduled");
  const pass = done.filter((i) => i.result === "pass");
  const scored = done.filter((i) => i.score !== undefined);
  const phases = [...new Set(inspections.map((i) => i.phase))];
  return {
    summary: [
      { label: "ตรวจแล้ว", value: `${done.length}`, note: "ครั้งในช่วงที่เลือก" },
      { label: "อัตราผ่าน", value: pct(pass.length, done.length), note: `ไม่ผ่าน ${done.length - pass.length} ครั้ง` },
      { label: "คะแนนเฉลี่ย", value: scored.length ? (scored.reduce((s, i) => s + (i.score ?? 0), 0) / scored.length).toFixed(0) : "–", note: "เต็ม 100" },
      { label: "นัดตรวจที่จะถึง", value: `${scheduled.length}`, note: "รายการ" },
    ],
    chartTitle: "ผลการตรวจแยกตามงวดงาน",
    bars: {
      unit: "ครั้ง",
      baseLabel: "ตรวจทั้งหมด",
      hiLabel: "ไม่ผ่าน",
      data: phases.map((ph) => {
        const l = done.filter((i) => i.phase === ph);
        return { label: ph.length > 10 ? ph.slice(0, 9) + "…" : ph, value: l.length, hi: l.filter((i) => i.result === "fail").length, note: ph };
      }),
    },
    columns: ["เลขที่", "รายการตรวจ", "โครงการ", "ผู้ตรวจ", "วันที่", "งวดงาน", "คะแนน", "ผล"],
    align: ["l", "l", "l", "l", "l", "l", "r", "l"],
    rows: done.map((i) => [i.id, i.title, `${i.projectId} ${pname(i.projectId)}`, i.inspector, thDate(i.date), i.phase, i.score ?? "–", i.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"]),
    empty: "ไม่มีผลการตรวจในช่วงนี้",
  };
}

function repairsReport(p: PeriodKey): Report {
  const from = periodStart(p);
  const list = repairs.filter((r) => r.reported >= from).sort((a, b) => a.slaHours - b.slaHours);
  const open = list.filter((r) => r.status !== "closed");
  const over = open.filter((r) => r.slaHours < 0);
  const avgAge = open.reduce((s, r) => s + daysBetween(r.reported, TODAY), 0) / (open.length || 1);
  return {
    summary: [
      { label: "แจ้งซ่อมในช่วงนี้", value: `${list.length}`, note: `เปิดอยู่ ${open.length} เรื่อง` },
      { label: "เกิน SLA", value: `${over.length}`, note: "เรื่องที่ยังไม่ปิด" },
      { label: "อยู่ในกำหนด SLA", value: pct(list.length - over.length, list.length) },
      { label: "อายุงานเฉลี่ย", value: `${avgAge.toFixed(1)} วัน`, note: "เฉพาะเรื่องที่เปิดอยู่" },
    ],
    chartTitle: "แจ้งซ่อมแยกตามระบบ",
    bars: {
      unit: "เรื่อง",
      baseLabel: "แจ้งซ่อม",
      hiLabel: "เกิน SLA",
      data: SYSTEMS.map((s) => {
        const l = list.filter((r) => r.system === s);
        return { label: SYSTEM_LABEL[s].split(" ")[0], value: l.length, hi: l.filter((r) => r.status !== "closed" && r.slaHours < 0).length, note: SYSTEM_LABEL[s] };
      }),
    },
    columns: ["เลขที่", "อาการ", "อุปกรณ์", "โครงการ", "ระบบ", "ความรุนแรง", "สถานะ", "แจ้งเมื่อ", "อายุ (วัน)", "SLA"],
    align: ["l", "l", "l", "l", "l", "l", "l", "l", "r", "l"],
    rows: list.map((r) => [
      r.id,
      r.title,
      r.asset,
      `${r.projectId} ${pname(r.projectId)}`,
      SYSTEM_LABEL[r.system],
      SEVERITY_LABEL[r.severity],
      REPAIR_STATUS_LABEL[r.status],
      thDate(r.reported),
      daysBetween(r.reported, TODAY),
      r.status === "closed" ? "ปิดแล้ว" : slaText(r.slaHours),
    ]),
    empty: "ไม่มีแจ้งซ่อมในช่วงนี้",
  };
}

const STATE_LABEL = { overdue: "เลยกำหนด", soon: "ใกล้ถึงกำหนด", planned: "ตามแผน", done: "เสร็จแล้ว" } as const;

function maintenanceReport(p: PeriodKey): Report {
  const from = periodStart(p);
  const list = maintenance.filter((m) => m.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const overdue = list.filter((m) => m.state === "overdue");
  return {
    summary: [
      { label: "งานบำรุงรักษา", value: `${list.length}`, note: "รวมงานที่นัดไว้ล่วงหน้า" },
      { label: "เลยกำหนด", value: `${overdue.length}`, note: overdue.length ? `นานสุด ${Math.max(...overdue.map((m) => daysBetween(m.date, TODAY)))} วัน` : "ไม่มี" },
      { label: "ใกล้ถึงกำหนด", value: `${list.filter((m) => m.state === "soon").length}`, note: "ต้องนัดลูกค้า" },
      { label: "เสร็จแล้ว", value: pct(list.filter((m) => m.state === "done").length, list.length) },
    ],
    chartTitle: "งานบำรุงรักษาแยกตามระบบ",
    bars: {
      unit: "รายการ",
      baseLabel: "งานทั้งหมด",
      hiLabel: "เลยกำหนด",
      data: SYSTEMS.map((s) => {
        const l = list.filter((m) => m.system === s);
        return { label: SYSTEM_LABEL[s].split(" ")[0], value: l.length, hi: l.filter((m) => m.state === "overdue").length, note: SYSTEM_LABEL[s] };
      }),
    },
    columns: ["เลขที่", "งาน", "โครงการ", "เจ้าของบ้าน", "ระบบ", "รอบ", "กำหนด", "สถานะ", "เลยกำหนด (วัน)"],
    align: ["l", "l", "l", "l", "l", "l", "l", "l", "r"],
    rows: list.map((m) => [m.id, m.task, `${m.projectId} ${pname(m.projectId)}`, m.owner, SYSTEM_LABEL[m.system], m.cycle, thDate(m.date), STATE_LABEL[m.state], m.state === "overdue" ? daysBetween(m.date, TODAY) : "–"]),
    empty: "ไม่มีงานบำรุงรักษาในช่วงนี้",
  };
}

function warranty(p: PeriodKey): Report {
  const from = periodStart(p);
  const delivered = projects.filter((x) => x.handedOver);
  const list = delivered.filter((x) => x.handedOver! >= from).sort((a, b) => b.handedOver!.localeCompare(a.handedOver!));
  const inWarranty = delivered.filter((x) => x.warrantyUntil && x.warrantyUntil >= TODAY);
  const expiring = inWarranty.filter((x) => daysBetween(TODAY, x.warrantyUntil!) <= 180);
  const years = [...new Set(delivered.map((x) => x.handedOver!.slice(0, 4)))].sort();
  const openFor = (id: string) => repairs.filter((r) => r.projectId === id && r.status !== "closed").length;
  return {
    summary: [
      { label: "ส่งมอบในช่วงนี้", value: `${list.length}`, note: `ทั้งหมด ${delivered.length} หลัง` },
      { label: "อยู่ในระยะประกัน", value: `${inWarranty.length}`, note: "หลัง" },
      { label: "ประกันหมดใน 180 วัน", value: `${expiring.length}`, note: "ควรนัดตรวจบ้านก่อนหมดประกัน" },
      { label: "งานซ่อมในประกันที่เปิดอยู่", value: `${repairs.filter((r) => r.source === "warranty" && r.status !== "closed").length}`, note: "เรื่อง" },
    ],
    chartTitle: "บ้านที่ส่งมอบรายปี",
    bars: {
      unit: "หลัง",
      baseLabel: "ส่งมอบ",
      hiLabel: "ยังอยู่ในประกัน",
      data: years.map((y) => {
        const l = delivered.filter((x) => x.handedOver!.startsWith(y));
        return { label: String(Number(y) + 543), value: l.length, hi: l.filter((x) => x.warrantyUntil! >= TODAY).length };
      }),
    },
    columns: ["รหัส", "โครงการ", "แบบบ้าน", "จังหวัด", "ส่งมอบ", "ประกันถึง", "ประกันเหลือ (วัน)", "แจ้งซ่อมเปิด"],
    align: ["l", "l", "l", "l", "l", "l", "r", "r"],
    rows: list.map((x) => {
      const left = daysBetween(TODAY, x.warrantyUntil!);
      return [x.id, x.name, x.model, x.province, thDate(x.handedOver!), thDate(x.warrantyUntil!), left >= 0 ? left : "หมดแล้ว", openFor(x.id)];
    }),
    empty: "ไม่มีบ้านที่ส่งมอบในช่วงนี้",
  };
}

function sales(p: PeriodKey): Report {
  const months = Math.min(PERIODS.find((x) => x.key === p)!.months, 132);
  const series = monthlySeries(months);
  const total = series.reduce((s, m) => s + m.contract, 0);
  const n = series.reduce((s, m) => s + m.contracts, 0);
  const open = projects.filter((x) => x.status !== "delivered");
  const backlog = open.reduce((s, x) => s + x.value * (1 - x.actual / 100), 0);
  const yearly = months > 36;
  const data: BarDatum[] = yearly
    ? [...new Set(series.map((m) => m.key.slice(0, 4)))].map((y) => {
        const l = series.filter((m) => m.key.startsWith(y));
        return { label: String(Number(y) + 543), value: Math.round(l.reduce((s, m) => s + m.contract, 0) * 10) / 10, hi: y === TODAY.slice(0, 4) ? Math.round(l.reduce((s, m) => s + m.contract, 0) * 10) / 10 : 0, note: `${l.reduce((s, m) => s + m.contracts, 0)} สัญญา` };
      })
    : series.map((m) => ({ label: m.label, value: m.contract, hi: m.key === TODAY.slice(0, 7) ? m.contract : 0, note: `${m.contracts} สัญญา · ส่งมอบ ${m.handovers} หลัง` }));
  return {
    summary: [
      { label: "มูลค่าสัญญา", value: `฿${total.toFixed(1)} ล้าน`, note: `${n} สัญญา` },
      { label: "เฉลี่ยต่อสัญญา", value: n ? `฿${(total / n).toFixed(2)} ล้าน` : "–" },
      { label: "ส่งมอบ", value: `${series.reduce((s, m) => s + m.handovers, 0)} หลัง` },
      { label: "มูลค่างานในมือ Backlog", value: `฿${backlog.toFixed(1)} ล้าน`, note: `${open.length} โครงการที่ยังไม่ส่งมอบ` },
    ],
    chartTitle: yearly ? "มูลค่าสัญญารายปี" : "มูลค่าสัญญารายเดือน",
    bars: { unit: "ล้านบาท", baseLabel: "มูลค่าสัญญา", hiLabel: yearly ? "ปีปัจจุบัน" : "เดือนปัจจุบัน", data },
    columns: ["เดือน", "จำนวนสัญญา", "มูลค่าสัญญา (ล้านบาท)", "ส่งมอบ (หลัง)"],
    align: ["l", "r", "r", "r"],
    rows: series
      .filter((m) => !yearly || m.contracts || m.handovers)
      .slice()
      .reverse()
      .map((m) => {
        const [y, mo] = m.key.split("-").map(Number);
        return [`${TH_MONTH[mo - 1]} ${y + 543}`, m.contracts, m.contract.toFixed(1), m.handovers];
      }),
    empty: "ไม่มีสัญญาในช่วงนี้",
  };
}

export function buildReport(key: ReportKey, p: PeriodKey): Report {
  switch (key) {
    case "progress":
      return progress(p);
    case "quality":
      return quality(p);
    case "repairs":
      return repairsReport(p);
    case "maintenance":
      return maintenanceReport(p);
    case "warranty":
      return warranty(p);
    case "sales":
      return sales(p);
  }
}

export function toCsv(columns: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [columns, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
