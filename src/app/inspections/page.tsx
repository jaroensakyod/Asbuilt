import { Page } from "@/components/shell/topbar";
import { InspectionsView } from "@/components/ops/inspections-view";

export default function Inspections() {
  return (
    <Page trail={[{ label: "งานปฏิบัติการ" }, { label: "การตรวจสอบงาน" }]}>
      <InspectionsView />
    </Page>
  );
}
