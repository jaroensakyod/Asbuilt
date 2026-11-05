import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SuppliersView } from "@/components/procurement/suppliers-view";

export default function SuppliersPage() {
  return (
    <Page trail={[{ label: "จัดซื้อ/คลัง" }, { label: "ผู้ขาย & ผู้รับเหมาช่วง" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SuppliersView />
      </Suspense>
    </Page>
  );
}
