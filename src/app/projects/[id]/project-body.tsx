"use client";

import { Page } from "@/components/shell/topbar";
import { getProject } from "@/lib/data";
import { ProjectOverview } from "./project-overview";
import { LocalProject } from "./local-project";

/** Looks the project up in the loaded workspace (demo data or the signed-in company). */
export function ProjectBody({ id }: { id: string }) {
  const project = getProject(id);
  return (
    <Page trail={[{ label: "โครงการ", href: "/projects" }, { label: project?.id ?? id }]}>
      {project ? <ProjectOverview project={project} /> : <LocalProject id={id} />}
    </Page>
  );
}
