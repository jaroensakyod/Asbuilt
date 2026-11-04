import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { ProjectsView } from "./projects-view";

export default function ProjectsPage() {
  return (
    <Page trail={[{ label: "ภาพรวม" }, { label: "โครงการ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <ProjectsView />
      </Suspense>
    </Page>
  );
}
