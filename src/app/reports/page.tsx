import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui";
import { PrintStyles } from "@/components/dashboard/print";
import { ReportsView } from "./reports-view";

export default function ReportsPage() {
  return (
    <Page trail={[{ label: "ข้อมูล" }, { label: "รายงาน" }]}>
      <PrintStyles />
      <PageHeader title="รายงาน" sub="รายงานสรุปจากข้อมูลโครงการ การตรวจ แจ้งซ่อม บำรุงรักษา และสัญญา เลือกช่วงเวลา พิมพ์ หรือส่งออกเป็น CSV" />
      <Suspense fallback={<div className="h-[640px] rounded-[14px] border border-line bg-card" />}>
        <ReportsView />
      </Suspense>
    </Page>
  );
}
