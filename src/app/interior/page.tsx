import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { InteriorView } from "@/components/interior/interior-view";

export default function InteriorPage() {
  return (
    <Page trail={[{ label: "ตกแต่งภายใน" }, { label: "งานตกแต่งภายใน" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <InteriorView />
      </Suspense>
    </Page>
  );
}
