import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { EstimatingView } from "@/components/sales/estimating-view";

export default function EstimatingPage() {
  return (
    <Page trail={[{ label: "การขาย" }, { label: "ประเมินราคา & BOQ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <EstimatingView />
      </Suspense>
    </Page>
  );
}
