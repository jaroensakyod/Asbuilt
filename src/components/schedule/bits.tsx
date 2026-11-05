"use client";

import { useMemo } from "react";
import { cx } from "@/components/ui";
import { Pill, type Tone } from "@/components/ops/bits";
import { projects as seedProjects, type Project } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useMe } from "@/lib/use-me";
import { canEdit, canView, levelOf } from "@/lib/permissions";
import { TASK_STATE_LABEL, type TaskState } from "@/lib/schedule";

export function useSchedulePerms() {
  const me = useMe();
  const lvl = levelOf(me.role, "schedule");
  return {
    me,
    /** edit WBS, dates, links, baseline */
    edit: canEdit(me.role, "schedule"),
    /** record measured progress (own-records level included: foremen, subcontractors) */
    progress: lvl === "o" || lvl === "e" || lvl === "a",
    /** money (values, EV in baht) */
    money: canView(me.role, "costs") || canEdit(me.role, "schedule"),
  };
}

export function useAllProjects(): Project[] {
  const local = useLocalProjects();
  return useMemo(() => [...local, ...seedProjects], [local]);
}

export const fmtM = (n: number) => (n / 1e6).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = (n: number) => Math.round(n).toLocaleString("th-TH");
export const fmtPct = (n: number, d = 1) => `${n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
export const fmtIdx = (n?: number) => (n === undefined || !Number.isFinite(n) ? "–" : n.toFixed(2));

export const idxTone = (n: number | undefined, warn = 0.9): Tone => (n === undefined ? "neutral" : n < warn - 0.1 ? "neg" : n < warn ? "warn" : n < 1 ? "neutral" : "pos");

export function IdxPill({ v, warn }: { v?: number; warn?: number }) {
  return (
    <Pill tone={idxTone(v, warn)} mono>
      {fmtIdx(v)}
    </Pill>
  );
}

const STATE_TONE: Record<TaskState, Tone> = { done: "pos", late: "neg", behind: "warn", active: "accent", due: "warn", upcoming: "neutral" };
export function StatePill({ s }: { s: TaskState }) {
  return <Pill tone={STATE_TONE[s]}>{TASK_STATE_LABEL[s]}</Pill>;
}

export function DaysLate({ d }: { d: number }) {
  if (d > 0) return <span className="num font-mono text-neg">ช้า {d} วัน</span>;
  if (d < 0) return <span className="num font-mono text-ink-3">เร็วกว่า {-d} วัน</span>;
  return <span className="num font-mono text-ink-3">ตามกำหนด</span>;
}

/** progress bar with a tick at the planned % */
export function ProgressBar({ actual, plan, className }: { actual: number; plan: number; className?: string }) {
  return (
    <div className={cx("relative h-1.5 w-full rounded-full bg-raised", className)}>
      <div className={cx("absolute inset-y-0 left-0 rounded-full", actual + 5 < plan ? "bg-warn" : "bg-ink")} style={{ width: `${Math.min(100, Math.max(0, actual))}%` }} />
      <div className="absolute -top-1 h-3.5 w-px bg-accent" style={{ left: `${Math.min(100, Math.max(0, plan))}%` }} />
    </div>
  );
}

export const SOURCE_LABEL = { engineer: "วิศวกร", foreman: "โฟร์แมน", diary: "รายงานประจำวัน", subcontractor: "ผู้รับเหมาช่วง" } as const;
export const DEP_LABEL = { FS: "เสร็จ→เริ่ม (FS)", SS: "เริ่ม→เริ่ม (SS)", FF: "เสร็จ→เสร็จ (FF)", SF: "เริ่ม→เสร็จ (SF)" } as const;

/** CSV download (UTF-8 with BOM so Excel shows Thai correctly) */
export function downloadCsv(name: string, rows: unknown[][]) {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
