"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx, PageHeader } from "@/components/ui";
import { Page } from "@/components/shell/topbar";

export const ACC_TABS: { href: string; label: string; group: string }[] = [
  { href: "/accounting", label: "ภาพรวม", group: "งานประจำวัน" },
  { href: "/accounting/sales", label: "ขาย & ลูกหนี้", group: "งานประจำวัน" },
  { href: "/accounting/purchases", label: "ซื้อ & เจ้าหนี้", group: "งานประจำวัน" },
  { href: "/accounting/expenses", label: "ค่าใช้จ่าย", group: "งานประจำวัน" },
  { href: "/accounting/cash", label: "เงินสด/ธนาคาร", group: "งานประจำวัน" },
  { href: "/accounting/tax", label: "ภาษี", group: "งานประจำวัน" },
  { href: "/accounting/journal", label: "สมุดรายวัน", group: "บัญชี" },
  { href: "/accounting/ledger", label: "แยกประเภท", group: "บัญชี" },
  { href: "/accounting/trial-balance", label: "งบทดลอง", group: "บัญชี" },
  { href: "/accounting/profit-loss", label: "งบกำไรขาดทุน", group: "งบการเงิน" },
  { href: "/accounting/balance-sheet", label: "งบแสดงฐานะการเงิน", group: "งบการเงิน" },
  { href: "/accounting/assets", label: "สินทรัพย์ถาวร", group: "ตั้งค่า & ปิดงวด" },
  { href: "/accounting/accounts", label: "ผังบัญชี", group: "ตั้งค่า & ปิดงวด" },
  { href: "/accounting/close", label: "ปิดงวด", group: "ตั้งค่า & ปิดงวด" },
];

export function AccFrame({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const groups = [...new Set(ACC_TABS.map((t) => t.group))];
  return (
    <Page trail={[{ label: "บัญชี/การเงิน", href: "/accounting" }, { label: title }]}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[188px_minmax(0,1fr)]">
        <nav aria-label="เมนูบัญชี" className="ops-noprint print:hidden">
          <div className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:gap-0">
            {groups.map((g) => (
              <div key={g} className="flex shrink-0 gap-1 lg:mb-4 lg:flex-col lg:gap-0.5">
                <p className="hidden px-3 pb-1 text-[12px] text-ink-3 lg:block">{g}</p>
                {ACC_TABS.filter((t) => t.group === g).map((t) => {
                  const active = path === t.href;
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[14px] transition-colors duration-150",
                        active ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised/60 hover:text-ink",
                      )}
                    >
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">
          <div className="ops-noprint">
            <PageHeader title={title} sub={sub} actions={actions} />
          </div>
          {children}
        </div>
      </div>
    </Page>
  );
}
