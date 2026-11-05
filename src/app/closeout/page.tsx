import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { CloseoutView } from "@/components/engineering/closeout-view";

export default function CloseoutPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ส่งมอบงาน" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <CloseoutView />
      </Suspense>
    </Page>
  );
}
