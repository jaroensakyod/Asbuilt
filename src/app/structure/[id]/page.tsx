import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, DraftingCompass, LayoutGrid, TriangleExclamationPoint } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { Status } from "@/components/ui";
import { getProject, projects, repairs, STATUS_LABEL } from "@/lib/data";
import { getModel } from "@/lib/house";
import { projectCard } from "@/lib/viewer-data";
import { StructureViewer } from "./structure-viewer";

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }));
}

export default function StructureModelPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <StructureModel params={params} />
    </Suspense>
  );
}

const btn = "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised";

async function StructureModel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();
  const list = repairs.filter((r) => r.projectId === project.id);
  const model = getModel(project.modelCode);
  const card = projectCard(project, repairs, model.elements);

  return (
    <Page wide trail={[{ label: "Structure 3D", href: "/structure" }, { label: project.id }, { label: `3D · ${project.name}` }]}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-line bg-card px-3 py-2.5">
        <Link href="/structure" aria-label="กลับไปหน้ารวมโมเดล" className="flex size-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-medium leading-tight">
            {project.name} <span className="font-normal text-ink-3">· {project.model}</span>
          </h1>
          <p className="truncate text-[12px] text-ink-3">
            <span className="font-mono">
              {project.id} · {project.modelCode}
            </span>{" "}
            {model.spec.nameTh} · {project.province}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <Status tone={project.status === "delivered" ? "pos" : project.status === "planning" ? "neutral" : "warn"}>{STATUS_LABEL[project.status]}</Status>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-24 rounded-full bg-raised">
              <span className="block h-1.5 rounded-full bg-ink" style={{ width: `${project.actual}%` }} />
            </span>
            <span className="num font-mono">{project.actual}%</span>
          </span>
          <span className="num font-mono text-[12px] text-ink-2">
            {card.built.toLocaleString("th-TH")}/{card.total.toLocaleString("th-TH")} <span className="font-sans text-ink-3">ชิ้นงาน</span>
          </span>
          {card.openRepairs > 0 ? (
            <span className="flex items-center gap-1 rounded-[6px] bg-accent-soft px-2 py-0.5 text-[12px] text-accent-text">
              <TriangleExclamationPoint size={16} strokeWidth={1.5} /> แจ้งซ่อมเปิด {card.openRepairs}
            </span>
          ) : (
            <span className="text-[12px] text-ink-3">ไม่มีแจ้งซ่อมค้าง</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/projects/${project.id}`} className={btn}>
            <Briefcase size={16} strokeWidth={1.5} /> โครงการ
          </Link>
          <Link href={`/blueprint/${project.modelCode}`} className={btn}>
            <LayoutGrid size={16} strokeWidth={1.5} /> แบบ 2D
          </Link>
          <Link href={`/cad/${project.modelCode}`} className={btn}>
            <DraftingCompass size={16} strokeWidth={1.5} /> CAD
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="h-[calc(100vh-160px)] min-h-[560px] rounded-[14px] border border-line bg-raised" />}>
        <StructureViewer project={project} repairs={list} />
      </Suspense>
    </Page>
  );
}
