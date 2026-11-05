import { Page } from "@/components/shell/topbar";
import { ServiceContractsView } from "@/components/field/service-contracts-view";

export default function ServiceContractsPage() {
  return (
    <Page trail={[{ label: "งานบริการ" }, { label: "สัญญาบริการ" }]}>
      <ServiceContractsView />
    </Page>
  );
}
