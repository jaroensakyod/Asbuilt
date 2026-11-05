"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/components/ui";
import { Pill, type Tone } from "@/components/ops/bits";
import { money, type SupplierBill } from "@/lib/biz";
import { projects as seedProjects, type Project } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useMe } from "@/lib/use-me";
import { canApprove, canView, levelOf } from "@/lib/permissions";
import { PO_STATUS_LABEL, PR_STATUS_LABEL, type POStatus, type PRStatus } from "@/lib/procurement";

export function useProcPerms() {
  const me = useMe();
  const lvl = levelOf(me.role, "purchasing");
  return {
    me,
    /** money columns (prices, totals, costs) */
    money: canView(me.role, "costs"),
    /** create PR / receive goods (own records level included) */
    request: lvl === "o" || lvl === "e" || lvl === "a",
    /** run RFQ, issue PO, bills, stock moves */
    edit: lvl === "e" || lvl === "a",
    approve: canApprove(me.role, "purchasing"),
  };
}

export function useProjects(): Project[] {
  const local = useLocalProjects();
  return useMemo(() => [...local, ...seedProjects], [local]);
}

export const fmt = (n: number) => money(n);
export const fmt0 = (n: number) => Math.round(n).toLocaleString("th-TH");
export const fmtM = (n: number) => `${(n / 1e6).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** amount or a dash when the role may not see money */
export function Amt({ n, show, className, zero = "–" }: { n: number; show: boolean; className?: string; zero?: string }) {
  if (!show) return <span className={cx("font-mono text-ink-3", className)}>•••</span>;
  return <span className={cx("num font-mono tabular-nums", n < 0 && "text-neg", className)}>{n === 0 ? zero : fmt(n)}</span>;
}

export const PO_TONE: Record<POStatus, Tone> = { pending: "warn", approved: "accent", partial: "accent", received: "pos", rejected: "neg", cancelled: "neutral" };
export const PR_TONE: Record<PRStatus, Tone> = { submitted: "warn", rfq: "accent", ordered: "pos", rejected: "neg" };
export const BILL_LABEL: Record<SupplierBill["status"], string> = { open: "รออนุมัติจ่าย", approved: "อนุมัติจ่ายแล้ว", paid: "จ่ายแล้ว" };
export const BILL_TONE: Record<SupplierBill["status"], Tone> = { open: "warn", approved: "accent", paid: "pos" };

export function POStatusPill({ s }: { s: POStatus }) {
  return <Pill tone={PO_TONE[s]}>{PO_STATUS_LABEL[s]}</Pill>;
}
export function PRStatusPill({ s }: { s: PRStatus }) {
  return <Pill tone={PR_TONE[s]}>{PR_STATUS_LABEL[s]}</Pill>;
}

export function DocLink({ id, href }: { id: string; href?: string }) {
  return (
    <Link href={href ?? `/purchasing/${id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] text-accent-text hover:underline">
      {id}
    </Link>
  );
}

export function Section({ title, meta, action, children, className }: { title: string; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-medium">{title}</h2>
          {meta && <span className="font-mono text-[12px] text-ink-3">{meta}</span>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export const th = "py-2.5 pr-4 text-[13px] font-normal text-ink-3";
export const td = "py-2.5 pr-4 align-top";

export function Stars({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`${v.toFixed(1)} / 5`}>
      <span className="relative h-1.5 w-12 rounded-full bg-raised">
        <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${(Math.max(0, Math.min(5, v)) / 5) * 100}%` }} />
      </span>
      <span className="num font-mono text-[12px] text-ink-2">{v.toFixed(1)}</span>
    </span>
  );
}

/** "฿1,234,567" without decimals */
export const baht = (n: number) => `฿${fmt0(n)}`;
