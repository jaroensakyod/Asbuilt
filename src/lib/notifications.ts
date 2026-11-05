"use client";

// One feed of things that need attention, built from every module's data.
// The bell in the top bar and the /notifications page both read it.
// Rules per category can be switched off and their lead times changed in /settings.

import { useMemo } from "react";
import { TODAY, getProject, projects, slaText } from "./data";
import { createCollection } from "./collection";
import { createLocalStore } from "./projects-store";
import { canView, type ModuleKey } from "./permissions";
import { useMe } from "./use-me";
import { useInspections, useMaintenance, useRepairs, maintState } from "./ops-store";
import { installments, supplierBills, baht0 } from "./biz";
import { purchaseOrders, purchaseRequests, poTotals } from "./procurement/store";
import { quotes, quoteTotals, validUntil } from "./sales/crm";
import { employees, leaves } from "./hr/store";
import { LEAVE_LABEL } from "./hr/types";

export type CoreCat = "repairs" | "inspections" | "maintenance" | "warranty" | "purchasing" | "payables" | "receivables" | "sales" | "hr";
/** core categories plus any registered by later modules (registerNotes) */
export type NoteCat = string;
export type NoteTone = "neg" | "warn" | "accent" | "neutral";

type CatMeta = { label: string; module: ModuleKey; hint: string };
const CORE_META: Record<CoreCat, CatMeta> = {
  repairs: { label: "แจ้งซ่อม", module: "repairs", hint: "งานที่เกินหรือใกล้เกิน SLA" },
  inspections: { label: "การตรวจสอบ", module: "inspections", hint: "นัดตรวจวันนี้และพรุ่งนี้ ผลตรวจไม่ผ่าน" },
  maintenance: { label: "บำรุงรักษา", module: "maintenance", hint: "รอบบำรุงรักษาที่เลยหรือใกล้กำหนด" },
  warranty: { label: "ประกันบ้าน", module: "projects", hint: "บ้านที่ประกันใกล้หมด" },
  purchasing: { label: "จัดซื้อ", module: "purchasing", hint: "ใบขอซื้อรอดำเนินการ ใบสั่งซื้อรออนุมัติ" },
  payables: { label: "เจ้าหนี้", module: "accounting", hint: "บิลผู้ขายที่ใกล้หรือเลยกำหนดจ่าย" },
  receivables: { label: "ลูกหนี้", module: "accounting", hint: "งวดเงินลูกค้าที่ค้างหรือใกล้ถึงกำหนด" },
  sales: { label: "การขาย", module: "sales", hint: "ใบเสนอราคาที่ใกล้หมดอายุ" },
  hr: { label: "บุคคล", module: "hr", hint: "ใบลารออนุมัติ ใบอนุญาตทำงานใกล้หมด" },
};
const CORE_CATS = Object.keys(CORE_META) as CoreCat[];

// ---------- plug-in sources ----------
// A module adds its own feed at import time (before first render, so hook order is stable):
//   registerNotes({ cat: "rfi", label: "RFI", module: "engineering", hint: "RFI ที่ใกล้ครบกำหนดตอบ", use: useRfiNotes });
// `use` is a React hook returning Note[] (already filtered to what matters); the user's
// category switch and role permission are applied here.
export type NoteSource = CatMeta & { cat: string; use: () => Note[] };
const sources: NoteSource[] = [];
export function registerNotes(src: NoteSource) {
  if (!sources.some((x) => x.cat === src.cat) && !(src.cat in CORE_META)) sources.push(src);
}
export const allCats = (): NoteCat[] => [...CORE_CATS, ...sources.map((x) => x.cat)];
export const catMeta = (c: NoteCat): CatMeta => (CORE_META as Record<string, CatMeta>)[c] ?? sources.find((x) => x.cat === c) ?? { label: c, module: "projects", hint: "" };
/** @deprecated use allCats() / catMeta() */
export const CAT_META = new Proxy({} as Record<NoteCat, CatMeta>, { get: (_t, k: string) => catMeta(k) });
/** @deprecated use allCats() */
export const CATS = CORE_CATS as NoteCat[];

export type Note = {
  id: string;
  cat: NoteCat;
  title: string;
  sub: string;
  href: string;
  tone: NoteTone;
  /** ISO date the item is about (due date, appointment); used for sorting and grouping */
  date: string;
};

// ---------- settings ----------

export type NotifySettings = {
  id: "notify";
  off: NoteCat[];
  warrantyDays: number;
  maintDays: number;
  billDays: number;
  installmentDays: number;
  quoteDays: number;
  permitDays: number;
  /** email digest; delivery needs the live backend */
  emailDigest: boolean;
};
export const NOTIFY_DEFAULTS: NotifySettings = {
  id: "notify",
  off: [],
  warrantyDays: 90,
  maintDays: 14,
  billDays: 7,
  installmentDays: 7,
  quoteDays: 7,
  permitDays: 60,
  emailDigest: false,
};
const settingsCol = createCollection<NotifySettings>("notify_settings", []);
export function useNotifySettings(): NotifySettings {
  const rows = settingsCol.use();
  return { ...NOTIFY_DEFAULTS, ...rows.find((r) => r.id === "notify") };
}
export const saveNotifySettings = (s: NotifySettings) => settingsCol.upsert(s);

