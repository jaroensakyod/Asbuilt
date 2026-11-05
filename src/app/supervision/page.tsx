import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SupervisionView } from "@/components/engineering/supervision-view";

export default function SupervisionPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ควบคุมงาน & ใบอนุญาต" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SupervisionView />
      </Suspense>
    </Page>
  );
}
