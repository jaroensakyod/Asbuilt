import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { QuoteDetail } from "@/components/sales/quote-detail";

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "การขาย" }, { label: "ใบเสนอราคา", href: "/quotes" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuoteDetail id={decodeURIComponent(id)} />;
}
