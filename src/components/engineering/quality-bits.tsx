"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui";
import { FilterField, I, Select } from "@/components/ops/bits";
import { ProjectSelect, SearchBox } from "./bits";

/** filters shared by the three quality tabs */
export type QFilter = { project: string; q: string; status: string; person: string };
export type SetQ = (fn: (x: QFilter) => QFilter) => void;

/** open a "new" form when the page header button bumps `key` (state adjusted during render) */
export function useNewTrigger(key: number, open: () => void) {
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    open();
  }
}

/** filter card used by each quality tab */
export function QFilters({ f, setF, statuses, personLabel, people, count, extra }: { f: QFilter; setF: SetQ; statuses: [string, string][]; personLabel: string; people: string[]; count: number; extra?: ReactNode }) {
  const set = (k: keyof QFilter) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const any = f.project || f.q || f.status || f.person;
  return (
    <Card className="ops-noprint mb-4">
      <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
        <SearchBox value={f.q} onChange={set("q")} placeholder="เลขที่ เรื่อง ตำแหน่ง" className="col-span-2" />
        <FilterField label="โครงการ">
          <ProjectSelect value={f.project} onChange={set("project")} />
        </FilterField>
        <FilterField label="สถานะ">
          <Select label="สถานะ" value={f.status} onChange={set("status")}>
            <option value="">ทุกสถานะ</option>
            {statuses.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label={personLabel}>
          <Select label={personLabel} value={f.person} onChange={set("person")}>
            <option value="">ทุกคน</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FilterField>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
        <span className="num font-mono text-[12px]">{count} รายการ</span>
        {any && (
          <button type="button" onClick={() => setF(() => ({ project: "", q: "", status: "", person: "" }))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
            <X {...I} />
            ล้างตัวกรอง
          </button>
        )}
        {extra && <span className="ml-auto flex items-center gap-2">{extra}</span>}
      </div>
    </Card>
  );
}

export const matchQ = (q: string, ...parts: (string | undefined)[]) => {
  const t = q.trim().toLowerCase();
  return !t || parts.filter(Boolean).join(" ").toLowerCase().includes(t);
};
