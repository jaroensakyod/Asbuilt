import { Page } from "@/components/shell/topbar";
import { QuotesView } from "@/components/sales/quotes-view";

export default function QuotesPage() {
  return (
    <Page trail={[{ label: "การขาย" }, { label: "ใบเสนอราคา" }]}>
      <QuotesView />
    </Page>
  );
}
