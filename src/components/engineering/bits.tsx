"use client";

// Shared pieces for the engineering pages (RFI, submittals, quality, supervision,
// document control, meetings, closeout).

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { areaCls, FilterField, I, Select } from "@/components/ops/bits";
import { getProject, projects as seedProjects, team, thDate, TODAY, type Project } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useMe } from "@/lib/use-me";
import { canApprove, canEdit } from "@/lib/permissions";
import { useMediaUrl, type MediaRef } from "@/lib/media";
import { diffDays } from "@/lib/engineering/calc";

export { DocHeader, DocRow, DocSection, Signatures } from "@/components/ops/doc";

export function useEngPerms() {
  const me = useMe();
  return { me, edit: canEdit(me.role, "engineering"), approve: canApprove(me.role, "engineering") };
}

/** every project (browser-created first), for pickers */
export function useAllProjects(): Project[] {
  const local = useLocalProjects();
  return useMemo(() => [...local, ...seedProjects], [local]);
}
/** projects where engineering work happens (building / handover first, then the rest) */
export function useActiveProjects(): Project[] {
  const all = useAllProjects();
  return useMemo(() => {
    const rank = { building: 0, handover: 1, planning: 2, delivered: 3 } as const;
    return [...all].sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
  }, [all]);
}

export const pname = (id: string) => getProject(id)?.name ?? id;

export function ProjectSelect({ value, onChange, allLabel = "ทุกโครงการ", required, only }: { value: string; onChange: (v: string) => void; allLabel?: string; required?: boolean; only?: (p: Project) => boolean }) {
  const list = useActiveProjects().filter((p) => (only ? only(p) : p.status !== "delivered" || p.id === value));
  return (
    <Select label="โครงการ" value={value} onChange={onChange}>
      {!required && <option value="">{allLabel}</option>}
      {required && !value && <option value="">เลือกโครงการ</option>}
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id} · {p.name}
        </option>
      ))}
    </Select>
  );
}

export function SearchBox({ value, onChange, placeholder = "ค้นหา", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <FilterField label="ค้นหา" className={className}>
      <div className="relative">
        <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputCls, "w-full pl-8")} />
      </div>
    </FilterField>
  );
}

/** names offered in "assigned to / owner / inspector" inputs */
export const PEOPLE = [
  ...team.filter((m) => m.active).map((m) => m.name),
  "ภานุวัฒน์ ศักดิ์สิทธิ์",
  "คุณกิตติพงษ์ วงศ์วิศาล (ไทยสตรัคเจอร์ คอนซัลแตนท์)",
  "คุณชนิดา มีสุข (สถาปนิก)",
  "คุณธีรวัฒน์ บุญมา (วิศวกรไฟฟ้า)",
  "วศิน พรหมรักษ์ (เอ็มอีพี โซลูชั่น)",
];
export function PeopleList({ id = "eng-people" }: { id?: string }) {
  return (
    <datalist id={id}>
      {PEOPLE.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}

export function Area({ value, onChange, placeholder, rows = 3, className }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={cx(areaCls, "w-full", className)} />;
}

export function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("inline-flex items-center gap-2 text-[13px] text-ink-2", disabled ? "opacity-50" : "cursor-pointer")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--ink)]" />
      {children}
    </label>
  );
}

export const th = "px-3 py-2.5 text-left text-[13px] font-normal text-ink-3 whitespace-nowrap first:pl-5 last:pr-5";
export const td = "px-3 py-2.5 align-top text-[14px] first:pl-5 last:pr-5";
export const rowCls = "cursor-pointer border-t border-line transition-colors duration-150 hover:bg-raised/60";

/** "เลยกำหนด 3 วัน" style due text, red when late */
export function Due({ date, done, warnDays = 2 }: { date?: string; done?: boolean; warnDays?: number }) {
  if (!date) return <span className="text-ink-3">–</span>;
  const d = diffDays(TODAY, date);
  const tone = done ? "text-ink-3" : d < 0 ? "text-neg" : d <= warnDays ? "text-warn" : "text-ink-2";
  return (
    <span className={cx("text-[13px]", tone)}>
      <span className="num font-mono">{thDate(date)}</span>
      {!done && <span className="block text-[12px]">{d < 0 ? `เลย ${-d} วัน` : d === 0 ? "วันนี้" : `อีก ${d} วัน`}</span>}
    </span>
  );
}

export function DocId({ id, href }: { id: string; href: string }) {
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] text-accent-text hover:underline">
      {id}
    </Link>
  );
}

/** Tab strip inside a card header */
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { key: T; label: string; count?: number }[] }) {
  return (
    <div className="ops-noprint flex flex-wrap items-center gap-0.5 border-b border-line px-3 py-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          aria-pressed={value === t.key}
          className={cx("flex h-8 items-center gap-2 rounded-[8px] px-3 text-[13px] transition-colors duration-150", value === t.key ? "bg-raised text-ink" : "text-ink-2 hover:text-ink")}
        >
          {t.label}
          {t.count !== undefined && <span className="num font-mono text-[11px] text-ink-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Heading({ eyebrow = "วิศวกรรม & คุณภาพ", title, sub, actions }: { eyebrow?: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="ops-noprint flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        <p className="mb-1 text-[13px] text-ink-3">{eyebrow}</p>
        <h1 className="text-[30px] font-normal leading-[1.15]">{title}</h1>
        {sub && <p className="mt-2 max-w-[48rem] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A note next to a configurable legal / standard figure */
export function CheckNote({ children = "ตรวจสอบกับมาตรฐานล่าสุด" }: { children?: ReactNode }) {
  return <span className="text-[12px] text-warn">{children}</span>;
}

/** Signature image for printed documents (falls back to a blank line) */
export function SigImg({ sig, name, role, date }: { sig?: MediaRef; name?: string; role: string; date?: string }) {
  const url = useMediaUrl(sig);
  return (
    <div className="text-center text-[12px] text-ink-2">
      <div className="flex h-14 items-end justify-center border-b border-ink-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- object/signed URL */}
        {url && <img src={url} alt={`ลายมือชื่อ ${name ?? ""}`} className="max-h-14" />}
      </div>
      <p className="mt-2 text-ink">({name || "................................................"})</p>
      <p>{role}</p>
      <p className="mt-1 text-ink-3">{date ? `วันที่ ${thDate(date.slice(0, 10))}` : "วันที่ ........../........../.........."}</p>
    </div>
  );
}

export const thDT = (iso: string) => `${thDate(iso.slice(0, 10))} ${iso.length > 10 ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""}`.trim();

/** Small "back" link used on detail pages */
export function Back({ href, label = "กลับ" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
      <ArrowLeft {...I} />
      {label}
    </Link>
  );
}
