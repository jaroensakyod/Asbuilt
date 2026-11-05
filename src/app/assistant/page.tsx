import { Page } from "@/components/shell/topbar";
import { AssistantView } from "@/components/ai/chat";

export default function AssistantPage() {
  return (
    <Page trail={[{ label: "ผู้ช่วย AI" }]} wide>
      <div className="-mx-4 -my-4">
        <AssistantView />
      </div>
    </Page>
  );
}
