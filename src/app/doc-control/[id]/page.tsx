import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { DocDetail } from "@/components/engineering/doc-detail";

export default function DocControlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ทะเบียนแบบ & เอกสาร", href: "/doc-control" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocDetail id={decodeURIComponent(id)} />;
}
