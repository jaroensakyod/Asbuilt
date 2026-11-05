import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { VariationDetail } from "@/components/contracts/variation-detail";

export default function VariationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "งานเปลี่ยนแปลง", href: "/contracts/variations" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VariationDetail id={decodeURIComponent(id)} />;
}
