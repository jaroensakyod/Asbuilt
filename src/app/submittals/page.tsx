import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SubmittalsView } from "@/components/engineering/submittals-view";

export default function SubmittalsPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ส่งอนุมัติวัสดุ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SubmittalsView />
      </Suspense>
    </Page>
  );
}
