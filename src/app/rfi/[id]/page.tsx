import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { RfiDetail } from "@/components/engineering/rfi-detail";

export default function RfiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "RFI ถาม-ตอบแบบ", href: "/rfi" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RfiDetail id={decodeURIComponent(id)} />;
}
