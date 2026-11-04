"use client";

// Client page: in live mode it renders the signed-in company's data.
import Link from "next/link";
import { Page } from "@/components/shell/topbar";
import { PageHeader, Status } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { getProject, projects, repairs, STATUS_LABEL } from "@/lib/data";
import { getModel } from "@/lib/house";
import { projectCard } from "@/lib/viewer-data";
import { Gallery } from "./gallery";

const FEATURED = [
  { id: "HC-2026-02", title: "เปรียบเทียบแบบกับหน้างานจริง", query: "?mode=compare&view=slider" },
  { id: "HC-2025-03", title: "คอนโด 6 ชั้น · ไทม์ไลน์ก่อสร้าง", query: "?mode=compare&view=overlay" },
  { id: "HC-2019-11", title: "Heatmap คะแนนตรวจรายห้อง", query: "?mode=heat" },
  { id: "HC-2024-05", title: "พูลวิลล่า · โหมดสมจริง", query: "?mode=real" },
];

export default function StructurePage() {
  const cards = projects.map((p) => projectCard(p, repairs, getModel(p.modelCode).elements));
  const featured = FEATURED.map((f) => ({ ...f, p: getProject(f.id) })).filter((f) => f.p);

  return (
    <Page trail={[{ label: "ดูแบบ" }, { label: "Structure 3D" }]}>
      <PageHeader title="โมเดล 3 มิติ" sub="ทุกหลังในโครงการเปิดดูได้ 4 โหมด สมจริง งานระบบแบบ X-Ray เทียบแบบกับหน้างานตามไทม์ไลน์ และ Heatmap คะแนนตรวจรายห้อง" />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {featured.map(({ id, title, query, p }) => (
          <li key={id}>
            <Link href={`/structure/${id}${query}`} className="group flex h-full items-stretch gap-4 rounded-[14px] border border-line bg-card p-3 transition-colors duration-150 hover:border-line-strong">
              <HouseThumb code={p!.modelCode} className="h-[88px] w-[112px] shrink-0 rounded-[10px]" />
              <div className="min-w-0 py-0.5">
                <p className="text-[14px] font-medium leading-snug">{title}</p>
                <p className="mt-1 truncate text-[13px] text-ink-2">
                  {p!.name} · {p!.model}
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <Status tone={p!.status === "delivered" ? "pos" : "warn"}>{STATUS_LABEL[p!.status]}</Status>
                  <span className="num font-mono text-[12px] text-ink-3">{p!.actual}%</span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Gallery cards={cards} />
    </Page>
  );
}
