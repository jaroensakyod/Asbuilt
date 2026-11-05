import { Page } from "@/components/shell/topbar";
import { LeadsView } from "@/components/sales/leads-view";

export default function SalesPage() {
  return (
    <Page trail={[{ label: "การขาย" }, { label: "ลูกค้า & ลีด" }]}>
      <LeadsView />
    </Page>
  );
}
