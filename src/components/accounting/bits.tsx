"use client";

import { useEffect, type ReactNode } from "react";
import { Download, Lock, Printer, X } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { Btn, I, PrintStyle } from "@/components/ops/bits";
import { BOOKS_START, fmt, fmtAcc, periodLabelFull, periodOf, periodsBetween } from "@/lib/accounting/money";
import { toCsv } from "@/lib/accounting/reports";
import { ACC_TODAY } from "@/lib/accounting/store";

export { Btn, Empty, I, Modal, Pill, Select, useHydrated } from "@/components/ops/bits";

/** Right-aligned tabular amount. `acc` shows negatives in parentheses and zero as a dash. */
export function Num({ v, acc, className, strong }: { v: number; acc?: boolean; className?: string; strong?: boolean }) {
  return <span className={cx("num font-mono", v < 0 && "text-neg", strong && "font-medium", className)}>{acc ? fmtAcc(v) : fmt(v)}</span>;
}

export const th = "px-3 py-2 text-left text-[12px] font-normal text-ink-3 whitespace-nowrap";
export const thR = cx(th, "text-right");
export const td = "px-3 py-2 align-top [&_.font-mono]:whitespace-nowrap";
export const tdR = cx(td, "text-right whitespace-nowrap");
export const tableCls = "w-full border-collapse text-[13px] [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tfoot_tr]:border-t [&_tfoot_tr]:border-line-strong";

export function downloadCsv(name: string, rows: unknown[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvButton({ name, rows }: { name: string; rows: () => unknown[][] }) {
  return (
    <Btn small onClick={() => downloadCsv(name, rows())}>
      <Download {...I} />
      CSV
    </Btn>
  );
}
export function PrintButton({ label = "พิมพ์" }: { label?: string }) {
  return (
    <Btn small onClick={() => window.print()}>
      <Printer {...I} />
      {label}
    </Btn>
  );
}

/** Months from the start of the books to today, newest first. */
export const allPeriods = () => periodsBetween(periodOf(BOOKS_START), periodOf(ACC_TODAY)).reverse();

export function PeriodSelect({ value, onChange, allowAll, label = "งวด" }: { value: string; onChange: (v: string) => void; allowAll?: boolean; label?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "pr-8")}>
      {allowAll && <option value="">ทุกงวด</option>}
      {allPeriods().map((p) => (
        <option key={p} value={p}>
          {periodLabelFull(p)}
        </option>
      ))}
    </select>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="ops-noprint flex flex-wrap items-end gap-2 pb-4">{children}</div>;
}

export function LockedNote({ children = "งวดนี้ปิดบัญชีแล้ว รายการแสดงตามที่ปิดงวดไว้ และแก้ไขเอกสารในงวดนี้ไม่ได้" }: { children?: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-[10px] border border-line bg-raised px-3 py-2 text-[13px] text-ink-2">
      <Lock {...I} />
      {children}
    </p>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "neg" | "pos"; children: ReactNode }) {
  const cls = tone === "neg" ? "bg-neg-soft text-neg" : tone === "pos" ? "bg-pos-soft text-pos" : "bg-warn-soft text-warn";
  return <div className={cx("mb-4 rounded-[10px] px-3 py-2 text-[13px]", cls)}>{children}</div>;
}

/** Full-screen sheet for an A4 document; only the sheet prints. */
export function PrintSheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgb(31_27_22/0.28)] px-4 py-8">
      <PrintStyle />
      <div className="ops-noprint mx-auto mb-3 flex max-w-[860px] items-center justify-between">
        <p className="text-[14px] font-medium text-card">{title}</p>
        <div className="flex gap-2">
          <Btn small primary onClick={() => window.print()}>
            <Printer {...I} />
            พิมพ์ / บันทึก PDF
          </Btn>
          <Btn small onClick={onClose}>
            <X {...I} />
            ปิด
          </Btn>
        </div>
      </div>
      <article className="ops-print mx-auto w-full max-w-[860px] rounded-[4px] bg-white px-12 py-10 text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">{children}</article>
    </div>
  );
}

/** Marks a report card as the printable area of the page. */
export function PrintArea({ children }: { children: ReactNode }) {
  return (
    <>
      <PrintStyle />
      <div className="ops-print">{children}</div>
    </>
  );
}

export function Labeled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5 text-[13px] text-ink-2", className)}>
      {label}
      {children}
    </label>
  );
}

export const numInput = cx(inputCls, "num text-right font-mono");
