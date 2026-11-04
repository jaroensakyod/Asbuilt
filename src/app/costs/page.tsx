import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { CostsView } from "@/components/procurement/costs-view";

export default function CostsPage() {
  return (
    <Page trail={[{ label: "ภาพรวม" }, { label: "ต้นทุนโครงการ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <CostsView />
      </Suspense>
    </Page>
  );
}
