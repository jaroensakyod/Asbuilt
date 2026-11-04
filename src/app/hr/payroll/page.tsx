import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PayrollView } from "@/components/hr/payroll-view";

export default function PayrollPage() {
  return (
    <Page trail={[{ label: "บัญชี & บุคคล" }, { label: "เงินเดือน & ค่าแรง" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <PayrollView />
      </Suspense>
    </Page>
  );
}
