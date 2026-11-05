import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PermitsView } from "@/components/design/permits-view";

export default function PermitsPage() {
  return (
    <Page trail={[{ label: "ออกแบบ" }, { label: "ขออนุญาตก่อสร้าง" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <PermitsView />
      </Suspense>
    </Page>
  );
}
