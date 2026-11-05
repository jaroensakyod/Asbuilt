import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { CampsView } from "@/components/hr/camps-view";

export default function CampsPage() {
  return (
    <Page trail={[{ label: "บัญชี & บุคคล" }, { label: "พนักงาน", href: "/hr" }, { label: "แคมป์คนงาน" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <CampsView />
      </Suspense>
    </Page>
  );
}
