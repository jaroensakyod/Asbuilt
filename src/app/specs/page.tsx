import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SpecsView } from "@/components/design/specs-view";

export default function SpecsPage() {
  return (
    <Page trail={[{ label: "ออกแบบ" }, { label: "รายการประกอบแบบ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SpecsView />
      </Suspense>
    </Page>
  );
}
