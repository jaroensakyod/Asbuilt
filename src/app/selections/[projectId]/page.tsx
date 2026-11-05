import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SelectionDetail } from "@/components/interior/selection-detail";

export default function SelectionProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "ตกแต่งภายใน" }, { label: "ลูกค้าเลือกวัสดุ", href: "/selections" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <SelectionDetail projectId={decodeURIComponent(projectId)} />;
}
