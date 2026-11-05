import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { ScheduleOverview } from "@/components/schedule/overview";

export default function SchedulePage() {
  return (
    <Page trail={[{ label: "แผนงาน & ความคืบหน้า" }, { label: "แผนงานทุกโครงการ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <ScheduleOverview />
      </Suspense>
    </Page>
  );
}
