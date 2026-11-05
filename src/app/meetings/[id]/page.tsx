import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { MeetingDetail } from "@/components/engineering/meeting-detail";

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ประชุม", href: "/meetings" }, { label: "รายงานการประชุม" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingDetail id={decodeURIComponent(id)} />;
}
