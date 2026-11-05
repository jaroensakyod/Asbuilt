import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { DesignProjectView } from "@/components/design/stage-detail";

export default function DesignProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "ออกแบบ" }, { label: "ขั้นตอนออกแบบ", href: "/design-stages" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <DesignProjectView projectId={decodeURIComponent(projectId)} />;
}
