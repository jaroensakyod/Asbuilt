"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cx } from "@/components/ui";
import { I, IconBtn, type Tone } from "@/components/ops/bits";
import { getProject } from "@/lib/data";
import { canApprove, canEdit, levelOf } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import type { EmpStatus } from "@/lib/hr/types";

export const fmt = (n: number, d = 2) => n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt0 = (n: number) => Math.round(n).toLocaleString("th-TH");

/** "xxxxxxxxx1234" → "•••• 1234" for lists */
export const maskId = (s?: string) => (s ? `•••• ${s.slice(-4)}` : "-");
export const maskAccount = (s?: string) => (s ? `•••-${s.replace(/\D/g, "").slice(-4)}` : "-");

export const siteName = (id?: string) => (id ? (getProject(id)?.name ?? id) : "-");

export const STATUS_TONE: Record<EmpStatus, Tone> = { active: "pos", probation: "warn", suspended: "neutral", resigned: "neutral" };

/** HR access for the current user. Salaries are shown only with full HR view (not "own records"). */
export function useHrAccess() {
  const me = useMe();
  const level = levelOf(me.role, "hr");
  return {
    me,
    showPay: level === "v" || level === "e" || level === "a",
    edit: canEdit(me.role, "hr"),
    approve: canApprove(me.role, "hr"),
    /** foremen key in site attendance even without HR rights */
    attendance: canEdit(me.role, "hr") || me.role === "foreman" || me.role === "pm",
  };
}

const TABS = [
  { href: "/hr", label: "พนักงาน" },
  { href: "/hr/attendance", label: "ลงเวลา & การลา" },
  { href: "/hr/payroll", label: "เงินเดือน & ค่าแรง" },
  { href: "/hr/crew", label: "ค่าแรงเหมา & เบิก" },
  { href: "/hr/skills", label: "ทักษะ & ใบรับรอง" },
  { href: "/hr/camps", label: "แคมป์คนงาน" },
];

export function HrTabs() {
  const path = usePathname();
  return (
    <nav aria-label="เมนูบุคคล" className="hr-noprint mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
      {TABS.map((t) => {
        const on = t.href === "/hr" ? path === "/hr" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[14px] transition-colors duration-150", on ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Underlined sub-tabs inside a page */
export function SubTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="hr-noprint flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          type="button"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cx("h-8 rounded-[8px] px-3 text-[13px] transition-colors duration-150", value === o.key ? "bg-ink text-card" : "text-ink-2 hover:bg-raised hover:text-ink")}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 font-mono text-[12px] opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Right-hand detail drawer */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgb(31_27_22/0.2)] print:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal className="flex h-full w-full max-w-[520px] flex-col border-l border-line bg-card shadow-[0_12px_40px_rgba(31,27,22,0.16)]">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">{title}</div>
          <IconBtn label="ปิด" onClick={onClose}>
            <X {...I} />
          </IconBtn>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[14px] font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Print only `.hr-print`; each `.hr-page` starts on a new sheet. */
export function HrPrintStyle({ size = "A4" }: { size?: "A4" | "A5" }) {
  return (
    <style>{`
@media print {
  @page { size: ${size}; margin: ${size === "A5" ? "8mm" : "12mm"}; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .hr-noprint { display: none !important; }
  .hr-print, .hr-print * { visibility: visible !important; }
  .hr-print { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; padding: 0 !important; }
  .hr-print .hr-page { box-shadow: none !important; border: 0 !important; margin: 0 !important; break-after: page; }
  .hr-print .hr-page:last-child { break-after: auto; }
  .hr-print .avoid-break { break-inside: avoid; }
}
`}</style>
  );
}

export const thBaht = (n: number) => `${fmt(n)} บาท`;

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** "2026-10" → "ตุลาคม 2569" */
export const periodLabel = (p: string) => `${TH_MONTHS[Number(p.slice(5, 7)) - 1]} ${Number(p.slice(0, 4)) + 543}`;

const DIG = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
function readInt(n: number): string {
  if (n === 0) return "";
  if (n >= 1_000_000) return readInt(Math.floor(n / 1_000_000)) + "ล้าน" + readInt(n % 1_000_000);
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const pos = s.length - 1 - i;
    if (!d) continue;
    if (pos === 0 && d === 1 && s.length > 1) out += "เอ็ด";
    else if (pos === 1 && d === 2) out += "ยี่";
    else if (pos === 1 && d === 1) out += "";
    else out += DIG[d];
    out += POS[pos];
  }
  return out;
}
/** 1234.5 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์" */
export function bahtText(x: number) {
  const baht = Math.floor(Math.abs(x));
  const satang = Math.round((Math.abs(x) - baht) * 100);
  if (!baht && !satang) return "ศูนย์บาทถ้วน";
  return (baht ? readInt(baht) + "บาท" : "") + (satang ? readInt(satang) + "สตางค์" : "ถ้วน");
}
