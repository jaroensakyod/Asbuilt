import { Page } from "@/components/shell/topbar";
import { CashflowView } from "@/components/contracts/cashflow-view";

export default function CashflowPage() {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "กระแสเงินสดโครงการ" }]}>
      <CashflowView />
    </Page>
  );
}
