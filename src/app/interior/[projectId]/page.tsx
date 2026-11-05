import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { InteriorDetail } from "@/components/interior/interior-detail";

// projectId = interior job id (INT-2026-01) or a house project id linked to one
export default function InteriorProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "ตกแต่งภายใน" }, { label: "งานตกแต่งภายใน", href: "/interior" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <InteriorDetail id={decodeURIComponent(projectId)} />;
}
