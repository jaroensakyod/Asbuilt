"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Box } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { getProject } from "@/lib/data";
import { ModelViewer } from "@/components/model3d/model-viewer";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised";

export function Model3dBody({ id }: { id: string }) {
  const project = getProject(id);
  return (
    <Page wide trail={[{ label: "โครงการ", href: "/projects" }, { label: id, href: `/projects/${encodeURIComponent(id)}` }, { label: "ไฟล์ 3D" }]}>
      {project ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Link href={`/projects/${encodeURIComponent(project.id)}`} aria-label="กลับไปหน้าโครงการ" className="flex size-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-medium leading-tight">ไฟล์ 3D · {project.name}</h1>
              <p className="truncate text-[12px] text-ink-3">
                <span className="font-mono">{project.id}</span> · {project.model} · {project.province}
              </p>
            </div>
            <Link href={`/structure/${encodeURIComponent(project.id)}`} className={`${btn} ml-auto`}>
              <Box size={16} strokeWidth={1.5} /> โมเดลจากระบบ
            </Link>
          </div>
          <WithFile project={project} />
        </>
      ) : (
        <p className="py-16 text-center text-[14px] text-ink-3">ไม่พบโครงการ {id}</p>
      )}
    </Page>
  );
}

const noop = () => () => {};

// read ?file= in the browser only: useSearchParams() on this prerendered route left the page stuck in its Suspense fallback on a direct load
function WithFile({ project }: { project: NonNullable<ReturnType<typeof getProject>> }) {
  const file = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get("file") ?? undefined, () => undefined);
  return <ModelViewer key={file ?? ""} project={project} initialFile={file} />;
}
