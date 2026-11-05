import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { QualityView } from "@/components/engineering/quality-view";

export default function QualityPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "คุณภาพ & ผลทดสอบ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <QualityView />
      </Suspense>
    </Page>
  );
}
