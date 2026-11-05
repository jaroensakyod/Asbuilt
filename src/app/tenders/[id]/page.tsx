import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { TenderDetail } from "@/components/tender/tender-detail";

export default function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "ประมูลงาน" }, { label: "งานประมูล", href: "/tenders" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TenderDetail id={decodeURIComponent(id)} />;
}
