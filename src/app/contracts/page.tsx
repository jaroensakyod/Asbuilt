import { Page } from "@/components/shell/topbar";
import { ContractsOverview } from "@/components/contracts/overview";

export default function ContractsPage() {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "สัญญาและการเบิกเงิน" }]}>
      <ContractsOverview />
    </Page>
  );
}
