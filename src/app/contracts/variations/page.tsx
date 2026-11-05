import { Page } from "@/components/shell/topbar";
import { VariationsList } from "@/components/contracts/variations-view";

export default function VariationsPage() {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "งานเปลี่ยนแปลง" }]}>
      <VariationsList />
    </Page>
  );
}
