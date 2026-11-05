import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SelectionsView } from "@/components/interior/selections-view";

export default function SelectionsPage() {
  return (
    <Page trail={[{ label: "ตกแต่งภายใน" }, { label: "ลูกค้าเลือกวัสดุ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SelectionsView />
      </Suspense>
    </Page>
  );
}
