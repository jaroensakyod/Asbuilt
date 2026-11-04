import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PurchasingView } from "@/components/procurement/purchasing-view";

export default function PurchasingPage() {
  return (
    <Page trail={[{ label: "จัดซื้อ/คลัง" }, { label: "จัดซื้อ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <PurchasingView />
      </Suspense>
    </Page>
  );
}
