import { Page } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui";
import { houseModels } from "@/lib/data";
import { ModelCatalog } from "./model-catalog";

export default function ModelsPage() {
  return (
    <Page trail={[{ label: "ภาพรวม" }, { label: "แบบบ้าน" }]}>
      <PageHeader title="แบบบ้าน" sub={`แคตตาล็อกแบบมาตรฐานของบริษัท ${houseModels.length} แบบ พร้อมสเปก ราคา ระยะเวลาก่อสร้าง และโครงการที่สร้างจริง`} />
      <ModelCatalog />
    </Page>
  );
}
