import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { CrewView } from "@/components/hr/crew-view";

export default function CrewPage() {
  return (
    <Page trail={[{ label: "บัญชี & บุคคล" }, { label: "พนักงาน", href: "/hr" }, { label: "ค่าแรงเหมา & เบิกล่วงหน้า" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <CrewView />
      </Suspense>
    </Page>
  );
}
