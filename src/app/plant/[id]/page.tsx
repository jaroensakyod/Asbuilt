import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PlantDetail } from "@/components/plant/plant-detail";

export default function PlantItemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "หน้างาน" }, { label: "เครื่องจักร", href: "/plant" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlantDetail id={decodeURIComponent(id)} />;
}
