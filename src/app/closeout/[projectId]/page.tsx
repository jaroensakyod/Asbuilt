import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { CloseoutDetail } from "@/components/engineering/closeout-detail";

export default function CloseoutDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ส่งมอบงาน", href: "/closeout" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <CloseoutDetail projectId={decodeURIComponent(projectId)} />;
}
