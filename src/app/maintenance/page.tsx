import { Page } from "@/components/shell/topbar";
import { MaintenanceView } from "@/components/ops/maintenance-view";

export default function Maintenance() {
  return (
    <Page trail={[{ label: "งานปฏิบัติการ" }, { label: "บำรุงรักษาเชิงป้องกัน" }]}>
      <MaintenanceView />
    </Page>
  );
}
