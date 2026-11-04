import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { WorkOrderDetail } from "@/components/ops/work-order-detail";
import { SEED_WORK_ORDER_IDS } from "@/components/ops/seed";

export function generateStaticParams() {
  return SEED_WORK_ORDER_IDS.map((id) => ({ id }));
}

export default function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <WorkOrderScreen params={params} />
    </Suspense>
  );
}

async function WorkOrderScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page trail={[{ label: "ใบสั่งงาน", href: "/work-orders" }, { label: `ใบสั่งงาน ${id}` }]}>
      <WorkOrderDetail id={id} />
    </Page>
  );
}
