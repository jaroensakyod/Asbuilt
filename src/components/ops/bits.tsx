"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { SYSTEM_LABEL, type Severity, type SystemKey } from "@/lib/data";

export const I = { size: 16, strokeWidth: 1.5 } as const;

export type Tone = "neutral" | "accent" | "pos" | "neg" | "warn";
const PILL: Record<Tone, string> = {
  neutral: "bg-raised text-ink-2",
  accent: "bg-accent-soft text-accent-text",
  pos: "bg-pos-soft text-pos",
  neg: "bg-neg-soft text-neg",
  warn: "bg-warn-soft text-warn",
};

export function Pill({ tone = "neutral", children, mono }: { tone?: Tone; children: ReactNode; mono?: boolean }) {
  return <span className={cx("inline-flex h-5 items-center whitespace-nowrap rounded-[6px] px-1.5 text-[12px] leading-none", PILL[tone], mono && "font-mono")}>{children}</span>;
}

export const SEV_TONE: Record<Severity, Tone> = { high: "neg", medium: "warn", low: "neutral" };

export function SystemPill({ s }: { s: SystemKey }) {
  return <Pill>{SYSTEM_LABEL[s]}</Pill>;
}

/** Clickable stat card: label + number + note, optional extra (mini chart / bar) */
export function StatCard({
  label,
  value,
  unit,
  note,
  extra,
  active,
  onClick,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  extra?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: Tone;
}) {
  const body = (
    <>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={cx("num text-[30px] font-medium leading-none", tone === "neg" && "text-neg")}>{value}</span>
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-[13px] text-ink-3">{note}</p>}
      {extra && <div className="mt-3">{extra}</div>}
    </>
  );
  const cls = cx(
    "rounded-[14px] border bg-card px-5 py-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150",
    active ? "border-ink-3" : "border-line",
    onClick && "hover:border-line-strong",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {body}
    </button>
  ) : (
    <section className={cls}>{body}</section>
  );
}

/** Tiny bar series for stat cards */
export function MiniBars({ values, highlightLast }: { values: number[]; highlightLast?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className={cx("flex-1 rounded-[2px]", highlightLast && i === values.length - 1 ? "bg-accent" : "bg-deep")} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function Meter({ value, mark }: { value: number; mark?: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-raised">
      <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      {mark !== undefined && <div className="absolute -top-1 h-3.5 w-px bg-accent" style={{ left: `${mark}%` }} />}
    </div>
  );
}

/** Two-way view toggle */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="flex h-9 items-center gap-0.5 rounded-[10px] border border-line bg-raised p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cx("flex h-full items-center gap-1.5 rounded-[8px] px-3 text-[13px] transition-colors duration-150", value === o.key ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2 hover:text-ink")}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  primary,
  danger,
  small,
  disabled,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        small ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-[14px]",
        primary ? "bg-ink text-card hover:bg-[#253d5c]" : danger ? "border border-line-strong bg-card text-neg hover:bg-neg-soft" : "border border-line-strong bg-card text-ink hover:bg-raised",
      )}
    >
      {children}
    </button>
  );
}

export function IconBtn({ label, onClick, children, danger }: { label: string; onClick?: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx("inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-raised", danger ? "hover:text-neg" : "hover:text-ink")}
    >
      {children}
    </button>
  );
}

export function Select({ value, onChange, children, label, className }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cx(inputCls, "w-full pr-8", className)}>
      {children}
    </select>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[13px] text-ink-3">{label}</span>
      {children}
    </div>
  );
}

export const areaCls =
  "min-h-[80px] rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[14px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-ink-3";

export function Modal({ open, onClose, title, children, footer, width = 640 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgb(31_27_22/0.28)] px-4 py-12 print:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={title} className="enter w-full rounded-[16px] border border-line bg-card shadow-[0_12px_40px_rgba(31,27,22,0.16)]" style={{ maxWidth: width }}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[16px] font-medium">{title}</h2>
          <IconBtn label="ปิด" onClick={onClose}>
            <X {...I} />
          </IconBtn>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-12 text-center text-[14px] text-ink-3">{children}</p>;
}

export function Initials({ name }: { name: string }) {
  const parts = name.replace(/^คุณ/, "").split(" ");
  const t = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-[12px] text-ink-2">{t}</span>;
}

/** Print only `.ops-print`; everything else on the page is hidden on paper */
export function PrintStyle() {
  return (
    <style>{`
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  body > div > aside, body > div > div > header, .ops-noprint { display: none !important; }
  .ops-print, .ops-print * { visibility: visible !important; }
  .ops-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; }
  .ops-print .avoid-break { break-inside: avoid; }
}
`}</style>
  );
}

export function KV({ k, children, wide }: { k: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cx("grid grid-cols-[120px_1fr] gap-3 border-b border-line py-1.5 text-[13px]", wide && "col-span-2")}>
      <span className="text-ink-3">{k}</span>
      <span className="min-w-0 text-ink">{children}</span>
    </div>
  );
}

const noopSub = () => () => {};
/** false during SSR and hydration, true afterwards (records created in the browser exist only then) */
export function useHydrated() {
  return useSyncExternalStore(noopSub, () => true, () => false);
}
