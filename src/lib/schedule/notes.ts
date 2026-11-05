// Notification feed of the schedule module (bell + /notifications).

import { useMemo } from "react";
import { progressEntries, wbsTasks, type WbsTask } from "@/lib/biz";
import { getProject, thDate, TODAY } from "@/lib/data";
import { registerNotes, type Note } from "@/lib/notifications";
import { cpm, progressAware } from "./cpm";
import { earnedValue } from "./ev";
import { leavesOf, plannedFraction, taskState } from "./rollup";
import { calOf, useScheduleSettings } from "./store";

function useScheduleNotes(): Note[] {
  const tasks = wbsTasks.use();
  const entries = progressEntries.use();
  const settings = useScheduleSettings();
  return useMemo(() => {
    const out: Note[] = [];
    const byProject = new Map<string, WbsTask[]>();
    for (const t of tasks) byProject.set(t.projectId, [...(byProject.get(t.projectId) ?? []), t]);
    for (const [pid, ts] of byProject) {
      const p = getProject(pid);
      if (p && (p.status === "delivered" || p.status === "planning")) continue;
      const name = p?.name ?? pid;
      const leaves = leavesOf(ts);
      const res = cpm(progressAware(leaves), calOf(settings));
      const crit = new Set(res.ok ? res.critical : []);
      const href = (id?: string) => `/schedule/${encodeURIComponent(pid)}${id ? `?task=${encodeURIComponent(id)}` : ""}`;
      for (const t of leaves) {
        const s = taskState(t, TODAY, settings.behindPts);
        if (s === "due")
          out.push({
            id: `sched-start-${t.id}`,
            cat: "schedule",
            title: `ควรเริ่มแล้ว: ${t.name}`,
            sub: `${name} · กำหนดเริ่ม ${thDate(t.start)} · ยังไม่มีความคืบหน้า${crit.has(t.id) ? " · งานวิกฤต" : ""}`,
            href: href(t.id),
            tone: crit.has(t.id) ? "neg" : "warn",
            date: t.start,
          });
        else if (crit.has(t.id) && (s === "late" || s === "behind")) {
          const plan = Math.round(plannedFraction(t.start, t.finish, TODAY, t.milestone) * 100);
          out.push({
            id: `sched-crit-${t.id}`,
            cat: "schedule",
            title: `งานวิกฤตล่าช้า: ${t.name}`,
            sub: `${name} · ทำได้ ${Math.round(t.pct)}% จากแผน ${plan}% · กำหนดเสร็จ ${thDate(t.finish)}`,
            href: href(t.id),
            tone: "neg",
            date: t.finish,
          });
        }
      }
      const ev = earnedValue({ tasks: ts, entries: entries.filter((e) => e.projectId === pid), costs: [], asOf: TODAY, costRatio: 1, withSeries: false });
      if (ev.spi !== undefined && ev.spi < settings.spiWarn)
        out.push({
          id: `sched-spi-${pid}`,
          cat: "schedule",
          title: `SPI ${ev.spi.toFixed(2)} ต่ำกว่าเกณฑ์ ${settings.spiWarn.toFixed(2)}: ${name}`,
          sub: `ความคืบหน้า ${ev.actualPct.toFixed(1)}% · ตามแผน ${ev.planPct.toFixed(1)}%`,
          href: href(),
          tone: ev.spi < settings.spiWarn - 0.1 ? "neg" : "warn",
          date: TODAY,
        });
    }
    return out;
  }, [tasks, entries, settings]);
}

registerNotes({ cat: "schedule", label: "แผนงาน", module: "schedule", hint: "งานวิกฤตล่าช้า งานที่ควรเริ่มแล้ว โครงการที่ SPI ต่ำกว่าเกณฑ์", use: useScheduleNotes });
