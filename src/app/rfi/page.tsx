import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { RfiView } from "@/components/engineering/rfi-view";

export default function RfiPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "RFI ถาม-ตอบแบบ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <RfiView />
      </Suspense>
    </Page>
  );
}
