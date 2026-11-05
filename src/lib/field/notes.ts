// Notification feeds of the field and service modules (registered from ./index).

import { useMemo } from "react";
import { getProject, projects, TODAY, type Project } from "@/lib/data";
import { registerNotes, type Note } from "@/lib/notifications";
import { useRepairs, useWorkOrders } from "@/lib/ops-store";
import { useLocalProjects } from "@/lib/projects-store";
import { addDays, daysDiff, lowStock, overloaded, renewalDue, warrantyEnd } from "./calc";
import { diaries, serviceContracts, useFieldSettings, vanStock, warrantyItems } from "./store";

const name = (id: string) => getProject(id)?.name ?? id;
const dueText = (d: number) => (d < 0 ? `เลยกำหนด ${-d} วัน` : d === 0 ? "วันนี้" : `อีก ${d} วัน`);

/** last day before today on which a diary was expected */
function lastWorkday(days: number[]) {
  let d = addDays(TODAY, -1);
  for (let i = 0; i < 7 && !days.includes(new Date(`${d}T00:00:00Z`).getUTCDay()); i++) d = addDays(d, -1);
  return d;
}

function useDiaryNotes(): Note[] {
  const list = diaries.use();
  const s = useFieldSettings();
  const local = useLocalProjects();
  return useMemo(() => {
    const out: Note[] = [];
    const day = lastWorkday(s.diaryDays);
    const active: Project[] = [...projects, ...local].filter((p) => p.status === "building");
    const have = new Set(list.filter((d) => d.date === day).map((d) => d.projectId));
    for (const p of active)
      if (!have.has(p.id) && p.start <= day)
        out.push({ id: `dia-miss-${p.id}-${day}`, cat: "diary", tone: "warn", date: day, title: `ยังไม่มีรายงานประจำวัน · ${p.name}`, sub: `${p.id} · วันที่ ${day} · ผู้ควบคุมงานส่งรายงานย้อนหลังได้`, href: `/diary?project=${p.id}` });
    for (const d of list)
      if (d.status === "submitted")
        out.push({ id: `dia-wait-${d.id}`, cat: "diary", tone: "accent", date: d.date, title: `รายงานประจำวันรออนุมัติ · ${name(d.projectId)}`, sub: `${d.id} · ส่งโดย ${d.by}`, href: `/diary/${d.id}` });
    return out;
  }, [list, s.diaryDays, local]);
}

function useDispatchNotes(): Note[] {
  const repairs = useRepairs();
  const wos = useWorkOrders();
  const s = useFieldSettings();
  const stock = vanStock.use();
  return useMemo(() => {
    const out: Note[] = [];
    const withWo = new Set(wos.filter((w) => w.status !== "cancelled").map((w) => w.repairId));
    for (const r of repairs)
      if (r.status !== "closed" && r.severity === "high" && !withWo.has(r.id))
        out.push({ id: `dsp-un-${r.id}`, cat: "dispatch", tone: "neg", date: TODAY, title: `งานด่วนยังไม่จัดช่าง · ${r.title}`, sub: `${r.id} · ${name(r.projectId)}`, href: "/dispatch" });
    const open = wos.filter((w) => w.status === "assigned" || w.status === "in_progress" || w.status === "on_hold").filter((w) => w.scheduled >= TODAY);
    for (const o of overloaded(open.map((w) => ({ id: w.id, tech: w.technician, date: w.scheduled })), s.maxJobsPerDay))
      out.push({ id: `dsp-over-${o.tech}-${o.date}`, cat: "dispatch", tone: "warn", date: o.date, title: `ช่างงานล้น · ${o.tech}`, sub: `${o.count} งานวันที่ ${o.date} (เกิน ${s.maxJobsPerDay} งาน/วัน)`, href: "/dispatch" });
    const low = lowStock(stock);
    const byTech = new Map<string, number>();
    for (const x of low) byTech.set(x.tech, (byTech.get(x.tech) ?? 0) + 1);
    for (const [tech, n] of byTech) out.push({ id: `van-low-${tech}-${low.filter((x) => x.tech === tech).map((x) => `${x.code}${x.qty}`).join("")}`, cat: "dispatch", tone: "warn", date: TODAY, title: `อะไหล่ในรถใกล้หมด · ${tech}`, sub: `${n} รายการต่ำกว่าขั้นต่ำ · เติมสต็อกรถ`, href: "/dispatch?tab=van" });
    return out;
  }, [repairs, wos, s.maxJobsPerDay, stock]);
}

function useServiceNotes(): Note[] {
  const list = serviceContracts.use();
  const items = warrantyItems.use();
  const s = useFieldSettings();
  return useMemo(() => {
    const out: Note[] = [];
    for (const c of list)
      if (renewalDue(c, TODAY, Math.max(30, c.remindDays)))
        out.push({ id: `svc-renew-${c.id}`, cat: "service-contract", tone: daysDiff(TODAY, c.end) <= 14 ? "warn" : "neutral", date: c.end, title: `สัญญาบริการใกล้ครบกำหนด · ${name(c.projectId)}`, sub: `${c.id} · สิ้นสุด ${c.end} · ${dueText(daysDiff(TODAY, c.end))} · เสนอต่ออายุ`, href: "/service-contracts" });
    for (const w of items) {
      const end = warrantyEnd(w);
      const d = daysDiff(TODAY, end);
      if (d >= 0 && d <= s.preExpiryDays)
        out.push({ id: `war-exp-${w.id}`, cat: "warranty-register", tone: d <= 30 ? "warn" : "neutral", date: end, title: `ประกันใกล้หมด · ${w.label}`, sub: `${name(w.projectId)} · ${dueText(d)} · นัดตรวจก่อนหมดประกัน`, href: `/warranty?project=${w.projectId}` });
    }
    return out;
  }, [list, items, s.preExpiryDays]);
}

export function registerFieldNotes() {
  registerNotes({ cat: "diary", label: "รายงานประจำวัน", module: "field", hint: "หน้างานที่ยังไม่ส่งรายงานเมื่อวาน และรายงานที่รออนุมัติ", use: useDiaryNotes });
  registerNotes({ cat: "dispatch", label: "จัดคิวช่าง", module: "service", hint: "งานด่วนที่ยังไม่มีช่าง ช่างงานล้น อะไหล่ในรถใกล้หมด", use: useDispatchNotes });
  registerNotes({ cat: "service-contract", label: "สัญญาบริการ/ประกัน", module: "service", hint: "สัญญาบำรุงรักษาที่ใกล้ต่ออายุ รายการประกันที่ใกล้หมด", use: useServiceNotes });
}
