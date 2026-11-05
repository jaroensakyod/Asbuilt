import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SubmittalDetail } from "@/components/engineering/submittal-detail";

export default function SubmittalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ส่งอนุมัติวัสดุ", href: "/submittals" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubmittalDetail id={decodeURIComponent(id)} />;
}
