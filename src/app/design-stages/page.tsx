import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { DesignStagesView } from "@/components/design/stages-view";

export default function DesignStagesPage() {
  return (
    <Page trail={[{ label: "ออกแบบ" }, { label: "ขั้นตอนออกแบบ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <DesignStagesView />
      </Suspense>
    </Page>
  );
}
