// Notification feeds for safety (module "safety") and labour records (module "hr").
import { useMemo } from "react";
import { getProject, TODAY } from "../data";
import { registerNotes, type Note } from "../notifications";
import { employees, useRuns } from "../hr/store";
import { advances, migrantDocs, pieceClaims, pieceContracts, trainings } from "../hr/labour-store";
import { CERT_LABEL, CLAIM_STATUS_LABEL, MIGRANT_DOC_LABEL } from "../hr/labour-types";
import { advanceBalance } from "../hr/labour";
import { incidentFollowUp, permitOverdue } from "./calc";
import { dayDiff, dueText, useNow } from "./now";
import { incidents, permits, safetyInspections, useSiteSafety } from "./store";
import { INC_LABEL, JP_LABEL, PERMIT_SHORT } from "./types";

const site = (id?: string) => (id ? (getProject(id)?.name ?? id) : "");

function useSafetyNotes(): Note[] {
  const ptw = permits.use();
  const inc = incidents.use();
  const insp = safetyInspections.use();
  const sites = useSiteSafety();
  const now = useNow();
  return useMemo(() => {
    const out: Note[] = [];
    for (const p of ptw) {
      if (permitOverdue(p, now))
        out.push({ id: `ptw-over-${p.id}`, cat: "safety", tone: "neg", date: p.validTo.slice(0, 10), title: `ใบอนุญาตเกินเวลาที่อนุญาต ยังไม่ปิดงาน · ${PERMIT_SHORT[p.type]}`, sub: `${p.id} · ${p.title} · ${site(p.projectId)} · หมดเวลา ${p.validTo.slice(11)} น.`, href: `/safety?tab=permits&q=${p.id}` });
      else if (p.status === "requested" || p.status === "issued")
        out.push({ id: `ptw-wait-${p.id}-${p.status}`, cat: "safety", tone: "accent", date: p.validFrom.slice(0, 10), title: `ใบอนุญาตทำงาน${p.status === "requested" ? "รอผู้ออกใบลงนาม" : "รออนุมัติ"} · ${PERMIT_SHORT[p.type]}`, sub: `${p.id} · ${p.title} · ${site(p.projectId)}`, href: `/safety?tab=permits&q=${p.id}` });
    }
    for (const i of inc) {
      const f = incidentFollowUp(i, TODAY);
      if (!f.needs) continue;
      const bits = [f.overdue ? `มาตรการเลยกำหนด ${f.overdue}` : f.open ? `มาตรการค้าง ${f.open}` : "", f.notifyLeft ? `ยังไม่แจ้ง ${f.notifyLeft} รายการ` : "", f.kt16Missing ? "ยังไม่บันทึก กท.16" : ""].filter(Boolean);
      out.push({ id: `inc-${i.id}`, cat: "safety", tone: f.overdue || f.kt16Missing ? "neg" : "warn", date: i.date, title: `อุบัติเหตุรอติดตาม · ${INC_LABEL[i.cls]}`, sub: `${i.id} · ${site(i.projectId)} · ${bits.join(" · ")}`, href: `/safety?tab=incidents&q=${i.id}` });
    }
    for (const s of sites) {
      if (s.check.ok) continue;
      const miss = s.check.needs.filter((n) => !n.ok).map((n) => JP_LABEL[n.level]);
      out.push({ id: `jp-${s.projectId}-${miss.join("-")}`, cat: "safety", tone: "neg", date: TODAY, title: `จป. ไม่ครบตามจำนวนลูกจ้าง · ${site(s.projectId)}`, sub: `${s.headcount} คน ต้องมี ${miss.join(", ")}`, href: "/safety?tab=kpi" });
    }
    for (const x of insp) {
      if (x.closed || !x.followUpDue) continue;
      const d = dayDiff(x.followUpDue);
      if (d <= 1) out.push({ id: `sin-${x.id}`, cat: "safety", tone: d < 0 ? "neg" : "warn", date: x.followUpDue, title: `ผลตรวจความปลอดภัยรอแก้ไข · ${x.scaffoldNo ?? x.location}`, sub: `${x.id} · ${site(x.projectId)} · ${dueText(d)}`, href: `/safety?tab=inspections&q=${x.id}` });
    }
    return out;
  }, [ptw, inc, insp, sites, now]);
}

