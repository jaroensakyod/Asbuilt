import { Page } from "@/components/shell/topbar";
import { DiaryView } from "@/components/field/diary-view";

export default function DiaryPage() {
  return (
    <Page trail={[{ label: "หน้างาน" }, { label: "รายงานประจำวัน" }]}>
      <DiaryView />
    </Page>
  );
}
