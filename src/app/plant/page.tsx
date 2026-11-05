import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PlantView } from "@/components/plant/plant-view";

export default function PlantPage() {
  return (
    <Page trail={[{ label: "หน้างาน" }, { label: "เครื่องจักร" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <PlantView />
      </Suspense>
    </Page>
  );
}
