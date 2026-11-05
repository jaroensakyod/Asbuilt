import { Page } from "@/components/shell/topbar";
import { WarrantyView } from "@/components/field/warranty-view";

export default function WarrantyPage() {
  return (
    <Page trail={[{ label: "งานบริการ" }, { label: "ทะเบียนประกัน" }]}>
      <WarrantyView />
    </Page>
  );
}
