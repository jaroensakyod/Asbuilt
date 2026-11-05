"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { TakeoffView } from "@/components/takeoff/takeoff-view";
import { getProject } from "@/lib/data";

export function TakeoffBody({ id }: { id: string }) {
  const project = getProject(id);
  return (
    <Page wide trail={[{ label: "ถอดปริมาณงาน", href: "/takeoff" }, { label: id }]}>
      {project ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Link href="/takeoff" aria-label="กลับไปรายการโครงการ" className="flex size-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-medium leading-tight">ถอดปริมาณงานสถาปัตย์ · {project.name}</h1>
              <p className="truncate text-[12px] text-ink-3">
                <Link href={`/projects/${encodeURIComponent(project.id)}`} className="font-mono hover:text-ink">
                  {project.id}
                </Link>{" "}
                · {project.model} ({project.modelCode}) · {project.province}
              </p>
            </div>
          </div>
          <TakeoffView project={project} />
        </>
      ) : (
        <p className="py-16 text-center text-[14px] text-ink-3">ไม่พบโครงการ {id}</p>
      )}
    </Page>
  );
}
