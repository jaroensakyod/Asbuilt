import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SafetyView } from "@/components/safety/safety-view";

export default function SafetyPage() {
  return (
    <Page trail={[{ label: "หน้างาน" }, { label: "ความปลอดภัย" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SafetyView />
      </Suspense>
    </Page>
  );
}
