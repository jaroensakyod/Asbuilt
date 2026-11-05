"use client";

import type { ReactNode } from "react";
import { cx, inputCls } from "@/components/ui";
import { Pill, type Tone } from "@/components/ops/bits";
import { getProject, thDate } from "@/lib/data";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { canApprove, canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import type { ItemResult } from "@/lib/safety/types";

export const siteName = (id?: string) => (id ? (getProject(id)?.name ?? id) : "-");
export const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");
export const n2 = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "2026-11-04T08:00" → "4 พ.ย. 69 08:00" */
export const thDateTime = (s: string) => `${thDate(s.slice(0, 10))} ${s.slice(11, 16)}`;

export function useSafetyAccess() {
  const me = useMe();
  return {
    me,
    edit: canEdit(me.role, "safety"),
    /** approver of permits: safety officer / admin, or the project manager */
    approve: canApprove(me.role, "safety") || me.role === "pm",
  };
}

export function SiteSelect({ value, onChange, all = true, label = "หน้างาน", className }: { value: string; onChange: (v: string) => void; all?: boolean; label?: string; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cx(inputCls, "w-full pr-8", className)}>
      {all && <option value="">ทุกหน้างาน</option>}
      {ACTIVE_SITES.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id} · {p.name}
        </option>
      ))}
    </select>
  );
}

export const RESULT_LABEL: Record<ItemResult, string> = { pass: "ผ่าน", fail: "ไม่ผ่าน", na: "ไม่เกี่ยว" };
const RESULT_CLS: Record<ItemResult, string> = { pass: "bg-ink text-card", fail: "bg-neg-soft text-neg", na: "bg-raised text-ink-2" };

/** pass / fail / n.a. toggle for checklist rows */
export function ResultToggle({ value, onChange, label, disabled }: { value: ItemResult; onChange: (v: ItemResult) => void; label: string; disabled?: boolean }) {
  return (
    <div className="inline-flex shrink-0 gap-1" role="radiogroup" aria-label={label}>
      {(["pass", "fail", "na"] as ItemResult[]).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          disabled={disabled}
          onClick={() => onChange(r)}
          className={cx("h-7 rounded-[6px] px-2.5 text-[12px] transition-colors duration-150", value === r ? RESULT_CLS[r] : "border border-line text-ink-3 hover:bg-raised")}
        >
          {RESULT_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone: Tone = score >= 90 ? "pos" : score >= 75 ? "warn" : "neg";
  return (
    <Pill tone={tone} mono>
      {score}%
    </Pill>
  );
}

/** Checkbox row used by hazard / control / notification checklists */
export function CheckRow({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("flex items-start gap-2.5 border-b border-line py-2 text-[13px] last:border-0", disabled ? "cursor-default" : "cursor-pointer")}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={cx("min-w-0", checked ? "text-ink" : "text-ink-2")}>{children}</span>
    </label>
  );
}

export function VerifyNote({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-warn">{children}</p>;
}
