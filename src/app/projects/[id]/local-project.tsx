"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLocalProjects } from "@/lib/projects-store";
import { ProjectOverview } from "./project-overview";

const noop = () => () => {};

export function LocalProject({ id }: { id: string }) {
  const list = useLocalProjects();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const project = list.find((p) => p.id === id);

  if (!hydrated) return <div className="h-[60vh]" />;
  if (!project)
    return (
      <div className="py-24 text-center">
        <p className="font-mono text-[13px] text-ink-3">{id}</p>
        <h1 className="mt-2 text-[24px] font-normal">ไม่พบโครงการนี้</h1>
        <p className="mt-2 text-ink-2">โครงการอาจถูกสร้างในเบราว์เซอร์อื่น หรือถูกลบไปแล้ว</p>
        <Link href="/projects" className="mt-6 inline-flex h-9 items-center rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
          กลับไปหน้าโครงการ
        </Link>
      </div>
    );
  return <ProjectOverview project={project} local />;
}
