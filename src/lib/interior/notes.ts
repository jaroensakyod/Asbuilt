// Notification feeds of the interior module (registered at import time from ./index).

import { useMemo } from "react";
import { TODAY, getProject } from "../data";
import { registerNotes, type Note } from "../notifications";
import { daysBetween, isFfeLate, isSampleOverdue, isSelectionLate, sampleReturnBy } from "./calc";
import { ffeItems, interiorProjects, samples, selections, useInteriorSettings } from "./store";

const pname = (id: string) => getProject(id)?.name ?? id;

function useSelectionNotes(): Note[] {
  const list = selections.use();
  return useMemo(() => {
    const out: Note[] = [];
    for (const s of list) {
      if (isSelectionLate(s, TODAY)) {
        const d = daysBetween(s.deadline, TODAY);
        out.push({ id: `sel-late-${s.id}-${s.deadline}`, cat: "selections", tone: d > 7 ? "neg" : "warn", date: s.deadline, title: `ลูกค้ายังไม่เลือก${s.item} · เลยกำหนด ${d} วัน`, sub: `${pname(s.projectId)} · ${s.room}${s.blocks ? ` · รอ${s.blocks}` : ""}`, href: `/selections/${s.projectId}` });
      } else if (s.status === "chosen")
        out.push({ id: `sel-chosen-${s.id}-${s.chosenId}`, cat: "selections", tone: "accent", date: s.chosenAt ?? TODAY, title: `ลูกค้าเลือกแล้ว รออนุมัติ · ${s.item}`, sub: `${pname(s.projectId)} · ${s.room}`, href: `/selections/${s.projectId}` });
    }
    return out;
  }, [list]);
}

function useInteriorNotes(): Note[] {
  const items = ffeItems.use();
  const smp = samples.use();
  const ints = interiorProjects.use();
  const st = useInteriorSettings();
  return useMemo(() => {
    const out: Note[] = [];
    const name = (id: string) => ints.find((x) => x.id === id)?.name ?? id;
    for (const f of items)
      if (isFfeLate(f, TODAY))
        out.push({ id: `ffe-late-${f.id}-${f.expectedAt}`, cat: "interior", tone: "warn", date: f.expectedAt!, title: `ของตกแต่งส่งช้ากว่ากำหนด · ${f.description}`, sub: `${f.code} · ${name(f.interiorId)} · ${f.room} · กำหนดส่ง ${f.expectedAt}`, href: `/interior/${f.interiorId}?tab=ffe` });
    for (const s of smp)
      if (isSampleOverdue(s, TODAY, st.sampleReturnDays))
        out.push({ id: `smp-${s.id}`, cat: "interior", tone: "neutral", date: sampleReturnBy(s, st.sampleReturnDays)!, title: `ตัวอย่างยังไม่คืน · ${s.description}`, sub: `${name(s.interiorId)} · ${s.location} · ครบกำหนดคืน ${sampleReturnBy(s, st.sampleReturnDays)}`, href: `/interior/${s.interiorId}?tab=samples` });
    return out;
  }, [items, smp, ints, st.sampleReturnDays]);
}

registerNotes({ cat: "selections", label: "ลูกค้าเลือกวัสดุ", module: "interior", hint: "รายการที่ลูกค้ายังไม่เลือกเลยกำหนด (กระทบแผนงาน) และรายการที่รออนุมัติ", use: useSelectionNotes });
registerNotes({ cat: "interior", label: "งานตกแต่งภายใน", module: "interior", hint: "ของตกแต่ง/เฟอร์นิเจอร์ส่งช้ากว่ากำหนด ตัวอย่างวัสดุที่ยังไม่คืน", use: useInteriorNotes });