// ---------- read state (per browser) ----------

const NO_READ: string[] = [];
const readStore = createLocalStore<string[]>("asbuilt.notify.read.v1", NO_READ);
export const useReadIds = () => readStore.use();
export function markRead(ids: string[]) {
  const cur = readStore.get();
  const add = ids.filter((id) => !cur.includes(id));
  if (add.length) readStore.set([...cur, ...add].slice(-2000));
}
export const markUnread = (id: string) => readStore.set(readStore.get().filter((x) => x !== id));

// ---------- feed ----------

const DAY = 86400000;
export const daysFrom = (iso: string) => Math.round((Date.parse(iso) - Date.parse(TODAY)) / DAY);
const plusDays = (n: number) => new Date(Date.parse(TODAY) + n * DAY).toISOString().slice(0, 10);
const dueText = (d: number) => (d < 0 ? `เลยกำหนด ${-d} วัน` : d === 0 ? "ครบกำหนดวันนี้" : `อีก ${d} วัน`);
const projName = (id?: string) => (id ? (getProject(id)?.name ?? id) : "คลังกลาง");

const RANK: Record<NoteTone, number> = { neg: 0, warn: 1, accent: 2, neutral: 3 };

/** Every notification the current user may see, most urgent first. */
export function useNotifications(): Note[] {
  const s = useNotifySettings();
  const me = useMe();
  const repairs = useRepairs();
  const inspections = useInspections();
  const maintenance = useMaintenance();
  const inst = installments.use();
  const bills = supplierBills.use();
  const pos = purchaseOrders.use();
  const prs = purchaseRequests.use();
  const qs = quotes.use();
  const emps = employees.use();
  const lvs = leaves.use();
  // plug-in feeds (registration happens at import time, so this list is stable between renders)
  const extra = sources.map((src) => ({ src, notes: src.use() }));

  const core = useMemo(() => {
    const out: Note[] = [];
    const on = (c: NoteCat) => !s.off.includes(c) && canView(me.role, catMeta(c).module);

    if (on("repairs"))
      for (const r of repairs) {
        if (r.status === "closed") continue;
        if (r.slaHours < 0) out.push({ id: `rep-sla-${r.id}`, cat: "repairs", tone: "neg", date: TODAY, title: `แจ้งซ่อมเกิน SLA · ${r.title}`, sub: `${r.id} · ${r.asset} · ${projName(r.projectId)} · ${slaText(r.slaHours)}`, href: `/repairs?q=${r.id}` });
        else if (r.slaHours <= 24) out.push({ id: `rep-soon-${r.id}`, cat: "repairs", tone: "warn", date: TODAY, title: `ใกล้ครบ SLA · ${r.title}`, sub: `${r.id} · ${projName(r.projectId)} · ${slaText(r.slaHours)}`, href: `/repairs?q=${r.id}` });
      }

    if (on("inspections")) {
      const tomorrow = plusDays(1);
      for (const i of inspections) {
        if (i.result === "scheduled" && (i.date === TODAY || i.date === tomorrow))
          out.push({ id: `ins-${i.id}`, cat: "inspections", tone: i.date === TODAY ? "accent" : "neutral", date: i.date, title: `${i.date === TODAY ? "นัดตรวจวันนี้" : "นัดตรวจพรุ่งนี้"} ${i.time} น. · ${i.title}`, sub: `${i.id} · ${projName(i.projectId)} · ${i.inspector}`, href: `/inspections/${i.id}` });
        else if (i.result === "fail" && daysFrom(i.date) >= -7)
          out.push({ id: `ins-fail-${i.id}`, cat: "inspections", tone: "neg", date: i.date, title: `ผลตรวจไม่ผ่าน · ${i.title}`, sub: `${i.id} · ${projName(i.projectId)} · คะแนน ${i.score ?? "–"}`, href: `/inspections/${i.id}` });
      }
    }

    if (on("maintenance"))
      for (const m of maintenance) {
        const st = maintState(m);
        if (st === "done") continue;
        const d = daysFrom(m.date);
        if (st === "overdue" || d <= s.maintDays)
          out.push({ id: `pm-${m.id}-${m.date}`, cat: "maintenance", tone: st === "overdue" ? "neg" : "warn", date: m.date, title: `${st === "overdue" ? "บำรุงรักษาเลยกำหนด" : "บำรุงรักษาใกล้ถึงกำหนด"} · ${m.task}`, sub: `${m.owner} · ${m.projectId} · ${dueText(d)}`, href: "/maintenance" });
      }

    if (on("warranty"))
      for (const p of projects) {
        if (!p.warrantyUntil) continue;
        const d = daysFrom(p.warrantyUntil);
        if (d >= 0 && d <= s.warrantyDays)
          out.push({ id: `war-${p.id}`, cat: "warranty", tone: d <= 30 ? "warn" : "neutral", date: p.warrantyUntil, title: `ประกันบ้านใกล้หมด · ${p.name}`, sub: `${p.id} · ${p.owner} · ${dueText(d)} · นัดตรวจบ้านก่อนหมดประกัน`, href: `/projects/${p.id}` });
      }

    if (on("purchasing")) {
      for (const po of pos)
        if (po.status === "pending")
          out.push({ id: `po-${po.id}`, cat: "purchasing", tone: "accent", date: po.date, title: `ใบสั่งซื้อรออนุมัติ · ${po.id}`, sub: `${baht0(poTotals(po).total)} · ${projName(po.projectId)}`, href: `/purchasing/${po.id}` });
      for (const pr of prs)
        if (pr.status === "submitted" || pr.status === "rfq")
          out.push({ id: `pr-${pr.id}-${pr.status}`, cat: "purchasing", tone: "neutral", date: pr.lines[0]?.neededBy ?? TODAY, title: `${pr.status === "submitted" ? "ใบขอซื้อรอจัดซื้อ" : "ใบขอซื้อรอเลือกผู้ขาย"} · ${pr.id}`, sub: `${projName(pr.projectId)} · ${pr.lines.length} รายการ`, href: `/purchasing?tab=pr` });
    }

    if (on("payables"))
      for (const b of bills) {
        if (b.status === "paid") continue;
        const d = daysFrom(b.dueDate);
        if (d <= s.billDays)
          out.push({ id: `bill-${b.id}`, cat: "payables", tone: d < 0 ? "neg" : "warn", date: b.dueDate, title: `${d < 0 ? "บิลผู้ขายเลยกำหนดจ่าย" : "บิลผู้ขายใกล้ครบกำหนด"} · ${b.supplierName}`, sub: `${b.id} · ${baht0(b.subtotal + b.vat)} · ${dueText(d)}`, href: "/accounting/purchases" });
      }

    if (on("receivables"))
      for (const i of inst) {
        if (i.status === "paid" || i.status === "scheduled") continue;
        const d = daysFrom(i.dueDate);
        if (i.status === "overdue" || d <= s.installmentDays)
          out.push({ id: `ar-${i.id}`, cat: "receivables", tone: d < 0 || i.status === "overdue" ? "neg" : "warn", date: i.dueDate, title: `${d < 0 || i.status === "overdue" ? "งวดเงินลูกค้าค้างชำระ" : "งวดเงินใกล้ถึงกำหนด"} · ${projName(i.projectId)}`, sub: `งวดที่ ${i.no} · ${baht0(i.amount + i.vat)} · ${dueText(d)}`, href: "/accounting/sales" });
      }

    if (on("sales"))
      for (const q of qs) {
        if (q.status !== "sent") continue;
        const until = validUntil(q);
        const d = daysFrom(until);
        if (d >= 0 && d <= s.quoteDays)
          out.push({ id: `qt-${q.id}`, cat: "sales", tone: "warn", date: until, title: `ใบเสนอราคาใกล้หมดอายุ · ${q.customer.name}`, sub: `${q.id} · ${baht0(quoteTotals(q).total)} · ${dueText(d)}`, href: `/quotes/${q.id}` });
      }

    if (on("hr")) {
      const name = (id: string) => emps.find((e) => e.id === id)?.name ?? id;
      for (const l of lvs)
        if (l.status === "pending")
          out.push({ id: `lv-${l.id}`, cat: "hr", tone: "accent", date: l.from, title: `ใบลารออนุมัติ · ${name(l.employeeId)}`, sub: `${LEAVE_LABEL[l.type]} ${l.days} วัน · ${l.from}`, href: "/hr/attendance" });
      for (const e of emps) {
        if (!e.workPermitExpiry || e.status === "resigned") continue;
        const d = daysFrom(e.workPermitExpiry);
        if (d <= s.permitDays)
          out.push({ id: `wp-${e.id}-${e.workPermitExpiry}`, cat: "hr", tone: d < 0 ? "neg" : "warn", date: e.workPermitExpiry, title: `${d < 0 ? "ใบอนุญาตทำงานหมดอายุ" : "ใบอนุญาตทำงานใกล้หมด"} · ${e.name}`, sub: `${e.id} · ${dueText(d)}`, href: "/hr" });
      }
    }

    return out;
  }, [s, me.role, repairs, inspections, maintenance, inst, bills, pos, prs, qs, emps, lvs]);

  // merge plug-in feeds (cheap; their hooks memoise their own lists)
  const out = [...core];
  for (const { src, notes } of extra) if (!s.off.includes(src.cat) && canView(me.role, src.module)) for (const n of notes) out.push({ ...n, cat: src.cat });
  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone] || a.date.localeCompare(b.date));
}
