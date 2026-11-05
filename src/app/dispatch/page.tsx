import { Page } from "@/components/shell/topbar";
import { DispatchView } from "@/components/field/dispatch-view";

export default function DispatchPage() {
  return (
    <Page trail={[{ label: "งานบริการ" }, { label: "จัดคิวช่าง" }]}>
      <DispatchView />
    </Page>
  );
}
