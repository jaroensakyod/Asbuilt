"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { Btn, Empty, FilterField, I, PrintStyle, Select } from "@/components/ops/bits";
import type { WbsTask } from "@/lib/biz";
import { COMPANY, thDate, TODAY, type Project } from "@/lib/data";
import { addDays, compareCode, taskState, weekday } from "@/lib/schedule";
import { StatePill } from "./bits";

export function LookAhead({ project, leaves, critical, weeks, behindPts, onSelect }: { project: Project; leaves: WbsTask[]; critical: Set<string>; weeks: number; behindPts: number; onSelect: (id: string) => void }) {
  const [crew, setCrew] = useState("");
  const end = addDays(TODAY, weeks * 7 - 1);
  const days = useMemo(() => Array.from({ length: weeks * 7 }, (_, i) => addDays(TODAY, i)), [weeks]);
  const crews = [...new Set(leaves.map((t) => t.crew).filter(Boolean) as string[])].sort();
  const list = leaves
    .filter((t) => (t.pct || 0) < 100 && t.start <= end && (t.finish >= TODAY || t.start <= TODAY))
    .filter((t) => !crew || t.crew === crew)
    .sort((a, b) => a.start.localeCompare(b.start) || compareCode(a.code, b.code));

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint mb-3 flex flex-wrap items-end justify-between gap-3">
        <FilterField label="ทีมช่าง / ผู้รับเหมา" className="w-full sm:w-[280px]">
          <Select label="ทีมช่าง" value={crew} onChange={setCrew}>
            <option value="">ทุกทีม</option>
            {crews.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </FilterField>
        <Btn onClick={() => window.print()}>
          <Printer {...I} />
          พิมพ์สำหรับประชุมหน้างาน
        </Btn>
      </div>
      <Card className="ops-print">
        <div className="border-b border-line px-5 py-3.5">
          <p className="hidden text-[12px] text-ink-3 print:block">{COMPANY}</p>
          <h2 className="text-[15px] font-medium">
            แผนงานล่วงหน้า {weeks} สัปดาห์ (look-ahead) · {project.name}
          </h2>
          <p className="font-mono text-[12px] text-ink-3">
            {project.id} · {thDate(TODAY)} – {thDate(end)} · {list.length} งาน{crew ? ` · ${crew}` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="px-3 py-2 pl-5 text-left font-normal text-ink-3">งาน</th>
                <th className="px-3 py-2 text-left font-normal text-ink-3">ทีม</th>
                <th className="px-3 py-2 text-left font-normal text-ink-3">เริ่ม – เสร็จ</th>
                <th className="px-3 py-2 text-right font-normal text-ink-3">%</th>
                <th className="px-3 py-2 text-left font-normal text-ink-3">สถานะ</th>
                {days.map((d, i) => (
                  <th key={d} className={cx("w-[18px] px-0 py-2 text-center font-mono font-normal text-[10px] text-ink-3", weekday(d) === 0 && "bg-raised", i % 7 === 0 && "border-l border-line-strong")}>
                    {Number(d.slice(8))}
                  </th>
                ))}
                <th className="w-3 pr-5" />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const s = taskState(t, TODAY, behindPts);
                return (
                  <tr key={t.id} className="avoid-break cursor-pointer border-t border-line hover:bg-raised/60" onClick={() => onSelect(t.id)}>
                    <td className="max-w-[260px] px-3 py-2 pl-5">
                      <span className="font-mono text-[11px] text-ink-3">{t.code}</span> <span className={cx(critical.has(t.id) && "text-accent-text")}>{t.name}</span>
                      {critical.has(t.id) && <span className="ml-1 text-[11px] text-accent-text">· วิกฤต</span>}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-ink-2">{t.crew ?? "–"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-ink-2">
                      {thDate(t.start)} – {thDate(t.finish)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{Math.round(t.pct)}</td>
                    <td className="px-3 py-2">
                      <StatePill s={s} />
                    </td>
                    {days.map((d, i) => {
                      const on = d >= t.start && d <= t.finish;
                      return (
                        <td key={d} className={cx("px-0 py-2", weekday(d) === 0 && "bg-raised", i % 7 === 0 && "border-l border-line-strong")}>
                          {on && <span className={cx("mx-auto block h-2.5 w-full", critical.has(t.id) ? "bg-accent" : "bg-ink-3")} />}
                        </td>
                      );
                    })}
                    <td className="pr-5" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <Empty>ไม่มีงานที่ทำอยู่หรือจะเริ่มใน {weeks} สัปดาห์ข้างหน้า</Empty>}
        <div className="hidden grid-cols-3 gap-6 px-5 pb-6 pt-10 text-[12px] text-ink-2 print:grid">
          {["ผู้จัดการโครงการ", "วิศวกรควบคุมงาน", "โฟร์แมน"].map((r) => (
            <div key={r} className="border-t border-ink-3 pt-1 text-center">
              {r}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
