import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { ProjectSchedule } from "@/components/schedule/project-view";

export default function ProjectSchedulePage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "แผนงาน & ความคืบหน้า" }, { label: "แผนงานทุกโครงการ", href: "/schedule" }, { label: "แผนงานโครงการ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectSchedule id={decodeURIComponent(projectId)} />;
}
