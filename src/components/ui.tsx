import type { ReactNode } from "react";
import Link from "next/link";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Signature detail: the asset tag riveted onto every piece of equipment */
export function AssetTag({ code, href }: { code: string; href?: string }) {
  const body = (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-[4px] border border-line-strong bg-raised pl-1.5 pr-2 font-mono text-[12px] leading-none text-ink">
      <span aria-hidden className="size-[5px] rounded-full border border-ink-3/60 bg-card" />
      {code}
    </span>
  );
  return href ? (
    <Link href={href} className="transition-opacity duration-150 hover:opacity-70">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </section>
  );
}

export function CardHead({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {meta && <span className="font-mono text-[12px] text-ink-3">{meta}</span>}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        {eyebrow && <p className="mb-1 text-[13px] text-ink-3">{eyebrow}</p>}
        <h1 className="text-[30px] font-normal leading-[1.15]">{title}</h1>
        {sub && <p className="mt-2 max-w-[44rem] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Button({ children, primary, href }: { children: ReactNode; primary?: boolean; href?: string }) {
  const cls = cx(
    "inline-flex h-9 items-center gap-2 rounded-[8px] px-4 text-[14px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.98]",
    primary ? "bg-ink text-card hover:bg-[#3a332b]" : "border border-line-strong bg-card text-ink hover:bg-raised",
  );
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

export function Stat({ label, value, unit, note }: { label: string; value: string | number; unit?: string; note?: ReactNode }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-[30px] font-medium leading-none">{value}</span>
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-[13px] text-ink-3">{note}</p>}
    </Card>
  );
}

type Tone = "neutral" | "accent" | "pos" | "neg" | "warn";
const DOT: Record<Tone, string> = {
  neutral: "bg-ink-3",
  accent: "bg-accent",
  pos: "bg-pos",
  neg: "bg-neg",
  warn: "bg-warn",
};

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return <span aria-hidden className={cx("inline-block size-1.5 shrink-0 rounded-full", DOT[tone])} />;
}

export function Status({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/** Actual progress with a tick at the planned value */
export function PlanBar({ actual, plan }: { actual: number; plan: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-raised">
      <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${actual}%` }} />
      <div className="absolute -top-1 h-3.5 w-px bg-ink" style={{ left: `${plan}%` }} />
    </div>
  );
}

export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong bg-card px-1 font-mono text-[11px] text-ink-2 shadow-[0_1px_0_var(--line-strong)]">
      {children}
    </kbd>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      {label}
      {children}
    </label>
  );
}

export const inputCls =
  "h-9 rounded-[8px] border border-line-strong bg-card px-3 text-[14px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-ink-3";
