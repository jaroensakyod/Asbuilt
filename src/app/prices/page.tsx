import { Page } from "@/components/shell/topbar";
import { PricesView } from "@/components/sales/prices-view";

export default function PricesPage() {
  return (
    <Page trail={[{ label: "การขาย" }, { label: "ราคาวัสดุตลาด" }]}>
      <PricesView />
    </Page>
  );
}