function useLabourNotes(): Note[] {
  const emps = employees.use();
  const trn = trainings.use();
  const docs = migrantDocs.use();
  const claims = pieceClaims.use();
  const contracts = pieceContracts.use();
  const adv = advances.use();
  const runs = useRuns();
  return useMemo(() => {
    const out: Note[] = [];
    const active = new Map(emps.filter((e) => e.status !== "resigned").map((e) => [e.id, e]));
    for (const t of trn) {
      const e = active.get(t.employeeId);
      if (!e || !t.expiry) continue;
      // only the latest record of a certificate per person counts
      if (trn.some((o) => o.employeeId === t.employeeId && o.cert === t.cert && (o.expiry ?? "9999") > t.expiry!)) continue;
      const d = dayDiff(t.expiry);
      if (d <= 30 && d >= -60) out.push({ id: `trn-${t.id}-${t.expiry}`, cat: "labour", tone: d < 0 ? "neg" : "warn", date: t.expiry, title: `${d < 0 ? "ใบรับรองหมดอายุ" : "ใบรับรองใกล้หมดอายุ"} · ${CERT_LABEL[t.cert]}`, sub: `${e.name} · ${e.projectId ?? ""} · ${dueText(d)}`, href: `/hr/skills?q=${e.id}` });
    }
    for (const m of docs) {
      const e = active.get(m.employeeId);
      if (!e) continue;
      const d = dayDiff(m.expiry);
      if (d <= 30 && d >= -60) out.push({ id: `mgd-${m.id}-${m.expiry}`, cat: "labour", tone: d < 0 ? "neg" : "warn", date: m.expiry, title: `${m.kind === "report_90" ? "ครบกำหนดรายงานตัว 90 วัน" : `${MIGRANT_DOC_LABEL[m.kind]}${d < 0 ? "หมดอายุ" : "ใกล้หมดอายุ"}`} · ${e.name}`, sub: `${e.id} · ${e.projectId ?? ""} · ${dueText(d)}`, href: `/hr/skills?tab=docs&q=${e.id}` });
    }
    for (const c of claims) {
      if (c.status !== "submitted" && c.status !== "foreman") continue;
      const k = contracts.find((x) => x.id === c.contractId);
      out.push({ id: `prq-${c.id}-${c.status}`, cat: "labour", tone: "accent", date: c.periodTo, title: `ค่าแรงเหมา${CLAIM_STATUS_LABEL[c.status]} · ${k?.trade ?? ""}`, sub: `${c.id} · ${k?.crewName ?? ""} · ${c.qty} ${k?.unit ?? ""} · ${site(c.projectId)}`, href: `/hr/crew?q=${c.id}` });
    }
    for (const a of adv) {
      const who = emps.find((e) => e.id === a.employeeId)?.name ?? a.employeeId;
      if (a.status === "pending") out.push({ id: `adv-req-${a.id}`, cat: "labour", tone: "accent", date: a.date, title: `ขอเบิกเงินล่วงหน้ารออนุมัติ · ${who}`, sub: `${a.id} · ${a.amount.toLocaleString("th-TH")} บาท · ${a.reason}`, href: "/hr/crew?tab=advances" });
      else if (a.status === "approved") {
        const b = advanceBalance(a, runs, claims);
        if (b.outstanding > 0) out.push({ id: `adv-out-${a.id}`, cat: "labour", tone: "neutral", date: a.date, title: `เงินเบิกล่วงหน้าคงค้าง · ${who}`, sub: `${a.id} · ค้าง ${b.outstanding.toLocaleString("th-TH")} จาก ${a.amount.toLocaleString("th-TH")} บาท`, href: "/hr/crew?tab=advances" });
      }
    }
    return out;
  }, [emps, trn, docs, claims, contracts, adv, runs]);
}

registerNotes({ cat: "safety", label: "ความปลอดภัย", module: "safety", hint: "ใบอนุญาตทำงานเกินเวลา อุบัติเหตุรอติดตาม หน้างานที่ จป. ไม่ครบ", use: useSafetyNotes });
registerNotes({ cat: "labour", label: "แรงงาน", module: "hr", hint: "ใบรับรอง/เอกสารแรงงานต่างด้าวใกล้หมด ค่าแรงเหมารออนุมัติ เงินเบิกล่วงหน้าคงค้าง", use: useLabourNotes });
