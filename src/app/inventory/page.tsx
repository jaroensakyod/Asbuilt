import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { InventoryView } from "@/components/procurement/inventory-view";

export default function InventoryPage() {
  return (
    <Page trail={[{ label: "จัดซื้อ/คลัง" }, { label: "คลังวัสดุ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <InventoryView />
      </Suspense>
    </Page>
  );
}
