import { Page } from "@/components/shell/topbar";
import { SubcontractorsView } from "@/components/contracts/subcontractors-view";

export default function SubcontractorsPage() {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "ผู้รับเหมาช่วง" }]}>
      <SubcontractorsView />
    </Page>
  );
}
