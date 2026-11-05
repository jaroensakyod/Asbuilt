"use client";

// Shared UI bits for the design, permit, spec, selection and interior screens.

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { I, Pill, Select, type Tone } from "@/components/ops/bits";
import { getProject, projects, thDate, type Project } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useMediaUrl, type MediaRef } from "@/lib/media";
import { useMe } from "@/lib/use-me";
import { canApprove, canEdit, type ModuleKey } from "@/lib/permissions";
import { STAGE_STATUS_LABEL, PERMIT_STATUS_LABEL, type PermitStatus, type StageStatus } from "@/lib/design/types";

export const th = "px-3 py-2 text-left text-[12px] font-normal text-ink-3 whitespace-nowrap";
export const thR = cx(th, "text-right");
export const td = "px-3 py-2.5 align-top text-[13px]";
export const tdR = cx(td, "text-right whitespace-nowrap");
export const rowCls = "border-t border-line transition-colors duration-150 hover:bg-raised/60";

export const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
export const signedBaht = (n: number) => (n === 0 ? "฿0" : `${n > 0 ? "+" : "−"}฿${Math.abs(Math.round(n)).toLocaleString("th-TH")}`);
export const dateOr = (iso?: string, dash = "–") => (iso ? thDate(iso.slice(0, 10)) : dash);

export function Amt({ n, signed, className }: { n: number; signed?: boolean; className?: string }) {
  return <span className={cx("num font-mono", signed && n > 0 && "text-warn", signed && n < 0 && "text-pos", className)}>{signed ? signedBaht(n) : baht(n)}</span>;
}

export function usePerms(m: ModuleKey) {
  const me = useMe();
  return { me, edit: canEdit(me.role, m), approve: canApprove(me.role, m) || me.role === "admin" };
}

/** All projects: bundled demo projects + ones created in this browser */
export function useAllProjects(): Project[] {
  const local = useLocalProjects();
  return [...projects, ...local.filter((l) => !projects.some((p) => p.id === l.id))];
}
export const projectName = (id?: string) => (id ? (getProject(id)?.name ?? id) : "–");

export function ProjectSelect({ value, onChange, list, label = "โครงการ", allowEmpty }: { value: string; onChange: (v: string) => void; list: Project[]; label?: string; allowEmpty?: string }) {
  return (
    <Select label={label} value={value} onChange={onChange}>
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id} · {p.name}
        </option>
      ))}
    </Select>
  );
}

const STAGE_TONE: Record<StageStatus, Tone> = { not_started: "neutral", in_progress: "accent", client_review: "warn", changes_requested: "neg", approved: "pos" };
export const StagePill = ({ s }: { s: StageStatus }) => <Pill tone={STAGE_TONE[s]}>{STAGE_STATUS_LABEL[s]}</Pill>;

const PERMIT_TONE: Record<PermitStatus, Tone> = { preparing: "neutral", submitted: "accent", query: "warn", approved: "pos", rejected: "neg", completion: "accent", completed: "pos" };
export const PermitPill = ({ s }: { s: PermitStatus }) => <Pill tone={PERMIT_TONE[s]}>{PERMIT_STATUS_LABEL[s]}</Pill>;

/** Legal numbers are defaults: always show this next to them */
export function VerifyNote({ children = "ตรวจสอบกับประกาศล่าสุด" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-warn">
      <Info {...I} size={14} />
      {children}
    </span>
  );
}

/** Product / option tile: photo when there is one, otherwise the colour chip */
export function Swatch({ image, color, label, className }: { image?: MediaRef; color?: string; label: string; className?: string }) {
  const url = useMediaUrl(image);
  return (
    <div className={cx("relative overflow-hidden rounded-[8px] border border-line bg-raised", className)} title={label}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object / signed URLs
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" style={{ background: color ?? "var(--deep)" }} aria-label={label} role="img" />
      )}
    </div>
  );
}

/** Simple tab row (state kept by the caller) */
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { key: T; label: string; count?: number }[] }) {
  return (
    <div className="ops-noprint mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          aria-pressed={value === t.key}
          className={cx("-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[14px] transition-colors duration-150", value === t.key ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink")}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="num font-mono text-[12px] text-ink-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function NumInput({ value, onChange, step = 1, className, min }: { value: number; onChange: (n: number) => void; step?: number; className?: string; min?: number }) {
  return <input type="number" inputMode="decimal" step={step} min={min} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className={cx(inputCls, "num w-full font-mono", className)} />;
}

export function Check({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("flex items-start gap-2 text-[13px] text-ink", disabled && "opacity-60")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );
}

export function Header({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="ops-noprint flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <p className="mb-1 text-[13px] text-ink-3">{eyebrow}</p>
        <h1 className="text-[30px] font-normal leading-[1.15]">{title}</h1>
        {sub && <p className="mt-2 max-w-[48rem] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Stars 1–5 (read-only) */
export function Stars({ v, size = 14 }: { v: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${v} จาก 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
          <path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill={i <= Math.round(v) ? "var(--accent)" : "none"} stroke={i <= Math.round(v) ? "var(--accent)" : "var(--line-strong)"} strokeWidth="1.2" />
        </svg>
      ))}
    </span>
  );
}
