import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { LeadDetail } from "@/components/sales/lead-detail";

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "การขาย" }, { label: "ลูกค้า & ลีด", href: "/sales" }, { label: "รายละเอียดลีด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetail id={decodeURIComponent(id)} />;
}
