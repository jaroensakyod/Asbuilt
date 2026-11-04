import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { RepairsView } from "@/components/ops/repairs-view";

export default function Repairs() {
  return (
    <Page trail={[{ label: "งานปฏิบัติการ" }, { label: "แจ้งซ่อม / ปัญหา" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <RepairsView />
      </Suspense>
    </Page>
  );
}
