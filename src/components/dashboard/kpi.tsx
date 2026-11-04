import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, cx } from "@/components/ui";

/** Compact stat: label, number, change against a comparison, one supporting line */
export function Kpi({
  label,
  value,
  unit,
  change,
  note,
  href,
  children,
}: {
  label: string;
  value: string | number;
  unit?: string;
  change?: { text: string; tone: "pos" | "neg" | "neutral"; dir?: "up" | "down" };
  note?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  const Icon = change?.dir === "up" ? ArrowUpRight : change?.dir === "down" ? ArrowDownRight : null;
  const body = (
    <Card className={cx("flex h-full flex-col px-4 py-3.5", href && "transition-colors duration-150 group-hover:border-line-strong")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] text-ink-2">{label}</p>
        {change && (
          <span
            className={cx(
              "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-[6px] px-1.5 font-mono text-[11px]",
              change.tone === "pos" ? "bg-pos-soft text-pos" : change.tone === "neg" ? "bg-neg-soft text-neg" : "bg-raised text-ink-2",
            )}
          >
            {Icon && <Icon size={12} strokeWidth={1.5} />}
            {change.text}
          </span>
        )}
      </div>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-[26px] font-medium leading-none">{value}</span>
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-[12px] leading-[18px] text-ink-3">{note}</p>}
      {children && <div className="mt-auto pt-3">{children}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="group block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function MoreLink({ href, children = "ทั้งหมด" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} data-noprint className="flex shrink-0 items-center gap-1 text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
      {children} <ArrowRight size={14} strokeWidth={1.5} />
    </Link>
  );
}

/** Thin labelled meter used inside KPI cards */
export function Meter({ value, label, tone = "ink" }: { value: number; label: string; tone?: "ink" | "accent" | "warn" }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] text-ink-3">
        <span>{label}</span>
        <span className="num font-mono text-ink-2">{Math.round(value)}%</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-raised">
        <div className={cx("h-full rounded-full", tone === "accent" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-ink")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
