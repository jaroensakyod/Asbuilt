import type { ReactNode } from "react";
import { COMPANY_INFO } from "@/lib/data";

/** Company letterhead for printable documents */
export function DocHeader({ title, titleEn, code, meta }: { title: string; titleEn: string; code: string; meta: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
      <div className="flex gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-ink font-mono text-[15px] text-card">AB</span>
        <div className="text-[12px] leading-[18px] text-ink-2">
          <p className="text-[16px] font-medium leading-[22px] text-ink">{COMPANY_INFO.name}</p>
          <p className="text-ink-3">{COMPANY_INFO.nameEn}</p>
          <p>{COMPANY_INFO.address}</p>
          <p>
            โทร {COMPANY_INFO.phone} · สายด่วน {COMPANY_INFO.hotline} · LINE {COMPANY_INFO.line}
          </p>
          <p>
            เลขประจำตัวผู้เสียภาษี <span className="font-mono">{COMPANY_INFO.taxId}</span>
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right text-[12px] leading-[18px] text-ink-2">
        <p className="text-[17px] font-medium leading-[24px] text-ink">{title}</p>
        <p className="text-ink-3">{titleEn}</p>
        <p className="mt-2 inline-block rounded-[6px] border border-ink px-2 py-0.5 font-mono text-[13px] text-ink">{code}</p>
        <div className="mt-2">{meta}</div>
      </div>
    </header>
  );
}

export function DocSection({ n, title, en, children }: { n: number; title: string; en: string; children: ReactNode }) {
  return (
    <section className="avoid-break mt-5">
      <div className="flex items-center justify-between rounded-[6px] bg-ink px-3 py-1.5 text-[13px] font-medium text-card">
        <span>
          {n}. {title}
        </span>
        <span className="font-mono text-[11px]">{en}</span>
      </div>
      <div className="pt-2">{children}</div>
    </section>
  );
}

export function DocRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-line py-1.5 text-[13px]">
      <span className="text-ink-3">{k}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function Signatures({ roles }: { roles: { role: string; name?: string }[] }) {
  return (
    <div className="avoid-break mt-10 grid gap-8" style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))` }}>
      {roles.map((r) => (
        <div key={r.role} className="text-center text-[12px] text-ink-2">
          <div className="h-12 border-b border-ink-3" />
          <p className="mt-2 text-ink">({r.name ?? "................................................"})</p>
          <p>{r.role}</p>
          <p className="mt-1 text-ink-3">วันที่ ........../........../..........</p>
        </div>
      ))}
    </div>
  );
}
