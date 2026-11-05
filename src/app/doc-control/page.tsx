import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { DocControlView } from "@/components/engineering/doc-control-view";

export default function DocControlPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ทะเบียนแบบ & เอกสาร" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <DocControlView />
      </Suspense>
    </Page>
  );
}
