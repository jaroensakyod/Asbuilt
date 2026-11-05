"use client";

// Client page: in live mode it lists the signed-in company's projects.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { PageHeader, Status } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { projects, STATUS_LABEL } from "@/lib/data";
import { CATS } from "@/lib/takeoff/types";

export function TakeoffIndex() {
  return (
    <Page trail={[{ label: "การขาย & ประมูล" }, { label: "ถอดปริมาณงาน" }]}>
      <PageHeader
        title="ถอดปริมาณงานสถาปัตย์"
        sub={`นับปริมาณ ${CATS.length} หมวดจากโมเดลบ้านของแต่ละโครงการ ทุกชิ้นมีรหัส แยกชั้นและห้อง ไม่นับซ้ำ พร้อมค่าเผื่อและยอดสั่งซื้อ`}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <span key={c.key} className="rounded-[6px] border border-line bg-card px-2.5 py-1 text-[12px] text-ink-2">
            <span className="font-medium text-ink">{c.prefix}</span> {c.label}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/takeoff/${encodeURIComponent(p.id)}`} className="group flex items-center gap-4 rounded-[14px] border border-line bg-card p-3 transition-colors duration-150 hover:border-line-strong">
              <HouseThumb code={p.modelCode} className="h-[72px] w-[92px] shrink-0 rounded-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{p.name}</p>
                <p className="truncate text-[12px] text-ink-2">
                  {p.model} · {p.floors} ชั้น · {p.area} ตร.ม.
                </p>
                <p className="mt-1.5 flex items-center gap-2">
                  <Status tone={p.status === "delivered" ? "pos" : p.status === "planning" ? "neutral" : "warn"}>{STATUS_LABEL[p.status]}</Status>
                  <span className="font-mono text-[12px] text-ink-3">{p.id}</span>
                </p>
              </div>
              <ArrowRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
