import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { MeetingsView } from "@/components/engineering/meetings-view";

export default function MeetingsPage() {
  return (
    <Page trail={[{ label: "วิศวกรรม & คุณภาพ" }, { label: "ประชุม" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <MeetingsView />
      </Suspense>
    </Page>
  );
}
