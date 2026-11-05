import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PermitDetail } from "@/components/design/permit-detail";

export default function PermitPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "ออกแบบ" }, { label: "ขออนุญาตก่อสร้าง", href: "/permits" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <PermitDetail projectId={decodeURIComponent(projectId)} />;
}
