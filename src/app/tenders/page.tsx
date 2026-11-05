import { Page } from "@/components/shell/topbar";
import { TendersView } from "@/components/tender/tenders-view";

export default function TendersPage() {
  return (
    <Page trail={[{ label: "ประมูลงาน" }, { label: "งานประมูล" }]}>
      <TendersView />
    </Page>
  );
}
