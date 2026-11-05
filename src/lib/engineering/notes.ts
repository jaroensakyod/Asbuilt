"use client";

// Notification feed for the engineering module (bell + /notifications).

import { useMemo } from "react";
import { getProject, TODAY } from "@/lib/data";
import { registerNotes, type Note } from "@/lib/notifications";
import { concreteVerdict, diffDays, setState, submittalState, waitingHold } from "./calc";
import { actionItems, concreteTests, inspectionRequests, itpTemplates, licensees, ncrs, rfis, submittals, useEngSettings } from "./store";

const pname = (id: string) => getProject(id)?.name ?? id;
const dueText = (d: number) => (d < 0 ? `เลยกำหนด ${-d} วัน` : d === 0 ? "ครบกำหนดวันนี้" : `อีก ${d} วัน`);

function useEngineeringNotes(): Note[] {
  const s = useEngSettings();
  const rf = rfis.use();
  const sb = submittals.use();
  const ct = concreteTests.use();
  const nc = ncrs.use();
  const ir = inspectionRequests.use();
  const tp = itpTemplates.use();
  const lic = licensees.use();
  const act = actionItems.use();
  return useMemo(() => {
    const out: Note[] = [];
    const base = { cat: "engineering" } as const;
    for (const r of rf) {
      if (r.status !== "open") continue;
      const d = diffDays(TODAY, r.due);
      if (d <= s.rfiWarnDays)
        out.push({ ...base, id: `rfi-due-${r.id}`, tone: d < 0 ? "neg" : "warn", date: r.due, title: `${d < 0 ? "RFI เลยกำหนดตอบ" : "RFI ใกล้ครบกำหนดตอบ"} · ${r.subject}`, sub: `${r.id} · ${pname(r.projectId)} · รอ ${r.assignedTo} · ${dueText(d)}`, href: `/rfi/${r.id}` });
    }
    for (const x of sb) {
      const st = submittalState(x, TODAY);
      const rev = x.revs[x.revs.length - 1];
      if (st === "overdue")
        out.push({ ...base, id: `sbm-due-${x.id}-${rev.rev}`, tone: "neg", date: rev.due, title: `เอกสารส่งอนุมัติเลยกำหนดพิจารณา · ${x.title}`, sub: `${x.id} Rev.${rev.rev} · ${pname(x.projectId)} · ผู้พิจารณา ${x.reviewer} · ${dueText(diffDays(TODAY, rev.due))}`, href: `/submittals/${x.id}` });
    }
    for (const t of ct) {
      const v = concreteVerdict(t, s.concrete);
      if (v === "fail" && diffDays(t.pourDate, TODAY) <= 90)
        out.push({ ...base, id: `ct-fail-${t.id}`, tone: "neg", date: t.sets[t.sets.length - 1]?.testedAt ?? t.pourDate, title: `ผลทดสอบคอนกรีตไม่ผ่าน · ${t.element}`, sub: `${t.id} · ${pname(t.projectId)} · fc' ${t.fc} ksc`, href: `/quality?tab=tests&q=${t.id}` });
      for (const set of t.sets) {
        const st = setState(set, TODAY);
        if (st === "today" || st === "overdue")
          out.push({ ...base, id: `ct-due-${t.id}-${set.age}`, tone: st === "overdue" ? "warn" : "accent", date: set.due, title: `${st === "today" ? "ทดสอบกำลังอัดคอนกรีตวันนี้" : "ทดสอบคอนกรีตเลยกำหนด"} · อายุ ${set.age} วัน · ${t.element}`, sub: `${t.id} · ${pname(t.projectId)} · ${dueText(diffDays(TODAY, set.due))}`, href: `/quality?tab=tests&q=${t.id}` });
      }
    }
    for (const n of nc) {
      if (n.status === "closed") continue;
      const age = diffDays(n.raisedAt, TODAY);
      if (age > s.ncrOpenDays)
        out.push({ ...base, id: `ncr-open-${n.id}`, tone: n.severity === "minor" ? "warn" : "neg", date: n.raisedAt, title: `NCR เปิดค้าง ${age} วัน · ${n.title}`, sub: `${n.id} · ${pname(n.projectId)} · ${n.responsible}`, href: `/quality?tab=ncr&q=${n.id}` });
    }
    for (const r of ir) {
      const tpl = tp.find((t) => t.id === r.templateId);
      const h = tpl && waitingHold(tpl, r);
      if (h && r.date <= TODAY)
        out.push({ ...base, id: `hold-${r.id}-${h.step.id}`, tone: "accent", date: r.date, title: `Hold point รอผู้ควบคุมงานอนุมัติ · ${h.step.text}`, sub: `${r.id} · ${r.title} · ${pname(r.projectId)} · ${r.inspector}`, href: `/quality?tab=itp&q=${r.id}` });
    }
    for (const l of lic) {
      const d = diffDays(TODAY, l.expiry);
      if (d <= s.licenseDays)
        out.push({ ...base, id: `lic-${l.id}-${l.expiry}`, tone: d < 0 ? "neg" : "warn", date: l.expiry, title: `${d < 0 ? "ใบอนุญาตวิชาชีพหมดอายุ" : "ใบอนุญาตวิชาชีพใกล้หมดอายุ"} · ${l.name}`, sub: `${l.licenseNo} · ${dueText(d)}`, href: "/supervision?tab=licenses" });
    }
    for (const a of act) {
      if (a.status !== "open" || a.due >= TODAY) continue;
      out.push({ ...base, id: `act-${a.id}`, tone: diffDays(a.due, TODAY) > 7 ? "neg" : "warn", date: a.due, title: `งานจากที่ประชุมเลยกำหนด · ${a.text}`, sub: `${a.id} · ${pname(a.projectId)} · ${a.owner} · ${dueText(diffDays(TODAY, a.due))}`, href: `/meetings/${a.meetingId}` });
    }
    return out;
  }, [s, rf, sb, ct, nc, ir, tp, lic, act]);
}

registerNotes({ cat: "engineering", label: "วิศวกรรม & คุณภาพ", module: "engineering", hint: "RFI ใกล้/เลยกำหนด เอกสารส่งอนุมัติค้าง ผลคอนกรีต NCR ค้าง Hold point ใบอนุญาตวิชาชีพ งานจากที่ประชุม", use: useEngineeringNotes });
