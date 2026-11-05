"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { canView } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import type { LeadStage, QuoteStatus } from "@/lib/sales/crm";
import type { Tone } from "@/components/ops/bits";

export const I = { size: 16, strokeWidth: 1.5 } as const;

/** Whole baht with thousands separators, no symbol */
export const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");
export const n2 = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** price with sensible decimals: < 100 → 2 decimals */
export const price = (n: number) => (Math.abs(n) < 100 ? n2(n) : n0(n));
export const qty = (n: number) => (Number.isInteger(n) ? n.toLocaleString("th-TH") : n.toLocaleString("th-TH", { maximumFractionDigits: 1 }));
export const pct = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
export const mb = (baht: number, digits = 2) => `${(baht / 1e6).toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ล้าน`;

/** Cost and margin are visible only to roles with access to the costs module */
export function useCostAccess() {
  const me = useMe();
  return { canSeeCost: canView(me.role, "costs"), me };
}

export const STAGE_TONE: Record<LeadStage, Tone> = { new: "accent", contacted: "neutral", viewing: "neutral", quoted: "warn", negotiating: "warn", won: "pos", lost: "neg" };
export const QUOTE_TONE: Record<QuoteStatus, Tone> = { draft: "neutral", sent: "accent", approved: "pos", lost: "neg", expired: "warn" };

/** Small "sample data" marker */
export function SampleTag({ className }: { className?: string }) {
  return <span className={cx("inline-flex h-5 items-center whitespace-nowrap rounded-[6px] border border-dashed border-line-strong px-1.5 text-[11px] leading-none text-ink-3", className)}>ราคาตัวอย่าง</span>;
}

export function Change({ v, threshold }: { v?: number; threshold?: number }) {
  if (v === undefined || !Number.isFinite(v)) return <span className="text-ink-3">–</span>;
  const big = threshold !== undefined && Math.abs(v) * 100 >= threshold;
  return <span className={cx("num font-mono text-[12px]", Math.abs(v) < 0.0005 ? "text-ink-3" : v > 0 ? (big ? "text-neg" : "text-ink-2") : big ? "text-pos" : "text-ink-2")}>{Math.abs(v) < 0.0005 ? "0.0%" : pct(v)}</span>;
}

export function Th({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <th className={cx("whitespace-nowrap px-3 py-2.5 font-normal first:pl-5 last:pr-5", right && "text-right", className)}>{children}</th>;
}
export function Td({ children, right, mono, className, colSpan }: { children?: ReactNode; right?: boolean; mono?: boolean; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx("px-3 py-2.5 align-top first:pl-5 last:pr-5", right && "text-right", mono && "num font-mono text-[12px]", className)}>
      {children}
    </td>
  );
}

export const theadCls = "border-b border-line text-left text-[12px] text-ink-3";
