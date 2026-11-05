import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SubcontractorDetail } from "@/components/contracts/subcontractors-view";

export default function SubcontractorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "ผู้รับเหมาช่วง", href: "/subcontractors" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubcontractorDetail id={decodeURIComponent(id)} />;
}
