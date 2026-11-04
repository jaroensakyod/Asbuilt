import { Page } from "@/components/shell/topbar";
import { WorkOrdersView } from "@/components/ops/work-orders-view";

export default function WorkOrders() {
  return (
    <Page trail={[{ label: "งานปฏิบัติการ" }, { label: "ใบสั่งงาน" }]}>
      <WorkOrdersView />
    </Page>
  );
}
