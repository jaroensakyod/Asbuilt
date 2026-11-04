import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { InspectionDetail } from "@/components/ops/inspection-detail";
import { SEED_INSPECTION_IDS } from "@/components/ops/seed";

export function generateStaticParams() {
  return SEED_INSPECTION_IDS.map((id) => ({ id }));
}

export default function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <InspectionScreen params={params} />
    </Suspense>
  );
}

async function InspectionScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page trail={[{ label: "การตรวจสอบ", href: "/inspections" }, { label: id }]}>
      <InspectionDetail id={id} />
    </Page>
  );
}
