import { Page } from "@/components/shell/topbar";
import { BlueprintList } from "@/components/drawing/blueprint-list";

export default function BlueprintPage() {
  return (
    <Page trail={[{ label: "แบบก่อสร้าง" }, { label: "Blueprint" }]}>
      <BlueprintList />
    </Page>
  );
}
