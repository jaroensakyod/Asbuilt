import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { getProject, projects } from "@/lib/data";
import { ProjectOverview } from "./project-overview";
import { LocalProject } from "./local-project";

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }));
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <ProjectBody params={params} />
    </Suspense>
  );
}

async function ProjectBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(decodeURIComponent(id));
  return (
    <Page trail={[{ label: "โครงการ", href: "/projects" }, { label: project?.id ?? decodeURIComponent(id) }]}>
      {/* Seed projects render on the server; projects created in this browser live in localStorage */}
      {project ? <ProjectOverview project={project} /> : <LocalProject id={decodeURIComponent(id)} />}
    </Page>
  );
}
