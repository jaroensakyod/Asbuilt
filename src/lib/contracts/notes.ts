"use client";

// Notification feed of the contracts module (bell + /notifications). Also runs the one-time sync that
// pushes approved variations / certified subcontract certificates into budgets, installments and bills.

import { useMemo } from "react";
import { budgets } from "@/lib/biz";
import { getProject, TODAY } from "@/lib/data";
import { registerNotes, type Note } from "@/lib/notifications";
import { r2, sum } from "@/lib/accounting/money";
import { addDaysIso, retentionDueDate } from "./calc";
import { retentionHeld } from "./billing";
import { contractTerms, useContractSettings } from "./settings";
import { certCol, scCol, subCol, subRetentionDue, subRetentionHeld, useContractsSync, voCol } from "./store";

const pname = (id: string) => getProject(id)?.name ?? id;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const baht = (n: number) => `${Math.round(n).toLocaleString("th-TH")} บาท`;

function useContractNotes(): Note[] {
  useContractsSync();
  const s = useContractSettings();
  const vos = voCol.use();
  const certs = certCol.use();
  const terms = contractTerms.use();
  const subs = subCol.use();
  const scs = scCol.use();
  const budgetList = budgets.use();
  return useMemo(() => {
    const out: Note[] = [];
    const base = { cat: "contracts" } as const;
    for (const v of vos) {
      if (v.status !== "submitted") continue;
      const since = v.submittedAt ?? v.raisedAt;
      const waited = days(since, TODAY);
      if (waited > s.voApprovalDays)
        out.push({ ...base, id: `vo-wait-${v.id}`, tone: waited > s.voApprovalDays * 2 ? "neg" : "warn", date: since, title: `งานเปลี่ยนแปลงรอลูกค้าอนุมัติ ${waited} วัน · ${v.title}`, sub: `${v.id} · ${pname(v.projectId)} · ${baht(v.amount)}${v.days ? ` · ขยายเวลา ${v.days} วัน` : ""}`, href: `/contracts/variations/${v.id}` });
    }
    for (const c of certs) {
      if (c.side !== "client" || c.status !== "certified" || !c.dueDate || c.dueDate >= TODAY) continue;
      out.push({ ...base, id: `ipc-due-${c.id}`, tone: "neg", date: c.dueDate, title: `เบิกงวดรับรองแล้วยังไม่ได้รับเงิน · งวดที่ ${c.no}`, sub: `${pname(c.projectId)} · ${baht(c.net)} · เลยกำหนด ${days(c.dueDate, TODAY)} วัน`, href: `/contracts/${c.projectId}` });
    }
    for (const t of terms) {
      if (t.billing !== "measured" || t.retentionRelease) continue;
      const held = retentionHeld(certs, t.projectId);
      const p = getProject(t.projectId);
      const due = retentionDueDate(p?.handedOver ?? (p?.status === "delivered" ? p.finish : undefined), t.defectsMonths);
      if (!(held > 0) || !due || due > addDaysIso(TODAY, 30)) continue;
      out.push({ ...base, id: `ret-due-${t.projectId}`, tone: due < TODAY ? "warn" : "accent", date: due, title: `ครบกำหนดคืนเงินประกันผลงาน · ${pname(t.projectId)}`, sub: `เงินประกันที่ลูกค้าหักไว้ ${baht(held)} · ${due < TODAY ? `ครบกำหนดแล้ว ${days(due, TODAY)} วัน` : `อีก ${days(TODAY, due)} วัน`} · ออกใบแจ้งหนี้ขอคืน`, href: `/contracts/${t.projectId}` });
    }
    for (const sc of scs) {
      if (sc.status !== "completed" || sc.retentionReleaseBillId) continue;
      const held = subRetentionHeld(certs, sc.id);
      const due = subRetentionDue(sc);
      if (!(held > 0) || !due || due > addDaysIso(TODAY, 30)) continue;
      const sub = subs.find((x) => x.id === sc.subcontractorId);
      out.push({ ...base, id: `sc-ret-${sc.id}`, tone: "accent", date: due, title: `ครบกำหนดคืนเงินประกันผลงานผู้รับเหมาช่วง · ${sub?.name ?? sc.subcontractorId}`, sub: `${sc.id} · ${pname(sc.projectId)} · ${baht(held)} · ${due < TODAY ? "ครบกำหนดแล้ว" : `อีก ${days(TODAY, due)} วัน`}`, href: `/subcontractors/${sc.subcontractorId}?sc=${sc.id}` });
    }
    for (const x of subs) {
      if (x.prequal === "blacklisted") continue;
      const active = scs.some((sc) => sc.subcontractorId === x.id && (sc.status === "active" || sc.status === "draft"));
      for (const [kind, d] of [["ประกันภัย", x.insuranceExpiry], ["กองทุนเงินทดแทน", x.compFundExpiry]] as const) {
        if (!d || d > addDaysIso(TODAY, s.insuranceWarnDays) || (!active && d < TODAY)) continue;
        out.push({ ...base, id: `sub-ins-${x.id}-${kind}`, tone: d < TODAY ? "neg" : "warn", date: d, title: `${kind}ผู้รับเหมาช่วง${d < TODAY ? "หมดอายุแล้ว" : "ใกล้หมดอายุ"} · ${x.name}`, sub: `${d < TODAY ? `หมดอายุ ${days(d, TODAY)} วัน` : `เหลือ ${days(TODAY, d)} วัน`}${active ? " · มีงานที่กำลังทำอยู่" : ""}`, href: `/subcontractors/${x.id}` });
      }
    }
    // subcontract commitments above the budget line of their cost code, and work measured above contract quantities
    const committed = new Map<string, number>();
    for (const sc of scs) {
      if (sc.status === "terminated") continue;
      const k = `${sc.projectId}|${sc.costCode ?? sc.lines[0]?.costCode ?? "90"}`;
      committed.set(k, r2((committed.get(k) ?? 0) + sc.value));
    }
    for (const [k, v] of committed) {
      const [projectId, code] = k.split("|");
      const line = budgetList.find((b) => b.projectId === projectId)?.lines.filter((l) => l.costCode === code);
      const budget = sum((line ?? []).map((l) => l.amount));
      if (budget > 0 && v > budget) out.push({ ...base, id: `sc-budget-${k}`, tone: "warn", date: TODAY, title: `สัญญาผู้รับเหมาช่วงเกินงบหมวด ${code} · ${pname(projectId)}`, sub: `ผูกพันแล้ว ${baht(v)} จากงบ ${baht(budget)} (เกิน ${baht(v - budget)})`, href: `/contracts/${projectId}` });
    }
    for (const sc of scs) {
      const last = certs.filter((c) => c.side === "sub" && c.subcontractId === sc.id).sort((a, b) => b.no - a.no)[0];
      if (!last) continue;
      const over = (last.lines ?? []).filter((m) => {
        const l = sc.lines.find((x) => x.id === m.lineId);
        return l && m.qtyToDate > l.qty + 1e-9;
      });
      if (over.length || last.grossToDate > sc.value + 0.5)
        out.push({ ...base, id: `sc-over-${last.id}`, tone: "warn", date: last.date, title: `ผู้รับเหมาช่วงเบิกเกินปริมาณ/มูลค่าตามสัญญา · ${sc.title}`, sub: `${last.id} · ${pname(sc.projectId)} · ผลงานสะสม ${baht(last.grossToDate)} จากสัญญา ${baht(sc.value)}${over.length ? ` · ${over.length} รายการเกินปริมาณ` : ""}`, href: `/subcontractors/${sc.subcontractorId}?sc=${sc.id}` });
    }
    return out;
  }, [s, vos, certs, terms, subs, scs, budgetList]);
}

registerNotes({ cat: "contracts", label: "สัญญา/เบิกงวด", module: "contracts", hint: "งานเปลี่ยนแปลงรออนุมัติ เบิกงวดค้างรับ เงินประกันครบกำหนดคืน ประกันภัยผู้รับเหมาช่วง", use: useContractNotes });
