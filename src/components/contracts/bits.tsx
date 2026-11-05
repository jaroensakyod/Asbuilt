"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { cx } from "@/components/ui";
import { I, Pill } from "@/components/ops/bits";
import { fmt } from "@/lib/accounting/money";
import type { Tone } from "@/lib/contracts";

export { Btn, Empty, FilterField, I, IconBtn, KV, Meter, Modal, Pill, Segmented, Select, StatCard, useHydrated, areaCls } from "@/components/ops/bits";
export { CsvButton, downloadCsv, Labeled, Num, numInput, PrintSheet, tableCls, td, tdR, th, thR } from "@/components/accounting/bits";

/** Status pill from a label/tone map */
export function StatusPill<K extends string>({ k, labels, tones }: { k: K; labels: Record<K, string>; tones: Record<K, Tone> }) {
  return <Pill tone={tones[k]}>{labels[k]}</Pill>;
}

/** Baht amount, short (no satang) for overview tables */
export function Baht({ v, className, strong }: { v: number; className?: string; strong?: boolean }) {
  return <span className={cx("num font-mono", v < 0 && "text-neg", strong && "font-medium", className)}>{Math.round(v).toLocaleString("th-TH")}</span>;
}
export const millions = (n: number) => (n / 1e6).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = fmt;

/** Configurable legal number: the value plus the reminder to check the latest regulation / contract */
export function CheckNote({ children = "ตรวจสอบกับประกาศล่าสุด" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
      <Info {...I} size={13} />
      {children}
    </span>
  );
}

export function ProjectLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/contracts/${id}`} className="hover:underline">
      {name}
      <span className="block font-mono text-[12px] text-ink-3">{id}</span>
    </Link>
  );
}

/** Header block used by every page of the module */
export function Header({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <p className="mb-1 text-[13px] text-ink-3">{eyebrow}</p>
        <h1 className="text-[30px] font-normal leading-[1.15]">{title}</h1>
        {sub && <div className="mt-2 max-w-[48rem] text-ink-2">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small label/value tile inside cards and modals */
export function Mini({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "neg" | "pos" }) {
  return (
    <div className="rounded-[10px] bg-raised px-3 py-2.5">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className={cx("num mt-1 font-mono text-[15px]", tone === "neg" && "text-neg", tone === "pos" && "text-pos")}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-ink-3">{sub}</p>}
    </div>
  );
}

export const COST_CODE_OPTIONS = (codes: Record<string, string>) =>
  Object.entries(codes).map(([k, v]) => (
    <option key={k} value={k}>
      {k} {v}
    </option>
  ));
